// Edge function: updates an existing Google Calendar event when a lesson is rescheduled.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

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

    const { lessonId } = await req.json();
    if (!lessonId) {
      return new Response(JSON.stringify({ error: "lessonId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: lesson, error } = await supabase
      .from("lessons")
      .select("id, scheduled_at, duration_minutes, google_event_id")
      .eq("id", lessonId)
      .single();

    if (error || !lesson) throw new Error("Lesson not found");
    if (!lesson.google_event_id) {
      return new Response(JSON.stringify({ error: "No calendar event to update" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const start = new Date(lesson.scheduled_at);
    const end = new Date(start.getTime() + (lesson.duration_minutes ?? 60) * 60_000);

    const resp = await fetch(
      `${GATEWAY_URL}/calendars/primary/events/${lesson.google_event_id}?sendUpdates=none`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GOOGLE_CALENDAR_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start: { dateTime: start.toISOString(), timeZone: "UTC" },
          end: { dateTime: end.toISOString(), timeZone: "UTC" },
        }),
      },
    );

    const data = await resp.json();
    if (!resp.ok) {
      console.error("Failed to update event:", data);
      throw new Error(JSON.stringify(data));
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("reschedule-lesson-event error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
