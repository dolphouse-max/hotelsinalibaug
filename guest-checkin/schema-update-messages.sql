CREATE TABLE IF NOT EXISTS hotel_message_threads (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  hotel_a_id TEXT NOT NULL,
  hotel_b_id TEXT NOT NULL,
  last_message_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (hotel_a_id <> hotel_b_id),
  FOREIGN KEY (hotel_a_id) REFERENCES hotels(id) ON DELETE CASCADE,
  FOREIGN KEY (hotel_b_id) REFERENCES hotels(id) ON DELETE CASCADE,
  UNIQUE (hotel_a_id, hotel_b_id)
);

CREATE TABLE IF NOT EXISTS hotel_messages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  thread_id TEXT NOT NULL,
  sender_hotel_id TEXT NOT NULL,
  message_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES hotel_message_threads(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hotel_message_reads (
  message_id TEXT NOT NULL,
  hotel_id TEXT NOT NULL,
  read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, hotel_id),
  FOREIGN KEY (message_id) REFERENCES hotel_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hotel_message_threads_hotel_a ON hotel_message_threads(hotel_a_id);
CREATE INDEX IF NOT EXISTS idx_hotel_message_threads_hotel_b ON hotel_message_threads(hotel_b_id);
CREATE INDEX IF NOT EXISTS idx_hotel_message_threads_last_message_at ON hotel_message_threads(last_message_at);
CREATE INDEX IF NOT EXISTS idx_hotel_messages_thread_id ON hotel_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_hotel_messages_created_at ON hotel_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_hotel_message_reads_hotel_id ON hotel_message_reads(hotel_id);
