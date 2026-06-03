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
// (Yves's account), against its primary calendar.

const GOOGLE_API = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

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
