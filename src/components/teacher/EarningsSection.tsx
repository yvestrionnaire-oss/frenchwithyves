import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";

type Pkg = { id: string; name: string; price_cents: number; is_free: boolean; credits: number };
type Request = {
  id: string;
  student_id: string;
  package_id: string;
  status: "pending" | "payment_link_sent" | "approved" | "paid" | "cancelled";
  credits_granted: number;
  created_at: string;
  paid_at: string | null;
};
type Lesson = {
  id: string;
  student_id: string;
  scheduled_at: string;
  duration_minutes: number;
  lesson_type: string;
  status: string;
  meet_link: string | null;
};

const fmtUSD = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const fmtRange = (a: Date, b: Date) => {
  const o: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" };
  return `${a.toLocaleDateString(undefined, o)} – ${b.toLocaleDateString(undefined, o)}`;
};

export function EarningsSection({
  lessons,
  requests,
  packages,
}: {
  lessons: Lesson[];
  requests: Request[];
  packages: Pkg[];
}) {
  const pricePerCredit = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of packages) {
      if (p.is_free || !p.credits) map.set(p.id, 0);
      else map.set(p.id, p.price_cents / 100 / p.credits);
    }
    return map;
  }, [packages]);

  function lessonValue(l: Lesson): number {
    if (l.lesson_type === "trial") return 0;
    const paid = requests
      .filter((r) => r.student_id === l.student_id && r.status === "paid")
      .sort((a, b) => (a.paid_at ?? "").localeCompare(b.paid_at ?? ""));
    const pkgId = paid[paid.length - 1]?.package_id;
    const v = pkgId ? pricePerCredit.get(pkgId) : undefined;
    return typeof v === "number" ? v : 20;
  }

  const now = new Date();
  const startOfWeek = (() => {
    const d = new Date(now);
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const endOfYear = new Date(now.getFullYear(), 11, 31);

  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
  const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);

  function sum(predicate: (l: Lesson) => boolean): number {
    return lessons.filter(predicate).reduce((s, l) => s + lessonValue(l), 0);
  }
  const inRange = (iso: string, from: Date, to: Date) => {
    const t = new Date(iso).getTime();
    return t >= from.getTime() && t <= to.getTime() + 86_400_000 - 1;
  };

  const projectedWeek = sum((l) =>
    l.status !== "cancelled"
    && new Date(l.scheduled_at).getTime() >= now.getTime()
    && inRange(l.scheduled_at, startOfWeek, endOfWeek)
  );
  const projectedMonth = sum((l) => l.status !== "cancelled" && inRange(l.scheduled_at, now, endOfMonth));
  const projectedYear = sum((l) => l.status !== "cancelled" && inRange(l.scheduled_at, now, endOfYear));

  const isEarned = (l: Lesson) => l.status !== "cancelled" && new Date(l.scheduled_at).getTime() < now.getTime();
  const earnedThisMonth = sum((l) => isEarned(l) && inRange(l.scheduled_at, startOfMonth, now));
  const earnedLastMonth = sum((l) => isEarned(l) && inRange(l.scheduled_at, startOfLastMonth, endOfLastMonth));
  const earnedThisYear = sum((l) => isEarned(l) && inRange(l.scheduled_at, startOfYear, now));
  const earnedLastYear = sum((l) => isEarned(l) && inRange(l.scheduled_at, startOfLastYear, endOfLastYear));
  const earnedAllTime = sum(isEarned);

  return (
    <section className="space-y-6">
      <div>
        <div className="mb-3">
          <h2 className="text-2xl font-bold">Projected Earnings</h2>
          <p className="text-sm text-muted-foreground">Based on your booked lessons</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <EarningCard title="This Week" subtitle="Your Projected Earnings" amount={projectedWeek} range={fmtRange(startOfWeek, endOfWeek)} />
          <EarningCard title="This Month" subtitle="Your Projected Earnings" amount={projectedMonth} range={fmtRange(now, endOfMonth)} />
          <EarningCard title="This Year" subtitle="Your Projected Earnings" amount={projectedYear} range={fmtRange(now, endOfYear)} />
        </div>
      </div>

      <div>
        <div className="mb-3">
          <h2 className="text-2xl font-bold">Earnings</h2>
          <p className="text-sm text-muted-foreground">Based on completed lessons</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <EarningCard title="This Month" subtitle="Your Earnings" amount={earnedThisMonth} range={fmtRange(startOfMonth, now)} />
          <EarningCard title="Last Month" subtitle="Your Earnings" amount={earnedLastMonth} range={fmtRange(startOfLastMonth, endOfLastMonth)} />
          <EarningCard title="This Year" subtitle="Your Earnings" amount={earnedThisYear} range={fmtRange(startOfYear, now)} />
          <EarningCard title="Last Year" subtitle="Your Earnings" amount={earnedLastYear} range={fmtRange(startOfLastYear, endOfLastYear)} />
          <EarningCard title="All Time" subtitle="Your Earnings" amount={earnedAllTime} range="Since you started" />
        </div>
      </div>
    </section>
  );
}

function EarningCard({
  title,
  subtitle,
  amount,
  range,
}: {
  title: string;
  subtitle: string;
  amount: number;
  range: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div>
          <div className="text-lg font-bold leading-tight">{title}</div>
          <div className="text-sm text-muted-foreground">{subtitle}</div>
        </div>
        <div className="text-3xl font-bold text-primary">{fmtUSD(amount)}</div>
        <div className="text-xs text-muted-foreground">{range}</div>
      </CardContent>
    </Card>
  );
}
