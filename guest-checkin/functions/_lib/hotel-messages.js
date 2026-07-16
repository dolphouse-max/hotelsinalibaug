export async function purgeExpiredHotelMessages(db) {
  await db.prepare(
    `DELETE FROM hotel_message_threads
     WHERE id IN (
       SELECT t.id
       FROM hotel_message_threads t
       LEFT JOIN hotel_messages m ON m.thread_id = t.id
       GROUP BY t.id
       HAVING MAX(m.created_at) IS NULL OR MAX(m.created_at) < datetime('now', '-1 day')
     )`
  ).run();
}
