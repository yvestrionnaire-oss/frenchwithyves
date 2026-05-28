// Pure attribution logic for teacher earnings.
// Each non-cancelled, non-trial lesson is matched to the oldest still-having-credits
// paid request from the same student. The lesson's value is that package's
// price-per-credit. Lessons beyond all paid credits earn $0.

export type EarningsLesson = {
  id: string;
  student_id: string;
  scheduled_at: string;
  lesson_type: string;
  status: string;
};

export type EarningsRequest = {
  id: string;
  student_id: string;
  status: string;
  package_id: string;
  credits_granted: number;
  paid_at: string | null;
  created_at: string;
};

export type EarningsPackage = {
  id: string;
  price_cents: number;
  is_free: boolean;
  credits: number;
};

export function pricePerCreditMap(packages: EarningsPackage[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of packages) {
    if (p.is_free || !p.credits) m.set(p.id, 0);
    else m.set(p.id, p.price_cents / 100 / p.credits);
  }
  return m;
}

export function computeLessonValues(
  lessons: EarningsLesson[],
  requests: EarningsRequest[],
  packages: EarningsPackage[],
): Map<string, number> {
  const prices = pricePerCreditMap(packages);
  const result = new Map<string, number>();

  const lessonsByStudent = new Map<string, EarningsLesson[]>();
  for (const l of lessons) {
    if (l.status === "cancelled") continue;
    if (l.lesson_type === "trial") {
      result.set(l.id, 0);
      continue;
    }
    const arr = lessonsByStudent.get(l.student_id) ?? [];
    arr.push(l);
    lessonsByStudent.set(l.student_id, arr);
  }

  const paidByStudent = new Map<string, EarningsRequest[]>();
  for (const r of requests) {
    if (r.status !== "paid") continue;
    const arr = paidByStudent.get(r.student_id) ?? [];
    arr.push(r);
    paidByStudent.set(r.student_id, arr);
  }

  for (const [studentId, studentLessons] of lessonsByStudent) {
    const sortedLessons = [...studentLessons].sort((a, b) =>
      a.scheduled_at.localeCompare(b.scheduled_at),
    );
    const sortedRequests = [...(paidByStudent.get(studentId) ?? [])].sort((a, b) =>
      (a.paid_at ?? a.created_at).localeCompare(b.paid_at ?? b.created_at),
    );

    let reqIdx = 0;
    let remaining = sortedRequests[0]?.credits_granted ?? 0;

    for (const lesson of sortedLessons) {
      while (reqIdx < sortedRequests.length && remaining <= 0) {
        reqIdx++;
        remaining = sortedRequests[reqIdx]?.credits_granted ?? 0;
      }
      if (reqIdx >= sortedRequests.length) {
        result.set(lesson.id, 0);
        continue;
      }
      const price = prices.get(sortedRequests[reqIdx].package_id) ?? 0;
      result.set(lesson.id, price);
      remaining--;
    }
  }

  return result;
}
