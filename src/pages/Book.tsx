import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarCheck, ChevronLeft, ChevronRight, Loader2, CheckCircle2, ExternalLink, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type AvailabilityRule = { day_of_week: number; slot_time: string };
type LessonRow = { scheduled_at: string; status: string };
type Mode = "trial" | "regular";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PACKAGE_OPTIONS = [
  { value: 1, label: "Single lesson" },
  { value: 5, label: "Pack of 5" },
  { value: 10, label: "Pack of 10" },
  { value: 20, label: "Pack of 20" },
];

function startOfWeek(d: Date) {
  const out = new Date(d);
  const day = out.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  out.setDate(out.getDate() + diff);
  out.setHours(0, 0, 0, 0);
  return out;
}
function addDays(d: Date, n: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}
function isoSlot(date: Date, time: string) {
  const [h, m] = time.split(":").map(Number);
  const out = new Date(date);
  out.setHours(h, m ?? 0, 0, 0);
  return out;
}
function fmtTime(time: string) {
  const [h] = time.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${ampm}`;
}

export default function Book() {
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [booked, setBooked] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Booking flow
  const [mode, setMode] = useState<Mode>("regular");
  const [packageSize, setPackageSize] = useState<number>(5);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [success, setSuccess] = useState<{ count: number; meetLinks: (string | null)[] } | null>(null);

  const targetCount = mode === "trial" ? 1 : packageSize;
  const weekStart = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset]);

  useEffect(() => {
    void load();
  }, []);

  // When switching mode, clear selection
  useEffect(() => {
    setSelected(new Set());
  }, [mode, packageSize]);

  async function load() {
    setLoading(true);
    const [rulesRes, lessonsRes] = await Promise.all([
      supabase.from("availability_rules").select("day_of_week, slot_time").order("slot_time"),
      supabase.from("lessons").select("scheduled_at, status").neq("status", "cancelled"),
    ]);
    if (rulesRes.data) setRules(rulesRes.data as AvailabilityRule[]);
    if (lessonsRes.data) {
      setBooked(new Set((lessonsRes.data as LessonRow[]).map((l) => new Date(l.scheduled_at).toISOString())));
    }
    setLoading(false);
  }

  const uniqueTimes = useMemo(() => {
    const set = new Set<string>();
    rules.forEach((r) => set.add(r.slot_time));
    return Array.from(set).sort();
  }, [rules]);

  const ruleSet = useMemo(() => new Set(rules.map((r) => `${r.day_of_week}-${r.slot_time}`)), [rules]);

  function toggle(slot: Date) {
    const key = slot.toISOString();
    if (slot.getTime() < Date.now()) return;
    if (booked.has(key)) return;
    const next = new Set(selected);
    if (next.has(key)) {
      next.delete(key);
    } else {
      // Trial: only one slot at a time
      if (mode === "trial") {
        next.clear();
      } else if (next.size >= targetCount) {
        toast({
          title: "Package full",
          description: `You've already selected ${targetCount} slots. Remove one to swap.`,
        });
        return;
      }
      next.add(key);
    }
    setSelected(next);
  }

  function openConfirm() {
    if (selected.size === 0) return;
    if (mode === "regular" && selected.size !== targetCount) {
      toast({
        title: "Pick all your slots first",
        description: `You picked ${selected.size} of ${targetCount}. You can also confirm fewer if you wish.`,
      });
    }
    setConfirmOpen(true);
  }

  async function confirmBooking() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      toast({ title: "Your name is required", variant: "destructive" });
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
      toast({ title: "A valid email is required", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const slots = Array.from(selected).sort();
    const { data, error } = await supabase.rpc("book_guest_lessons", {
      _guest_name: trimmedName,
      _guest_email: trimmedEmail,
      _slots: slots,
      _lesson_type: mode,
      _duration_minutes: 60,
    });

    if (error) {
      const msg = error.message ?? "";
      const friendly = msg.includes("already booked")
        ? "One of those slots was just booked by someone else. Please pick another."
        : msg.includes("trial lesson already exists")
          ? "A free trial has already been booked with this email. Use a regular package instead."
          : msg;
      toast({ title: "Booking failed", description: friendly, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    const lessonIds = data as string[];

    // Create Google Calendar events with Meet links + email invites
    const { data: gcalData, error: gcalError } = await supabase.functions.invoke("create-lesson-events", {
      body: { lessonIds },
    });

    if (gcalError) {
      toast({
        title: `${lessonIds.length} lesson${lessonIds.length > 1 ? "s" : ""} booked`,
        description: "Booked, but Google Meet link generation failed. Yves will follow up by email.",
      });
      setSuccess({ count: lessonIds.length, meetLinks: [] });
    } else {
      const links = (gcalData?.results ?? []).map((r: { meetLink: string | null }) => r.meetLink);
      setSuccess({ count: lessonIds.length, meetLinks: links });
    }

    setConfirmOpen(false);
    setSelected(new Set());
    setSubmitting(false);
    await load();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <Badge variant="secondary" className="text-sm">
            {mode === "trial" ? "Free trial · 30 min" : `${targetCount} × 60 min lesson${targetCount > 1 ? "s" : ""}`}
          </Badge>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Book your lessons</h1>
          <p className="mt-1 text-muted-foreground">
            Pick your slots, enter your name & email, and you'll receive a Google Meet invite for each lesson.
          </p>
        </div>

        {/* Mode selector */}
        <Card className="mb-6 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setMode("trial")}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                mode === "trial"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-accent",
              )}
            >
              🎁 Free 30-min trial
            </button>
            <button
              type="button"
              onClick={() => setMode("regular")}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                mode === "regular"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-accent",
              )}
            >
              📚 Lesson package
            </button>

            {mode === "regular" && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Package size:</span>
                {PACKAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPackageSize(opt.value)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm transition-colors",
                      packageSize === opt.value
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : "hover:bg-accent",
                    )}
                  >
                    {opt.value}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {mode === "trial"
              ? "Pick one 30-min slot — perfect to meet Yves and discuss your goals before committing."
              : `Select ${targetCount} slot${targetCount > 1 ? "s" : ""} across the next 12 weeks. Yves will email you a payment link after booking.`}
          </p>
        </Card>

        {/* Week navigator */}
        <div className="mb-4 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
            disabled={weekOffset === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous week
          </Button>
          <div className="text-sm font-medium">
            Week of{" "}
            {weekStart.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
            <span className="ml-2 text-muted-foreground">({weekOffset + 1} / 12)</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset((w) => Math.min(11, w + 1))}
            disabled={weekOffset === 11}
          >
            Next week
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendar grid */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading availability…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid min-w-[700px] grid-cols-[80px_repeat(7,1fr)] border-b bg-muted/30">
                <div className="p-3 text-xs font-medium text-muted-foreground">Time</div>
                {Array.from({ length: 7 }).map((_, i) => {
                  const d = addDays(weekStart, i);
                  const isToday = d.toDateString() === new Date().toDateString();
                  return (
                    <div
                      key={i}
                      className={cn("p-3 text-center text-xs font-medium", isToday && "text-primary font-semibold")}
                    >
                      <div>{DAYS[d.getDay()]}</div>
                      <div className="text-base font-semibold text-foreground">{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>

              {uniqueTimes.map((time) => (
                <div key={time} className="grid min-w-[700px] grid-cols-[80px_repeat(7,1fr)] border-b last:border-b-0">
                  <div className="border-r p-3 text-xs font-medium text-muted-foreground">{fmtTime(time)}</div>
                  {Array.from({ length: 7 }).map((_, i) => {
                    const d = addDays(weekStart, i);
                    const dow = d.getDay();
                    const exists = ruleSet.has(`${dow}-${time}`);
                    if (!exists) return <div key={i} className="border-r last:border-r-0 bg-muted/10" />;

                    const slot = isoSlot(d, time);
                    const key = slot.toISOString();
                    const isPast = slot.getTime() < Date.now();
                    const isBooked = booked.has(key);
                    const isSelected = selected.has(key);

                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggle(slot)}
                        disabled={isPast || isBooked}
                        className={cn(
                          "border-r last:border-r-0 p-2 text-xs transition-colors",
                          "hover:bg-primary/10",
                          isPast && "cursor-not-allowed bg-muted/30 text-muted-foreground hover:bg-muted/30",
                          isBooked && "cursor-not-allowed bg-destructive/10 text-destructive hover:bg-destructive/10",
                          isSelected && "bg-primary text-primary-foreground hover:bg-primary",
                          !isPast && !isBooked && !isSelected && "bg-background",
                        )}
                      >
                        {isBooked ? "Booked" : isSelected ? "Selected" : isPast ? "—" : "Available"}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Sticky bottom action bar */}
        <div className="sticky bottom-4 z-10 mt-6 flex items-center justify-between rounded-xl border bg-card p-4 shadow-lg">
          <div className="flex items-center gap-4">
            <CalendarCheck className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-medium">
                {selected.size} of {targetCount} slot{targetCount === 1 ? "" : "s"} selected
              </div>
              <div className="text-xs text-muted-foreground">
                {mode === "trial" ? "Free 30-min trial" : "Yves will email a payment link after booking"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <Button variant="ghost" onClick={() => setSelected(new Set())} disabled={submitting}>
                Clear
              </Button>
            )}
            <Button onClick={openConfirm} disabled={selected.size === 0 || submitting} size="lg">
              Continue
            </Button>
          </div>
        </div>
      </main>

      {/* Confirm dialog with name/email */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !submitting && setConfirmOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm your booking</DialogTitle>
            <DialogDescription>
              {selected.size} {mode === "trial" ? "trial" : "lesson"}
              {selected.size > 1 ? "s" : ""} — Google Meet links will be emailed to you.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Marie Dupont"
                autoComplete="name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <p className="text-xs text-muted-foreground">
                The Google Meet invite for each lesson will be sent here.
              </p>
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-xs">
              <div className="mb-1 font-medium">Your selected slots:</div>
              <ul className="space-y-0.5 text-muted-foreground">
                {Array.from(selected).sort().slice(0, 6).map((iso) => (
                  <li key={iso}>
                    •{" "}
                    {new Date(iso).toLocaleString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </li>
                ))}
                {selected.size > 6 && <li>… and {selected.size - 6} more</li>}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Back
            </Button>
            <Button onClick={confirmBooking} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success dialog */}
      <Dialog open={!!success} onOpenChange={() => setSuccess(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">
              {success?.count === 1 ? "Lesson booked!" : `${success?.count} lessons booked!`}
            </DialogTitle>
            <DialogDescription className="text-center">
              You'll receive a Google Calendar invite with a Meet link for each lesson at <strong>{email}</strong>.
              {mode === "regular" && " Yves will follow up with a payment link shortly."}
            </DialogDescription>
          </DialogHeader>

          {success && success.meetLinks.filter(Boolean).length > 0 && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-medium">Your Meet links:</div>
              {success.meetLinks.filter((l): l is string => !!l).map((link, i) => (
                <a
                  key={link}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <Video className="h-4 w-4" /> Lesson {i + 1} <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setSuccess(null)} className="w-full">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
