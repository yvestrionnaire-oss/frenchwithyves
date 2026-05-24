// Pure date/slot helpers used by the booking grid.
// Teacher's hours in Peru time (5:30am – 7:00pm).
export const PET_START_MIN = 5 * 60 + 30; // 330
export const PET_END_MIN = 19 * 60;       // 1140
export const SLOT_MINUTES = 30;
export const SLOT_MS = SLOT_MINUTES * 60_000;
export const MAX_WEEKS_AHEAD = 52;
export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function startOfWeek(d: Date) {
  const out = new Date(d);
  const day = out.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  out.setDate(out.getDate() + diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function addDays(d: Date, n: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function petMinutes(d: Date): number {
  // Minutes-since-midnight in America/Lima for the given UTC instant.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

export function isWithinTeachingHours(slot: Date, durationMin: number): boolean {
  const start = petMinutes(slot);
  const end = start + durationMin;
  if (end <= start) return false;
  return start >= PET_START_MIN && end <= PET_END_MIN;
}
