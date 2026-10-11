// Reusable Oracle integration example. Connection comes from node-oracledb.
// Bind actor IDs from the authenticated server session, never from a body actorId.
// Caller owns commit/rollback; there is no I/O or dynamic SQL inside triggers.
function positiveId(value) {
 if (!Number.isSafeInteger(value) || value <= 0 || value > 2147483647) throw new TypeError('Invalid numeric ID');
 return value;
}
function boundedText(value,max) {
 if (typeof value !== 'string' || !value.trim() || value.length > max) throw new TypeError('Invalid text');
 return value;
}
export async function bookingsForUser(connection,sessionUserId) {
 return connection.execute(
  'SELECT booking_id,booking_status,purpose FROM booking WHERE users_user_id=:user_id ORDER BY created_at DESC',
  {user_id:positiveId(sessionUserId)},{autoCommit:false});
}
export async function createPendingBooking(connection,sessionUserId,input) {
 const userId=positiveId(sessionUserId),roomId=positiveId(input.roomId),attendees=positiveId(input.attendees);
 if (!(input.start instanceof Date) || !(input.end instanceof Date) || !Number.isFinite(input.start.getTime()) || !Number.isFinite(input.end.getTime())) throw new TypeError('Invalid timestamps');
 return connection.execute(
  `INSERT INTO booking(booking_date,start_time,end_time,purpose,booking_status,users_user_id,room_room_id,expected_attendees)
   VALUES(TRUNC(CAST(:start_time AS DATE)),:start_time,:end_time,:purpose,'PENDING',:user_id,:room_id,:attendees)`,
  {start_time:input.start,end_time:input.end,purpose:boundedText(input.purpose,500),user_id:userId,room_id:roomId,attendees},
  {autoCommit:false});
}
export async function recordEquipmentReturn(connection,bookingId,equipmentId,quantity) {
 return connection.execute(
  `UPDATE booking_equipment SET returned_qty=returned_qty+:quantity
   WHERE booking_booking_id=:booking_id AND equipment_equipment_id=:equipment_id AND returned_qty+:quantity<=issued_qty`,
  {quantity:positiveId(quantity),booking_id:positiveId(bookingId),equipment_id:positiveId(equipmentId)},
  {autoCommit:false});
}
