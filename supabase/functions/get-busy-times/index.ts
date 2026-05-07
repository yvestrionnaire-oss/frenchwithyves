// supabase/functions/get-busy-times/index.ts
//
// Returns the teacher's Google Calendar busy ranges in [from, to].
// Used by:
//   - the student/teacher calendar UIs (to grey out conflicting slots), and
//   - book-with-availability (as the single source of truth for "Yves is busy").
//
// Critical correctness rules:
//   1) Query EVERY calendar the connected Google account has at least freeBusy
//      access to — not just `primary`. A common cause of "I can book over a
//      busy time" is that the busy event lives on a secondary/work/shared
//      calendar that `primary` alone does not see.
//   2) NEVER silently return `{busy: []}` when the Google Calendar API has
//      actually failed. A booking that goes through because the calendar
//      check returned an empty list "by accident" is a worse outcome than
//      the user getting a clear "try again" error. Errors return non-2xx so
//      the booking layer refuses to write the row.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

type BusyRange = { start: string; end: string };

type CalendarListItem = {
  id: string;
  primary?: boolean;
  selected?: boolean;
  hidden?: boolean;
  accessRole?: string;
};

type FreeBusyCalendarEntry = {
  busy?: BusyRange[];
  errors?: Array<{ domain?: string; reason?: string }>;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Fetch every calendar id the connected account can read free/busy info for.
 * - Hides hidden calendars.
 * - Excludes calendars the user explicitly unselected in their Google UI
 *   (those events don't show up in their own calendar grid, so honoring
 *   that flag matches user expectation).
 * - Falls back to ["primary"] only if the calendar list is unexpectedly empty.
 */
async function listCalendarIds(
  lovableApiKey: string,
  googleApiKey: string,
): Promise<string[]> {
  const url = `${GATEWAY_URL}/users/me/calendarList?showHidden=false&minAccessRole=freeBusyReader`;
  const resp = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "X-Connection-Api-Key": googleApiKey,
      "Content-Type": "application/json",
    },
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`calendarList.list ${resp.status}: ${detail.slice(0, 200)}`);
  }
  const data = (await resp.json()) as { items?: CalendarListItem[] };
  const ids = (data.items ?? [])
    .filter((cal) => cal.hidden !== true)
    // `selected: false` means the user has unticked this calendar in Google's UI;
    // they don't expect events on it to block their availability.
    // `selected` undefined is treated as visible (Google's default).
    .filter((cal) => cal.selected !== false)
    .map((cal) => cal.id)
    .filter((id) => typeof id === "string" && id.length > 0);
  return ids.length > 0 ? ids : ["primary"];
}

/**
 * Query freeBusy across all relevant calendars and merge the busy ranges.
 * Throws on any HTTP error from the Google API. If `freeBusy` reports
 * per-calendar errors but at least one calendar succeeded, we log the
 * partial failure but still return what we got — partial coverage is
 * better than fail-open. If EVERY calendar errored, we throw.
 */
async function fetchBusyRanges(
  lovableApiKey: string,
  googleApiKey: string,
  calendarIds: string[],
  from: string,
  to: string,
): Promise<BusyRange[]> {
  // Google freeBusy supports up to 50 calendars per call. For most accounts
  // this is plenty; if someone ever has more we batch it.
  const BATCH = 50;
  const merged: BusyRange[] = [];
  let anySuccess = false;
  let perCalErrors = 0;

  for (let i = 0; i < calendarIds.length; i += BATCH) {
    const batch = calendarIds.slice(i, i + BATCH);
    const resp = await fetch(`${GATEWAY_URL}/freeBusy`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": googleApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: from,
        timeMax: to,
        items: batch.map((id) => ({ id })),
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      throw new Error(`freeBusy ${resp.status}: ${detail.slice(0, 200)}`);
    }

    const data = (await resp.json()) as {
      calendars?: Record<string, FreeBusyCalendarEntry>;
    };
    const cals = data.calendars ?? {};
    for (const [calId, entry] of Object.entries(cals)) {
      if (entry.errors && entry.errors.length > 0) {
        perCalErrors++;
        console.error(
          `get-busy-times: per-calendar error for ${calId}:`,
          entry.errors,
        );
        continue;
      }
      anySuccess = true;
      for (const range of entry.busy ?? []) {
        if (
          range &&
          typeof range.start === "string" &&
          typeof range.end === "string"
        ) {
          merged.push({ start: range.start, end: range.end });
        }
      }
    }
  }

  if (!anySuccess && perCalErrors > 0) {
    throw new Error(
      `freeBusy: every calendar (${perCalErrors}) returned an error`,
    );
  }
  return merged;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_CALENDAR_API_KEY = Deno.env.get("GOOGLE_CALENDAR_API_KEY");
    if (!LOVABLE_API_KEY || !GOOGLE_CALENDAR_API_KEY) {
      // Connector intentionally unconfigured: this is the only case where
      // we degrade gracefully — there is no Google account linked, so we
      // truly have nothing to report. Frontend treats this as "no Google
      // events", which is honest. The booking layer reads the same response
      // and refuses to insert (it considers connector-unconfigured as a
      // calendar-check failure for safety; see book-with-availability).
      return jsonResponse(
        { busy: [], unavailable: true, reason: "CONNECTOR_UNCONFIGURED" },
        503,
      );
    }

    let body: { from?: string; to?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }
    const { from, to } = body;
    if (!from || !to) {
      return jsonResponse({ error: "from/to required" }, 400);
    }

    const calendarIds = await listCalendarIds(
      LOVABLE_API_KEY,
      GOOGLE_CALENDAR_API_KEY,
    );
    console.log(
      `get-busy-times: querying ${calendarIds.length} calendar(s) [${from} → ${to}]`,
    );

    const busy = await fetchBusyRanges(
      LOVABLE_API_KEY,
      GOOGLE_CALENDAR_API_KEY,
      calendarIds,
      from,
      to,
    );
    console.log(
      `get-busy-times: returning ${busy.length} busy range(s) across ${calendarIds.length} calendar(s)`,
    );

    return jsonResponse({ busy });
  } catch (e) {
    // Hard failure — do NOT mask as success. Returning 503 ensures
    // book-with-availability throws CalendarCheckUnavailable and the
    // booking is refused, instead of silently succeeding with an
    // empty busy list.
    console.error("get-busy-times: fatal error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return jsonResponse(
      {
        busy: [],
        unavailable: true,
        reason: "CALENDAR_CHECK_FAILED",
        detail: message,
      },
      503,
    );
  }
});
