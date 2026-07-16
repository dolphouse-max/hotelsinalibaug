CREATE TABLE IF NOT EXISTS app_notifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'general' CHECK (notification_type IN ('general', 'reminder', 'greeting')),
  audience_type TEXT NOT NULL DEFAULT 'active_hotels' CHECK (audience_type IN ('all_hotels', 'active_hotels', 'expiring_15_days', 'specific_hotel')),
  target_hotel_id TEXT,
  action_url TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (target_hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hotel_notification_reads (
  notification_id TEXT NOT NULL,
  hotel_id TEXT NOT NULL,
  seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id, hotel_id),
  FOREIGN KEY (notification_id) REFERENCES app_notifications(id) ON DELETE CASCADE,
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  hotel_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscription_reminder_deliveries (
  hotel_id TEXT NOT NULL,
  reminder_day INTEGER NOT NULL CHECK (reminder_day IN (15, 7, 3, 1)),
  subscription_end_date TEXT NOT NULL,
  notification_id TEXT,
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (hotel_id, reminder_day, subscription_end_date),
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
  FOREIGN KEY (notification_id) REFERENCES app_notifications(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_created_at ON app_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_app_notifications_audience_type ON app_notifications(audience_type);
CREATE INDEX IF NOT EXISTS idx_hotel_notification_reads_hotel_id ON hotel_notification_reads(hotel_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_hotel_id ON push_subscriptions(hotel_id);
CREATE INDEX IF NOT EXISTS idx_subscription_reminder_deliveries_sent_at ON subscription_reminder_deliveries(sent_at);
