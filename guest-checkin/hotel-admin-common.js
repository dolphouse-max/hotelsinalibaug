(function () {
  const params = new URLSearchParams(window.location.search);

  function readStoredToken() {
    return localStorage.getItem("hotel_admin_token") || "";
  }

  function readStoredHotelId() {
    return params.get("hotel_id")
      || localStorage.getItem("hotel_admin_hotel_id")
      || localStorage.getItem("dashboard_hotel_id")
      || localStorage.getItem("guest_checkin_hotel_id")
      || localStorage.getItem("staff_console_hotel_id")
      || "";
  }

  function hydrateContext(tokenInput, hotelIdInput) {
    if (tokenInput) {
      tokenInput.value = readStoredToken();
    }

    if (hotelIdInput) {
      hotelIdInput.value = readStoredHotelId();
    }
  }

  function persistContext(token, hotelId) {
    localStorage.setItem("hotel_admin_token", token || "");
    localStorage.setItem("hotel_admin_hotel_id", hotelId || "");

    if (hotelId) {
      localStorage.setItem("dashboard_hotel_id", hotelId);
      localStorage.setItem("guest_checkin_hotel_id", hotelId);
      localStorage.setItem("staff_console_hotel_id", hotelId);
    }
  }

  function authHeaders(tokenInput, includeJson = true) {
    const token = tokenInput?.value?.trim() || "";
    const headers = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (includeJson) {
      headers["Content-Type"] = "application/json";
    }

    return headers;
  }

  async function readJson(response) {
    const text = await response.text();

    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return { error: text || "Unexpected response" };
    }
  }

  function setMessage(target, message, tone) {
    target.textContent = message;
    target.className = "rounded-2xl border px-4 py-3 text-sm";
    target.classList.remove("hidden");

    if (tone === "success") {
      target.classList.add("border-emerald-200", "bg-emerald-50", "text-emerald-700");
    } else {
      target.classList.add("border-rose-200", "bg-rose-50", "text-rose-700");
    }
  }

  function clearMessage(target) {
    target.classList.add("hidden");
    target.textContent = "";
  }

  function setButtonLoading(button, isLoading, loadingText) {
    if (!button) {
      return;
    }

    if (!button.dataset.defaultText) {
      button.dataset.defaultText = button.textContent.trim();
    }

    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : button.dataset.defaultText;
    button.classList.toggle("opacity-70", isLoading);
  }

  function safeHotelId(hotelIdInput) {
    return hotelIdInput?.value?.trim() || "";
  }

  async function loadHotelProfile(tokenInput, hotelIdInput) {
    const hotelId = safeHotelId(hotelIdInput);
    if (!hotelId) {
      throw new Error("Enter a hotel ID first.");
    }

    persistContext(tokenInput?.value?.trim() || "", hotelId);

    const response = await fetch(`/api/hotel-admin/profile?hotel_id=${encodeURIComponent(hotelId)}`, {
      headers: authHeaders(tokenInput),
    });
    const data = await readJson(response);

    if (!response.ok) {
      throw new Error(data.error || "Unable to load hotel account");
    }

    return data.hotel;
  }

  window.hotelAdminCommon = {
    params,
    hydrateContext,
    persistContext,
    authHeaders,
    readJson,
    setMessage,
    clearMessage,
    setButtonLoading,
    safeHotelId,
    loadHotelProfile,
  };
})();
