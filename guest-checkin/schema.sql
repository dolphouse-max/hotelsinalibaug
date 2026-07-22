PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS hotels (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  address TEXT NOT NULL,
  total_rooms INTEGER NOT NULL DEFAULT 0 CHECK (total_rooms >= 0),
  occupied_rooms INTEGER NOT NULL DEFAULT 0 CHECK (occupied_rooms >= 0),
  subscription_start_date TEXT NOT NULL,
  subscription_end_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  encrypted_refresh_token TEXT,
  google_drive_folder_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hotel_staff (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  hotel_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  age INTEGER CHECK (age IS NULL OR age >= 0),
  sex TEXT NOT NULL DEFAULT 'Other',
  working_since_month TEXT,
  working_since_year INTEGER CHECK (working_since_year IS NULL OR working_since_year >= 1900),
  email TEXT,
  phone TEXT NOT NULL,
  whatsapp_phone TEXT,
  address_line_1 TEXT NOT NULL,
  address_city TEXT NOT NULL,
  address_pin_code TEXT NOT NULL,
  vehicle_type TEXT NOT NULL DEFAULT 'None',
  vehicle_number TEXT,
  role TEXT NOT NULL DEFAULT 'staff',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  google_drive_file_id_front TEXT,
  google_drive_file_id_back TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
  UNIQUE (hotel_id, email)
);

CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  hotel_id TEXT NOT NULL,
  name TEXT NOT NULL,
  age INTEGER CHECK (age IS NULL OR age >= 0),
  sex TEXT NOT NULL DEFAULT 'Other',
  total_guests INTEGER NOT NULL DEFAULT 1 CHECK (total_guests >= 1),
  room_number TEXT NOT NULL,
  check_in_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expected_check_out_date TEXT NOT NULL,
  address_line_1 TEXT NOT NULL,
  address_city TEXT NOT NULL,
  address_pin_code TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp_phone TEXT,
  email TEXT,
  vehicle_type TEXT NOT NULL DEFAULT 'None',
  vehicle_number TEXT,
  coming_from TEXT NOT NULL,
  going_to TEXT NOT NULL,
  id_type TEXT NOT NULL,
  id_number TEXT NOT NULL,
  google_drive_file_id_front TEXT,
  google_drive_file_id_back TEXT,
  check_out_time TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS guest_family_members (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  guest_id TEXT NOT NULL,
  hotel_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  age INTEGER CHECK (age IS NULL OR age >= 0),
  sex TEXT NOT NULL DEFAULT 'Other',
  id_type TEXT NOT NULL,
  google_drive_file_id_front TEXT,
  google_drive_file_id_back TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE,
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS police_access_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  officer_name TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  hotel_id TEXT NOT NULL,
  accessed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE,
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hotel_renewal_requests (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  hotel_id TEXT NOT NULL,
  requested_months INTEGER NOT NULL CHECK (requested_months >= 1 AND requested_months <= 24),
  requested_end_date TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed')),
  resolved_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hotel_subscription_payments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  hotel_id TEXT NOT NULL,
  renewal_request_id TEXT,
  amount_paid REAL NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  currency_code TEXT NOT NULL DEFAULT 'INR',
  plan_months INTEGER NOT NULL CHECK (plan_months >= 1 AND plan_months <= 24),
  payment_method TEXT NOT NULL,
  payment_reference TEXT,
  payment_date TEXT NOT NULL,
  period_start_date TEXT NOT NULL,
  period_end_date TEXT NOT NULL,
  note TEXT,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
  FOREIGN KEY (renewal_request_id) REFERENCES hotel_renewal_requests(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS hotel_future_reservations (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL,
  booking_type TEXT NOT NULL DEFAULT 'future',
  booking_source TEXT NOT NULL DEFAULT 'direct',
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  total_guests INTEGER NOT NULL DEFAULT 1 CHECK (total_guests >= 1),
  room_count INTEGER NOT NULL DEFAULT 1 CHECK (room_count >= 1),
  check_in_date TEXT NOT NULL,
  check_out_date TEXT NOT NULL,
  room_plan TEXT,
  advance_payment REAL NOT NULL DEFAULT 0 CHECK (advance_payment >= 0),
  booking_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hotel_future_reservations_hotel_id ON hotel_future_reservations(hotel_id);
CREATE INDEX IF NOT EXISTS idx_hotel_future_reservations_dates ON hotel_future_reservations(check_in_date, check_out_date);

CREATE TABLE IF NOT EXISTS super_admin_proof_access_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  viewer_name TEXT NOT NULL,
  access_reason TEXT NOT NULL,
  hotel_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  document_side TEXT NOT NULL CHECK (document_side IN ('front', 'back')),
  accessed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS hotel_public_pages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  hotel_id TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'hotel' CHECK (category IN ('resort', 'hotel', 'cottage', 'homestay')),
  slug TEXT NOT NULL UNIQUE,
  public_title TEXT NOT NULL,
  meta_title TEXT NOT NULL,
  meta_description TEXT NOT NULL,
  hero_heading TEXT NOT NULL,
  hero_subheading TEXT,
  short_description TEXT NOT NULL,
  full_description TEXT NOT NULL,
  contact_person_name TEXT,
  address_line_1 TEXT,
  address_village TEXT,
  address_taluka TEXT,
  address_district TEXT,
  address_pincode TEXT,
  primary_phone TEXT,
  secondary_phone TEXT,
  whatsapp_number TEXT,
  inquiry_email TEXT,
  website_url TEXT,
  google_maps_embed_url TEXT,
  google_maps_place_url TEXT,
  latitude REAL,
  longitude REAL,
  check_in_time TEXT,
  check_out_time TEXT,
  room_count_display INTEGER,
  distance_from_beach TEXT,
  distance_from_local_bus_stop TEXT,
  distance_from_alibaug_bus_stand TEXT,
  distance_from_mandwa_jetty TEXT,
  beach_distance_meters INTEGER,
  beach_distance_label TEXT,
  room_types_json TEXT NOT NULL DEFAULT '[]',
  amenities_json TEXT NOT NULL DEFAULT '[]',
  faq_json TEXT NOT NULL DEFAULT '[]',
  nearby_places_json TEXT NOT NULL DEFAULT '[]',
  policies_json TEXT NOT NULL DEFAULT '[]',
  inquiry_whatsapp_prefill TEXT,
  canonical_path TEXT,
  is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  last_reviewed_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hotel_public_page_photos (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  public_page_id TEXT NOT NULL,
  hotel_id TEXT NOT NULL,
  google_drive_file_id TEXT NOT NULL,
  file_name TEXT,
  alt_text TEXT NOT NULL,
  caption TEXT,
  photo_order INTEGER NOT NULL DEFAULT 0,
  is_cover INTEGER NOT NULL DEFAULT 0 CHECK (is_cover IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (public_page_id) REFERENCES hotel_public_pages(id) ON DELETE CASCADE,
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hotel_public_inquiries (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  hotel_id TEXT NOT NULL,
  public_page_id TEXT,
  public_page_slug TEXT,
  hotel_name_snapshot TEXT,
  page_title_snapshot TEXT,
  guest_name TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  check_in_date TEXT,
  check_out_date TEXT,
  total_persons INTEGER,
  requested_room_type TEXT,
  guest_message TEXT NOT NULL,
  inquiry_status TEXT NOT NULL DEFAULT 'new' CHECK (inquiry_status IN ('new', 'reviewed', 'closed')),
  source_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
  FOREIGN KEY (public_page_id) REFERENCES hotel_public_pages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_hotels_is_active ON hotels(is_active);
CREATE INDEX IF NOT EXISTS idx_hotels_subscription_end_date ON hotels(subscription_end_date);
CREATE INDEX IF NOT EXISTS idx_hotel_staff_hotel_id ON hotel_staff(hotel_id);
CREATE INDEX IF NOT EXISTS idx_hotel_staff_role ON hotel_staff(role);
CREATE INDEX IF NOT EXISTS idx_guests_hotel_id ON guests(hotel_id);
CREATE INDEX IF NOT EXISTS idx_guests_check_in_time ON guests(check_in_time);
CREATE INDEX IF NOT EXISTS idx_guest_family_members_guest_id ON guest_family_members(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_family_members_hotel_id ON guest_family_members(hotel_id);
CREATE INDEX IF NOT EXISTS idx_police_logs_hotel_id ON police_access_logs(hotel_id);
CREATE INDEX IF NOT EXISTS idx_police_logs_guest_id ON police_access_logs(guest_id);
CREATE INDEX IF NOT EXISTS idx_police_logs_accessed_at ON police_access_logs(accessed_at);
CREATE INDEX IF NOT EXISTS idx_renewal_requests_hotel_id ON hotel_renewal_requests(hotel_id);
CREATE INDEX IF NOT EXISTS idx_renewal_requests_status ON hotel_renewal_requests(status);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_hotel_id ON hotel_subscription_payments(hotel_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_payment_date ON hotel_subscription_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_super_admin_proof_logs_hotel_id ON super_admin_proof_access_logs(hotel_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_proof_logs_guest_id ON super_admin_proof_access_logs(guest_id);
CREATE INDEX IF NOT EXISTS idx_app_notifications_created_at ON app_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_app_notifications_audience_type ON app_notifications(audience_type);
CREATE INDEX IF NOT EXISTS idx_hotel_notification_reads_hotel_id ON hotel_notification_reads(hotel_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_hotel_id ON push_subscriptions(hotel_id);
CREATE INDEX IF NOT EXISTS idx_subscription_reminder_deliveries_sent_at ON subscription_reminder_deliveries(sent_at);
CREATE INDEX IF NOT EXISTS idx_hotel_message_threads_hotel_a ON hotel_message_threads(hotel_a_id);
CREATE INDEX IF NOT EXISTS idx_hotel_message_threads_hotel_b ON hotel_message_threads(hotel_b_id);
CREATE INDEX IF NOT EXISTS idx_hotel_message_threads_last_message_at ON hotel_message_threads(last_message_at);
CREATE INDEX IF NOT EXISTS idx_hotel_messages_thread_id ON hotel_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_hotel_messages_created_at ON hotel_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_hotel_message_reads_hotel_id ON hotel_message_reads(hotel_id);
CREATE INDEX IF NOT EXISTS idx_hotel_public_pages_category ON hotel_public_pages(category);
CREATE INDEX IF NOT EXISTS idx_hotel_public_inquiries_hotel_id ON hotel_public_inquiries(hotel_id);
CREATE INDEX IF NOT EXISTS idx_hotel_public_inquiries_created_at ON hotel_public_inquiries(created_at);
CREATE INDEX IF NOT EXISTS idx_hotel_public_inquiries_status ON hotel_public_inquiries(inquiry_status);
CREATE INDEX IF NOT EXISTS idx_hotel_public_pages_published ON hotel_public_pages(is_published);
CREATE INDEX IF NOT EXISTS idx_hotel_public_pages_sort_order ON hotel_public_pages(sort_order);
CREATE INDEX IF NOT EXISTS idx_hotel_public_page_photos_public_page_id ON hotel_public_page_photos(public_page_id);
CREATE INDEX IF NOT EXISTS idx_hotel_public_page_photos_hotel_id ON hotel_public_page_photos(hotel_id);
CREATE INDEX IF NOT EXISTS idx_hotel_public_page_photos_photo_order ON hotel_public_page_photos(photo_order);
