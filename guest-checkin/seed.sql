PRAGMA foreign_keys = ON;

DELETE FROM police_access_logs;
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
  age,
  sex,
  working_since_month,
  working_since_year,
  email,
  phone,
  whatsapp_phone,
  address_line_1,
  address_city,
  address_pin_code,
  vehicle_type,
  vehicle_number,
  role,
  is_active,
  google_drive_file_id_front,
  google_drive_file_id_back
)
VALUES
  (
    'staffalibaug0001',
    'hotelalibaug0001',
    'Front Desk Admin',
    32,
    'Male',
    'March',
    2024,
    'frontdesk@seabreezealibaug.in',
    '+91-9123456780',
    '+91-9123456780',
    'Nagaon Main Road',
    'Alibaug',
    '402201',
    'Motor Bike',
    'MH06AB1234',
    'admin',
    1,
    NULL,
    NULL
  );

INSERT INTO guests (
  id,
  hotel_id,
  name,
  age,
  sex,
  total_guests,
  room_number,
  check_in_time,
  expected_check_out_date,
  address_line_1,
  address_city,
  address_pin_code,
  phone,
  whatsapp_phone,
  email,
  vehicle_type,
  vehicle_number,
  coming_from,
  going_to,
  id_type,
  id_number,
  google_drive_file_id_front,
  google_drive_file_id_back,
  check_out_time
)
VALUES
  (
    'guestalibaug0001',
    'hotelalibaug0001',
    'Rahul Patil',
    35,
    'Male',
    3,
    '205',
    '2026-07-14 10:30:00',
    '2026-07-16',
    'Vashi Sector 17',
    'Navi Mumbai',
    '400703',
    '+91-9988776655',
    '+91-9988776655',
    'rahul@example.com',
    'Car',
    'MH43CD5678',
    'Mumbai',
    'Alibaug',
    'aadhaar',
    '1234-5678-9012',
    NULL,
    NULL,
    NULL
  ),
  (
    'guestalibaug0002',
    'hotelalibaug0001',
    'Aisha Khan',
    29,
    'Female',
    2,
    '104',
    '2026-07-14 12:15:00',
    '2026-07-15',
    'Camp Area',
    'Pune',
    '411001',
    '+91-9900112233',
    '+91-9900112233',
    NULL,
    'None',
    NULL,
    'Pune',
    'Alibaug',
    'passport',
    'N1234567',
    NULL,
    NULL,
    NULL
  );
