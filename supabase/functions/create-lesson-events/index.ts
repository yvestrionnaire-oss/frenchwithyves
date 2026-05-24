// Edge function: creates a Google Calendar event with auto-generated Meet link
// for each lesson, then stores meet_link + google_event_id back on the lesson row.
// Reads student email from the profiles table.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

interface RequestBody {
  lessonIds: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_CALENDAR_API_KEY = Deno.env.get("GOOGLE_CALENDAR_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!GOOGLE_CALENDAR_API_KEY) throw new Error("GOOGLE_CALENDAR_API_KEY is not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase env not configured");

    const body = (await req.json()) as RequestBody;
    if (!Array.isArray(body.lessonIds) || body.lessonIds.length === 0) {
      return new Response(JSON.stringify({ error: "lessonIds required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Authorization ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const SUPABASE_ANON_KEY =
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!SUPABASE_ANON_KEY) throw new Error("SUPABASE_ANON_KEY not configured");
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: lessons, error: fetchErr } = await supabase
      .from("lessons")
      .select("id, scheduled_at, duration_minutes, lesson_type, student_id, meet_link, google_event_id")
      .in("id", body.lessonIds);

    if (fetchErr) throw fetchErr;
    if (!lessons || lessons.length === 0) {
      return new Response(JSON.stringify({ error: "No lessons found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorize caller against every lesson in the batch
    const { data: roleData } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "teacher",
    });
    const isTeacher = roleData === true;
    const notAllowed = lessons.some((l) => l.student_id !== user.id && !isTeacher);
    if (notAllowed) {
      return new Response(JSON.stringify({ error: "Not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("create-lesson-events: caller", user.id, "authorized for", body.lessonIds.length, "lessons");

    // Pull profiles in one query
    const studentIds = Array.from(new Set(lessons.map((l) => l.student_id).filter(Boolean)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", studentIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const results: Array<{ lessonId: string; meetLink: string | null; eventId: string | null; error?: string; skipped?: boolean }> = [];

    for (const lesson of lessons) {
      if (lesson.google_event_id) {
        console.log("create-lesson-events: lesson", lesson.id, "already has event", lesson.google_event_id, "— skipping");
        results.push({ lessonId: lesson.id, meetLink: lesson.meet_link ?? null, eventId: lesson.google_event_id, skipped: true });
        continue;
      }
      const start = new Date(lesson.scheduled_at);
      const end = new Date(start.getTime() + (lesson.duration_minutes ?? 60) * 60_000);
      const isTrial = lesson.lesson_type === "trial";
      const profile = profileMap.get(lesson.student_id);
      const studentName = profile?.full_name ?? "Student";
      const studentEmail = profile?.email ?? null;

      const eventBody = {
        summary: isTrial
          ? `Free trial · French with ${studentName}`
          : `French Lesson · ${studentName}`,
        description: `${lesson.duration_minutes ?? 60}-minute ${isTrial ? "trial " : ""}French lesson with Yves.\n\nStudent: ${studentName}${studentEmail ? ` (${studentEmail})` : ""}`,
        start: { dateTime: start.toISOString(), timeZone: "UTC" },
        end: { dateTime: end.toISOString(), timeZone: "UTC" },
        conferenceData: {
          createRequest: {
            requestId: `lesson-${lesson.id}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        attendees: studentEmail ? [{ email: studentEmail, displayName: studentName }] : undefined,
      };

      try {
        const resp = await fetch(
          `${GATEWAY_URL}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": GOOGLE_CALENDAR_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(eventBody),
          },
        );

        const data = await resp.json();
        if (!resp.ok) {
          console.error(`Failed to create event for ${lesson.id}:`, data);
          results.push({ lessonId: lesson.id, meetLink: null, eventId: null, error: JSON.stringify(data) });
          continue;
        }

        const meetLink: string | null =
          data.hangoutLink ??
          data.conferenceData?.entryPoints?.find((e: { entryPointType: string; uri: string }) => e.entryPointType === "video")?.uri ??
          null;
        const eventId: string = data.id;

        await supabase.from("lessons").update({ meet_link: meetLink, google_event_id: eventId }).eq("id", lesson.id);

        results.push({ lessonId: lesson.id, meetLink, eventId });
      } catch (err) {
        console.error(`Error creating event for lesson ${lesson.id}:`, err);
        results.push({
          lessonId: lesson.id,
          meetLink: null,
          eventId: null,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("create-lesson-events error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
