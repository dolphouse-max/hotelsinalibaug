(function () {
  function formatDateOffset(daysAgo) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().slice(0, 10);
  }

  function authHeaders(tokenInput) {
    return {};
  }

  async function readJson(response) {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return { error: "Unexpected response" };
    }
  }

  function setMessage(target, message, tone = "error") {
    target.textContent = message;
    target.className = "rounded-2xl border px-4 py-3 text-sm";
    target.classList.remove("hidden");
    if (tone === "success") {
      target.classList.add("border-emerald-200", "bg-emerald-50", "text-emerald-800");
    } else {
      target.classList.add("border-rose-200", "bg-rose-50", "text-rose-700");
    }
  }

  function clearMessage(target) {
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

  function hydrateFilters(tokenInput, viewerNameInput, fromDateInput, toDateInput) {
    tokenInput.value = localStorage.getItem("super_admin_token") || "";
    if (window.superAdminCommon?.hideLegacyField) {
      window.superAdminCommon.hideLegacyField(tokenInput);
    }
    if (viewerNameInput) {
      viewerNameInput.value = localStorage.getItem("super_admin_viewer_name") || "";
    }
    if (fromDateInput) {
      fromDateInput.value = localStorage.getItem("super_admin_reports_from") || formatDateOffset(29);
    }
    if (toDateInput) {
      toDateInput.value = localStorage.getItem("super_admin_reports_to") || formatDateOffset(0);
    }
  }

  function persistFilters(tokenInput, viewerNameInput, fromDateInput, toDateInput) {
    localStorage.setItem("super_admin_token", "__app_session__");
    if (viewerNameInput) {
      localStorage.setItem("super_admin_viewer_name", viewerNameInput.value.trim());
    }
    if (fromDateInput) {
      localStorage.setItem("super_admin_reports_from", fromDateInput.value);
    }
    if (toDateInput) {
      localStorage.setItem("super_admin_reports_to", toDateInput.value);
    }
  }

  async function loadReports({ tokenInput, viewerNameInput, fromDateInput, toDateInput }) {
    const viewerName = viewerNameInput ? viewerNameInput.value.trim() : localStorage.getItem("super_admin_viewer_name") || "";

    if (!viewerName) {
      throw new Error("Please enter the viewer name.");
    }

    persistFilters(tokenInput, viewerNameInput, fromDateInput, toDateInput);

    const url = new URL("/api/super-admin/reports", window.location.origin);
    if (fromDateInput?.value) {
      url.searchParams.set("from", fromDateInput.value);
    }
    if (toDateInput?.value) {
      url.searchParams.set("to", toDateInput.value);
    }

    const response = await fetch(url.toString(), {
      headers: authHeaders(tokenInput),
    });
    const data = await readJson(response);

    if (!response.ok) {
      throw new Error(data.error || "Unable to load reports");
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

  function pageChrome(pageTitle, badgeText, description) {
    return `
      <div class="flex items-center justify-between text-sm">
        <a href="/super-admin-reports-home.html" class="font-medium text-slate-600">Back to Reports Home</a>
        <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm">${badgeText}</span>
      </div>
      <section class="mt-3 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <div class="bg-[linear-gradient(135deg,#08131d_0%,#17344d_68%,#275273_100%)] px-5 py-6 text-white">
          <p class="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">Hotels In Alibaug SaaS</p>
          <h1 class="mt-2 text-2xl font-semibold">${pageTitle}</h1>
          <p class="mt-2 text-sm leading-6 text-white/80">${description}</p>
        </div>
    `;
  }

  function quickNav(currentPage) {
    const pages = [
      { id: "home", label: "Home", href: "/super-admin-reports-home.html" },
      { id: "expiring", label: "Expiring", href: "/super-admin-reports-expiring.html" },
      { id: "checkins", label: "Check-Ins", href: "/super-admin-reports-checkins.html" },
      { id: "register", label: "Hotels", href: "/super-admin-reports-register.html" },
      { id: "police", label: "Police Logs", href: "/super-admin-reports-police.html" },
    ];

    return `
      <nav class="mt-4 overflow-x-auto pb-1">
        <div class="flex gap-2">
          ${pages.map((page) => `
            <a
              href="${page.href}"
              class="whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium ${
                page.id === currentPage
                  ? "border-ocean-950 bg-ocean-950 text-white"
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
          <p class="text-sm font-semibold text-ocean-950">Reports</p>
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
      <p class="mt-2 leading-6">Platform reports remain subject to the subscription, privacy, data processing, and license terms linked below.</p>
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

  function buildProofUrl(hotelId, guestId, side, reason, viewerName) {
    const url = new URL("/api/super-admin/guest-proof", window.location.origin);
    url.searchParams.set("hotel_id", hotelId);
    url.searchParams.set("guest_id", guestId);
    url.searchParams.set("side", side);
    url.searchParams.set("viewer_name", viewerName);
    url.searchParams.set("reason", reason);
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

  function proofButtons(entry) {
    const hasFront = Boolean(entry.google_drive_file_id_front);
    const hasBack = Boolean(entry.google_drive_file_id_back);

    return `
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="proof-button rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-ocean-800 hover:text-ocean-950 disabled:cursor-not-allowed disabled:opacity-50" data-hotel-id="${entry.hotel_id}" data-guest-id="${entry.id}" data-side="front" ${hasFront ? "" : "disabled"}>
          View Front ID
        </button>
        <button type="button" class="proof-button rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-ocean-800 hover:text-ocean-950 disabled:cursor-not-allowed disabled:opacity-50" data-hotel-id="${entry.hotel_id}" data-guest-id="${entry.id}" data-side="back" ${hasBack ? "" : "disabled"}>
          View Back ID
        </button>
      </div>
    `;
  }

  function attachProofButtons(scope, tokenInput, viewerNameInput, errorBox) {
    for (const button of scope.querySelectorAll(".proof-button")) {
      button.addEventListener("click", async () => {
        const viewerName = viewerNameInput.value.trim();
        const hotelId = button.dataset.hotelId;
        const guestId = button.dataset.guestId;
        const side = button.dataset.side;

        if (!viewerName) {
          setMessage(errorBox, "Please enter the viewer name before opening guest proofs.", "error");
          return;
        }

        const reason = window.prompt("Enter the reason for viewing this guest proof:");
        if (!reason || !reason.trim()) {
          setMessage(errorBox, "A reason is required before opening guest proofs.", "error");
          return;
        }

        try {
          clearMessage(errorBox);
          localStorage.setItem("super_admin_viewer_name", viewerName);
          await openProofDocument(buildProofUrl(hotelId, guestId, side, reason.trim(), viewerName));
        } catch (error) {
          setMessage(errorBox, error instanceof Error ? error.message : "Unable to open guest proof.", "error");
        }
      });
    }
  }

  window.superAdminReportsCommon = {
    formatDateOffset,
    authHeaders,
    readJson,
    setMessage,
    clearMessage,
    setButtonLoading,
    hydrateFilters,
    persistFilters,
    loadReports,
    createLine,
    renderCards,
    renderTable,
    downloadCsv,
    pageChrome,
    quickNav,
    mountBrandChip,
    mountLegalFooter,
    proofButtons,
    attachProofButtons,
  };
})();
