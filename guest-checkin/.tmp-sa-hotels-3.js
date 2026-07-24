
      const tokenInput = document.getElementById("superAdminToken");
      const refreshButton = document.getElementById("refreshButton");
      const hotelFilter = document.getElementById("hotelFilter");
      const hotelsGrid = document.getElementById("hotelsGrid");
      const listState = document.getElementById("listState");
      const totalHotelsStat = document.getElementById("totalHotelsStat");
      const reminderHotelsStat = document.getElementById("reminderHotelsStat");
      const inactiveHotelsStat = document.getElementById("inactiveHotelsStat");
      const hotelCardTemplate = document.getElementById("hotelCardTemplate");
      const paginationBar = document.getElementById("paginationBar");
      const previousPageButton = document.getElementById("previousPageButton");
      const nextPageButton = document.getElementById("nextPageButton");
      const paginationState = document.getElementById("paginationState");
      const HOTELS_PER_PAGE = 20;
      let allHotels = [];
      let currentPage = 1;

      superAdminCommon.restoreToken(tokenInput);

      function updateStats(hotels) {
        totalHotelsStat.textContent = String(hotels.length);
        reminderHotelsStat.textContent = String(hotels.filter((hotel) => hotel.payment_reminder_active).length);
        inactiveHotelsStat.textContent = String(hotels.filter((hotel) => hotel.is_active !== 1).length);
      }

      function editorMessage(element, message, tone) {
        superAdminCommon.setMessage(element, message, tone);
      }

      function parseStructuredAddress(address) {
        const result = {
          houseStreet: "",
          village: "",
          taluka: "Alibaug",
          district: "Raigad",
          pincode: "",
        };

        const text = String(address || "").trim();
        if (!text) {
          return result;
        }

        const patterns = [
          ["houseStreet", /^House\/Street:\s*(.*)$/i],
          ["village", /^Village:\s*(.*)$/i],
          ["taluka", /^Taluka:\s*(.*)$/i],
          ["district", /^District:\s*(.*)$/i],
          ["pincode", /^Pincode:\s*(.*)$/i],
        ];

        let matchedStructured = false;
        for (const line of text.split(/\r?\n/)) {
          for (const [key, pattern] of patterns) {
            const match = line.match(pattern);
            if (match) {
              result[key] = match[1].trim();
              matchedStructured = true;
            }
          }
        }

        if (!matchedStructured) {
          result.houseStreet = text;
        }

        if (!result.taluka) {
          result.taluka = "Alibaug";
        }
        if (!result.district) {
          result.district = "Raigad";
        }

        return result;
      }

      function renderHotelCard(hotel) {
        const fragment = hotelCardTemplate.content.cloneNode(true);
        const statusBadge = fragment.querySelector('[data-field="statusBadge"]');
        const reminderBox = fragment.querySelector('[data-field="reminderBox"]');
        const editor = fragment.querySelector('[data-role="editor"]');
        const editorMessageBox = fragment.querySelector('[data-role="editorMessage"]');
        const nameInput = fragment.querySelector('[data-input="name"]');
        const contactInput = fragment.querySelector('[data-input="contact"]');
        const addressHouseStreetInput = fragment.querySelector('[data-input="addressHouseStreet"]');
        const addressVillageInput = fragment.querySelector('[data-input="addressVillage"]');
        const addressTalukaInput = fragment.querySelector('[data-input="addressTaluka"]');
        const addressDistrictInput = fragment.querySelector('[data-input="addressDistrict"]');
        const addressPincodeInput = fragment.querySelector('[data-input="addressPincode"]');
        const gmailInput = fragment.querySelector('[data-input="gmail"]');
        const isActiveInput = fragment.querySelector('[data-input="isActive"]');
        const totalRoomsInput = fragment.querySelector('[data-input="totalRooms"]');
        const occupiedRoomsInput = fragment.querySelector('[data-input="occupiedRooms"]');
        const startDateInput = fragment.querySelector('[data-input="startDate"]');
        const endDateInput = fragment.querySelector('[data-input="endDate"]');

        const parsedAddress = parseStructuredAddress(hotel.address);
        fragment.querySelector('[data-field="name"]').textContent = hotel.name;
        fragment.querySelector('[data-field="id"]').textContent = hotel.id;
        fragment.querySelector('[data-field="adminEmail"]').textContent = hotel.admin_email || "Not set";
        fragment.querySelector('[data-field="adminPhone"]').textContent = hotel.admin_phone || hotel.contact || "Not set";
        fragment.querySelector('[data-field="address"]').textContent = hotel.address || "Not set";
        fragment.querySelector('[data-field="startDate"]').textContent = hotel.subscription_start_date;
        fragment.querySelector('[data-field="endDate"]').textContent = hotel.subscription_end_date;
        fragment.querySelector('[data-field="daysUntilExpiry"]').textContent = hotel.days_until_expiry ?? "Not available";
        fragment.querySelector('[data-field="rooms"]').textContent = `${hotel.occupied_rooms}/${hotel.total_rooms}`;

        if (hotel.is_active === 1) {
          statusBadge.textContent = "Active";
          statusBadge.className = "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700";
        } else {
          statusBadge.textContent = "Inactive";
          statusBadge.className = "rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700";
        }

        if (hotel.payment_reminder_active) {
          reminderBox.textContent = hotel.payment_reminder_message;
          reminderBox.classList.remove("hidden");
        }

        nameInput.value = hotel.name || "";
        contactInput.value = hotel.contact || "";
        addressHouseStreetInput.value = parsedAddress.houseStreet;
        addressVillageInput.value = parsedAddress.village;
        addressTalukaInput.value = parsedAddress.taluka;
        addressDistrictInput.value = parsedAddress.district;
        addressPincodeInput.value = parsedAddress.pincode;
        gmailInput.value = hotel.admin_email || "";
        isActiveInput.value = String(hotel.is_active);
        totalRoomsInput.value = hotel.total_rooms ?? 0;
        occupiedRoomsInput.value = hotel.occupied_rooms ?? 0;
        startDateInput.value = hotel.subscription_start_date || "";
        endDateInput.value = hotel.subscription_end_date || "";

        const toggleEditorButton = fragment.querySelector('[data-action="toggleEditor"]');
        toggleEditorButton.addEventListener("click", () => {
          editor.classList.toggle("hidden");
          toggleEditorButton.setAttribute("aria-expanded", String(!editor.classList.contains("hidden")));
          superAdminCommon.clearMessage(editorMessageBox);
        });

        fragment.querySelector('[data-action="cancelEditor"]').addEventListener("click", () => {
          editor.classList.add("hidden");
          toggleEditorButton.setAttribute("aria-expanded", "false");
          superAdminCommon.clearMessage(editorMessageBox);
          nameInput.value = hotel.name || "";
          contactInput.value = hotel.contact || "";
          addressHouseStreetInput.value = parsedAddress.houseStreet;
          addressVillageInput.value = parsedAddress.village;
          addressTalukaInput.value = parsedAddress.taluka;
          addressDistrictInput.value = parsedAddress.district;
          addressPincodeInput.value = parsedAddress.pincode;
          gmailInput.value = hotel.admin_email || "";
          isActiveInput.value = String(hotel.is_active);
          totalRoomsInput.value = hotel.total_rooms ?? 0;
          occupiedRoomsInput.value = hotel.occupied_rooms ?? 0;
          startDateInput.value = hotel.subscription_start_date || "";
          endDateInput.value = hotel.subscription_end_date || "";
        });

        fragment.querySelector('[data-action="deleteHotel"]').addEventListener("click", async () => {
          superAdminCommon.clearMessage(editorMessageBox);
          const confirmation = window.prompt(`Type the Hotel ID "${hotel.id}" to delete this hotel and its related server-side data permanently.`);
          if (confirmation !== hotel.id) {
            editorMessage(editorMessageBox, "Delete cancelled because the Hotel ID confirmation did not match.", "error");
            return;
          }

          try {
            const response = await fetch(`/api/super-admin/manage-hotel?hotel_id=${encodeURIComponent(hotel.id)}`, {
              method: "DELETE",
              headers: superAdminCommon.authHeaders(tokenInput),
            });
            const data = await superAdminCommon.readJson(response);
            if (!response.ok) {
              throw new Error(data.error || "Unable to delete hotel");
            }
            editorMessage(editorMessageBox, data.message || `${hotel.name} deleted successfully.`, "success");
            await loadHotels();
          } catch (error) {
            editorMessage(editorMessageBox, error instanceof Error ? error.message : "Unable to delete hotel", "error");
          }
        });

        editor.addEventListener("submit", async (event) => {
          event.preventDefault();
          superAdminCommon.clearMessage(editorMessageBox);
          try {
            const response = await fetch("/api/super-admin/manage-hotel", {
              method: "PUT",
              headers: superAdminCommon.authHeaders(tokenInput),
              body: JSON.stringify({
                id: hotel.id,
                hotel_id: hotel.id,
                name: nameInput.value.trim(),
                contact: contactInput.value.trim(),
                gmail_id: gmailInput.value.trim(),
                address_house_street: addressHouseStreetInput.value.trim(),
                address_village: addressVillageInput.value.trim(),
                address_taluka: addressTalukaInput.value.trim(),
                address_district: addressDistrictInput.value.trim(),
                address_pincode: addressPincodeInput.value.trim(),
                total_rooms: Number(totalRoomsInput.value || "0"),
                occupied_rooms: Number(occupiedRoomsInput.value || "0"),
                subscription_start_date: startDateInput.value,
                subscription_end_date: endDateInput.value,
                is_active: Number(isActiveInput.value),
              }),
            });
            const data = await superAdminCommon.readJson(response);
            if (!response.ok) {
              throw new Error(data.error || "Unable to update hotel");
            }
            editorMessage(editorMessageBox, `${data.hotel.name} updated successfully.`, "success");
            await loadHotels();
          } catch (error) {
            editorMessage(editorMessageBox, error instanceof Error ? error.message : "Unable to update hotel", "error");
          }
        });

        return fragment;
      }

      function applyHotelFilter(resetPage = false) {
        const query = hotelFilter.value.trim().toLowerCase();
        const filteredHotels = !query
          ? allHotels
          : allHotels.filter((hotel) =>
              [
                hotel.name,
                hotel.id,
                hotel.admin_email,
                hotel.admin_phone,
                hotel.contact,
              ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query))
            );

        hotelsGrid.innerHTML = "";

        updateStats(allHotels);
        if (!allHotels.length) {
          listState.textContent = "No hotels found yet.";
          paginationBar.classList.add("hidden");
          return;
        }

        if (!filteredHotels.length) {
          listState.textContent = "No hotels match this search.";
          paginationBar.classList.add("hidden");
          return;
        }

        if (resetPage) {
          currentPage = 1;
        }

        const totalPages = Math.max(1, Math.ceil(filteredHotels.length / HOTELS_PER_PAGE));
        if (currentPage > totalPages) {
          currentPage = totalPages;
        }

        const startIndex = (currentPage - 1) * HOTELS_PER_PAGE;
        const paginatedHotels = filteredHotels.slice(startIndex, startIndex + HOTELS_PER_PAGE);

        listState.textContent = `${filteredHotels.length} of ${allHotels.length} hotel account${allHotels.length === 1 ? "" : "s"} shown. Showing ${paginatedHotels.length} on this page.`;
        for (const hotel of paginatedHotels) {
          hotelsGrid.appendChild(renderHotelCard(hotel));
        }

        paginationState.textContent = `Page ${currentPage} of ${totalPages}`;
        previousPageButton.disabled = currentPage <= 1;
        nextPageButton.disabled = currentPage >= totalPages;
        paginationBar.classList.toggle("hidden", totalPages <= 1);
      }

      async function loadHotels() {
        listState.textContent = "Loading hotels...";
        hotelsGrid.innerHTML = "";
        try {
          const response = await fetch("/api/super-admin/manage-hotel", {
            headers: superAdminCommon.authHeaders(tokenInput),
          });
          const data = await superAdminCommon.readJson(response);
          if (!response.ok) {
            throw new Error(data.error || "Unable to load hotels");
          }
          allHotels = data.hotels || [];
          applyHotelFilter(true);
        } catch (error) {
          allHotels = [];
          updateStats([]);
          listState.textContent = error instanceof Error ? error.message : "Unable to load hotels";
          paginationBar.classList.add("hidden");
        }
      }

      refreshButton.addEventListener("click", async () => {
        superAdminCommon.saveToken(tokenInput);
        superAdminCommon.setButtonLoading(refreshButton, true, "Refreshing...");
        try {
          await loadHotels();
        } finally {
          superAdminCommon.setButtonLoading(refreshButton, false);
        }
      });

      previousPageButton.addEventListener("click", () => {
        if (currentPage <= 1) {
          return;
        }
        currentPage -= 1;
        applyHotelFilter(false);
      });

      nextPageButton.addEventListener("click", () => {
        currentPage += 1;
        applyHotelFilter(false);
      });

      hotelFilter.addEventListener("input", () => applyHotelFilter(true));

      loadHotels().catch(() => {});
    