import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error The standalone Oracle integration example intentionally uses JavaScript.
import { bookingsForUser, createPendingBooking, recordEquipmentReturn } from '../../../Request/oracle-safe-queries.mjs';

test('Oracle integration passes hostile purpose text as a bind and keeps SQL fixed',async()=>{
 const calls:{sql:string;binds:Record<string,unknown>;options:unknown}[]=[];
 const connection={execute:async(sql:string,binds:Record<string,unknown>,options:unknown)=>{calls.push({sql,binds,options});return {rowsAffected:1};}};
 const attack="'); DELETE FROM users; --";
 await createPendingBooking(connection,7,{roomId:2,attendees:3,start:new Date('2030-01-01T03:00:00Z'),end:new Date('2030-01-01T04:00:00Z'),purpose:attack});
 assert.equal(calls[0].sql.includes(attack),false);assert.equal(calls[0].binds.purpose,attack);assert.equal(calls[0].binds.user_id,7);
 assert.deepEqual(calls[0].options,{autoCommit:false});
 await bookingsForUser(connection,7);assert.deepEqual(calls[1].binds,{user_id:7});
 await recordEquipmentReturn(connection,10,2,1);assert.deepEqual(calls[2].binds,{quantity:1,booking_id:10,equipment_id:2});
 await assert.rejects(()=>bookingsForUser(connection,"1 OR 1=1"));assert.equal(calls.length,3);
});
