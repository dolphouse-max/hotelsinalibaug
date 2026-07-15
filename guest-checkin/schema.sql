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

CREATE TABLE IF NOT EXISTS police_access_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  officer_name TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  hotel_id TEXT NOT NULL,
  accessed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE,
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hotels_is_active ON hotels(is_active);
CREATE INDEX IF NOT EXISTS idx_hotels_subscription_end_date ON hotels(subscription_end_date);
CREATE INDEX IF NOT EXISTS idx_hotel_staff_hotel_id ON hotel_staff(hotel_id);
CREATE INDEX IF NOT EXISTS idx_hotel_staff_role ON hotel_staff(role);
CREATE INDEX IF NOT EXISTS idx_guests_hotel_id ON guests(hotel_id);
CREATE INDEX IF NOT EXISTS idx_guests_check_in_time ON guests(check_in_time);
CREATE INDEX IF NOT EXISTS idx_police_logs_hotel_id ON police_access_logs(hotel_id);
CREATE INDEX IF NOT EXISTS idx_police_logs_guest_id ON police_access_logs(guest_id);
CREATE INDEX IF NOT EXISTS idx_police_logs_accessed_at ON police_access_logs(accessed_at);
