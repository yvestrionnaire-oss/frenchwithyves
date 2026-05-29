// supabase/functions/paypal-create-order/index.ts
// Creates a PayPal order for a given lesson package.
// Returns the PayPal order ID to the client for approval.

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

    const { packageSlug } = await req.json();
    const pkg = PACKAGES[packageSlug];
    if (!pkg) {
      return new Response(JSON.stringify({ error: "Invalid package" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getPayPalAccessToken();
    const baseUrl = Deno.env.get("PAYPAL_BASE_URL") ?? "https://api-m.paypal.com";

    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: {
            currency_code: "USD",
            value: pkg.priceUsd.toFixed(2),
          },
          description: `French with Yves — ${pkg.lessons} lesson${pkg.lessons > 1 ? "s" : ""} (${packageSlug})`,
          custom_id: `${user.id}|${packageSlug}`,
        }],
      }),
    });

    const order = await orderRes.json();
    if (!order.id) throw new Error(`PayPal order creation failed: ${JSON.stringify(order)}`);

    return new Response(JSON.stringify({ orderId: order.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("paypal-create-order error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
