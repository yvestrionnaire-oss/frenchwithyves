import { describe, it, expect } from "vitest";
import { computeLessonValues } from "@/lib/earnings";

const PACKAGES = [
  { id: "pkg-free",   price_cents: 0,     is_free: true,  credits: 1 },
  { id: "pkg-single", price_cents: 2000,  is_free: false, credits: 1 },
  { id: "pkg-five",   price_cents: 9500,  is_free: false, credits: 5 },
  { id: "pkg-ten",    price_cents: 18800, is_free: false, credits: 10 },
];

const req = (over: Partial<{ id: string; student_id: string; status: string; package_id: string; credits_granted: number; paid_at: string | null; created_at: string }>) => ({
  id: over.id ?? "r",
  student_id: over.student_id ?? "s1",
  status: over.status ?? "paid",
  package_id: over.package_id ?? "pkg-five",
  credits_granted: over.credits_granted ?? 5,
  paid_at: over.paid_at ?? "2026-01-01T00:00:00Z",
  created_at: over.created_at ?? "2026-01-01T00:00:00Z",
});

const lesson = (over: Partial<{ id: string; student_id: string; scheduled_at: string; lesson_type: string; status: string }>) => ({
  id: over.id ?? "l",
  student_id: over.student_id ?? "s1",
  scheduled_at: over.scheduled_at ?? "2026-02-01T15:00:00Z",
  lesson_type: over.lesson_type ?? "regular",
  status: over.status ?? "scheduled",
});

describe("computeLessonValues", () => {
  it("values all lessons at a single package's per-credit price", () => {
    const lessons = [
      lesson({ id: "l1", scheduled_at: "2026-02-01T15:00:00Z" }),
      lesson({ id: "l2", scheduled_at: "2026-02-08T15:00:00Z" }),
      lesson({ id: "l3", scheduled_at: "2026-02-15T15:00:00Z" }),
    ];
    const result = computeLessonValues(lessons, [req({})], PACKAGES);
    expect(result.get("l1")).toBeCloseTo(19);
    expect(result.get("l2")).toBeCloseTo(19);
    expect(result.get("l3")).toBeCloseTo(19);
  });

  it("FIFO-attributes lessons across two packages bought at different prices", () => {
    const requests = [
      req({ id: "rA", package_id: "pkg-five", credits_granted: 5, paid_at: "2026-01-01T00:00:00Z" }),
      req({ id: "rB", package_id: "pkg-ten",  credits_granted: 10, paid_at: "2026-03-01T00:00:00Z" }),
    ];
    const lessons = Array.from({ length: 7 }, (_, i) =>
      lesson({ id: `l${i + 1}`, scheduled_at: `2026-02-${String(i + 1).padStart(2, "0")}T15:00:00Z` })
    );
    const result = computeLessonValues(lessons, requests, PACKAGES);
    for (let i = 1; i <= 5; i++) expect(result.get(`l${i}`)).toBeCloseTo(19);
    for (let i = 6; i <= 7; i++) expect(result.get(`l${i}`)).toBeCloseTo(18.8);
  });

  it("returns 0 for lessons beyond all paid credits (no $20 fallback)", () => {
    const lessons = Array.from({ length: 6 }, (_, i) =>
      lesson({ id: `l${i + 1}`, scheduled_at: `2026-02-${String(i + 1).padStart(2, "0")}T15:00:00Z` })
    );
    const result = computeLessonValues(lessons, [req({ id: "rA", package_id: "pkg-five", credits_granted: 5 })], PACKAGES);
    expect(result.get("l5")).toBeCloseTo(19);
    expect(result.get("l6")).toBe(0);
  });

  it("ignores cancelled lessons entirely", () => {
    const lessons = [
      lesson({ id: "l1", status: "cancelled" }),
      lesson({ id: "l2" }),
    ];
    const result = computeLessonValues(lessons, [req({})], PACKAGES);
    expect(result.has("l1")).toBe(false);
    expect(result.get("l2")).toBeCloseTo(19);
  });

  it("values trial lessons at 0", () => {
    const lessons = [lesson({ id: "l1", lesson_type: "trial" })];
    const result = computeLessonValues(lessons, [req({ package_id: "pkg-free", credits_granted: 1 })], PACKAGES);
    expect(result.get("l1")).toBe(0);
  });

  it("ignores non-paid requests (approved-only does not contribute earnings)", () => {
    const requests = [req({ status: "approved" })];
    const lessons = [lesson({ id: "l1" })];
    const result = computeLessonValues(lessons, requests, PACKAGES);
    expect(result.get("l1")).toBe(0);
  });
});
