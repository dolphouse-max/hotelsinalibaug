function json(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");

  return new Response(JSON.stringify(body), { ...init, headers });
}

function unauthorized() {
  return json({ error: "Unauthorized" }, { status: 401 });
}

function badRequest(message) {
  return json({ error: message }, { status: 400 });
}

function isSafeId(value) {
  return typeof value === "string" && /^[a-z0-9]{16,64}$/i.test(value.trim());
}

function isEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function requireHotelAdmin(request, env) {
  const authHeader = request.headers.get("authorization");

  if (!env.HOTEL_ADMIN_TOKEN || !authHeader?.startsWith("Bearer ")) {
    return false;
  }

  return authHeader.slice("Bearer ".length).trim() === env.HOTEL_ADMIN_TOKEN;
}

function normalizeStaffPayload(payload) {
  const hotelId = typeof payload.hotel_id === "string" ? payload.hotel_id.trim() : "";
  const staffId = typeof payload.staff_id === "string" ? payload.staff_id.trim() : typeof payload.id === "string" ? payload.id.trim() : "";
  const fullName = typeof payload.full_name === "string" ? payload.full_name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
  const role = typeof payload.role === "string" ? payload.role.trim().toLowerCase() : "staff";
  const isActive = payload.is_active === false || payload.is_active === 0 ? 0 : 1;

  if (!isSafeId(hotelId)) {
    throw new Error("Valid hotel_id is required");
  }

  if (!fullName || !isEmail(email)) {
    throw new Error("full_name and a valid email are required");
  }

  if (!["admin", "manager", "frontdesk", "staff"].includes(role)) {
    throw new Error("role must be one of admin, manager, frontdesk, or staff");
  }

  return {
    hotelId,
    staffId,
    fullName,
    email,
    phone,
    role,
    isActive,
  };
}

export async function onRequestGet(context) {
  if (!requireHotelAdmin(context.request, context.env)) {
    return unauthorized();
  }

  const url = new URL(context.request.url);
  const hotelId = url.searchParams.get("hotel_id");

  if (!isSafeId(hotelId)) {
    return badRequest("Valid hotel_id is required");
  }

  const { results } = await context.env.DB.prepare(
    `SELECT
       id,
       hotel_id,
       full_name,
       email,
       phone,
       role,
       is_active,
       created_at,
       updated_at
     FROM hotel_staff
     WHERE hotel_id = ?1
     ORDER BY
       CASE role
         WHEN 'admin' THEN 0
         WHEN 'manager' THEN 1
         WHEN 'frontdesk' THEN 2
         ELSE 3
       END,
       full_name ASC`
  )
    .bind(hotelId.trim())
    .all();

  return json({ ok: true, staff: results || [] });
}

export async function onRequestPost(context) {
  if (!requireHotelAdmin(context.request, context.env)) {
    return unauthorized();
  }

  try {
    const payload = await context.request.json();
    const staff = normalizeStaffPayload(payload);
    const staffId = crypto.randomUUID().replace(/-/g, "");

    const result = await context.env.DB.prepare(
      `INSERT INTO hotel_staff (
         id,
         hotel_id,
         full_name,
         email,
         phone,
         role,
         is_active
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       RETURNING id, hotel_id, full_name, email, phone, role, is_active, created_at, updated_at`
    )
      .bind(staffId, staff.hotelId, staff.fullName, staff.email, staff.phone, staff.role, staff.isActive)
      .first();

    return json({ ok: true, staff: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add staff";
    const status = message.includes("UNIQUE constraint failed") ? 409 : 400;
    return json({ error: message }, { status });
  }
}

export async function onRequestPut(context) {
  if (!requireHotelAdmin(context.request, context.env)) {
    return unauthorized();
  }

  try {
    const payload = await context.request.json();
    const staff = normalizeStaffPayload(payload);

    if (!isSafeId(staff.staffId)) {
      return badRequest("Valid staff_id is required");
    }

    const result = await context.env.DB.prepare(
      `UPDATE hotel_staff
       SET full_name = ?1,
           email = ?2,
           phone = ?3,
           role = ?4,
           is_active = ?5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?6 AND hotel_id = ?7
       RETURNING id, hotel_id, full_name, email, phone, role, is_active, created_at, updated_at`
    )
      .bind(staff.fullName, staff.email, staff.phone, staff.role, staff.isActive, staff.staffId, staff.hotelId)
      .first();

    if (!result) {
      return json({ error: "Staff member not found" }, { status: 404 });
    }

    return json({ ok: true, staff: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update staff";
    const status = message.includes("UNIQUE constraint failed") ? 409 : 400;
    return json({ error: message }, { status });
  }
}

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, POST, PUT, OPTIONS",
    },
  });
