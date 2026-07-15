(function () {
  function todayDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function addMonths(dateString, months) {
    const date = new Date(`${dateString}T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + months);
    return date.toISOString().slice(0, 10);
  }

  function restoreToken(tokenInput) {
    if (tokenInput) {
      tokenInput.value = localStorage.getItem("super_admin_token") || "";
    }
  }

  function saveToken(tokenInput) {
    localStorage.setItem("super_admin_token", tokenInput?.value?.trim() || "");
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

  function setMessage(target, message, tone = "success") {
    if (!target) {
      return;
    }

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
    if (!target) {
      return;
    }

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

  function slugHotelId(name) {
    const compact = String(name || "").replace(/[^a-zA-Z0-9]/g, "");
    return compact ? compact.charAt(0).toUpperCase() + compact.slice(1) : "";
  }

  function suggestHotelId(name, hotels) {
    const base = slugHotelId(name);
    if (!base) {
      return "";
    }

    let maxSuffix = 0;
    for (const hotel of hotels || []) {
      const match = String(hotel.id || "").match(/(\d{4})$/);
      if (!match) {
        continue;
      }

      const suffix = Number(match[1]);
      if (Number.isFinite(suffix) && suffix > maxSuffix) {
        maxSuffix = suffix;
      }
    }

    return `${base}${String(maxSuffix + 1).padStart(4, "0")}`;
  }

  function pageChrome(pageTitle, badgeText, description) {
    return `
      <div class="flex items-center justify-between text-sm">
        <a href="/super-admin-home.html" class="font-medium text-slate-600">Back to Home</a>
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

  window.superAdminCommon = {
    todayDate,
    addMonths,
    restoreToken,
    saveToken,
    authHeaders,
    readJson,
    setMessage,
    clearMessage,
    setButtonLoading,
    suggestHotelId,
    pageChrome,
  };
})();
