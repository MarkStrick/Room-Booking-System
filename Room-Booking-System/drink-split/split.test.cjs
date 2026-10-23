const assert = require('node:assert/strict');
require('./split.js');
const { calculate } = globalThis.DrinkSplit;
const people = ['a','b','c','d'].map(id => ({id}));
assert.deepEqual(calculate(people,[
  {amount:60000,members:['a','b']},
  {amount:30000,members:['b','c']},
  {amount:8000,members:['a','b','c','d']},
  {amount:40000,members:['a','b','c','d']}
]),{total:138000,totals:{a:42000,b:57000,c:27000,d:12000}});
assert.deepEqual(calculate(people,[{amount:100,members:['a','b','c']}]),{total:100,totals:{a:34,b:33,c:33,d:0}});
assert.deepEqual(calculate(people,[{amount:1,members:['a','b','c']}]),{total:1,totals:{a:1,b:0,c:0,d:0}});
assert.deepEqual(calculate([],[]),{total:0,totals:{}});
assert.throws(()=>calculate(people,[{amount:1,members:[]} ]));
assert.throws(()=>calculate(people,[{amount:1,members:['missing']} ]));
assert.throws(()=>calculate(people,[{amount:-1,members:['a']} ]));
assert.throws(()=>calculate(people,[{amount:1.25,members:['a']} ]));
assert.deepEqual(calculate(people,[{amount:100,members:['a','a','b']}]).totals,{a:50,b:50,c:0,d:0});
for(let amount=1;amount<1000;amount++){
  const result=calculate(people,[{amount,members:people.map(p=>p.id)}]);
  assert.equal(Object.values(result.totals).reduce((a,b)=>a+b,0),amount);
}
console.log('Passed: sample bill, exact cent rounding, invalid input, duplicate members, empty bill, and 999 balance checks.');
