// Edge function: returns the teacher's Google Calendar busy ranges in [from, to].
// Used to grey out conflicting slots in the student & teacher calendars.
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
    if (!LOVABLE_API_KEY || !GOOGLE_CALENDAR_API_KEY) {
      // No connector — return empty list, calendar still works
      return new Response(JSON.stringify({ busy: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { from, to } = await req.json();
    if (!from || !to) {
      return new Response(JSON.stringify({ error: "from/to required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      console.error("freeBusy failed:", data);
      return new Response(JSON.stringify({ busy: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const busy = data?.calendars?.primary?.busy ?? [];
    return new Response(JSON.stringify({ busy }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-busy-times error:", e);
    return new Response(JSON.stringify({ busy: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
