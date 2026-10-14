import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASSISTANT_IDLE_MS, clearConversation, conversationExpired, freshConversation, loadConversation, saveConversation, type ChatStorage } from '../apps/web/src/lib/assistant-conversation';
function memory(): ChatStorage {
  const values = new Map<string,string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key,value) => { values.set(key,value); }, removeItem: key => { values.delete(key); } };
}
function savedChat(storage: ChatStorage, now: number, owner='server:1') {
  const chat=freshConversation(owner,now);
  chat.messages=[{id:'q1',sender:'user',text:'วันนี้มีห้องไหนว่างบ้าง',timestamp:'2026-10-14T10:00:00+07:00'}];
  chat.context={date:'2026-10-14',start:'',end:'',endDate:'2026-10-14',capacity:10,amenities:[],building:'',roomQuery:''};
  saveConversation(storage,chat);return chat;
}
test('refresh restores the same conversation, messages and compact context within ten minutes', () => {
  const storage=memory(),now=1000000,chat=savedChat(storage,now);
  const restored=loadConversation(storage,'server:1',now+9*60000);
  assert.equal(restored.id,chat.id);assert.deepEqual(restored.messages,chat.messages);assert.deepEqual(restored.context,chat.context);
});
test('idle timeout clears messages and context at exactly ten minutes, not ten minutes since creation', () => {
  const storage=memory(),now=1000000,chat=savedChat(storage,now);
  assert.equal(conversationExpired(chat,now+ASSISTANT_IDLE_MS-1),false);
  assert.equal(conversationExpired(chat,now+ASSISTANT_IDLE_MS),true);
  chat.lastActivityAt=now+9*60000;saveConversation(storage,chat);
  assert.equal(loadConversation(storage,chat.owner,now+18*60000).id,chat.id,'activity extends the idle deadline');
  const expired=loadConversation(storage,chat.owner,now+19*60000);
  assert.notEqual(expired.id,chat.id);assert.deepEqual(expired.messages,[]);assert.equal(expired.context,undefined);
});
test('users and demo mode have separate conversations and logout clears only its owner', () => {
  const storage=memory(),now=1000000,a=savedChat(storage,now),b=savedChat(storage,now,'server:2');
  assert.deepEqual(loadConversation(storage,'demo:1',now).messages,[]);
  assert.equal(loadConversation(storage,'server:2',now).id,b.id);
  clearConversation(storage,'server:1');
  assert.notEqual(loadConversation(storage,'server:1',now).id,a.id);assert.equal(loadConversation(storage,'server:2',now).id,b.id);
});
test('malformed, future-dated, invalid response or disabled storage starts clean without crashing', () => {
  const storage=memory(),now=1000000,chat=savedChat(storage,now);
  chat.lastActivityAt=now+1;saveConversation(storage,chat);assert.deepEqual(loadConversation(storage,chat.owner,now).messages,[]);
  const key='kku-chat:v1:server:1';storage.setItem(key,'broken JSON');assert.deepEqual(loadConversation(storage,chat.owner,now).messages,[]);
  storage.setItem(key,JSON.stringify({...chat,lastActivityAt:now,messages:[{id:'q1',sender:'bot',text:'bad',timestamp:'2026-10-14T10:00:00+07:00',response:{rooms:'invalid'}}]}));
  assert.deepEqual(loadConversation(storage,chat.owner,now).messages,[]);
  const blocked={getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('blocked');},removeItem:()=>{throw new Error('blocked');}};
  assert.doesNotThrow(()=>saveConversation(blocked,chat));assert.deepEqual(loadConversation(blocked,chat.owner,now).messages,[]);
});
