const MSG91_EMAIL_URL = "https://control.msg91.com/api/v5/email/send";
const DEFAULT_TEMPLATE_ID = "checkin_hotel_procedure";
const DEFAULT_FROM_EMAIL = "support@hotelsinalibaug.in";
const DEFAULT_FROM_NAME = "Hotels In Alibaug";
const DEFAULT_DOMAIN = "hotelsinalibaug.in";

function getMsg91AuthKey(env) {
  return String(env.MSG91_EMAIL_AUTH_KEY || env.MSG91_AUTH_KEY || "").trim();
}

function getMsg91TemplateId(env) {
  return String(env.MSG91_EMAIL_TEMPLATE_ID || DEFAULT_TEMPLATE_ID).trim();
}

function getMsg91FromEmail(env) {
  return String(env.MSG91_EMAIL_FROM_EMAIL || DEFAULT_FROM_EMAIL).trim();
}

function getMsg91FromName(env) {
  return String(env.MSG91_EMAIL_FROM_NAME || DEFAULT_FROM_NAME).trim();
}

function getMsg91Domain(env) {
  return String(env.MSG91_EMAIL_DOMAIN || DEFAULT_DOMAIN).trim();
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
  const fromEmail = getMsg91FromEmail(env);
  const fromName = getMsg91FromName(env);
  const domain = getMsg91Domain(env);

  if (!authKey) {
    throw new Error("MSG91 auth key is not configured in Cloudflare Pages secrets.");
  }

  if (!fromEmail || !domain) {
    throw new Error("MSG91 sender email or domain is not configured in Cloudflare Pages secrets.");
  }

  const details = validateHotelOnboardingEmailInput(hotel, origin);
  const adminUrl = buildHotelAdminUrl(details.origin, details.id);

  const payload = {
    from: {
      email: fromEmail,
      name: fromName,
    },
    domain,
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

  console.log("Sending hotel onboarding email via MSG91", {
    template_id: templateId,
    domain,
    from_email: fromEmail,
    to_email: details.admin_email,
    hotel_id: details.id,
  });

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

  console.log("MSG91 hotel onboarding email response", {
    status: response.status,
    ok: response.ok,
    body: data,
    hotel_id: details.id,
    to_email: details.admin_email,
  });

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
