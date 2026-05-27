import { describe, it, expect } from "vitest";
import { isWithinTeachingHours, petMinutes, PET_START_MIN, PET_END_MIN } from "@/lib/booking";

// All timestamps in UTC — we exercise the Lima-time conversion that
// isWithinTeachingHours / petMinutes do internally.
//
// Lima is UTC-5 year-round (no DST), so 10:00:00 UTC = 05:00 Lima.

describe("petMinutes", () => {
  it("converts a UTC instant to Lima minutes-of-day", () => {
    expect(petMinutes(new Date("2026-06-01T15:30:00Z"))).toBe(630);
  });

  it("handles slots that cross midnight Lima", () => {
    expect(petMinutes(new Date("2026-06-02T04:00:00Z"))).toBe(1380);
  });
});

describe("isWithinTeachingHours", () => {
  it("accepts a 60-min slot starting exactly at the open boundary", () => {
    const slot = new Date("2026-06-01T10:30:00Z");
    expect(petMinutes(slot)).toBe(PET_START_MIN);
    expect(isWithinTeachingHours(slot, 60)).toBe(true);
  });

  it("rejects a slot that starts before the open boundary", () => {
    const slot = new Date("2026-06-01T10:00:00Z");
    expect(isWithinTeachingHours(slot, 60)).toBe(false);
  });

  it("rejects a 60-min slot whose end exceeds the close boundary", () => {
    const slot = new Date("2026-06-01T23:30:00Z");
    expect(isWithinTeachingHours(slot, 60)).toBe(false);
  });

  it("accepts a 30-min slot starting exactly at the close boundary - 30", () => {
    const slot = new Date("2026-06-01T23:30:00Z");
    expect(petMinutes(slot) + 30).toBe(PET_END_MIN);
    expect(isWithinTeachingHours(slot, 30)).toBe(true);
  });

  it("rejects zero or negative durations", () => {
    const slot = new Date("2026-06-01T15:00:00Z");
    expect(isWithinTeachingHours(slot, 0)).toBe(false);
  });
});
