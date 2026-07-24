const MSG91_SMS_URL = "https://control.msg91.com/api/v5/flow";
const DEFAULT_FLOW_TEMPLATE_ID = "6a630e0d1bd01cb6df050c32";
const DEFAULT_SENDER_ID = "DLHNOS";
const DEFAULT_DLT_TEMPLATE_ID = "1177178444554181486";
const DEFAULT_SUPPORT_PHONE = "7208993899";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIndianMobile(value) {
  let digits = text(value).replace(/\D/g, "");
  if (digits.length === 10) digits = `91${digits}`;
  if (!/^91\d{10}$/.test(digits)) {
    throw new Error("A valid Indian 10-digit mobile number is required to send the onboarding SMS.");
  }
  return digits;
}

function buildPasswordUrl(origin, hotelId) {
  const url = new URL("/hotel-admin-home.html", origin);
  url.searchParams.set("hotel_id", hotelId);
  return url.toString();
}

export async function sendHotelOnboardingSms(env, hotel, origin) {
  const authKey = text(env.MSG91_SMS_AUTH_KEY || env.MSG91_AUTH_KEY || env.MSG91_EMAIL_AUTH_KEY);
  const templateId = text(env.MSG91_SMS_FLOW_TEMPLATE_ID || DEFAULT_FLOW_TEMPLATE_ID);
  const hotelName = text(hotel?.name);
  const loginId = text(hotel?.admin_email).toLowerCase();
  const hotelId = text(hotel?.id).toLowerCase();
  const mobile = normalizeIndianMobile(hotel?.admin_phone || hotel?.contact);

  if (!authKey) throw new Error("MSG91 SMS auth key is not configured in Cloudflare Pages secrets.");
  if (!hotelName || !loginId || !hotelId || !text(origin)) {
    throw new Error("Hotel name, ID, admin email, and origin are required for onboarding SMS.");
  }

  const payload = {
    template_id: templateId,
    short_url: "1",
    recipients: [{
      mobiles: mobile,
      hotel_name: hotelName,
      login_id: loginId,
      password_url: buildPasswordUrl(origin, hotelId),
      support_phone: text(env.MSG91_SMS_SUPPORT_PHONE || DEFAULT_SUPPORT_PHONE),
    }],
  };

  const response = await fetch(MSG91_SMS_URL, {
    method: "POST",
    headers: { accept: "application/json", authkey: authKey, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const responseText = await response.text();
  let data = {};
  try { data = responseText ? JSON.parse(responseText) : {}; } catch { data = { raw: responseText }; }

  console.log("MSG91 hotel onboarding SMS response", {
    status: response.status,
    ok: response.ok,
    template_id: templateId,
    sender_id: text(env.MSG91_SMS_SENDER_ID || DEFAULT_SENDER_ID),
    dlt_template_id: text(env.MSG91_SMS_DLT_TEMPLATE_ID || DEFAULT_DLT_TEMPLATE_ID),
    hotel_id: hotelId,
  });

  if (!response.ok) {
    throw new Error(String(data?.message || data?.error || data?.msg || responseText || "MSG91 SMS send failed."));
  }

  return { ok: true, provider: "msg91", template_id: templateId, response: data };
}
