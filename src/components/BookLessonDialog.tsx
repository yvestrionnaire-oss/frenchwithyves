import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DAY_LABELS, buildHourTimes, displayTime, formatPrice, getWeekDates } from "@/lib/format";

type Pkg = {
  id: string;
  slug: string;
  name: string;
  price_cents: number;
  currency: string;
  duration: string;
  description: string;
  is_recommended: boolean;
  is_free: boolean;
  credits: number;
  sort_order: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  balance: number;
  initialStep: "purchase" | "book";
  onAfterBook: () => void | Promise<void>;
};

const ERROR_MAP: Record<string, string> = {
  P0001: "That slot is no longer available.",
  P0002: "That time is already booked.",
  P0005: "You don't have any credits left. Request a package first.",
};

export default function BookLessonDialog({ open, onClose, balance, initialStep, onAfterBook }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<"purchase" | "book">(initialStep);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [requesting, setRequesting] = useState<string | null>(null);

  // Calendar state
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d;
  });
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const times = useMemo(buildHourTimes, []);
  const [available, setAvailable] = useState<Set<string>>(new Set()); // dow-time
  const [booked, setBooked] = useState<Set<string>>(new Set()); // ISO scheduled_at
  const [selected, setSelected] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (open) setStep(initialStep); }, [open, initialStep]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data } = await supabase.from("packages").select("*").order("sort_order", { ascending: true });
      setPackages(((data as Pkg[]) ?? []).filter((p) => !p.is_free));
    })();
  }, [open]);

  useEffect(() => {
    if (!open || step !== "book") return;
    void (async () => {
      const [{ data: avail }, { data: ls }] = await Promise.all([
        supabase.from("availability_rules").select("day_of_week, slot_time"),
        supabase.from("lessons").select("scheduled_at, status").neq("status", "cancelled"),
      ]);
      const a = new Set<string>();
      for (const r of avail ?? []) a.add(`${r.day_of_week}-${(r.slot_time as string).slice(0, 5)}`);
      setAvailable(a);
      const b = new Set<string>();
      for (const l of ls ?? []) b.add(new Date(l.scheduled_at).toISOString());
      setBooked(b);
    })();
  }, [open, step, weekStart]);

  if (!open) return null;

  const requestPurchase = async (pkg: Pkg) => {
    if (!user) return;
    setRequesting(pkg.id);
    const { error } = await supabase.from("purchase_requests").insert({ student_id: user.id, package_id: pkg.id });
    setRequesting(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Request sent! Yves will send you a payment link shortly.");
    onClose();
  };

  const slotState = (date: Date, time: string) => {
    const [h, m] = time.split(":").map(Number);
    const d = new Date(date); d.setHours(h, m, 0, 0);
    const past = d.getTime() < Date.now();
    const key = `${d.getDay()}-${time}`;
    const isAvail = available.has(key);
    const isBooked = booked.has(d.toISOString());
    return { d, past, isAvail, isBooked };
  };

  const confirmBooking = async () => {
    if (!selected) return;
    if (balance < 1) { toast.error("No credits available."); return; }
    setSubmitting(true);
    const { error } = await supabase.rpc("book_lesson", { _scheduled_at: selected.toISOString() });
    setSubmitting(false);
    if (error) {
      const code = (error as any).code as string | undefined;
      toast.error((code && ERROR_MAP[code]) || error.message);
      return;
    }
    toast.success("Lesson booked. À bientôt !");
    setSelected(null);
    await onAfterBook();
    onClose();
  };

  const weekLabel = `${weekDates[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekDates[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="my-8 w-full max-w-3xl rounded-lg bg-card shadow-modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h2 className="text-xl font-bold">Book a lesson</h2>
            <div className="mt-2 flex gap-2 text-xs">
              <StepBadge active={step === "purchase"} done={balance > 0 && step === "book"} n={1} label="Purchase" />
              <StepBadge active={step === "book"} done={false} n={2} label="Book in calendar" />
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-2 hover:bg-muted" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5">
          {step === "purchase" && (
            <div>
              <p className="mb-5 text-sm text-secondaryText">
                Choose a package and request it. Yves will send you a Wise or PayPal payment link
                (there may be some delay during night-time). Once he confirms payment, your credits will appear and step 2 will unlock.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {packages.map((p) => (
                  <article key={p.id} className={`fw-card-flat relative flex flex-col p-5 ${p.is_recommended ? "border-primary ring-1 ring-primary/30" : ""}`}>
                    {p.is_recommended && <span className="absolute right-4 top-4 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">Recommended</span>}
                    <h3 className="text-lg font-bold">{p.name}</h3>
                    <div className="mt-1 text-3xl font-bold text-primary">{formatPrice(p.price_cents, p.currency)}</div>
                    <p className="mt-1 text-sm text-secondaryText">{p.duration}</p>
                    <p className="mt-3 min-h-[3rem] text-sm text-secondaryText">{p.description}</p>
                    <button
                      onClick={() => void requestPurchase(p)}
                      disabled={requesting === p.id}
                      className={`${p.is_recommended ? "btn-primary" : "btn-secondary"} mt-4 w-full`}
                    >
                      {requesting === p.id ? "Sending…" : "Request this package"}
                    </button>
                  </article>
                ))}
              </div>
              {balance > 0 && (
                <div className="mt-5 flex items-center justify-between rounded-md bg-secondary p-4">
                  <div className="text-sm font-semibold text-secondary-foreground">You already have {balance} credit{balance > 1 ? "s" : ""}.</div>
                  <button onClick={() => setStep("book")} className="btn-primary">Skip to booking</button>
                </div>
              )}
            </div>
          )}

          {step === "book" && (
            <div>
              {balance < 1 ? (
                <div className="rounded-md border border-warning bg-warning/40 p-5">
                  <p className="text-sm font-semibold text-warning-foreground">You don't have any credits yet. Yves needs to confirm your payment first.</p>
                  <button onClick={() => setStep("purchase")} className="btn-secondary mt-3">Back to purchase</button>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-5 w-5 text-primary" />
                      <span className="font-semibold">{weekLabel}</span>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-neutral px-3 py-2 text-xs" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); setSelected(null); }}><ChevronLeft className="h-4 w-4" /></button>
                      <button className="btn-neutral px-3 py-2 text-xs" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); setSelected(null); }}><ChevronRight className="h-4 w-4" /></button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-md border border-border">
                    <div className="min-w-[640px]">
                      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-card">
                        <div />
                        {weekDates.map((d, i) => (
                          <div key={i} className="border-l border-border p-2 text-center text-xs">
                            <div className="font-semibold">{DAY_LABELS[d.getDay()]}</div>
                            <div className="text-mutedText">{d.getDate()}</div>
                          </div>
                        ))}
                      </div>
                      {times.map((t) => (
                        <div key={t} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border last:border-b-0">
                          <div className="px-2 py-1 text-right text-[11px] text-secondaryText">{displayTime(t)}</div>
                          {weekDates.map((date, i) => {
                            const { d, past, isAvail, isBooked } = slotState(date, t);
                            const bookable = isAvail && !isBooked && !past;
                            const isSel = selected?.getTime() === d.getTime();
                            return (
                              <button
                                key={i}
                                disabled={!bookable}
                                onClick={() => setSelected(d)}
                                aria-label={`${DAY_LABELS[d.getDay()]} ${t}`}
                                className={`h-9 border-l border-border transition-colors ${
                                  isSel ? "bg-primary" :
                                  bookable ? "bg-secondary hover:bg-primary/30" :
                                  "bg-muted/30 opacity-40"
                                }`}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4">
                    <div className="text-sm">
                      <div className="text-secondaryText">Selected</div>
                      <div className="font-semibold">{selected ? selected.toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Pick a green slot"}</div>
                    </div>
                    <button onClick={() => void confirmBooking()} disabled={!selected || submitting} className="btn-primary">
                      <CheckCircle className="h-4 w-4" /> {submitting ? "Booking…" : "Confirm booking"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepBadge({ active, done, n, label }: { active: boolean; done: boolean; n: number; label: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${active ? "border-primary bg-secondary text-primary" : done ? "border-primary bg-primary text-primary-foreground" : "border-border text-mutedText"}`}>
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-card text-[10px] text-foreground">{n}</span>
      {label}
    </span>
  );
}
