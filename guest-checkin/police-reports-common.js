(function () {
  const params = new URLSearchParams(window.location.search);
  const SESSION_PLACEHOLDER = "__app_session__";

  function formatDateOffset(daysAgo) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().slice(0, 10);
  }

  function authHeaders(tokenInput) {
    return {};
  }

  function hideSessionField(input) {
    if (!input) {
      return;
    }

    input.type = "hidden";
    const wrapper = input.closest("div");
    if (wrapper) {
      wrapper.classList.add("hidden");
    }
  }

  async function getSession() {
    const url = new URL("/api/auth/session", window.location.origin);
    url.searchParams.set("role", "police");

    const response = await fetch(url.toString());
    const data = await readJson(response);
    if (!response.ok) {
      return null;
    }

    if (data.session) {
      localStorage.setItem("police_access_token", SESSION_PLACEHOLDER);
    }

    return data.session || null;
  }

  async function readJson(response) {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return { error: "Unexpected response" };
    }
  }

  function showBox(target, message, tone = "error") {
    target.textContent = message;
    target.className = "rounded-2xl border px-4 py-3 text-sm";
    target.classList.remove("hidden");
    if (tone === "success") {
      target.classList.add("border-emerald-200", "bg-emerald-50", "text-emerald-700");
    } else {
      target.classList.add("border-rose-200", "bg-rose-50", "text-rose-700");
    }
  }

  function clearBox(target) {
    target.classList.add("hidden");
    target.textContent = "";
  }

  function setButtonLoading(button, isLoading, loadingText) {
    if (!button.dataset.defaultText) {
      button.dataset.defaultText = button.textContent.trim();
    }
    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : button.dataset.defaultText;
    button.classList.toggle("opacity-70", isLoading);
  }

  function normalizeFilterValue(value) {
    return String(value || "").trim().toLowerCase();
  }

  function hydrateFilters(tokenInput, officerNameInput, hotelIdInput, fromDateInput, toDateInput) {
    if (tokenInput) {
      tokenInput.value = localStorage.getItem("police_access_token") || "";
      hideSessionField(tokenInput);
    }
    officerNameInput.value = localStorage.getItem("police_officer_name") || "";
    fromDateInput.value = localStorage.getItem("police_reports_from") || formatDateOffset(29);
    toDateInput.value = localStorage.getItem("police_reports_to") || formatDateOffset(0);
    hotelIdInput.dataset.preselectedHotelId =
      params.get("hotel_id") ||
      localStorage.getItem("police_reports_hotel_id") ||
      localStorage.getItem("dashboard_hotel_id") ||
      "";
  }

  function persistFilters(tokenInput, officerNameInput, hotelIdInput, fromDateInput, toDateInput) {
    localStorage.setItem("police_access_token", SESSION_PLACEHOLDER);
    localStorage.setItem("police_officer_name", officerNameInput.value.trim());
    localStorage.setItem("police_reports_hotel_id", hotelIdInput.value.trim());
    localStorage.setItem("police_reports_from", fromDateInput.value);
    localStorage.setItem("police_reports_to", toDateInput.value);
  }

  async function loadHotels(tokenInput, hotelIdInput) {
    const response = await fetch("/api/police/hotels", {
      headers: authHeaders(tokenInput),
    });
    const data = await readJson(response);
    if (!response.ok) {
      throw new Error(data.error || "Unable to load hotels");
    }

    const selectedHotelId = hotelIdInput.dataset.preselectedHotelId || hotelIdInput.value.trim() || "";
    hotelIdInput.dataset.preselectedHotelId = selectedHotelId;
    hotelIdInput._allHotels = data.hotels || [];
    renderHotelOptions(hotelIdInput);
  }

  function renderHotelOptions(hotelIdInput, filterValue = "") {
    const hotels = Array.isArray(hotelIdInput?._allHotels) ? hotelIdInput._allHotels : [];
    const selectedHotelId = hotelIdInput?.dataset?.preselectedHotelId || hotelIdInput?.value?.trim() || "";
    const normalizedFilter = normalizeFilterValue(filterValue);

    hotelIdInput.innerHTML = '<option value="">Select hotel</option>';
    for (const hotel of hotels) {
      const matches = !normalizedFilter
        || normalizeFilterValue(hotel.name).includes(normalizedFilter)
        || normalizeFilterValue(hotel.id).includes(normalizedFilter);

      if (!matches) {
        continue;
      }

      const option = document.createElement("option");
      option.value = hotel.id;
      option.textContent = `${hotel.name} (${hotel.id})`;
      if (hotel.id === selectedHotelId) {
        option.selected = true;
      }
      hotelIdInput.appendChild(option);
    }
  }

  function attachHotelFilter(filterInput, hotelIdInput) {
    if (!filterInput || !hotelIdInput) {
      return;
    }

    if (filterInput.dataset.hotelFilterBound === "true") {
      return;
    }

    filterInput.dataset.hotelFilterBound = "true";
    filterInput.addEventListener("input", () => {
      const selectedHotelId = hotelIdInput.value.trim();
      hotelIdInput.dataset.preselectedHotelId = selectedHotelId;
      renderHotelOptions(hotelIdInput, filterInput.value);
      if (selectedHotelId && !Array.from(hotelIdInput.options).some((option) => option.value === selectedHotelId)) {
        hotelIdInput.value = "";
      }
    });

    hotelIdInput.addEventListener("change", () => {
      hotelIdInput.dataset.preselectedHotelId = hotelIdInput.value.trim();
    });
  }

  async function loadReport({ tokenInput, officerNameInput, hotelIdInput, fromDateInput, toDateInput }) {
    const officerName = officerNameInput.value.trim();
    const hotelId = hotelIdInput.value.trim();

    if (!officerName || !hotelId) {
      throw new Error("Please enter officer name and hotel ID.");
    }

    persistFilters(tokenInput, officerNameInput, hotelIdInput, fromDateInput, toDateInput);

    const url = new URL("/api/police/reports", window.location.origin);
    url.searchParams.set("officer_name", officerName);
    url.searchParams.set("hotel_id", hotelId);
    url.searchParams.set("from", fromDateInput.value);
    url.searchParams.set("to", toDateInput.value);

    const response = await fetch(url.toString(), {
      headers: authHeaders(tokenInput),
    });
    const data = await readJson(response);
    if (!response.ok) {
      throw new Error(data.error || "Unable to load police report");
    }
    return data;
  }

  function createLine(label, value) {
    return `<p class="mt-1 text-sm text-slate-500">${label}: <span class="font-medium text-slate-700">${value}</span></p>`;
  }

  function renderCards(container, rows, emptyText, builder) {
    container.innerHTML = "";
    if (!rows.length) {
      container.innerHTML = `<div class="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">${emptyText}</div>`;
      return;
    }
    for (const row of rows) {
      const card = document.createElement("article");
      card.className = "rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4";
      card.innerHTML = builder(row);
      container.appendChild(card);
    }
  }

  function renderTable(container, rows, columns, emptyText) {
    container.innerHTML = "";
    if (!rows.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="${columns}" class="px-3 py-6 text-center text-sm text-slate-500">${emptyText}</td>`;
      container.appendChild(tr);
      return;
    }
    for (const row of rows) {
      container.appendChild(row);
    }
  }

  function downloadCsv(filename, rows) {
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, "\"\"")}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function buildProofUrl(hotelIdInput, officerNameInput, guestId, side) {
    const url = new URL("/api/police/guest-proof", window.location.origin);
    url.searchParams.set("hotel_id", hotelIdInput.value.trim());
    url.searchParams.set("guest_id", guestId);
    url.searchParams.set("side", side);
    url.searchParams.set("officer_name", officerNameInput.value.trim());
    return url.toString();
  }

  async function openProofDocument(url) {
    const response = await fetch(url);
    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Unable to open guest proof");
      }
      throw new Error("Unable to open guest proof");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const proofWindow = window.open(objectUrl, "_blank", "noopener,noreferrer");
    if (!proofWindow) {
      URL.revokeObjectURL(objectUrl);
      throw new Error("Popup was blocked while opening guest proof");
    }
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }

  function proofButtons(guest) {
    const hasFront = Boolean(guest.google_drive_file_id_front);
    const hasBack = Boolean(guest.google_drive_file_id_back);

    return `
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="proof-button rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slateblue hover:text-ink disabled:cursor-not-allowed disabled:opacity-50" data-guest-id="${guest.id}" data-side="front" ${hasFront ? "" : "disabled"}>
          View Front ID
        </button>
        <button type="button" class="proof-button rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slateblue hover:text-ink disabled:cursor-not-allowed disabled:opacity-50" data-guest-id="${guest.id}" data-side="back" ${hasBack ? "" : "disabled"}>
          View Back ID
        </button>
      </div>
    `;
  }

  function attachProofButtons(scope, tokenInput, officerNameInput, hotelIdInput, errorBox) {
    for (const button of scope.querySelectorAll(".proof-button")) {
      button.addEventListener("click", async () => {
        const guestId = button.dataset.guestId;
        const side = button.dataset.side;

        if (!guestId || !side) {
          showBox(errorBox, "Guest or proof side is missing.", "error");
          return;
        }

        try {
          clearBox(errorBox);
          await openProofDocument(buildProofUrl(hotelIdInput, officerNameInput, guestId, side));
        } catch (error) {
          showBox(errorBox, error instanceof Error ? error.message : "Unable to open guest proof.", "error");
        }
      });
    }
  }

  function pageChrome(pageTitle, badgeText, description) {
    return `
      <div class="flex items-center justify-between text-sm">
        <a href="/police-reports-home.html" class="font-medium text-slate-600">Back to Reports Home</a>
        <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm">${badgeText}</span>
      </div>
      <section class="mt-3 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(17,24,39,0.08)]">
        <div class="bg-[linear-gradient(135deg,#111827_0%,#1f3b57_68%,#355879_100%)] px-5 py-6 text-white">
          <p class="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">Hotels In Alibaug SaaS</p>
          <h1 class="mt-2 text-2xl font-semibold">${pageTitle}</h1>
          <p class="mt-2 text-sm leading-6 text-white/80">${description}</p>
        </div>
    `;
  }

  function quickNav(currentPage) {
    const pages = [
      { id: "home", label: "Home", href: "/police-reports-home.html" },
      { id: "hotel", label: "Hotel", href: "/police-report-hotel-details.html" },
      { id: "current", label: "Current Guests", href: "/police-report-current-guests.html" },
      { id: "register", label: "Guest Register", href: "/police-report-guest-register.html" },
      { id: "staff", label: "Staff", href: "/police-report-staff-register.html" },
      { id: "logs", label: "Logs", href: "/police-report-access-logs.html" },
    ];

    return `
      <nav class="mt-4 overflow-x-auto pb-1">
        <div class="flex gap-2">
          ${pages.map((page) => `
            <a
              href="${page.href}"
              class="whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium ${
                page.id === currentPage
                  ? "border-ink bg-ink text-white"
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
          <p class="text-sm font-semibold text-ink">Police Access</p>
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
      <p class="mt-2 leading-6">Access to these police reports remains governed by the hotel subscription, privacy, and data processing terms below.</p>
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

  window.policeReportsCommon = {
    params,
    formatDateOffset,
    authHeaders,
    hideSessionField,
    normalizeFilterValue,
    getSession,
    readJson,
    showBox,
    clearBox,
    setButtonLoading,
    hydrateFilters,
    persistFilters,
    loadHotels,
    renderHotelOptions,
    attachHotelFilter,
    loadReport,
    createLine,
    renderCards,
    renderTable,
    downloadCsv,
    proofButtons,
    attachProofButtons,
    pageChrome,
    quickNav,
    mountBrandChip,
    mountLegalFooter,
  };
})();
