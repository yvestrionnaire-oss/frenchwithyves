import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Clock } from "lucide-react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PACKAGES, packageMath, type PackageDef } from "@/lib/packages";
import { Seo } from "@/components/Seo";
import { toast } from "@/hooks/use-toast";

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID as string;

export default function StudentDashboard() {
  const { user } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadData() {
    setLoading(true);
    const [creditsRes, lessonsRes] = await Promise.all([
      supabase.rpc("credit_balance"),
      supabase
        .from("lessons")
        .select("*")
        .eq("student_id", user!.id)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true }),
    ]);
    if (creditsRes.data !== null) setCredits(creditsRes.data as number);
    if (lessonsRes.data) setUpcoming(lessonsRes.data);
    setLoading(false);
  }

  return (
    <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: "USD" }}>
      <div className="min-h-screen bg-secondary/30">
        <Seo title="Student Dashboard — French with Yves" path="/student" noindex />
        <DashboardHeader />
        <main className="app-container py-8">
          {/* Welcome & credits */}
          <section className="grid gap-5 md:grid-cols-[2fr_1fr]">
            <div className="fw-card relative overflow-hidden p-6">
              <div className="relative z-10">
                <p className="text-sm font-semibold uppercase tracking-wide text-primary">Welcome back</p>
                <h1 className="mt-1 text-2xl font-bold">
                  {user?.email?.split("@")[0] ?? "Student"}
                </h1>
                <p className="mt-2 text-secondaryText">Ready for your next French lesson?</p>
              </div>
            </div>

            <div className="fw-card flex flex-col justify-between gap-4 p-6">
              <div>
                <h2 className="text-lg font-bold">Your lesson credits</h2>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-primary">{credits ?? "—"}</span>
                  <span className="text-secondaryText">credits</span>
                </div>
              </div>
              <Link to="/book" className="btn-primary w-full justify-center text-sm">Book a lesson</Link>
            </div>
          </section>

          {/* Upcoming lessons */}
          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Upcoming lessons</h2>
            </div>
            {loading ? (
              <p className="text-secondaryText">Loading…</p>
            ) : upcoming.length === 0 ? (
              <div className="fw-card p-8 text-center">
                <CalendarDays className="mx-auto mb-3 h-10 w-10 text-secondaryText/50" />
                <p className="font-semibold">No upcoming lessons</p>
                <p className="mt-1 text-sm text-secondaryText">
                  {credits && credits > 0
                    ? "You have credits! Book your next lesson."
                    : "Buy a package below to start booking lessons."}
                </p>
                {credits && credits > 0 ? (
                  <div className="mt-4 flex flex-wrap justify-center gap-3">
                    <Link to="/book" className="btn-primary text-sm">Book a lesson</Link>
                  </div>
                ) : null}
              </div>
            ) : (
              <ul className="grid gap-3">
                {upcoming.map((l) => (
                  <li key={l.id} className="fw-card flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-semibold">
                          {new Date(l.starts_at).toLocaleString(undefined, {
                            weekday: "long", month: "short", day: "numeric",
                            hour: "numeric", minute: "2-digit",
                          })}
                        </p>
                        <p className="text-sm text-secondaryText">1 hour · Google Meet</p>
                      </div>
                    </div>
                    <span className="pill">Booked</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Buy more credits */}
          <section className="mt-10">
            <h2 className="text-xl font-bold">Buy lesson credits</h2>
            <p className="mt-1 text-secondaryText">
              Purchase a package below — credits are added instantly after payment.
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {PACKAGES.map((pkg) => (
                <StudentPackageCard key={pkg.slug} pkg={pkg} onPaid={loadData} />
              ))}
            </div>
          </section>
        </main>
      </div>
    </PayPalScriptProvider>
  );
}

/* ---------------- helpers ---------------- */

function DashboardHeader() {
  const { user, signOut } = useAuth();
  return (
    <header className="border-b border-border bg-card">
      <div className="app-container flex items-center justify-between py-4">
        <Link to="/student" className="flex items-center gap-3">
          <span className="font-bold">French with Yves</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-secondaryText sm:inline">{user?.email}</span>
          <button onClick={signOut} className="btn-secondary !py-2 !text-xs">Sign out</button>
        </div>
      </div>
    </header>
  );
}

function StudentPackageCard({ pkg, onPaid }: { pkg: PackageDef; onPaid: () => void | Promise<void> }) {
  const { subtotal, discountPct, pricePerHour } = packageMath(pkg);
  const [purchasing, setPurchasing] = useState(false);
  const [paid, setPaid] = useState(false);

  async function createOrder() {
    const { data, error } = await supabase.functions.invoke("paypal-create-order", {
      body: { packageSlug: pkg.slug },
    });
    if (error || data?.error) throw new Error(data?.error ?? error?.message ?? "Failed to create order");
    return data.orderId as string;
  }

  async function onApprove(data: { orderID: string }) {
    setPurchasing(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("paypal-capture-order", {
        body: { orderId: data.orderID, packageSlug: pkg.slug },
      });
      if (error || result?.error) {
        toast({ title: "Payment failed", description: result?.error ?? error?.message, variant: "destructive" });
        return;
      }
      setPaid(true);
      toast({
        title: "Payment successful! 🎉",
        description: `${pkg.lessons} lesson${pkg.lessons > 1 ? "s" : ""} added to your account.`,
      });
      setTimeout(() => void onPaid(), 1500);
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <div className={`fw-card relative flex flex-col gap-4 p-6 ${pkg.highlight ? "ring-2 ring-primary" : ""}`}>
      {pkg.highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
          Most popular
        </span>
      )}
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-lg font-bold">{pkg.lessons} {pkg.lessons === 1 ? "lesson" : "lessons"}</h3>
          {discountPct > 0 && (
            <span className="rounded-full bg-secondary px-2 py-1 text-xs font-bold text-primary">−{discountPct}%</span>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">${pkg.priceUsd}</span>
          <span className="text-sm text-secondaryText">total</span>
        </div>
        <p className="mt-1 text-sm text-secondaryText">
          ${pricePerHour.toFixed(2)} / hour
          {discountPct > 0 && <span className="ml-2 text-xs line-through">${subtotal}</span>}
        </p>
      </div>

      <div className="mt-auto">
        {paid ? (
          <div className="rounded-md bg-green-50 p-3 text-center text-sm font-semibold text-green-700">
            ✓ Added to your account
          </div>
        ) : (
          <div className={purchasing ? "pointer-events-none opacity-60" : ""}>
            <PayPalButtons
              style={{ layout: "vertical", label: "pay", height: 40 }}
              createOrder={createOrder}
              onApprove={onApprove}
              onError={(err) => {
                console.error("PayPal error", err);
                toast({ title: "PayPal error", description: "Something went wrong. Please try again.", variant: "destructive" });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
