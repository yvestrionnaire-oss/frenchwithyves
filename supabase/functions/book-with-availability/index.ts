// supabase/functions/book-with-availability/index.ts
//
// Books one or more lessons after verifying the time isn't already taken.
// Two layers of "is the time taken?":
//   1) Google Calendar — fetched via the get-busy-times edge function so the
//      booking gate uses the SAME data source that paints the calendar UI.
//      Any failure of that function (HTTP error, "unavailable" flag, missing
//      env, network blip) refuses the booking. Never silently allow.
//   2) Other lessons in the public.lessons table — checked inside the
//      `book_lessons` SECURITY DEFINER RPC and additionally enforced by the
//      `lessons_no_scheduled_overlap` exclusion constraint, so it's impossible
//      for two students to win the same slot in a race.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

/**
 * Single source of truth: invoke the get-busy-times edge function so the
 * availability check the booker performs is byte-for-byte the same one the
 * frontend uses to grey out slots. Hard-fails on any error: missing config,
 * non-2xx response, an `unavailable: true` flag in the body, malformed
 * shape, or network issue.
 */
async function getCalendarBusy(from: string, to: string): Promise<BusyRange[]> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new CalendarCheckUnavailable(
      "Server misconfigured: missing service role for calendar check",
    );
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

  // Refuse the booking if the calendar service reports it is unavailable,
  // whether by HTTP status OR by an explicit `unavailable: true` flag.
  // Both are valid signals of "we did not actually verify availability".
  if (!resp.ok) {
    console.error("get-busy-times non-2xx:", resp.status, data);
    throw new CalendarCheckUnavailable("Calendar check failed");
  }
  if ((data as { unavailable?: boolean })?.unavailable === true) {
    console.error("get-busy-times reported unavailable:", data);
    throw new CalendarCheckUnavailable("Calendar check unavailable");
  }

  const busy = (data as { busy?: unknown })?.busy;
  if (!Array.isArray(busy)) {
    console.error("get-busy-times unexpected shape:", data);
    throw new CalendarCheckUnavailable(
      "Calendar check returned unexpected shape",
    );
  }

  for (const r of busy) {
    if (
      !r ||
      typeof (r as BusyRange).start !== "string" ||
      typeof (r as BusyRange).end !== "string"
    ) {
      console.error("get-busy-times bad range entry:", r);
      throw new CalendarCheckUnavailable(
        "Calendar check returned invalid range",
      );
    }
  }

  console.log(
    "getCalendarBusy via get-busy-times returned",
    busy.length,
    "ranges",
  );
  return busy as BusyRange[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { slots, lessonType, durationMinutes } = (await req.json()) as {
      slots?: string[];
      lessonType?: LessonType;
      durationMinutes?: number;
    };
    const type: LessonType = lessonType === "trial" ? "trial" : "regular";
    const duration =
      type === "trial" ? 30 : durationMinutes === 30 ? 30 : 60;

    if (!Array.isArray(slots) || slots.length === 0) {
      return json({ error: "No slots selected" });
    }
    if (type === "trial" && slots.length !== 1) {
      return json({ error: "Trials must use one slot" });
    }

    // Verify the caller's JWT BEFORE making any calendar calls, so
    // unauthenticated users cannot probe slot availability.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Not authenticated" }, 401);
    }
    {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_ANON_KEY =
        Deno.env.get("SUPABASE_ANON_KEY") ??
        Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return json({ error: "Server misconfigured" }, 500);
      }
      const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await sb.auth.getClaims(token);
      if (error || !data?.claims) {
        return json({ error: "Not authenticated" }, 401);
      }
    }


    const lessonRanges = slots.map((slot) => {
      const start = new Date(slot).getTime();
      if (!Number.isFinite(start)) throw new Error("Invalid slot");
      return { slot, start, end: start + duration * 60_000 };
    });

    const from = new Date(
      Math.min(...lessonRanges.map((r) => r.start)),
    ).toISOString();
    const to = new Date(
      Math.max(...lessonRanges.map((r) => r.end)),
    ).toISOString();
    const busy = await getCalendarBusy(from, to);
    console.log("getCalendarBusy returned", busy.length, "ranges");
    const hasCalendarConflict = lessonRanges.some((lesson) =>
      busy.some((range) =>
        overlaps(
          lesson.start,
          lesson.end,
          new Date(range.start).getTime(),
          new Date(range.end).getTime(),
        ),
      ),
    );

    if (hasCalendarConflict) {
      return json({
        error: "That time is no longer available — please pick another slot.",
        description: `Yves is busy during part of that ${duration}-minute lesson. Please pick another slot.`,
        code: "CALENDAR_BUSY",
      });
    }

    // Honor teacher "block" availability overrides server-side. We use the
    // anon client to read these (RLS allows any signed-in user to read), but
    // before authenticating below we don't have a client yet — read with the
    // anon key directly via a service-role-less query is unnecessary; the
    // overrides table is public-read for signed-in users, so we fetch with
    // the anon key and the caller's Authorization header below would also
    // work. To keep this simple we use the SUPABASE_URL + anon key.
    const OVERRIDE_URL = Deno.env.get("SUPABASE_URL");
    const OVERRIDE_KEY =
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (OVERRIDE_URL && OVERRIDE_KEY) {
      try {
        const callerAuth = req.headers.get("Authorization") ?? `Bearer ${OVERRIDE_KEY}`;
        const ovResp = await fetch(
          `${OVERRIDE_URL}/rest/v1/availability_overrides?select=kind,starts_at,ends_at&kind=eq.block&starts_at=lt.${encodeURIComponent(to)}&ends_at=gt.${encodeURIComponent(from)}`,
          { headers: { apikey: OVERRIDE_KEY, Authorization: callerAuth } },
        );
        if (ovResp.ok) {
          const ovs = (await ovResp.json()) as Array<{ starts_at: string; ends_at: string }>;
          const hasOverrideConflict = lessonRanges.some((lesson) =>
            ovs.some((r) =>
              overlaps(
                lesson.start,
                lesson.end,
                new Date(r.starts_at).getTime(),
                new Date(r.ends_at).getTime(),
              ),
            ),
          );
          if (hasOverrideConflict) {
            return json({
              error: "That time is no longer available — please pick another slot.",
              description: "Yves has marked that time as unavailable.",
              code: "TEACHER_BLOCKED",
            });
          }
        } else {
          console.error("availability_overrides fetch non-2xx:", ovResp.status);
        }
      } catch (e) {
        console.error("availability_overrides fetch failed:", e);
      }
    }


    const RPC_URL = Deno.env.get("SUPABASE_URL");
    const RPC_KEY =
      Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!RPC_URL || !RPC_KEY) {
      return json({ error: "Server misconfigured" }, 500);
    }

    const supabase = createClient(RPC_URL, RPC_KEY, {
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

    const { data, error } = await supabase.rpc("book_lessons", {
      _slots: slots,
      _duration_minutes: duration,
    });
    if (error) {
      return json({
        error: "That time is no longer available — please pick another slot.",
        description: error.message,
        code: error.code,
      });
    }
    return json({ lessonIds: data ?? [] });
  } catch (error) {
    console.error("book-with-availability error:", error);
    if (error instanceof CalendarCheckUnavailable) {
      return json(
        {
          error:
            "Couldn't verify Yves's calendar right now — please try again in a minute.",
          code: "CALENDAR_CHECK_UNAVAILABLE",
        },
        503,
      );
    }
    return json(
      { error: error instanceof Error ? error.message : "Booking failed" },
      500,
    );
  }
});
