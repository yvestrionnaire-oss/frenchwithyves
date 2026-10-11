// Shared Google Calendar access for edge functions.
//
// Replaces the old Lovable connector-gateway. We authenticate directly to
// Google using an OAuth refresh token (one-time user consent), exchanging it
// for a short-lived access token on each invocation.
//
// Required Supabase secrets:
//   GOOGLE_CLIENT_ID      - OAuth client id from Google Cloud console
//   GOOGLE_CLIENT_SECRET  - OAuth client secret
//   GOOGLE_REFRESH_TOKEN  - refresh token captured during one-time consent
//
// All calendar operations run as the Google account that granted consent
// (Yves's account). Lesson events are written to the calendar returned by
// teachingCalendarPathId() — primary by default, or a secondary calendar when
// TEACHING_CALENDAR_ID is set (see below).

const GOOGLE_API = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Calendar id that lesson events are created/updated/deleted on, already
 * URL-encoded so it is safe to drop straight into a `/calendars/<id>/...` path.
 *
 * Defaults to "primary". Set the TEACHING_CALENDAR_ID secret to a secondary
 * calendar's id (e.g. the "French Classes" calendar that Verbling's Google
 * Calendar sync watches) so that every lesson booked on the site lands there
 * and automatically blocks the matching slot on Verbling — preventing
 * double-bookings without any manual step. Availability checks (get-busy-times)
 * scan ALL calendars, so they keep seeing these events regardless of this
 * setting.
 */
export function teachingCalendarPathId(): string {
  const id = Deno.env.get("TEACHING_CALENDAR_ID")?.trim();
  return id ? encodeURIComponent(id) : "primary";
}

export class GoogleCalendarUnconfigured extends Error {
  constructor() {
    super("Google Calendar is not configured (missing OAuth secrets)");
    this.name = "GoogleCalendarUnconfigured";
  }
}

/** True when all required Google OAuth secrets are present. */
export function googleConfigured(): boolean {
  return Boolean(
    Deno.env.get("GOOGLE_CLIENT_ID") &&
      Deno.env.get("GOOGLE_CLIENT_SECRET") &&
      Deno.env.get("GOOGLE_REFRESH_TOKEN"),
  );
}

/**
 * Exchange the stored refresh token for a fresh access token.
 * Throws GoogleCalendarUnconfigured if secrets are missing, or a generic
 * Error if Google rejects the exchange (e.g. revoked token).
 */
export async function getGoogleAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new GoogleCalendarUnconfigured();
  }

  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.access_token) {
    throw new Error(
      `Google token exchange failed (${resp.status}): ${
        JSON.stringify(data).slice(0, 200)
      }`,
    );
  }
  return data.access_token as string;
}

/**
 * Make an authenticated Google Calendar v3 request.
 * `path` is appended to the calendar/v3 base (e.g. "/freeBusy",
 * "/calendars/primary/events"). Returns the raw Response so callers can
 * inspect status codes (e.g. tolerate 404/410 on delete).
 */
export async function googleCalendarFetch(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return await fetch(`${GOOGLE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}
