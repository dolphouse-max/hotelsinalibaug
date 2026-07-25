(function () {
  const params = new URLSearchParams(window.location.search);
  const SESSION_PLACEHOLDER = "__app_session__";
  const HOTEL_LANGUAGE_KEY = "hotel_admin_language";
  const HOTEL_TRANSLATIONS = {
    en: {
      nav_home: "Home",
      nav_help: "Help",
      nav_profile: "Profile",
      nav_website: "Website",
      nav_inquiries: "Inquiries",
      nav_drive: "Drive",
      nav_staff: "Staff",
      nav_checkin: "Guest QR",
      nav_payment: "Pay QR",
      nav_reservations: "Bookings",
      nav_notifications: "Alerts",
      nav_messages: "Messages",
      nav_renewal: "Renewal",
      nav_guests: "Guests",
      nav_reports: "Reports",
      brand_private_app: "Private App",
      footer_text: "Private software for subscribed hotel users. Review the legal terms below before using the platform.",
      footer_subscription: "Subscription Agreement",
      footer_privacy: "Privacy Policy",
      footer_terms: "Terms & Conditions",
      footer_dpa: "Data Processing Agreement",
      footer_eula: "EULA",
      language_label: "Language",
      language_english: "English",
      language_marathi: "Marathi",
      report_nav_home: "Home",
      report_nav_help: "Help",
      report_nav_snapshot: "Snapshot",
      report_nav_checkins: "Check-Ins",
      report_nav_current: "Current Guests",
      report_nav_checkouts: "Check-Outs",
      report_nav_register: "Guest Register",
      report_nav_staff: "Staff",
      msg_loading: "Loading...",
      msg_saving: "Saving...",
    },
    mr: {
      nav_home: "मुख्यपृष्ठ",
      nav_help: "मदत",
      nav_profile: "प्रोफाइल",
      nav_website: "वेबसाइट",
      nav_inquiries: "चौकशी",
      nav_drive: "ड्राइव्ह",
      nav_staff: "स्टाफ",
      nav_checkin: "गेस्ट क्यूआर",
      nav_payment: "पेमेंट क्यूआर",
      nav_reservations: "बुकिंग",
      nav_notifications: "सूचना",
      nav_messages: "संदेश",
      nav_renewal: "नूतनीकरण",
      nav_guests: "गेस्ट",
      nav_reports: "रिपोर्ट्स",
      brand_private_app: "खाजगी अॅप",
      footer_text: "हे सॉफ्टवेअर फक्त सदस्य हॉटेल वापरकर्त्यांसाठी आहे. प्लॅटफॉर्म वापरण्यापूर्वी खालील कायदेशीर अटी वाचा.",
      footer_subscription: "सब्स्क्रिप्शन करार",
      footer_privacy: "गोपनीयता धोरण",
      footer_terms: "नियम व अटी",
      footer_dpa: "डेटा प्रक्रिया करार",
      footer_eula: "अंतिम वापरकर्ता परवाना करार",
      language_label: "भाषा",
      language_english: "इंग्रजी",
      language_marathi: "मराठी",
      report_nav_home: "मुख्यपृष्ठ",
      report_nav_help: "मदत",
      report_nav_snapshot: "स्नॅपशॉट",
      report_nav_checkins: "चेक-इन",
      report_nav_current: "सध्याचे गेस्ट",
      report_nav_checkouts: "चेक-आउट",
      report_nav_register: "गेस्ट रजिस्टर",
      report_nav_staff: "स्टाफ",
      msg_loading: "लोड होत आहे...",
      msg_saving: "सेव्ह होत आहे...",
    },
  };

  const HOTEL_PAGE_TRANSLATIONS = {
    "/hotel-admin-home.html": {
      en: {
        pageTitle: "Hotel Admin Home",
        heroTitle: "Hotel Admin Home",
        heroBody: "Keep the front desk flow simple. Save the hotel once, then open one focused page per task.",
        loginTitle: "Hotel admin login",
        loginBody: "Log in with the hotel admin email and password created by superadmin in Firebase.",
        emailLabel: "Hotel Admin Email",
        hotelIdLabel: "Hotel ID",
        passwordLabel: "Password",
        loginButton: "Login",
        changePasswordButton: "Change Password",
        forgotPasswordButton: "Send Password Reset Email",
        logoutButton: "Logout",
        taskTitle: "Task Pages",
        taskBadge: "Mobile First",
        taskIntro: "Open only one task page at a time on mobile so reception work stays simple and fast.",
        helpCardTitle: "Help",
        helpCardBody: "Open English and Marathi help for setup, each hotel page, reports, guest register, and subscription steps.",
        installTitle: "Install App",
        installBody: "Install the hotel app on this device for a cleaner full-screen experience and faster daily use.",
        installButton: "Install App",
        profileTitle: "Profile & Subscription",
        profileBody: "Update hotel details, room counts, and check current active status.",
        websiteTitle: "Website Page",
        websiteBody: "Edit your hotel webpage content and replace website photo slots while publish control stays with superadmin.",
        inquiriesTitle: "Website Inquiries",
        inquiriesBody: "See all inquiries sent from your public hotel webpage and call guests back quickly.",
        driveTitle: "Google Drive",
        driveBody: "Connect the hotel Drive folder used for guest and staff proof images.",
        qrTitle: "Guest QR & Link",
        qrBody: "Generate the guest self-check-in link and QR for reception display.",
        paymentTitle: "Pay Subscription",
        paymentBody: "Open the payment QR page and pay the subscription from any phone.",
        bookingsTitle: "Bookings & Reservations",
        bookingsBody: "Store walk-ins, future reservations, advance payments, and arrival/departure plans on this device.",
        notificationsTitle: "Notifications",
        notificationsBody: "Enable browser alerts and read subscription reminders or greeting messages.",
        messagesTitle: "Hotel Messages",
        messagesBody: "Ask nearby hotels about room availability, overflow guests, and quick coordination.",
        renewalTitle: "Renewal Requests",
        renewalBody: "Send renewal requests and track recent payments from superadmin.",
        staffTitle: "Staff Entry",
        staffBody: "Open the staff onboarding page and then continue to the staff registration form with hotel context.",
        guestsTitle: "Guest Check-Out",
        guestsBody: "Search in-house guests quickly and complete checkout room by room.",
        reportsTitle: "Reports",
        reportsBody: "Open hotel-level reports for check-ins, guests, guest register, and staff.",
      },
      mr: {
        pageTitle: "हॉटेल अॅडमिन मुख्यपृष्ठ",
        heroTitle: "हॉटेल अॅडमिन मुख्यपृष्ठ",
        heroBody: "फ्रंट डेस्कचा वापर सोपा ठेवा. हॉटेल एकदा जतन करा आणि मग प्रत्येक कामासाठी वेगळे पान उघडा.",
        loginTitle: "हॉटेल अॅडमिन लॉगिन",
        loginBody: "सुपरअॅडमिनने फायरबेसमध्ये तयार केलेल्या हॉटेल अॅडमिन ईमेल आणि पासवर्डने लॉगिन करा.",
        emailLabel: "हॉटेल अॅडमिन ईमेल",
        hotelIdLabel: "हॉटेल आयडी",
        passwordLabel: "पासवर्ड",
        loginButton: "लॉगिन",
        changePasswordButton: "पासवर्ड बदला",
        forgotPasswordButton: "पासवर्ड रीसेट ईमेल पाठवा",
        logoutButton: "लॉगआउट",
        taskTitle: "कामाची पाने",
        taskBadge: "मोबाइलसाठी",
        taskIntro: "मोबाइलवर एकावेळी एकच कामाचे पान उघडा, म्हणजे रिसेप्शनचे काम सोपे आणि जलद राहील.",
        helpCardTitle: "मदत",
        helpCardBody: "सेटअप, प्रत्येक हॉटेल पान, रिपोर्ट्स, गेस्ट रजिस्टर आणि सदस्यतेसाठी इंग्रजी व मराठी मदत उघडा.",
        installTitle: "अॅप इन्स्टॉल करा",
        installBody: "हे अॅप या उपकरणावर इन्स्टॉल करा, म्हणजे पूर्ण-स्क्रीन वापर आणि रोजचे काम अधिक सोपे होईल.",
        installButton: "अॅप इन्स्टॉल करा",
        profileTitle: "प्रोफाइल आणि सदस्यता",
        profileBody: "हॉटेलची माहिती, रूम संख्या अद्ययावत करा आणि सध्याची सक्रिय स्थिती तपासा.",
        websiteTitle: "वेबसाइट पान",
        websiteBody: "आपल्या हॉटेलच्या वेबपानातील मजकूर बदला आणि फोटो स्लॉट अद्ययावत करा. प्रकाशित करण्याचा अधिकार सुपरअॅडमिनकडे राहील.",
        inquiriesTitle: "वेबसाइट चौकशी",
        inquiriesBody: "आपल्या सार्वजनिक हॉटेल वेबपानावरून आलेल्या सर्व चौकशा पाहा आणि पाहुण्यांना लगेच संपर्क करा.",
        driveTitle: "गूगल ड्राइव्ह",
        driveBody: "गेस्ट आणि स्टाफ पुरावा-प्रतिमांसाठी वापरला जाणारा हॉटेल ड्राइव्ह फोल्डर जोडा.",
        qrTitle: "गेस्ट क्यूआर आणि लिंक",
        qrBody: "रिसेप्शनसाठी गेस्ट स्वयं-चेक-इन लिंक आणि क्यूआर तयार करा.",
        paymentTitle: "सदस्यता भरा",
        paymentBody: "पेमेंट क्यूआर पान उघडा आणि कोणत्याही फोनवरून सदस्यता भरा.",
        bookingsTitle: "बुकिंग आणि आरक्षणे",
        bookingsBody: "या उपकरणावर वॉक-इन, भविष्यातील आरक्षणे, आगाऊ देयके आणि येणे-जाण्याचे नियोजन जतन करा.",
        notificationsTitle: "सूचना",
        notificationsBody: "ब्राउझर सूचना सुरू करा आणि सदस्यता स्मरणपत्रे किंवा शुभेच्छा संदेश वाचा.",
        messagesTitle: "हॉटेल संदेश",
        messagesBody: "जवळच्या हॉटेलशी रूम उपलब्धता, जादा पाहुणे आणि तातडीच्या समन्वयासाठी संदेश करा.",
        renewalTitle: "नूतनीकरण विनंत्या",
        renewalBody: "नूतनीकरण विनंत्या पाठवा आणि सुपरअॅडमिनकडील अलीकडील देयके तपासा.",
        staffTitle: "स्टाफ नोंदणी",
        staffBody: "स्टाफ नोंदणीचे पान उघडा आणि हॉटेल संदर्भासह स्टाफ नोंदणी फॉर्मवर जा.",
        guestsTitle: "गेस्ट चेक-आउट",
        guestsBody: "सध्या राहणारे गेस्ट पटकन शोधा आणि रूमनुसार चेक-आउट पूर्ण करा.",
        reportsTitle: "रिपोर्ट्स",
        reportsBody: "चेक-इन, गेस्ट, गेस्ट रजिस्टर आणि स्टाफसाठी हॉटेल-स्तरीय रिपोर्ट्स उघडा.",
      },
    },
    "/hotel-reports-home.html": {
      en: {
        pageTitle: "Hotel Reports Home",
        backButton: "Go Back To Hotel Home",
        heroTitle: "Hotel Reports",
        heroBody: "Save report filters once, then open one focused report page at a time on mobile.",
        intro: "Use one report page per task: snapshot, check-ins, current guests, check-outs, guest register, or staff register.",
        hotelIdLabel: "Hotel ID",
        saveButton: "Save Report Filters",
        helpTitle: "Help",
        helpBody: "Read English and Marathi guidance for setup, reports, guest register, staff, payments, and renewals.",
        snapshotTitle: "Hotel Snapshot",
        snapshotBody: "Summary metrics, room occupancy, report range, and trial status.",
        checkinsTitle: "Today's Check-Ins",
        checkinsBody: "Guests checked in today for the selected hotel.",
        currentTitle: "Current Guests",
        currentBody: "All currently in-house guests for front desk review.",
        checkoutsTitle: "Today's Check-Outs",
        checkoutsBody: "Guests checked out today.",
        registerTitle: "Guest Register",
        registerBody: "Guest history with search and CSV export.",
        staffTitle: "Staff Register",
        staffBody: "Staff list with search and CSV export.",
      },
      mr: {
        pageTitle: "हॉटेल रिपोर्ट्स मुख्यपृष्ठ",
        backButton: "हॉटेल मुख्यपृष्ठावर परत जा",
        heroTitle: "हॉटेल रिपोर्ट्स",
        heroBody: "रिपोर्ट फिल्टर्स एकदाच जतन करा आणि मग मोबाइलवर एकावेळी एक रिपोर्ट पान उघडा.",
        intro: "प्रत्येक कामासाठी वेगळे रिपोर्ट पान वापरा: स्नॅपशॉट, चेक-इन, सध्याचे गेस्ट, चेक-आउट, गेस्ट रजिस्टर किंवा स्टाफ रजिस्टर.",
        hotelIdLabel: "हॉटेल आयडी",
        saveButton: "रिपोर्ट फिल्टर्स जतन करा",
        helpTitle: "मदत",
        helpBody: "सेटअप, रिपोर्ट्स, गेस्ट रजिस्टर, स्टाफ, पेमेंट आणि नूतनीकरणासाठी इंग्रजी व मराठी मार्गदर्शन वाचा.",
        snapshotTitle: "हॉटेल स्नॅपशॉट",
        snapshotBody: "एकूण मोजणी, भरलेल्या रूम, रिपोर्ट कालावधी आणि चाचणी स्थिती.",
        checkinsTitle: "आजचे चेक-इन",
        checkinsBody: "निवडलेल्या हॉटेलचे आज चेक-इन झालेले गेस्ट.",
        currentTitle: "सध्याचे गेस्ट",
        currentBody: "फ्रंट डेस्क पाहणीसाठी सध्या राहणारे सर्व गेस्ट.",
        checkoutsTitle: "आजचे चेक-आउट",
        checkoutsBody: "आज चेक-आउट झालेले गेस्ट.",
        registerTitle: "गेस्ट रजिस्टर",
        registerBody: "शोध आणि सीएसव्ही निर्यातसह गेस्ट इतिहास.",
        staffTitle: "स्टाफ रजिस्टर",
        staffBody: "शोध आणि सीएसव्ही निर्यातसह स्टाफ यादी.",
      },
    },
    "/hotel-admin-profile.html": {
      en: {
        pageTitle: "Hotel Profile",
        backLink: "Back to Home",
        badge: "Profile",
        heroTitle: "Profile & Subscription",
        heroBody: "Review your hotel account, keep contact details current, and make sure room counts stay accurate.",
        intro: "Use this page only for hotel details, room counts, and checking the current paid-through date.",
        sessionLabel: "Session",
        hotelIdLabel: "Hotel ID",
        loadButton: "Load Hotel",
        accountStatusLabel: "Account Status",
        paidThroughLabel: "Paid Through",
        notLoaded: "Not loaded",
        hotelNameLabel: "Hotel Name",
        contactLabel: "Mobile Number",
        adminEmailLabel: "Hotel Admin Gmail",
        addressHouseStreetLabel: "Address: House No. / Street",
        addressVillageLabel: "Village",
        addressTalukaLabel: "Taluka",
        addressDistrictLabel: "District",
        addressPincodeLabel: "Pincode",
        totalRoomsLabel: "Total Rooms",
        occupiedRoomsLabel: "Occupied Rooms",
        saveButton: "Save Profile",
      },
      mr: {
        pageTitle: "हॉटेल प्रोफाइल",
        backLink: "मुख्यपृष्ठावर परत",
        badge: "प्रोफाइल",
        heroTitle: "प्रोफाइल आणि सदस्यता",
        heroBody: "आपले हॉटेल खाते तपासा, संपर्क माहिती अद्ययावत ठेवा आणि रूम संख्या बरोबर आहेत याची खात्री करा.",
        intro: "हे पान फक्त हॉटेलची माहिती, रूम संख्या आणि सध्याची सशुल्क अंतिम तारीख तपासण्यासाठी वापरा.",
        sessionLabel: "सेशन",
        hotelIdLabel: "हॉटेल आयडी",
        loadButton: "हॉटेल लोड करा",
        accountStatusLabel: "खाते स्थिती",
        paidThroughLabel: "सशुल्क तारीख",
        notLoaded: "लोड झालेले नाही",
        hotelNameLabel: "हॉटेलचे नाव",
        contactLabel: "मोबाइल नंबर",
        adminEmailLabel: "हॉटेल अॅडमिन जीमेल",
        addressHouseStreetLabel: "पत्ता: घर क्रमांक / रस्ता",
        addressVillageLabel: "गाव",
        addressTalukaLabel: "तालुका",
        addressDistrictLabel: "जिल्हा",
        addressPincodeLabel: "पिनकोड",
        totalRoomsLabel: "एकूण रूम",
        occupiedRoomsLabel: "भरलेल्या रूम",
        saveButton: "प्रोफाइल सेव्ह करा",
      },
    },
  };

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

  function getLanguage() {
    const stored = String(localStorage.getItem(HOTEL_LANGUAGE_KEY) || "").trim().toLowerCase();
    return stored === "mr" ? "mr" : "en";
  }

  function setLanguage(language) {
    const selected = language === "mr" ? "mr" : "en";
    localStorage.setItem(HOTEL_LANGUAGE_KEY, selected);
    document.documentElement.lang = selected === "mr" ? "mr" : "en";
    return selected;
  }

  function t(key, language = getLanguage()) {
    const selected = language === "mr" ? "mr" : "en";
    return HOTEL_TRANSLATIONS[selected]?.[key] || HOTEL_TRANSLATIONS.en[key] || key;
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
      { id: "home", label: t("nav_home"), href: "/hotel-admin-home.html" },
      { id: "help", label: t("nav_help"), href: "/hotel-help.html" },
      { id: "profile", label: t("nav_profile"), href: "/hotel-admin-profile.html" },
      { id: "website", label: t("nav_website"), href: "/hotel-admin-website.html" },
      { id: "inquiries", label: t("nav_inquiries"), href: "/hotel-admin-inquiries.html" },
      { id: "drive", label: t("nav_drive"), href: "/hotel-admin-google-drive.html" },
      { id: "staff", label: t("nav_staff"), href: "/hotel-admin-staff.html" },
      { id: "checkin", label: t("nav_checkin"), href: "/hotel-admin-checkin.html" },
      { id: "payment", label: t("nav_payment"), href: "/hotel-admin-payment.html" },
      { id: "reservations", label: t("nav_reservations"), href: "/hotel-admin-reservations.html" },
      { id: "notifications", label: t("nav_notifications"), href: "/hotel-admin-notifications.html" },
      { id: "messages", label: t("nav_messages"), href: "/hotel-admin-messages.html" },
      { id: "renewal", label: t("nav_renewal"), href: "/hotel-admin-renewal.html" },
      { id: "guests", label: t("nav_guests"), href: "/hotel-admin-guests.html" },
      { id: "reports", label: t("nav_reports"), href: "/reports.html" },
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
          <p class="text-sm font-semibold text-ocean">${t("brand_private_app")}</p>
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
      <div class="flex items-center gap-3">
        <img src="/logo.webp" alt="Hotels In Alibaug" class="h-10 w-10 rounded-xl object-cover">
        <p class="font-semibold text-slate-800">Hotels In Alibaug</p>
      </div>
      <p class="mt-2 leading-6">${t("footer_text")}</p>
      <div class="mt-4 flex flex-wrap gap-2">
        <a href="/software-subscription-agreement.html" class="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">${t("footer_subscription")}</a>
        <a href="/privacy-policy.html" class="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">${t("footer_privacy")}</a>
        <a href="/terms-and-conditions.html" class="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">${t("footer_terms")}</a>
        <a href="/data-processing-agreement.html" class="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">${t("footer_dpa")}</a>
        <a href="/end-user-license-agreement.html" class="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">${t("footer_eula")}</a>
      </div>
    `;

    main.appendChild(footer);
  }

  function mountLanguageSwitcher() {
    if (document.getElementById("hotelLanguageSwitcher")) {
      return;
    }

    const brand = document.getElementById("appBrandChip");
    const main = document.querySelector("main");
    if (!main) {
      return;
    }

    const selected = getLanguage();
    const wrapper = document.createElement("div");
    wrapper.id = "hotelLanguageSwitcher";
    wrapper.className = "mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm";
    wrapper.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-semibold text-slate-700">${t("language_label", selected)}</p>
        <div class="inline-flex rounded-2xl bg-slate-100 p-1">
          <button type="button" data-lang="en" class="hotel-language-button rounded-xl px-4 py-2 text-sm font-semibold transition ${selected === "en" ? "bg-ocean text-white" : "text-slate-700"}">${t("language_english", selected)}</button>
          <button type="button" data-lang="mr" class="hotel-language-button rounded-xl px-4 py-2 text-sm font-semibold transition ${selected === "mr" ? "bg-ocean text-white" : "text-slate-700"}">${t("language_marathi", selected)}</button>
        </div>
      </div>
    `;

    if (brand) {
      brand.insertAdjacentElement("afterend", wrapper);
    } else {
      main.prepend(wrapper);
    }

    wrapper.querySelectorAll(".hotel-language-button").forEach((button) => {
      button.addEventListener("click", () => {
        setLanguage(button.dataset.lang || "en");
        window.location.reload();
      });
    });
  }

  function applyPageTranslations(pageKey) {
    const language = getLanguage();
    const pageSet = HOTEL_PAGE_TRANSLATIONS[pageKey]?.[language];
    if (!pageSet) {
      return;
    }

    document.documentElement.lang = language === "mr" ? "mr" : "en";
    if (pageSet.pageTitle) {
      document.title = pageSet.pageTitle;
    }

    const selectorMap = {
      "/hotel-admin-home.html": {
        "body main section:first-of-type .bg-[linear-gradient(135deg,#0b1824_0%,#17324a_68%,#244767_100%)] h1": "heroTitle",
        "body main section:first-of-type .bg-[linear-gradient(135deg,#0b1824_0%,#17324a_68%,#244767_100%)] p.mt-2": "heroBody",
        "body main section:first-of-type .rounded-[1.5rem] .text-sm.font-semibold": "loginTitle",
        "body main section:first-of-type .rounded-[1.5rem] p.mt-1": "loginBody",
        "label[for='hotelAdminEmail']": "emailLabel",
        "label[for='hotelId']": "hotelIdLabel",
        "label[for='hotelPassword']": "passwordLabel",
        "#loginButton": "loginButton",
        "#changePasswordButton": "changePasswordButton",
        "#forgotPasswordButton": "forgotPasswordButton",
        "#logoutButton": "logoutButton",
        "body main > section:nth-of-type(2) h2": "taskTitle",
        "body main > section:nth-of-type(2) .text-xs.uppercase": "taskBadge",
        "body main > section:nth-of-type(2) .mb-4.rounded-\\[1\\.5rem\\]": "taskIntro",
        "[data-target='hotel-help.html'] .text-lg": "helpCardTitle",
        "[data-target='hotel-help.html'] .mt-1": "helpCardBody",
        "#installAppButton": "installButton",
      },
      "/hotel-reports-home.html": {
        "#backToHotelHomeLink": "backButton",
        "section:first-of-type h1": "heroTitle",
        "section:first-of-type .bg-[linear-gradient(135deg,#0b1824_0%,#17324a_68%,#244767_100%)] p.mt-2": "heroBody",
        "section:first-of-type .mb-4.rounded-\\[1\\.5rem\\]": "intro",
        "label[for='hotelId']": "hotelIdLabel",
        "#saveFiltersButton": "saveButton",
      },
      "/hotel-admin-profile.html": {
        "a[href='/hotel-admin-home.html']": "backLink",
        "span.rounded-full": "badge",
        "section h1": "heroTitle",
        "section .bg-[linear-gradient(135deg,#0b1824_0%,#17324a_68%,#244767_100%)] p.mt-2": "heroBody",
        "section .mb-4.rounded-\\[1\\.5rem\\]": "intro",
        "label[for='hotelAdminToken']": "sessionLabel",
        "label[for='hotelId']": "hotelIdLabel",
        "#loadButton": "loadButton",
        "#saveButton": "saveButton",
        "label[for='hotelName']": "hotelNameLabel",
        "label[for='contact']": "contactLabel",
        "label[for='adminEmail']": "adminEmailLabel",
        "label[for='addressHouseStreet']": "addressHouseStreetLabel",
        "label[for='addressVillage']": "addressVillageLabel",
        "label[for='addressTaluka']": "addressTalukaLabel",
        "label[for='addressDistrict']": "addressDistrictLabel",
        "label[for='addressPincode']": "addressPincodeLabel",
        "label[for='totalRooms']": "totalRoomsLabel",
        "label[for='occupiedRooms']": "occupiedRoomsLabel",
      },
    };

    Object.entries(selectorMap[pageKey] || {}).forEach(([selector, key]) => {
      const node = document.querySelector(selector);
      if (node && pageSet[key]) {
        node.textContent = pageSet[key];
      }
    });

    if (pageKey === "/hotel-admin-home.html") {
      const cards = {
        "[data-target='/hotel-admin-website.html']": ["websiteTitle", "websiteBody"],
        "[data-target='hotel-admin-inquiries.html']": ["inquiriesTitle", "inquiriesBody"],
        "[data-target='hotel-admin-google-drive.html']": ["driveTitle", "driveBody"],
        "[data-target='hotel-admin-checkin.html']": ["qrTitle", "qrBody"],
        "[data-target='hotel-admin-payment.html']": ["paymentTitle", "paymentBody"],
        "[data-target='hotel-admin-reservations.html']": ["bookingsTitle", "bookingsBody"],
        "[data-target='hotel-admin-notifications.html']": ["notificationsTitle", "notificationsBody"],
        "[data-target='hotel-admin-messages.html']": ["messagesTitle", "messagesBody"],
        "[data-target='hotel-admin-renewal.html']": ["renewalTitle", "renewalBody"],
        "[data-target='hotel-admin-staff.html']": ["staffTitle", "staffBody"],
        "[data-target='hotel-admin-guests.html']": ["guestsTitle", "guestsBody"],
        "[data-target='reports.html']": ["reportsTitle", "reportsBody"],
        "[data-target='hotel-admin-profile.html']": ["profileTitle", "profileBody"],
      };

      Object.entries(cards).forEach(([selector, keys]) => {
        const card = document.querySelector(selector);
        if (!card) {
          return;
        }
        const title = card.querySelector(".text-lg");
        const body = card.querySelector(".mt-1");
        if (title && pageSet[keys[0]]) {
          title.textContent = pageSet[keys[0]];
        }
        if (body && pageSet[keys[1]]) {
          body.textContent = pageSet[keys[1]];
        }
      });
    }

    if (pageKey === "/hotel-reports-home.html") {
      const cards = {
        "[data-target='hotel-help.html']": ["helpTitle", "helpBody"],
        "[data-target='hotel-report-snapshot.html']": ["snapshotTitle", "snapshotBody"],
        "[data-target='hotel-report-checkins.html']": ["checkinsTitle", "checkinsBody"],
        "[data-target='hotel-report-current-guests.html']": ["currentTitle", "currentBody"],
        "[data-target='hotel-report-checkouts.html']": ["checkoutsTitle", "checkoutsBody"],
        "[data-target='hotel-report-guest-register.html']": ["registerTitle", "registerBody"],
        "[data-target='hotel-report-staff-register.html']": ["staffTitle", "staffBody"],
      };

      Object.entries(cards).forEach(([selector, keys]) => {
        const card = document.querySelector(selector);
        if (!card) {
          return;
        }
        const title = card.querySelector(".text-lg");
        const body = card.querySelector(".mt-1");
        if (title && pageSet[keys[0]]) {
          title.textContent = pageSet[keys[0]];
        }
        if (body && pageSet[keys[1]]) {
          body.textContent = pageSet[keys[1]];
        }
      });
    }

    if (pageKey === "/hotel-admin-profile.html") {
      const smallCards = document.querySelectorAll(".mt-5.grid .rounded-2xl");
      if (smallCards[0]) {
        const title = smallCards[0].querySelector(".text-sm");
        const value = smallCards[0].querySelector(".mt-1");
        if (title) {
          title.textContent = pageSet.accountStatusLabel;
        }
        if (value && value.textContent.trim() === "Not loaded") {
          value.textContent = pageSet.notLoaded;
        }
      }
      if (smallCards[1]) {
        const title = smallCards[1].querySelector(".text-sm");
        const value = smallCards[1].querySelector(".mt-1");
        if (title) {
          title.textContent = pageSet.paidThroughLabel;
        }
        if (value && value.textContent.trim() === "Not loaded") {
          value.textContent = pageSet.notLoaded;
        }
      }
    }
  }

  function getPageTranslations(pageKey, language = getLanguage()) {
    const selected = language === "mr" ? "mr" : "en";
    return HOTEL_PAGE_TRANSLATIONS[pageKey]?.[selected] || HOTEL_PAGE_TRANSLATIONS[pageKey]?.en || null;
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
      setLanguage(getLanguage());
      mountBrandChip();
      mountLanguageSwitcher();
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
    getLanguage,
    setLanguage,
    t,
    loadHotelProfile,
    quickNav,
    mountBrandChip,
    mountLanguageSwitcher,
    mountLegalFooter,
    applyPageTranslations,
    getPageTranslations,
  };
})();
