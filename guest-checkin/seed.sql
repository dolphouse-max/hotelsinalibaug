PRAGMA foreign_keys = ON;

DELETE FROM guests;
DELETE FROM hotel_staff;
DELETE FROM hotels;

INSERT INTO hotels (
  id,
  name,
  contact,
  address,
  total_rooms,
  occupied_rooms,
  subscription_start_date,
  subscription_end_date,
  is_active,
  encrypted_refresh_token,
  google_drive_folder_id
)
VALUES
  (
    'hotelalibaug0001',
    'Sea Breeze Alibaug',
    '+91-9876543210',
    'Nagaon Beach Road, Alibaug, Maharashtra',
    18,
    6,
    '2026-01-01',
    '2027-01-01',
    1,
    NULL,
    NULL
  );

INSERT INTO hotel_staff (
  id,
  hotel_id,
  full_name,
  email,
  phone,
  role,
  is_active
)
VALUES
  (
    'staffalibaug0001',
    'hotelalibaug0001',
    'Front Desk Admin',
    'frontdesk@seabreezealibaug.in',
    '+91-9123456780',
    'admin',
    1
  );

INSERT INTO guests (
  id,
  hotel_id,
  name,
  phone,
  id_type,
  id_number,
  check_in_time,
  check_out_time,
  google_drive_file_id
)
VALUES
  (
    'guestalibaug0001',
    'hotelalibaug0001',
    'Rahul Patil',
    '+91-9988776655',
    'aadhaar',
    '1234-5678-9012',
    '2026-07-14 10:30:00',
    NULL,
    NULL
  ),
  (
    'guestalibaug0002',
    'hotelalibaug0001',
    'Aisha Khan',
    '+91-9900112233',
    'passport',
    'N1234567',
    '2026-07-14 12:15:00',
    NULL,
    NULL
  );
