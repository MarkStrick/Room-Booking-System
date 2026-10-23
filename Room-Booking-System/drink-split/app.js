'use strict';
const $ = selector => document.querySelector(selector);
const KEY = 'chon-kaew-bill-v1';
const palette = [['#f0dcc7','#875b3d'],['#dfe8d5','#536c3a'],['#eedcdb','#975a56'],['#dce6eb','#4c7183'],['#e9e1ee','#7c618d']];
const categories = {
  spirits: { label: 'เหล้า', path: '<path d="M10 3h4v5l3 4v13H7V12l3-4V3Z"/><path d="M7 16h10v6H7M10 6h4"/>' },
  soju: { label: 'โซจู / เบียร์', path: '<path d="M10 3h4v6l3 3v13H7V12l3-3V3Z"/><path d="M7 15h10v7H7M10 6h4"/><path d="m10 18 2 2 2-2"/>' },
  mixer: { label: 'น้ำแข็ง / มิกเซอร์', path: '<path d="m4 10 9-6 10 6v12l-10 5-9-5V10Z"/><path d="m4 10 9 6 10-6M13 16v11M9 7l10 6"/>' },
  food: { label: 'อาหาร / อื่น ๆ', path: '<path d="M4 16h20M6 16a8 8 0 0 1 16 0M5 20h18M14 6V4M7 23h14"/>' }
};
let state = {
  people: [{id:'a',name:'เอ'},{id:'b',name:'บี'},{id:'c',name:'ซี'},{id:'d',name:'ดี'}],
  items: [
    {id:'1',name:'เหล้า 1 ขวด',category:'spirits',amount:60000,members:['a','b']},
    {id:'2',name:'โซจูพีช 2 ขวด',category:'soju',amount:30000,members:['b','c']},
    {id:'3',name:'น้ำแข็ง 2 ถัง',category:'mixer',amount:8000,members:['a','b','c','d']},
    {id:'4',name:'กับแกล้มของชาวแก๊ง',category:'food',amount:40000,members:['a','b','c','d']}
  ]
};
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = amount => (amount/100).toLocaleString('th-TH',{minimumFractionDigits:amount%100 ? 2 : 0,maximumFractionDigits:2});
let storageWarning = '';
try {
  const saved = localStorage.getItem(KEY);
  if (saved) {
    const data = JSON.parse(saved);
    if (!Array.isArray(data.people) || !Array.isArray(data.items) || data.people.length > 100 || data.items.length > 1000) throw Error();
    if (data.people.some(p => typeof p.id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(p.id) || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 30) || new Set(data.people.map(p=>p.id)).size !== data.people.length) throw Error();
    if (data.items.some(i => typeof i.id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(i.id) || typeof i.name !== 'string' || !i.name.trim() || i.name.length > 80 || !Object.hasOwn(categories,i.category) || !Array.isArray(i.members) || !i.members.length || i.members.some(id=>!data.people.some(p=>p.id===id)))) throw Error();
    if(new Set(data.items.map(i=>i.id)).size !== data.items.length) throw Error();
    DrinkSplit.calculate(data.people,data.items);
    state = data;
  }
} catch { storageWarning = 'อ่านบิลที่บันทึกไว้ไม่ได้ กำลังแสดงบิลตัวอย่าง'; }
let noticeTimer;
function notice(message) {
  clearTimeout(noticeTimer);
  $('#notice').textContent=message;
  $('#notice').hidden=false;
  noticeTimer=setTimeout(()=>{$('#notice').hidden=true;},5000);
}
function avatar(person,index) {
  const color=palette[index%palette.length];
  return `<span class="avatar" style="background:${color[0]};color:${color[1]}">${escapeHtml([...person.name][0])}</span>`;
}
function save() {
  try { localStorage.setItem(KEY,JSON.stringify(state)); }
  catch { notice('เบราว์เซอร์บันทึกบิลไม่ได้ อย่าเพิ่งปิดหน้านี้จนกว่าจะคัดลอกสรุป'); $('.local-badge').textContent='บิลนี้ยังไม่ถูกบันทึก'; }
  render();
}
function render() {
  const {total,totals}=DrinkSplit.calculate(state.people,state.items);
  $('#people-count').textContent=`${state.people.length} คน`;
  $('#item-count').textContent=`${state.items.length} รายการ`;
  $('#people-list').innerHTML=state.people.map((p,i)=>`<div class="person">${avatar(p,i)}<span class="person-name">${escapeHtml(p.name)}</span><button class="remove-person" data-remove-person="${p.id}" aria-label="ลบ ${escapeHtml(p.name)}">×</button></div>`).join('') || '<p class="empty-people">เริ่มจากเพิ่มชื่อเพื่อน<br>หรือชื่อของตัวเองได้เลย</p>';
  $('#item-list').innerHTML=state.items.map(item=>`<article class="item"><div class="item-top"><span class="item-icon" aria-hidden="true"><svg viewBox="0 0 28 30">${categories[item.category].path}</svg></span><h3 class="item-title">${escapeHtml(item.name)}</h3><button class="item-price" data-edit="${item.id}" aria-label="แก้ไข ${escapeHtml(item.name)} ราคา ${money(item.amount)} บาท">฿${money(item.amount)} <span aria-hidden="true">✎</span></button><button class="delete-item" data-remove-item="${item.id}" aria-label="ลบรายการ ${escapeHtml(item.name)}">×</button></div><div class="member-chips"><button class="all-members" data-all="${item.id}" aria-label="หาร ${escapeHtml(item.name)} ทุกคน">หารทุกคน</button>${state.people.map(p=>`<button class="member-chip" aria-label="${escapeHtml(p.name)} ร่วมจ่าย ${escapeHtml(item.name)}" aria-pressed="${item.members.includes(p.id)}" data-item="${item.id}" data-member="${p.id}"><span class="check" aria-hidden="true">${item.members.includes(p.id)?'✓':'−'}</span>${escapeHtml(p.name)}</button>`).join('')}</div><p class="share-note">${item.members.length===state.people.length?'หารทุกคน':`หาร ${item.members.length} คน`} · คนละ ฿${money(Math.floor(item.amount/item.members.length))}${item.amount%item.members.length?'–'+money(Math.ceil(item.amount/item.members.length)):''}</p></article>`).join('') || '<div class="empty"><strong>เพิ่มรายการแรกได้เลย</strong>กด “เพิ่มรายการ” หรือเลือกเหล้า โซจู น้ำแข็งด้านบน</div>';
  $('#grand-total').textContent=money(total);
  $('#mobile-total').textContent=`฿${money(total)}`;
  $('#receipt-total').textContent=`฿${money(total)}`;
  $('#summary-meta').textContent=`${state.items.length} รายการ / ${state.people.length} คนร่วมโต๊ะ`;
  $('#summary-list').innerHTML=state.people.map((p,i)=>`<div class="summary-person">${avatar(p,i)}<span class="summary-person-name">${escapeHtml(p.name)}</span><strong>฿${money(totals[p.id])}</strong></div>`).join('') || '<p class="empty-people">เพิ่มเพื่อนเพื่อเริ่มหารบิล</p>';
}
$('#person-form').addEventListener('submit',event=>{
  event.preventDefault();
  const name=$('#person-name').value.trim();
  if (!name) return notice('ใส่ชื่อเพื่อนก่อนนะ');
  if (state.people.some(p=>p.name===name)) return notice('ชื่อนี้มีแล้ว ลองเติมชื่อเล่นหรือเลขท้ายชื่อ');
  if (state.people.length>=100) return notice('บิลหนึ่งรองรับได้สูงสุด 100 คน');
  state.people.push({id:crypto.randomUUID(),name});
  $('#person-name').value=''; save(); $('#person-name').focus();
  if(state.items.length)notice('เพิ่มเพื่อนแล้ว เลือกชื่อในรายการที่เพื่อนร่วมจ่ายได้เลย');
});
$('#people-list').addEventListener('click',event=>{
  const button=event.target.closest('[data-remove-person]'); if(!button)return;
  const id=button.dataset.removePerson;
  if(state.items.some(i=>i.members.includes(id)&&i.members.length===1)) return notice('เพื่อนคนนี้จ่ายคนเดียวบางรายการ แก้คนร่วมจ่ายหรือลบรายการนั้นก่อน');
  state.people=state.people.filter(p=>p.id!==id);
  state.items.forEach(i=>{i.members=i.members.filter(member=>member!==id);});save();
});
let editingId=null;
function openItem(id=null, preset=null){
  if(!state.people.length){notice('เพิ่มชื่อเพื่อนก่อน แล้วค่อยเพิ่มรายการได้เลย');$('#person-name').focus();return;}
  if(!id && state.items.length>=1000) return notice('บิลหนึ่งรองรับได้สูงสุด 1,000 รายการ');
  editingId=id; const item=state.items.find(i=>i.id===id);
  $('#item-form').reset();$('#form-error').textContent='';
  $('#dialog-title').textContent=item?'แก้ไขรายการ':'เพิ่มรายการ';
  $('#item-name').value=item?.name||preset?.name||'';$('#item-price').value=item?(item.amount/100).toFixed(2):'';$('#item-category').value=item?.category||preset?.category||'food';
  $('#member-options').innerHTML=state.people.map(p=>`<label><input type="checkbox" name="member" value="${p.id}" ${!item||item.members.includes(p.id)?'checked':''}>${escapeHtml(p.name)}</label>`).join('');
  $('.field-help').textContent=item?'แตะเลือกคนที่ร่วมจ่ายรายการนี้':'เลือกไว้ทุกคนแล้ว แตะเอาคนที่ไม่ได้กินออกได้';
  $('#item-dialog').showModal();$(preset?'#item-price':'#item-name').focus();
}
$('#add-item').onclick=()=>openItem();$('#add-item-bottom').onclick=()=>openItem();
$('.quick-add').onclick=event=>{const button=event.target.closest('[data-quick]');if(button)openItem(null,{name:button.dataset.name,category:button.dataset.quick});};
$('#select-all-members').onclick=()=>{document.querySelectorAll('input[name="member"]').forEach(input=>{input.checked=true;});};
$('#show-summary').onclick=()=>{const summary=$('#summary');summary.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});summary.focus({preventScroll:true});};
$('#close-dialog').onclick=()=>$('#item-dialog').close();
$('#item-form').addEventListener('submit',event=>{
  event.preventDefault();
  const name=$('#item-name').value.trim();
  const price=$('#item-price').value;
  const amount=Math.round(Number(price)*100);
  const members=[...document.querySelectorAll('input[name="member"]:checked')].map(input=>input.value);
  if(!name || !/^\d+(?:\.\d{1,2})?$/.test(price) || !Number.isSafeInteger(amount) || amount<=0 || amount>999999900 || !members.length){$('#form-error').textContent='ใส่ชื่อ ราคาที่ถูกต้อง และเลือกคนร่วมจ่ายอย่างน้อย 1 คน';return;}
  const item={id:editingId||crypto.randomUUID(),name,category:$('#item-category').value,amount,members};
  if(editingId)state.items=state.items.map(i=>i.id===editingId?item:i);else state.items.push(item);
  save();$('#item-dialog').close();notice(editingId?'แก้ไขรายการแล้ว':'เพิ่มรายการแล้ว');
});
$('#item-list').addEventListener('click',event=>{
  const all=event.target.closest('[data-all]');
  if(all){const item=state.items.find(i=>i.id===all.dataset.all);item.members=state.people.map(p=>p.id);save();document.querySelector(`[data-all="${item.id}"]`)?.focus();return;}
  const chip=event.target.closest('[data-member]');
  if(chip){
    const item=state.items.find(i=>i.id===chip.dataset.item);const member=chip.dataset.member;
    if(item.members.includes(member)){
      if(item.members.length===1)return notice('แต่ละรายการต้องมีคนร่วมจ่ายอย่างน้อย 1 คน');
      item.members=item.members.filter(id=>id!==member);
    }else item.members.push(member);
    save();document.querySelector(`[data-item="${item.id}"][data-member="${member}"]`)?.focus();return;
  }
  const edit=event.target.closest('[data-edit]');if(edit)return openItem(edit.dataset.edit);
  const remove=event.target.closest('[data-remove-item]');if(remove){state.items=state.items.filter(i=>i.id!==remove.dataset.removeItem);save();notice('ลบรายการแล้ว');}
});
$('#copy-summary').onclick=async()=>{
  const {total,totals}=DrinkSplit.calculate(state.people,state.items);
  const text=['ชนแก้ว — สรุปบิลคืนนี้',...state.items.map(i=>`${i.name}: ฿${money(i.amount)} (${state.people.filter(p=>i.members.includes(p.id)).map(p=>p.name).join(', ')})`),'',...state.people.map(p=>`${p.name}: ฿${money(totals[p.id])}`),`รวมทั้งหมด ฿${money(total)}`,'หารเฉพาะรายการที่ร่วมจ่าย'].join('\n');
  try{await navigator.clipboard.writeText(text);notice('คัดลอกสรุปแล้ว ส่งเข้ากลุ่มได้เลย');}
  catch{$('#copy-text').value=text;$('#copy-dialog').showModal();$('#copy-text').select();}
};
$('#close-copy').onclick=()=>$('#copy-dialog').close();
$('#reset').onclick=()=>{if(confirm('เริ่มบิลใหม่? รายชื่อและรายการในบิลปัจจุบันจะถูกล้าง')){state={people:[],items:[]};save();notice('เริ่มบิลใหม่แล้ว เพิ่มชื่อเพื่อนได้เลย');$('#person-name').focus();}};
render();
if(storageWarning)notice(storageWarning);
