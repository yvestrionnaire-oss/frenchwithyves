import { useEffect, useState } from "react";
import { CheckCircle2, ShoppingBag, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatPrice } from "@/lib/format";
import TeacherAvailability from "./TeacherAvailability";

type PReq = {
  id: string;
  status: "pending" | "paid" | "cancelled";
  created_at: string;
  student_id: string;
  packages: { name: string; price_cents: number; currency: string; credits: number } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

type Lesson = {
  id: string;
  scheduled_at: string;
  status: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

export default function TeacherDashboard({ displayName }: { displayName: string }) {
  const [tab, setTab] = useState<"requests" | "lessons" | "availability">("requests");
  const [requests, setRequests] = useState<PReq[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    const [{ data: rq }, { data: ls }] = await Promise.all([
      // join profiles via student_id (manual lookup since FK is to auth.users)
      supabase
        .from("purchase_requests")
        .select("id, status, created_at, student_id, packages(name, price_cents, currency, credits)")
        .order("created_at", { ascending: false }),
      supabase
        .from("lessons")
        .select("id, scheduled_at, status, student_id")
        .order("scheduled_at", { ascending: true }),
    ]);

    const studentIds = Array.from(new Set([
      ...((rq ?? []).map((r) => r.student_id)),
      ...((ls ?? []).map((l: any) => l.student_id)),
    ]));
    let profiles: Record<string, { full_name: string | null; email: string | null }> = {};
    if (studentIds.length) {
      const { data: ps } = await supabase.from("profiles").select("id, full_name, email").in("id", studentIds);
      for (const p of ps ?? []) profiles[p.id] = { full_name: p.full_name, email: p.email };
    }
    setRequests(((rq as any[]) ?? []).map((r) => ({ ...r, profiles: profiles[r.student_id] ?? null })));
    setLessons(((ls as any[]) ?? []).map((l) => ({ ...l, profiles: profiles[l.student_id] ?? null })));
  };

  useEffect(() => {
    void refresh();
    const ch = supabase
      .channel("teacher-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_requests" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "lessons" }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const markPaid = async (r: PReq) => {
    if (!r.packages) return;
    setBusy(r.id);
    const { error } = await supabase
      .from("purchase_requests")
      .update({ status: "paid", credits_granted: r.packages.credits, paid_at: new Date().toISOString() })
      .eq("id", r.id);
    setBusy(null);
    if (error) toast.error(error.message);
    else toast.success(`Granted ${r.packages.credits} credit(s) to ${r.profiles?.full_name ?? "student"}`);
  };

  const cancel = async (r: PReq) => {
    setBusy(r.id);
    const { error } = await supabase.from("purchase_requests").update({ status: "cancelled" }).eq("id", r.id);
    setBusy(null);
    if (error) toast.error(error.message);
  };

  const pending = requests.filter((r) => r.status === "pending");
  const upcomingLessons = lessons.filter((l) => new Date(l.scheduled_at).getTime() >= Date.now() && l.status !== "cancelled");

  return (
    <>
      <section className="fw-card mb-6 p-6">
        <h1 className="text-3xl font-bold md:text-4xl">Bonjour, {displayName} 👋</h1>
        <p className="mt-2 text-secondaryText">Your teaching cockpit — confirm payments, see upcoming lessons, and set your weekly availability.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Stat icon={<ShoppingBag />} value={String(pending.length)} label="Pending purchase requests" />
          <Stat icon={<Users />} value={String(upcomingLessons.length)} label="Upcoming lessons" />
        </div>
      </section>

      <div className="mb-5 flex gap-2 border-b border-border">
        {([
          ["requests", "Purchases"],
          ["lessons", "Lessons"],
          ["availability", "Availability"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-3 text-sm font-bold transition ${tab === k ? "border-primary text-primary" : "border-transparent text-secondaryText hover:text-foreground"}`}
          >
            {label}
            {k === "requests" && pending.length > 0 && (
              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">{pending.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "requests" && (
        <div className="fw-card p-5">
          <h2 className="mb-4 text-lg font-bold">Purchase requests</h2>
          {requests.length === 0 ? (
            <p className="text-secondaryText">No purchase requests yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <div className="font-semibold">{r.profiles?.full_name ?? r.profiles?.email ?? "Unknown student"}</div>
                    <div className="text-sm text-secondaryText">
                      {r.packages?.name} · {r.packages ? formatPrice(r.packages.price_cents, r.packages.currency) : "—"} · {new Date(r.created_at).toLocaleString()}
                    </div>
                    {r.profiles?.email && <div className="text-xs text-mutedText">{r.profiles.email}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status === "pending" ? (
                      <>
                        <button onClick={() => void markPaid(r)} disabled={busy === r.id} className="btn-primary px-3 py-2 text-xs">
                          <CheckCircle2 className="h-4 w-4" /> Mark as paid
                        </button>
                        <button onClick={() => void cancel(r)} disabled={busy === r.id} className="btn-danger">Cancel</button>
                      </>
                    ) : (
                      <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${r.status === "paid" ? "bg-secondary text-primary" : "bg-muted text-mutedText"}`}>
                        {r.status === "paid" ? "Paid" : "Cancelled"}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "lessons" && (
        <div className="fw-card p-5">
          <h2 className="mb-4 text-lg font-bold">All upcoming lessons</h2>
          {upcomingLessons.length === 0 ? (
            <p className="text-secondaryText">No lessons booked yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {upcomingLessons.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{formatDateTime(new Date(l.scheduled_at))}</div>
                    <div className="text-sm text-secondaryText">{l.profiles?.full_name ?? l.profiles?.email ?? "Student"}</div>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-primary capitalize">{l.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "availability" && <TeacherAvailability />}
    </>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">{icon}</span>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-secondaryText">{label}</div>
      </div>
    </div>
  );
}
