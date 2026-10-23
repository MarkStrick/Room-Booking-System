(function (root) {
  'use strict';
  function calculate(people, items) {
    const totals = Object.fromEntries(people.map(person => [person.id, 0]));
    let total = 0;
    for (const item of items) {
      if (!Number.isSafeInteger(item.amount) || item.amount <= 0) throw new Error('ราคาต้องมากกว่าศูนย์และมีทศนิยมไม่เกิน 2 ตำแหน่ง');
      const members = [...new Set(item.members)].filter(id => Object.hasOwn(totals, id));
      if (!members.length) throw new Error('เลือกคนร่วมจ่ายอย่างน้อย 1 คน');
      total += item.amount;
      if (!Number.isSafeInteger(total)) throw new Error('ยอดรวมสูงเกินขอบเขตที่รองรับ');
      const share = Math.floor(item.amount / members.length);
      const remainder = item.amount % members.length;
      members.forEach((id, index) => { totals[id] += share + (index < remainder ? 1 : 0); });
    }
    return { total, totals };
  }
  root.DrinkSplit = { calculate };
})(globalThis);
