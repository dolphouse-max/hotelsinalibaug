(function () {
  function formatDateOffset(daysAgo) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().slice(0, 10);
  }

  function hydrateFilters(tokenInput, hotelIdInput, fromDateInput, toDateInput) {
    hotelAdminCommon.hydrateContext(tokenInput, hotelIdInput);
    if (fromDateInput) {
      fromDateInput.value = localStorage.getItem("hotel_reports_from") || formatDateOffset(29);
    }
    if (toDateInput) {
      toDateInput.value = localStorage.getItem("hotel_reports_to") || formatDateOffset(0);
    }
  }

  function persistFilters(tokenInput, hotelIdInput, fromDateInput, toDateInput) {
    hotelAdminCommon.persistContext("__google_session__", hotelIdInput.value.trim());
    if (fromDateInput) {
      localStorage.setItem("hotel_reports_from", fromDateInput.value);
    }
    if (toDateInput) {
      localStorage.setItem("hotel_reports_to", toDateInput.value);
    }
  }

  async function loadReport({ tokenInput, hotelIdInput, fromDateInput, toDateInput }) {
    const hotelId = hotelIdInput.value.trim();

    if (!hotelId) {
      throw new Error("Please enter the hotel ID.");
    }

    persistFilters(tokenInput, hotelIdInput, fromDateInput, toDateInput);

    const url = new URL("/api/hotel-admin/reports", window.location.origin);
    url.searchParams.set("hotel_id", hotelId);
    if (fromDateInput?.value) {
      url.searchParams.set("from", fromDateInput.value);
    }
    if (toDateInput?.value) {
      url.searchParams.set("to", toDateInput.value);
    }

    const response = await fetch(url.toString(), {
      headers: {},
    });
    const data = await response.text().then((text) => {
      try {
        return text ? JSON.parse(text) : {};
      } catch {
        return { error: "Unexpected response" };
      }
    });

    if (!response.ok) {
      throw new Error(data.error || "Unable to load reports");
    }

    return data;
  }

  function setMessage(target, message, tone = "error") {
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
    if (!button.dataset.defaultText) {
      button.dataset.defaultText = button.textContent.trim();
    }
    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : button.dataset.defaultText;
    button.classList.toggle("opacity-70", isLoading);
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

  function quickNav(currentPage) {
    const pages = [
      { id: "home", label: "Home", href: "/hotel-reports-home.html" },
      { id: "snapshot", label: "Snapshot", href: "/hotel-report-snapshot.html" },
      { id: "checkins", label: "Check-Ins", href: "/hotel-report-checkins.html" },
      { id: "current", label: "Current Guests", href: "/hotel-report-current-guests.html" },
      { id: "checkouts", label: "Check-Outs", href: "/hotel-report-checkouts.html" },
      { id: "register", label: "Guest Register", href: "/hotel-report-guest-register.html" },
      { id: "staff", label: "Staff", href: "/hotel-report-staff-register.html" },
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

  window.hotelReportsCommon = {
    formatDateOffset,
    hydrateFilters,
    persistFilters,
    loadReport,
    setMessage,
    clearMessage,
    setButtonLoading,
    createLine,
    renderCards,
    renderTable,
    downloadCsv,
    quickNav,
  };
})();
