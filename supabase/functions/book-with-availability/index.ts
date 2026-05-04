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

async function getCalendarBusy(from: string, to: string): Promise<BusyRange[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GOOGLE_CALENDAR_API_KEY = Deno.env.get("GOOGLE_CALENDAR_API_KEY");
  if (!LOVABLE_API_KEY || !GOOGLE_CALENDAR_API_KEY) return [];

  const resp = await fetch(`${GATEWAY_URL}/freeBusy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_CALENDAR_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: from,
      timeMax: to,
      items: [{ id: "primary" }],
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    console.error("freeBusy failed before booking:", data);
    throw new Error("Unable to verify calendar availability");
  }
  return data?.calendars?.primary?.busy ?? [];
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