function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function ensureColumn(db, tableName, columnName, definition) {
  const columns = await db.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasColumn = (columns.results || []).some((column) => String(column.name || "") === columnName);
  if (!hasColumn) {
    await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

export async function ensureWebsiteInquiryTable(db) {
  await db.batch([
    db.prepare(`
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
      )
    `),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_hotel_public_inquiries_hotel_id ON hotel_public_inquiries(hotel_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_hotel_public_inquiries_created_at ON hotel_public_inquiries(created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_hotel_public_inquiries_status ON hotel_public_inquiries(inquiry_status)`),
  ]);

  await ensureColumn(db, "hotel_public_inquiries", "public_page_id", "TEXT");
  await ensureColumn(db, "hotel_public_inquiries", "public_page_slug", "TEXT");
  await ensureColumn(db, "hotel_public_inquiries", "hotel_name_snapshot", "TEXT");
  await ensureColumn(db, "hotel_public_inquiries", "page_title_snapshot", "TEXT");
  await ensureColumn(db, "hotel_public_inquiries", "check_in_date", "TEXT");
  await ensureColumn(db, "hotel_public_inquiries", "check_out_date", "TEXT");
  await ensureColumn(db, "hotel_public_inquiries", "total_persons", "INTEGER");
  await ensureColumn(db, "hotel_public_inquiries", "requested_room_type", "TEXT");
  await ensureColumn(db, "hotel_public_inquiries", "inquiry_status", "TEXT NOT NULL DEFAULT 'new'");
  await ensureColumn(db, "hotel_public_inquiries", "source_path", "TEXT");
  await ensureColumn(db, "hotel_public_inquiries", "updated_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
}

export function normalizeInquiryPayload(payload) {
  const hotelId = normalizeText(payload.hotel_id).toLowerCase();
  const guestName = normalizeText(payload.guest_name);
  const guestPhone = normalizeText(payload.guest_phone);
  const guestMessage = normalizeText(payload.guest_message || payload.special_request);
  const checkInDate = normalizeText(payload.check_in_date);
  const checkOutDate = normalizeText(payload.check_out_date);
  const totalPersonsValue = Number(payload.total_persons);
  const requestedRoomType = normalizeText(payload.requested_room_type);

  if (!hotelId || !/^[a-z][a-z0-9]{5,63}$/.test(hotelId)) {
    throw new Error("Valid hotel_id is required.");
  }
  if (!guestName) {
    throw new Error("Guest name is required.");
  }
  if (!guestPhone || guestPhone.replace(/[^0-9]/g, "").length < 10) {
    throw new Error("Valid guest mobile number is required.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkInDate)) {
    throw new Error("Valid check-in date is required.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkOutDate)) {
    throw new Error("Valid check-out date is required.");
  }
  if (checkOutDate <= checkInDate) {
    throw new Error("Check-out date must be after check-in date.");
  }
  if (!Number.isFinite(totalPersonsValue) || totalPersonsValue < 1) {
    throw new Error("Valid number of persons is required.");
  }
  if (!requestedRoomType) {
    throw new Error("Room type is required.");
  }

  return {
    hotelId,
    publicPageId: normalizeText(payload.public_page_id) || null,
    publicPageSlug: normalizeText(payload.public_page_slug) || null,
    hotelNameSnapshot: normalizeText(payload.hotel_name_snapshot) || null,
    pageTitleSnapshot: normalizeText(payload.page_title_snapshot) || null,
    guestName,
    guestPhone,
    checkInDate,
    checkOutDate,
    totalPersons: Math.floor(totalPersonsValue),
    requestedRoomType,
    guestMessage: guestMessage || "No special request",
    inquiryStatus: normalizeText(payload.inquiry_status) || "new",
    sourcePath: normalizeText(payload.source_path) || null,
  };
}
