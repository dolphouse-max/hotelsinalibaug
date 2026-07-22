(function () {
  const params = new URLSearchParams(window.location.search);
  const SESSION_PLACEHOLDER = "__app_session__";

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

  function normalizeHotelId(value) {
    return String(value || "").trim().toLowerCase();
  }

  function hydrateContext(tokenInput, hotelIdInput) {
    if (tokenInput) {
      tokenInput.value = readStoredToken();
      hideLegacyField(tokenInput);
    }

    if (hotelIdInput) {
      hotelIdInput.value = normalizeHotelId(readStoredHotelId());
    }
  }

  function persistContext(token, hotelId) {
    const normalizedHotelId = normalizeHotelId(hotelId);
    localStorage.setItem("hotel_admin_token", SESSION_PLACEHOLDER);
    localStorage.setItem("hotel_admin_hotel_id", normalizedHotelId);

    if (normalizedHotelId) {
      localStorage.setItem("dashboard_hotel_id", normalizedHotelId);
      localStorage.setItem("guest_checkin_hotel_id", normalizedHotelId);
      localStorage.setItem("staff_console_hotel_id", normalizedHotelId);
    }
  }

  function authHeaders(tokenInput, includeJson = true) {
    const headers = {};

    if (includeJson) {
      headers["Content-Type"] = "application/json";
    }

    return headers;
  }

  function hideLegacyField(input) {
    if (!input) {
      return;
    }

    input.type = "hidden";
    const wrapper = input.closest("div");
    if (wrapper) {
      wrapper.classList.add("hidden");
    }
  }

  async function getSession(hotelId) {
    const url = new URL("/api/auth/session", window.location.origin);
    url.searchParams.set("role", "hotel_admin");
    if (hotelId) {
      url.searchParams.set("hotel_id", hotelId);
    }

    const response = await fetch(url.toString());
    const data = await readJson(response);

    if (!response.ok) {
      return null;
    }

    if (data.session) {
      persistContext(SESSION_PLACEHOLDER, data.session.hotel_id || hotelId);
    }

    return data.session || null;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("hotel_admin_token");
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
    button.classList.toggle("scale-[0.98]", isLoading);
    button.classList.toggle("ring-4", isLoading);
    button.classList.toggle("ring-harbor/20", isLoading);
    button.classList.toggle("cursor-wait", isLoading);
  }

  function safeHotelId(hotelIdInput) {
    return normalizeHotelId(hotelIdInput?.value);
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

  function quickNav(currentPage) {
    const pages = [
      { id: "home", label: "Home", href: "/hotel-admin-home.html" },
      { id: "help", label: "Help", href: "/hotel-help.html" },
      { id: "profile", label: "Profile", href: "/hotel-admin-profile.html" },
      { id: "website", label: "Website", href: "/hotel-admin-website.html" },
      { id: "drive", label: "Drive", href: "/hotel-admin-google-drive.html" },
      { id: "staff", label: "Staff", href: "/hotel-admin-staff.html" },
      { id: "checkin", label: "Guest QR", href: "/hotel-admin-checkin.html" },
      { id: "payment", label: "Pay QR", href: "/hotel-admin-payment.html" },
      { id: "reservations", label: "Bookings", href: "/hotel-admin-reservations.html" },
      { id: "notifications", label: "Alerts", href: "/hotel-admin-notifications.html" },
      { id: "messages", label: "Messages", href: "/hotel-admin-messages.html" },
      { id: "renewal", label: "Renewal", href: "/hotel-admin-renewal.html" },
      { id: "guests", label: "Guests", href: "/hotel-admin-guests.html" },
      { id: "reports", label: "Reports", href: "/reports.html" },
    ];

    return `
      <nav class="mt-4 overflow-x-auto pb-1">
        <div class="flex gap-2">
          ${pages.map((page) => `
            <a
              href="${page.href}"
              class="whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium ${
                page.id === currentPage
                  ? "border-ocean bg-ocean text-white"
                  : "border-slate-200 bg-white text-slate-700"
              }"
            >${page.label}</a>
          `).join("")}
        </div>
      </nav>
    `;
  }

  function mountBrandChip() {
    if (document.getElementById("appBrandChip")) {
      return;
    }

    const main = document.querySelector("main");
    if (!main) {
      return;
    }

    const brand = document.createElement("div");
    brand.id = "appBrandChip";
    brand.className = "mb-4";
    brand.innerHTML = `
      <div class="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <img src="/logo.webp" alt="Hotels In Alibaug" class="h-10 w-10 rounded-xl object-cover">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Hotels In Alibaug</p>
          <p class="text-sm font-semibold text-ocean">Private App</p>
        </div>
      </div>
    `;

    main.prepend(brand);
  }

  function mountLegalFooter() {
    if (document.getElementById("appLegalFooter")) {
      return;
    }

    const main = document.querySelector("main");
    if (!main) {
      return;
    }

    const footer = document.createElement("footer");
    footer.id = "appLegalFooter";
    footer.className = "mt-8 rounded-[1.75rem] border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600 shadow-sm";
    footer.innerHTML = `
      <p class="font-semibold text-slate-800">Hotels In Alibaug</p>
      <p class="mt-2 leading-6">Private software for subscribed hotel users. Review the legal terms below before using the platform.</p>
      <div class="mt-4 flex flex-wrap gap-2">
        <a href="/software-subscription-agreement.html" class="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">Subscription Agreement</a>
        <a href="/privacy-policy.html" class="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">Privacy Policy</a>
        <a href="/terms-and-conditions.html" class="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">Terms & Conditions</a>
        <a href="/data-processing-agreement.html" class="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">Data Processing Agreement</a>
        <a href="/end-user-license-agreement.html" class="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">EULA</a>
      </div>
    `;

    main.appendChild(footer);
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
      mountBrandChip();
      mountLegalFooter();
    });
  }

  window.hotelAdminCommon = {
    params,
    hydrateContext,
    persistContext,
    authHeaders,
    hideLegacyField,
    getSession,
    logout,
    readJson,
    setMessage,
    clearMessage,
    setButtonLoading,
    safeHotelId,
    normalizeHotelId,
    loadHotelProfile,
    quickNav,
    mountBrandChip,
    mountLegalFooter,
  };
})();
