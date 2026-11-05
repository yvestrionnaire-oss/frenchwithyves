// Regression tests for the "late join" bug: a student who connects after the
// scheduled start (e.g. Ryan at 2:05 for a 2:00 class) must still see the lesson
// as live — joinable, not "Completed". isLessonOver() is the single source of
// truth both dashboards and the lesson row use to decide that.
import { describe, expect, it } from "vitest";
import { isLessonOver, LESSON_GRACE_MIN } from "@/components/LessonsView";

const MIN = 60_000;
// Fixed "now" so the tests don't depend on the wall clock.
const NOW = new Date("2026-02-01T14:00:00Z").getTime(); // 2:00pm

function lesson(startOffsetMin: number, overrides: Partial<{ duration_minutes: number; status: string }> = {}) {
  return {
    scheduled_at: new Date(NOW + startOffsetMin * MIN).toISOString(),
    duration_minutes: overrides.duration_minutes ?? 60,
    status: overrides.status ?? "scheduled",
  };
}

describe("isLessonOver", () => {
  it("is NOT over just because the start time passed (Ryan's 2:05 case)", () => {
    // Class started 5 min ago; still mid-lesson.
    expect(isLessonOver(lesson(-5), NOW)).toBe(false);
  });

  it("is NOT over right up to the scheduled end", () => {
    // 60-min class that started exactly 60 min ago — end is now.
    expect(isLessonOver(lesson(-60), NOW)).toBe(false); // within grace
  });

  it("stays joinable through the grace window after the end", () => {
    // Ended 10 min ago, grace is 15 — still live.
    expect(isLessonOver(lesson(-70), NOW)).toBe(false);
    expect(LESSON_GRACE_MIN).toBeGreaterThanOrEqual(10);
  });

  it("is over once end + grace has fully passed", () => {
    // 60-min class started 90 min ago: ended 30 min ago, past the 15-min grace.
    expect(isLessonOver(lesson(-90), NOW)).toBe(true);
  });

  it("is not over for a future lesson", () => {
    expect(isLessonOver(lesson(+120), NOW)).toBe(false);
  });

  it("respects an explicit completed status immediately", () => {
    // Even a lesson still inside its time window counts as over if marked done.
    expect(isLessonOver(lesson(-5, { status: "completed" }), NOW)).toBe(true);
  });

  it("treats a cancelled lesson as over", () => {
    expect(isLessonOver(lesson(+120, { status: "cancelled" }), NOW)).toBe(true);
  });

  it("uses each lesson's own duration", () => {
    // A 30-min class started 40 min ago ended 10 min ago -> still in grace.
    expect(isLessonOver(lesson(-40, { duration_minutes: 30 }), NOW)).toBe(false);
    // ...but 50 min after start it's 20 min past end -> over.
    expect(isLessonOver(lesson(-50, { duration_minutes: 30 }), NOW)).toBe(true);
  });
});
