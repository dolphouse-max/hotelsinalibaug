const MSG91_EMAIL_URL = "https://control.msg91.com/api/v5/email/send";
const DEFAULT_TEMPLATE_ID = "checkin_hotel_procedure";

function getMsg91AuthKey(env) {
  return String(env.MSG91_EMAIL_AUTH_KEY || env.MSG91_AUTH_KEY || "").trim();
}

function getMsg91TemplateId(env) {
  return String(env.MSG91_EMAIL_TEMPLATE_ID || DEFAULT_TEMPLATE_ID).trim();
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildHotelAdminUrl(origin, hotelId) {
  const url = new URL("/hotel-admin-home.html", origin);
  url.searchParams.set("hotel_id", hotelId);
  return url.toString();
}

export function validateHotelOnboardingEmailInput(hotel, origin) {
  const normalized = {
    id: normalizeText(hotel?.id).toLowerCase(),
    name: normalizeText(hotel?.name),
    admin_email: normalizeEmail(hotel?.admin_email),
    admin_name: normalizeText(hotel?.admin_name || `${hotel?.name || ""} Admin`),
    origin: normalizeText(origin),
  };

  if (!normalized.id || !normalized.name || !normalized.admin_email || !normalized.origin) {
    throw new Error("Hotel onboarding email needs hotel ID, hotel name, admin email, and origin.");
  }

  return normalized;
}

export async function sendHotelOnboardingEmail(env, hotel, origin) {
  const authKey = getMsg91AuthKey(env);
  const templateId = getMsg91TemplateId(env);

  if (!authKey) {
    return {
      ok: false,
      skipped: true,
      reason: "MSG91 auth key is not configured.",
    };
  }

  const details = validateHotelOnboardingEmailInput(hotel, origin);
  const adminUrl = buildHotelAdminUrl(details.origin, details.id);

  const payload = {
    recipients: [
      {
        to: [
          {
            email: details.admin_email,
            name: details.admin_name || details.name,
          },
        ],
        variables: {
          hotel_name: details.name,
          hotel_id: details.id,
          admin_email: details.admin_email,
          temporary_password: details.id,
          admin_url: adminUrl,
        },
      },
    ],
    template_id: templateId,
    validate_before_send: true,
  };

  const response = await fetch(MSG91_EMAIL_URL, {
    method: "POST",
    headers: {
      authkey: authKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const errorMessage =
      (data && (data.message || data.error || data.msg)) ||
      text ||
      "MSG91 email send failed.";
    throw new Error(String(errorMessage));
  }

  return {
    ok: true,
    provider: "msg91",
    template_id: templateId,
    response: data,
    admin_url: adminUrl,
  };
}
