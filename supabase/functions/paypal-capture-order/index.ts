// supabase/functions/paypal-capture-order/index.ts
// Captures an approved PayPal order and grants lesson credits to the student.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PACKAGES: Record<string, { lessons: number; priceUsd: number }> = {
  single: { lessons: 1,  priceUsd: 20  },
  pack5:  { lessons: 5,  priceUsd: 95  },
  pack10: { lessons: 10, priceUsd: 188 },
  pack20: { lessons: 20, priceUsd: 364 },
};

async function getPayPalAccessToken(): Promise<string> {
  const clientId     = Deno.env.get("PAYPAL_CLIENT_ID")!;
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET")!;
  const baseUrl      = Deno.env.get("PAYPAL_BASE_URL") ?? "https://api-m.paypal.com";

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to get PayPal access token");
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate user
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { orderId, packageSlug } = await req.json();
    const pkg = PACKAGES[packageSlug];
    if (!pkg || !orderId) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Capture payment with PayPal
    const accessToken = await getPayPalAccessToken();
    const baseUrl = Deno.env.get("PAYPAL_BASE_URL") ?? "https://api-m.paypal.com";

    const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const capture = await captureRes.json();

    if (capture.status !== "COMPLETED") {
      throw new Error(`PayPal capture failed: ${JSON.stringify(capture)}`);
    }

    // Verify amount matches expected price
    const capturedAmount = parseFloat(
      capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value ?? "0"
    );
    if (Math.abs(capturedAmount - pkg.priceUsd) > 0.01) {
      throw new Error(`Amount mismatch: expected ${pkg.priceUsd}, got ${capturedAmount}`);
    }

    const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id;

    // Grant credits via secure DB function (service role)
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: rpcError } = await adminSupabase.rpc("record_paypal_payment", {
      _student_id: user.id,
      _package_slug: packageSlug,
      _paypal_order_id: orderId,
      _paypal_capture_id: captureId,
    });

    if (rpcError) throw new Error(`Failed to grant credits: ${rpcError.message}`);

    return new Response(JSON.stringify({ success: true, lessonsGranted: pkg.lessons }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("paypal-capture-order error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
