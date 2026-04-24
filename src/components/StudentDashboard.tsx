import { useEffect, useState } from "react";
import { BookOpen, CalendarDays, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import BookLessonDialog from "./BookLessonDialog";

type Lesson = { id: string; scheduled_at: string; status: string };
type PReq = {
  id: string;
  status: "pending" | "paid" | "cancelled";
  created_at: string;
  packages: { name: string; price_cents: number; currency: string } | null;
};

export default function StudentDashboard({ displayName }: { displayName: string }) {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [requests, setRequests] = useState<PReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"purchase" | "book">("purchase");

  const refresh = async () => {
    if (!user) return;
    const [{ data: bal }, { data: ls }, { data: rq }] = await Promise.all([
      supabase.rpc("credit_balance", { _user_id: user.id }),
      supabase.from("lessons").select("id, scheduled_at, status").eq("student_id", user.id).order("scheduled_at", { ascending: true }),
      supabase.from("purchase_requests").select("id, status, created_at, packages(name, price_cents, currency)").eq("student_id", user.id).order("created_at", { ascending: false }),
    ]);
    setBalance(typeof bal === "number" ? bal : 0);
    setLessons((ls as Lesson[]) ?? []);
    setRequests((rq as unknown as PReq[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    if (!user) return;
    const ch = supabase
      .channel(`student-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_requests", filter: `student_id=eq.${user.id}` }, () => {
        toast.success("Your purchase was just confirmed!");
        void refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lessons", filter: `student_id=eq.${user.id}` }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const upcoming = lessons.filter((l) => new Date(l.scheduled_at).getTime() >= Date.now() && l.status !== "cancelled");

  const startBookFlow = () => {
    setStep(balance > 0 ? "book" : "purchase");
    setOpen(true);
  };

  return (
    <>
      <section className="fw-card mb-6 grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">Bonjour, {displayName} 👋</h1>
          <p className="mt-2 text-secondaryText">Your simple space to book and track your French lessons with Yves.</p>
        </div>
        <button onClick={startBookFlow} className="btn-primary justify-self-start lg:justify-self-end">
          <CalendarDays className="h-4 w-4" /> Book a lesson
        </button>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="fw-card p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
              <BookOpen className="h-6 w-6" />
            </span>
            <div>
              <div className="text-3xl font-bold">{balance}</div>
              <div className="text-sm text-secondaryText">{balance === 1 ? "lesson credit available" : "lesson credits available"}</div>
            </div>
          </div>
          <p className="mt-4 text-xs text-mutedText">Credits are added automatically once Yves confirms your payment.</p>
        </div>
        <div className="fw-card p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
              <CalendarDays className="h-6 w-6" />
            </span>
            <div>
              <div className="text-lg font-bold">{upcoming[0] ? formatDateTime(new Date(upcoming[0].scheduled_at)) : "Nothing scheduled"}</div>
              <div className="text-sm text-secondaryText">Next lesson</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="fw-card p-5">
          <h2 className="mb-4 text-lg font-bold">Upcoming lessons</h2>
          {loading ? <p className="text-secondaryText">Loading…</p> : upcoming.length === 0 ? (
            <p className="text-secondaryText">No lessons booked yet. Click "Book a lesson" to get started.</p>
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-3">
                  <span className="font-medium">{formatDateTime(new Date(l.scheduled_at))}</span>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-primary capitalize">{l.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="fw-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><ShoppingBag className="h-5 w-5 text-primary" /> Purchase history</h2>
          {requests.length === 0 ? (
            <p className="text-secondaryText">No purchases yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {requests.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{r.packages?.name ?? "Package"}</div>
                    <div className="text-xs text-mutedText">{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                  <StatusPill status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <BookLessonDialog
        open={open}
        onClose={() => setOpen(false)}
        balance={balance}
        initialStep={step}
        onAfterBook={refresh}
      />
    </>
  );
}

function StatusPill({ status }: { status: "pending" | "paid" | "cancelled" }) {
  const styles =
    status === "paid"
      ? "bg-secondary text-primary"
      : status === "cancelled"
      ? "bg-muted text-mutedText"
      : "bg-warning text-warning-foreground";
  const label = status === "paid" ? "Confirmed" : status === "cancelled" ? "Cancelled" : "Awaiting payment";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${styles}`}>{label}</span>;
}
