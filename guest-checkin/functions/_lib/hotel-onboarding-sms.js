const MSG91_SMS_URL = "https://control.msg91.com/api/v5/flow";
const DEFAULT_FLOW_TEMPLATE_ID = "6a630e0d1bd01cb6df050c32";

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

export async function sendHotelOnboardingSms(env, hotel) {
  const authKey = text(env.MSG91_SMS_AUTH_KEY || env.MSG91_AUTH_KEY || env.MSG91_EMAIL_AUTH_KEY);
  const templateId = text(env.MSG91_SMS_FLOW_TEMPLATE_ID || DEFAULT_FLOW_TEMPLATE_ID);
  const hotelName = text(hotel?.name);
  const loginId = text(hotel?.admin_email).toLowerCase();
  const hotelId = text(hotel?.id).toLowerCase();
  const mobile = normalizeIndianMobile(hotel?.admin_phone || hotel?.contact);

  if (!authKey) throw new Error("MSG91 SMS auth key is not configured in Cloudflare Pages secrets.");
  if (!hotelName || !loginId || !hotelId) {
    throw new Error("Hotel name, ID, and admin email are required for onboarding SMS.");
  }

  const payload = {
    template_id: templateId,
    recipients: [{
      mobiles: mobile,
      // Configure the new MSG91 Flow variables in this exact order.
      VAR1: hotelName,
      VAR2: hotelId,
      VAR3: loginId,
      VAR4: hotelId,
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
    hotel_id: hotelId,
  });

  if (!response.ok) {
    throw new Error(String(data?.message || data?.error || data?.msg || responseText || "MSG91 SMS send failed."));
  }

  return { ok: true, provider: "msg91", template_id: templateId, response: data };
}
