import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateText } from 'ai';
import { createGoogle } from '@ai-sdk/google';
import { SqliteStore } from '../../apps/backend/src/infrastructure/sqlite-store';
import { emptyData } from '../../apps/backend/src/infrastructure/store';
import { createApplication } from '../../apps/backend/src/main';
import { readConfig } from '../../apps/backend/src/common/config';
import { assistantProviderFailure, interpretAssistant, redactAssistantText, reserveAssistantBudget } from '../../apps/backend/src/modules/assistant-service';
import { createSeed } from '../../apps/web/src/lib/seed';
import { emptyIntent } from '../../packages/core/src/assistant';
import { addDays, dateOf, stamp } from '../../packages/core/src/domain';
import { testSession } from './session-fixture';

test('assistant authenticates, checks CSRF, reads latest occupancy and never discloses booking data or writes bookings',async()=>{
  const origin='http://127.0.0.1:5174',c=readConfig({APP_ORIGIN:origin}),data=emptyData();
  data.state={...createSeed(),now:new Date().toISOString(),bookings:[],closures:[],holidays:[]};
  data.state.rooms=data.state.rooms.slice(0,1);
  const room=data.state.rooms[0]; room.status='AVAILABLE'; room.active=true; room.hours={start:'08:00',end:'18:00',weekdays:[0,1,2,3,4,5,6],leadMinutes:0};
  const store=new SqliteStore(':memory:',data),app=await createApplication(store,c);
  await app.listen(0,'127.0.0.1'); const base=await app.getUrl();
  const client=await testSession(store,c,1),other=await testSession(store,c,4);
  const filters={date:addDays(dateOf(new Date().toISOString()),1),start:'10:00',end:'12:00',endDate:addDays(dateOf(new Date().toISOString()),1),capacity:1,amenities:[],building:'',roomQuery:''};
  const body=JSON.stringify({question:'ค้นหาห้องตามเงื่อนไข',filters});
  const call=(headers:Record<string,string>,payload=body)=>fetch(`${base}/api/assistant`,{method:'POST',headers:{'content-type':'application/json',origin,...headers},body:payload});
  const headers={cookie:client.cookie,'x-csrf-token':client.body.csrfToken};
  try {
    assert.equal((await call({})).status,401); assert.equal((await call({cookie:client.cookie})).status,403);
    assert.equal((await call({...headers,origin:'https://evil.example'})).status,403);
    assert.equal((await call(headers,JSON.stringify({question:'x'.repeat(1001)}))).status,400);
    assert.equal((await call(headers,JSON.stringify({question:'ค้นหา',actorId:3}))).status,400);
    assert.equal((await call(headers,JSON.stringify({question:'ค้นหา',filters:{...filters,start:'25:00'}}))).status,400);
    const first=await call(headers); assert.equal(first.status,201); const result=await first.json(); assert.equal(result.total,1); assert.equal(result.mode,'fallback');
    assert.equal((await store.read()).state.bookings.length,0); assert.equal((await store.read()).state.messages.length,data.state.messages.length);
    await store.transaction(d=>{d.state.bookings.push({id:999,ref:'SECRET-BOOKING',userId:4,roomId:room.id,start:stamp(filters.date,'10:00'),end:stamp(filters.date,'12:00'),status:'PENDING',purpose:'SECRET-PURPOSE',participantEmails:['private@example.com'],participants:[],equipment:[],attendees:1,createdAt:new Date().toISOString()});});
    const busy=await (await call(headers)).json(); assert.equal(busy.total,0); assert.doesNotMatch(JSON.stringify(busy),/SECRET|private@example/);
    await store.transaction(d=>{d.state.bookings[0].status='CANCELLED';});
    assert.equal((await (await call(headers)).json()).total,1,'reads updated occupancy on next question');
    await Promise.all(Array.from({length:5},()=>call(headers)));
    const limited=await call(headers); assert.equal(limited.status,429); assert.ok(limited.headers.get('retry-after'));
    assert.equal((await call({cookie:other.cookie,'x-csrf-token':other.body.csrfToken})).status,201,'user budgets are independent');
  } finally { await app.close();await store.close(); }
});
test('shared provider budget survives transactions, limits all users together, and resets next UTC day',async()=>{
  const data=emptyData(),c=readConfig({GEMINI_API_KEY:'test-only-key',ASSISTANT_DAILY_LIMIT:'2'}),now='2026-10-14T12:00:00Z';
  assert.equal(reserveAssistantBudget(data,1,c,now).useGemini,true);
  assert.equal(reserveAssistantBudget(data,2,c,now).useGemini,true);
  assert.equal(reserveAssistantBudget(data,3,c,now).useGemini,false);
  assert.equal(reserveAssistantBudget(data,3,c,'2026-10-15T00:00:00Z').useGemini,true);
  const before=data.attempts.find(a=>a.key==='assistant-provider-day')!.rateCount;
  reserveAssistantBudget(data,4,c,'2026-10-15T00:00:01Z',false);
  assert.equal(data.attempts.find(a=>a.key==='assistant-provider-day')!.rateCount,before,'manual filters do not consume provider quota');
});
test('Gemini only returns validated intent and receives public labels, redacted question, no private database rows',async()=>{
  const state=createSeed(),c=readConfig({GEMINI_API_KEY:'test-only-key'});
  state.users[0].email='SECRET-USER@example.com'; state.bookings[0].purpose='SECRET-PURPOSE';
  const intent={...emptyIntent('search'),date:'2026-10-15',start:'10:00',end:'12:00',capacity:10};
  let prompt='';
  const mock=(async(options:{prompt?:string})=>{prompt=options.prompt??'';return {output:intent};}) as unknown as typeof generateText;
  const response=await interpretAssistant(state,{question:'พรุ่งนี้ 10:00–12:00 มีห้องสำหรับ 10 คนไหม ติดต่อ hello@example.com'},c,true,mock);
  assert.equal(response.mode,'gemini'); assert.equal(response.intent.capacity,10);
  assert.equal(response.reason,'ai');
  assert.doesNotMatch(prompt,/SECRET|hello@example.com|test-only-key/); assert.match(prompt,/\[อีเมล\]/);
  const failure=(async()=>{throw new Error('provider quota exceeded');}) as unknown as typeof generateText;
  const fallback=await interpretAssistant(state,{question:'ยกเลิกการจองอย่างไร?'},c,true,failure);
  assert.equal(fallback.mode,'fallback'); assert.equal(fallback.intent.kind,'faq');
  const invalid=(async()=>({output:{...intent,start:'99:00'}})) as unknown as typeof generateText;
  assert.equal((await interpretAssistant(state,{question:'วันนี้มีห้องไหนว่างบ้าง'},c,true,invalid)).mode,'fallback');
  assert.doesNotMatch(redactAssistantText('hello@example.com 0812345678 1234567890123'),/hello@|0812345678|1234567890123/);
  assert.equal(redactAssistantText('2026-10-15 10:00–12:00'),'2026-10-15 10:00–12:00','redaction must not remove dates or times');
});
test('provider diagnostics classify failures without returning raw messages, credentials or response bodies', () => {
  for (const [status, reason] of [[401,'provider_auth'],[403,'provider_auth'],[404,'model_unavailable'],[429,'provider_quota'],[503,'provider_overloaded']] as const) {
    const error=Object.assign(new Error('SECRET-KEY and private question'),{statusCode:status,responseBody:'SECRET-BODY'});
    assert.deepEqual(assistantProviderFailure(error),{reason,httpStatus:status});
    assert.doesNotMatch(JSON.stringify(assistantProviderFailure(error)),/SECRET|private/);
  }
  assert.equal(assistantProviderFailure(new DOMException('Timeout','TimeoutError')).reason,'provider_timeout');
});
test('installed AI SDK sends Gemini structured-output schema and decodes provider response', async () => {
  const state=createSeed(),c=readConfig({GEMINI_API_KEY:'test-only-key'});
  const expected={...emptyIntent('faq'),faqIndex:1};
  let providerBody='';
  const model=createGoogle({apiKey:'test-only-key',fetch:async (_url,init)=>{
    providerBody=String(init?.body);
    return new Response(JSON.stringify({candidates:[{content:{role:'model',parts:[{text:JSON.stringify(expected)}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:60,totalTokenCount:160}}),{status:200,headers:{'content-type':'application/json'}});
  }})(c.geminiModel);
  const transport=((options:Parameters<typeof generateText>[0])=>generateText({...options,model})) as typeof generateText;
  const result=await interpretAssistant(state,{question:'ยกเลิกการจองอย่างไร?'},c,true,transport);
  assert.equal(result.mode,'gemini');assert.equal(result.intent.faqIndex,1);
  assert.match(providerBody,/application\/json/); assert.match(providerBody,/faqIndex/);
});
