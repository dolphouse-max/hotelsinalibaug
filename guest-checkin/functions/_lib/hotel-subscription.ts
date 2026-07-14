interface Env {
  DB: D1Database;
}

interface HotelSubscriptionRecord {
  id: string;
  is_active: number;
  subscription_end_date: string;
  subscription_start_date: string;
}

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function assertHotelCanAcceptGuestUploads(
  hotelId: string,
  env: Env
): Promise<void> {
  const hotel = await env.DB.prepare(
    `SELECT id, is_active, subscription_start_date, subscription_end_date
     FROM hotels
     WHERE id = ?1
     LIMIT 1`
  )
    .bind(hotelId)
    .first<HotelSubscriptionRecord>();

  if (!hotel) {
    throw new Error("Hotel not found");
  }

  if (hotel.is_active !== 1) {
    throw new Error("Hotel account is inactive");
  }

  const today = todayUtcDate();

  if (hotel.subscription_start_date > today) {
    throw new Error("Hotel subscription has not started yet");
  }

  if (hotel.subscription_end_date < today) {
    throw new Error("Hotel subscription expired");
  }
}
