(function () {
  const SESSION_PLACEHOLDER = "__app_session__";
  const SUPER_ADMIN_LOGIN_PATH = "/super-admin-home.html";
  const HIDDEN_ATTRIBUTE = "data-super-admin-auth-hidden";

  function normalizePath(pathname = window.location.pathname) {
    const raw = String(pathname || "").trim().toLowerCase() || "/";
    const withoutQuery = raw.split("?")[0].split("#")[0] || "/";
    const withoutTrailingSlash = withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, "") : withoutQuery;
    return withoutTrailingSlash.endsWith(".html")
      ? withoutTrailingSlash.slice(0, -5)
      : withoutTrailingSlash;
  }

  function isSuperAdminLoginPath(pathname = window.location.pathname) {
    const path = normalizePath(pathname);
    return path === "/super-admin-home" || path === "/super-admin" || path === "/dashboard";
  }

  function isProtectedSuperAdminPath(pathname = window.location.pathname) {
    const path = normalizePath(pathname);
    return path.startsWith("/super-admin") && !isSuperAdminLoginPath(path);
  }

  function hideProtectedPageUntilAuth() {
    if (typeof document === "undefined" || !isProtectedSuperAdminPath()) {
      return;
    }

    document.documentElement.setAttribute(HIDDEN_ATTRIBUTE, "true");
    if (!document.getElementById("superAdminAuthHideStyle")) {
      const style = document.createElement("style");
      style.id = "superAdminAuthHideStyle";
      style.textContent = `html[${HIDDEN_ATTRIBUTE}="true"] body{display:none !important;}`;
      document.head.appendChild(style);
    }
  }

  function showProtectedPageAfterAuth() {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.removeAttribute(HIDDEN_ATTRIBUTE);
  }

  function redirectToSuperAdminLogin() {
    if (isSuperAdminLoginPath()) {
      return;
    }

    const loginUrl = new URL(SUPER_ADMIN_LOGIN_PATH, window.location.origin);
    loginUrl.searchParams.set("next", `${window.location.pathname}${window.location.search}`);
    window.location.replace(loginUrl.toString());
  }

  async function requireSuperAdminAccess() {
    if (!isProtectedSuperAdminPath()) {
      return null;
    }

    const session = await getSession("super_admin");
    if (!session) {
      redirectToSuperAdminLogin();
      return null;
    }

    showProtectedPageAfterAuth();
    return session;
  }

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
      hideLegacyField(tokenInput);
    }
  }

  function saveToken() {
    localStorage.setItem("super_admin_token", SESSION_PLACEHOLDER);
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

  async function getSession(role) {
    const url = new URL("/api/auth/session", window.location.origin);
    if (role) {
      url.searchParams.set("role", role);
    }

    const response = await fetch(url.toString());
    const data = await readJson(response);

    if (!response.ok) {
      return null;
    }

    if (data.session) {
      saveToken();
    }

    return data.session || null;
  }

  async function listUsers() {
    const response = await fetch("/api/super-admin/users");
    const data = await readJson(response);
    if (!response.ok) {
      throw new Error(data.error || "Unable to load users.");
    }
    return data.users || [];
  }

  async function saveUser(payload) {
    const response = await fetch("/api/super-admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await readJson(response);
    if (!response.ok) {
      throw new Error(data.error || "Unable to save user.");
    }
    return data.user;
  }

  async function deleteUser({ id = "", email = "" } = {}) {
    const url = new URL("/api/super-admin/users", window.location.origin);
    if (id) {
      url.searchParams.set("id", id);
    } else if (email) {
      url.searchParams.set("email", email);
    } else {
      throw new Error("User ID or email is required.");
    }

    const response = await fetch(url.toString(), {
      method: "DELETE",
    });
    const data = await readJson(response);
    if (!response.ok) {
      throw new Error(data.error || "Unable to delete user mapping.");
    }
    return data.deleted_user;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("super_admin_token");
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
    button.classList.toggle("scale-[0.98]", isLoading);
    button.classList.toggle("ring-4", isLoading);
    button.classList.toggle("ring-harbor/20", isLoading);
    button.classList.toggle("cursor-wait", isLoading);
  }

  function slugHotelId(name) {
    const compact = String(name || "").replace(/[^a-zA-Z0-9]/g, "");
    return compact ? compact.toLowerCase() : "";
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

  function suggestPoliceLoginId(users) {
    let maxSuffix = 0;

    for (const user of users || []) {
      if (String(user.role || "").trim() !== "police") {
        continue;
      }

      const value = String(user.display_name || user.email || "").trim().toLowerCase();
      const match = value.match(/^alibaug-police(\d{3})$/);
      if (!match) {
        continue;
      }

      const suffix = Number(match[1]);
      if (Number.isFinite(suffix) && suffix > maxSuffix) {
        maxSuffix = suffix;
      }
    }

    return `alibaug-police${String(maxSuffix + 1).padStart(3, "0")}`;
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

  function quickNav(currentPage) {
    const pages = [
      { id: "home", label: "Home", href: "/super-admin-home.html" },
      { id: "setup", label: "Setup", href: "/super-admin-setup.html" },
      { id: "add", label: "Add Hotel", href: "/super-admin-add-hotel.html" },
      { id: "hotels", label: "Hotels", href: "/super-admin-hotels.html" },
      { id: "website", label: "Website", href: "/super-admin-public-pages.html" },
      { id: "inquiries", label: "Inquiries", href: "/super-admin-inquiries.html" },
      { id: "messages", label: "Messages", href: "/super-admin-messages.html" },
      { id: "notifications", label: "Notifications", href: "/super-admin-notifications.html" },
      { id: "renewals", label: "Renewals", href: "/super-admin-renewals.html" },
      { id: "reports", label: "Reports", href: "/super-admin-reports.html" },
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
          <p class="text-sm font-semibold text-ocean-950">Superadmin</p>
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
      <p class="mt-2 leading-6">This software is licensed for subscribed hotel users only. Please review the governing legal documents before platform use.</p>
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
    hideProtectedPageUntilAuth();
    document.addEventListener("DOMContentLoaded", () => {
      requireSuperAdminAccess().catch(() => {
        redirectToSuperAdminLogin();
      });
      mountBrandChip();
      mountLegalFooter();
    });
  }

  window.superAdminCommon = {
    todayDate,
    addMonths,
    restoreToken,
    saveToken,
    authHeaders,
    hideLegacyField,
    getSession,
    listUsers,
    saveUser,
    deleteUser,
    logout,
    readJson,
    setMessage,
    clearMessage,
    setButtonLoading,
    suggestHotelId,
    suggestPoliceLoginId,
    pageChrome,
    quickNav,
    mountBrandChip,
    mountLegalFooter,
    requireSuperAdminAccess,
    showProtectedPageAfterAuth,
  };
})();
