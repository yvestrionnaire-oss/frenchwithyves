export function formatPrice(price_cents: number, currency = "USD", isFree = false) {
  if (isFree || price_cents === 0) return "Free";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: price_cents % 100 === 0 ? 0 : 2,
  }).format(price_cents / 100);
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function buildHourTimes() {
  // Hourly slots from 08:00 to 21:00 inclusive
  return Array.from({ length: 14 }, (_, i) => {
    const h = 8 + i;
    return `${String(h).padStart(2, "0")}:00`;
  });
}

export function displayTime(time: string) {
  const [hStr, m] = time.split(":");
  const h = Number(hStr);
  const suffix = h >= 12 ? "PM" : "AM";
  const dh = h % 12 || 12;
  return `${dh}:${m} ${suffix}`;
}

export function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
export function formatDateTime(d: Date) {
  return `${formatDate(d)} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

// Build dates for current week (Sun-Sat) starting from given date
export function getWeekDates(reference: Date) {
  const d = new Date(reference);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return x;
  });
}
