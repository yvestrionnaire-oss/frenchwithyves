import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DAY_LABELS, buildHourTimes, displayTime } from "@/lib/format";

export default function TeacherAvailability() {
  const times = useMemo(buildHourTimes, []);
  const [slots, setSlots] = useState<Set<string>>(new Set()); // "dow-HH:MM"
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("availability_rules").select("day_of_week, slot_time");
    if (error) toast.error(error.message);
    const s = new Set<string>();
    for (const r of data ?? []) s.add(`${r.day_of_week}-${(r.slot_time as string).slice(0, 5)}`);
    setSlots(s);
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, []);

  const toggle = async (dow: number, time: string) => {
    const key = `${dow}-${time}`;
    setBusy(key);
    if (slots.has(key)) {
      const { error } = await supabase.from("availability_rules").delete().eq("day_of_week", dow).eq("slot_time", time);
      if (error) { toast.error(error.message); setBusy(null); return; }
      const next = new Set(slots); next.delete(key); setSlots(next);
    } else {
      const { error } = await supabase.from("availability_rules").insert({ day_of_week: dow, slot_time: time });
      if (error) { toast.error(error.message); setBusy(null); return; }
      const next = new Set(slots); next.add(key); setSlots(next);
    }
    setBusy(null);
  };

  return (
    <div className="fw-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Weekly availability</h2>
          <p className="mt-1 text-sm text-secondaryText">Click any hour to open it for students. This pattern repeats every week.</p>
        </div>
        {loading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-card">
            <div />
            {DAY_LABELS.map((d) => (
              <div key={d} className="border-l border-border p-2 text-center text-xs font-semibold">{d}</div>
            ))}
          </div>
          {times.map((t) => (
            <div key={t} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border last:border-b-0">
              <div className="px-2 py-1 text-right text-[11px] text-secondaryText">{displayTime(t)}</div>
              {DAY_LABELS.map((_, dow) => {
                const key = `${dow}-${t}`;
                const open = slots.has(key);
                return (
                  <button
                    key={dow}
                    onClick={() => void toggle(dow, t)}
                    disabled={busy === key}
                    aria-label={`${DAY_LABELS[dow]} ${t}`}
                    className={`h-9 border-l border-border transition-colors ${open ? "bg-primary hover:bg-brandHover" : "bg-muted/30 hover:bg-secondary"}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-4 text-xs text-secondaryText">
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-primary" /> Open for booking</span>
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-muted/40 ring-1 ring-border" /> Closed</span>
      </div>
    </div>
  );
}
