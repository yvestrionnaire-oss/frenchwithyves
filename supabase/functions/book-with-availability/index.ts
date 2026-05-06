import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

type LessonType = "trial" | "regular";
type BusyRange = { start: string; end: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

class CalendarCheckUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarCheckUnavailable";
  }
}

// Single source of truth: invoke the get-busy-times edge function so the
// availability check the booker performs is byte-for-byte the same one the
// frontend uses to grey out slots. Hard-fails on any error.
async function getCalendarBusy(from: string, to: string): Promise<BusyRange[]> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new CalendarCheckUnavailable("Server misconfigured: missing service role for calendar check");
  }

  let resp: Response;
  try {
    resp = await fetch(`${SUPABASE_URL}/functions/v1/get-busy-times`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to }),
    });
  } catch (e) {
    console.error("get-busy-times invocation failed (network):", e);
    throw new CalendarCheckUnavailable("Calendar check unreachable");
  }

  let data: unknown;
  try {
    data = await resp.json();
  } catch (e) {
    console.error("get-busy-times returned non-JSON:", resp.status, e);
    throw new CalendarCheckUnavailable("Calendar check returned invalid response");
  }

  if (!resp.ok) {
    console.error("get-busy-times non-2xx:", resp.status, data);
    throw new CalendarCheckUnavailable("Calendar check failed");
  }

  const busy = (data as { busy?: unknown })?.busy;
  if (!Array.isArray(busy)) {
    console.error("get-busy-times unexpected shape:", data);
    throw new CalendarCheckUnavailable("Calendar check returned unexpected shape");
  }

  for (const r of busy) {
    if (
      !r ||
      typeof (r as BusyRange).start !== "string" ||
      typeof (r as BusyRange).end !== "string"
    ) {
      console.error("get-busy-times bad range entry:", r);
      throw new CalendarCheckUnavailable("Calendar check returned invalid range");
    }
  }

  console.log("getCalendarBusy via get-busy-times returned", busy.length, "ranges");
  return busy as BusyRange[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { slots, lessonType, durationMinutes } = (await req.json()) as { slots?: string[]; lessonType?: LessonType; durationMinutes?: number };
    const type: LessonType = lessonType === "trial" ? "trial" : "regular";
    const duration = type === "trial" ? 30 : durationMinutes === 30 ? 30 : 60;

    if (!Array.isArray(slots) || slots.length === 0) return json({ error: "No slots selected" });
    if (type === "trial" && slots.length !== 1) return json({ error: "Trials must use one slot" });

    const lessonRanges = slots.map((slot) => {
      const start = new Date(slot).getTime();
      if (!Number.isFinite(start)) throw new Error("Invalid slot");
      return { slot, start, end: start + duration * 60_000 };
    });

    const from = new Date(Math.min(...lessonRanges.map((r) => r.start))).toISOString();
    const to = new Date(Math.max(...lessonRanges.map((r) => r.end))).toISOString();
    const busy = await getCalendarBusy(from, to);
    console.log("getCalendarBusy returned", busy.length, "ranges");
    const hasCalendarConflict = lessonRanges.some((lesson) =>
      busy.some((range) => overlaps(lesson.start, lesson.end, new Date(range.start).getTime(), new Date(range.end).getTime())),
    );

    if (hasCalendarConflict) {
      return json({
        error: "That time is no longer available — please pick another slot.",
        description: `Yves is busy during part of that ${duration}-minute lesson. Please pick another slot.`,
        code: "CALENDAR_BUSY",
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !authHeader) return json({ error: "Not authenticated" });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    if (type === "trial") {
      const { data, error } = await supabase.rpc("book_lesson", {
        _scheduled_at: slots[0],
        _lesson_type: "trial",
      });
      if (error) return json({ error: error.message, code: error.code });
      return json({ lessonIds: [data] });
    }

    const { data, error } = await supabase.rpc("book_lessons", { _slots: slots, _duration_minutes: duration });
    if (error) return json({ error: "That time is no longer available — please pick another slot.", description: error.message, code: error.code });
    return json({ lessonIds: data ?? [] });
  } catch (error) {
    console.error("book-with-availability error:", error);
    return json({ error: error instanceof Error ? error.message : "Booking failed" }, 500);
  }
});