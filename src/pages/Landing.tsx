import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { BookOpen, CalendarDays, CheckCircle, CreditCard, Mail, Sparkles, Star, Wallet } from "lucide-react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import portrait from "@/assets/yves-trionnaire-real.jpg";

import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PACKAGES, packageMath, type PackageDef } from "@/lib/packages";
import { ProfileTabs, StatsGrid, StepCard } from "@/components/sections/ProfileSections";
import { Seo } from "@/components/Seo";
import { toast } from "@/hooks/use-toast";

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID as string;

export default function Landing() {
  const { user, role, loading } = useAuth();
  if (!loading && user && role) {
    return <Navigate to={role === "teacher" ? "/teacher" : "/student"} replace />;
  }
  return (
    <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: "USD" }}>
      <main>
        <Seo
          title="Yves Trionnaire — Private French Lessons Online"
          description="Book private online French lessons with Yves Trionnaire, DAEFLE certified native French teacher. 5.0 rating, 9,000+ lessons taught."
          path="/"
        />
        <Header />

        {/* Hero */}
        <section id="home" className="app-container grid gap-10 py-10 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-16">
          <div className="animate-fade-up">
            <span className="pill mb-4"><CheckCircle className="h-3.5 w-3.5 text-primary" /> Native French teacher · DAEFLE certified</span>
            <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-5xl">
              Learn French with clarity, structure, and confidence.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-secondaryText">
              Private online French lessons for beginners, professionals, and long-term learners. Sign up, pay securely with PayPal, and book your first lesson instantly.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/auth" className="btn-primary"><Sparkles className="h-4 w-4" /> Get started</Link>
              <a href="#about" className="btn-secondary">Learn more about Yves</a>
            </div>
          </div>
          <div className="relative">
            <video
              className="aspect-[4/3] w-full rounded-lg object-cover shadow-soft"
              controls
              preload="none"
              poster={portrait}
              src="/yves-introduction.mp4"
            >
              Your browser does not support the video tag.
            </video>
            <div className="pointer-events-none absolute left-4 top-4 hidden gap-3 md:grid">
              <div className="fw-card pointer-events-auto flex items-center gap-3 px-4 py-3">
                <Star className="h-5 w-5 fill-primary text-primary" />
                <div><strong className="block leading-none">5.0</strong><p className="text-xs text-secondaryText">Average rating</p></div>
              </div>
              <div className="fw-card pointer-events-auto flex items-center gap-3 px-4 py-3">
                <BookOpen className="h-5 w-5 text-primary" />
                <div><strong className="block leading-none">9,203</strong><p className="text-xs text-secondaryText">Lessons taught</p></div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="app-container py-6">
          <StatsGrid />
        </section>

        {/* Profile tabs */}
        <section id="about" className="app-container py-10">
          <h2 className="section-title mb-7 text-center">About Yves</h2>
          <ProfileTabs />
        </section>

        {/* Pricing */}
        <Section title="Lesson packages">
          <p className="mx-auto -mt-3 mb-7 max-w-2xl text-center text-secondaryText">
            One hour at <strong>$20</strong>. Buy a package and save more as you commit to your progress.
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PACKAGES.map((p) => (
              <PackageCard key={p.slug} pkg={p} />
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-secondaryText">
            Each lesson lasts one hour. Packages are paid securely via PayPal — your lessons appear instantly after payment.
          </p>
        </Section>

        {/* How it works */}
        <section id="how-it-works" className="app-container py-10">
          <h2 className="section-title mb-7 text-center">How booking & payment works</h2>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <StepCard n="1" title="Create your account" icon={<Sparkles className="h-5 w-5" />}>
              Sign up in 30 seconds with your email address.
            </StepCard>
            <StepCard n="2" title="Choose a package" icon={<BookOpen className="h-5 w-5" />}>
              Pick the package that fits your goals — single lesson, 5, 10 or 20.
            </StepCard>
            <StepCard n="3" title="Pay securely with PayPal" icon={<CreditCard className="h-5 w-5" />}>
              Click "Pay with PayPal" and complete checkout in seconds. Your card or PayPal balance — your choice.
            </StepCard>
            <StepCard n="4" title="Lessons appear instantly" icon={<Wallet className="h-5 w-5" />}>
              Your credits are added automatically the moment payment clears — no waiting, no email back-and-forth.
            </StepCard>
            <StepCard n="5" title="Book your slots" icon={<CalendarDays className="h-5 w-5" />}>
              The calendar unlocks. Pick any open time — a <strong>Google Meet</strong> invite is sent for each lesson.
            </StepCard>
            <StepCard n="6" title="Start learning" icon={<Star className="h-5 w-5" />}>
              Join the call and start speaking French from your very first lesson.
            </StepCard>
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-secondaryText">
            <strong>Need to reschedule?</strong> Cancel from your dashboard up to 5 minutes before your lesson and book a new slot any time.
          </p>
        </section>

        {/* Booking CTA */}
        <section id="book" className="app-container py-10">
          <h2 className="section-title mb-3 text-center">Ready to start?</h2>
          <p className="mx-auto mb-7 max-w-2xl text-center text-secondaryText">
            Create your free account in 30 seconds. Pick a package and pay with PayPal — your lessons unlock instantly.
          </p>
          <div className="fw-card mx-auto max-w-3xl border-2 border-primary/40 bg-primary/5 p-6 text-center">
            <h3 className="mb-2 text-xl font-bold">Get started</h3>
            <p className="mx-auto mb-5 max-w-xl text-sm text-secondaryText">
              Sign up, pick a package, and pay with PayPal in seconds.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link to="/auth" className="btn-primary"><CalendarDays className="h-4 w-4" /> Sign up & pick a package</Link>
            </div>
            <p className="mt-4 text-xs text-secondaryText">
              Already have an account? <Link to="/auth?mode=signin" className="font-semibold text-primary hover:underline">Sign in</Link>
            </p>
          </div>
        </section>

        {/* Contact */}
        <section className="app-container py-10">
          <div className="fw-card flex flex-col gap-5 bg-secondary p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">A question before booking?</h2>
              <p className="mt-2 text-secondaryText">All communication happens by email. Write to me and I'll get back to you personally.</p>
            </div>
            <a href="mailto:yvestrionnaire@gmail.com?subject=Question%20about%20French%20lessons" className="btn-primary"><Mail className="h-4 w-4" /> Email me</a>
          </div>
        </section>

        <footer className="border-t border-border py-8 text-center text-sm text-secondaryText">
          © {new Date().getFullYear()} Yves Trionnaire — Private French lessons.
        </footer>
      </main>
    </PayPalScriptProvider>
  );
}

/* ---------------- helpers ---------------- */

function Header() {
  const { user, role } = useAuth();
  const dashboardHref = role === "teacher" ? "/teacher" : "/student";
  return (
    <header className="relative overflow-hidden bg-primary text-primary-foreground">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 1440 120"
      >
        <path d="M0 70 C 240 40, 480 100, 720 70 S 1200 40, 1440 80 V120 H0 Z" fill="#ffffff" opacity="0.10" />
        <path d="M0 95 C 300 65, 560 115, 860 85 S 1240 65, 1440 100 V120 H0 Z" fill="#003d2c" opacity="0.14" />
        <path d="M0 55 C 360 35, 620 75, 960 55 S 1300 40, 1440 60 V120 H0 Z" fill="#ffffff" opacity="0.06" />
      </svg>
      <div className="app-container relative flex items-center justify-between py-4">
        <a href="#home" className="flex items-center gap-3" aria-label="Yves Trionnaire — home">
          <img src={portrait} alt="Yves Trionnaire" className="h-9 w-9 rounded-full object-cover ring-2 ring-white/50" />
          <div className="leading-tight">
            <div className="font-bold">Yves Trionnaire</div>
            <div className="text-xs text-primary-foreground/80">Native French teacher</div>
          </div>
        </a>
        <nav className="hidden items-center gap-6 text-sm font-bold text-white md:flex">
          <a href="#about" className="transition hover:text-white/80">About</a>
          <a href="#how-it-works" className="transition hover:text-white/80">How it works</a>
          <a href="mailto:yvestrionnaire@gmail.com?subject=Question%20about%20French%20lessons" className="transition hover:text-white/80">Contact</a>
        </nav>
        {user ? (
          <Link to={dashboardHref} className="rounded-md bg-white px-4 py-2 text-xs font-bold text-primary transition hover:bg-white/90">Go to dashboard</Link>
        ) : (
          <div className="flex items-center gap-3">
            <Link to="/auth?mode=signin" className="text-sm font-bold text-white transition hover:text-white/80">Sign in</Link>
            <Link to="/auth" className="rounded-md bg-white px-4 py-2 text-xs font-bold text-primary transition hover:bg-white/90">Sign up</Link>
          </div>
        )}
      </div>
    </header>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="app-container py-10">
      <h2 className="section-title mb-7 text-center">{title}</h2>
      {children}
    </section>
  );
}

function PackageCard({ pkg }: { pkg: PackageDef }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { subtotal, discountPct, pricePerHour } = packageMath(pkg);
  const highlight = pkg.highlight;
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
        description: `${pkg.lessons} lesson${pkg.lessons > 1 ? "s" : ""} added to your account. Redirecting…`,
      });
      setTimeout(() => navigate("/student"), 2500);
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <div className={`fw-card relative flex flex-col gap-4 p-6 ${highlight ? "ring-2 ring-primary" : ""}`}>
      {highlight && (
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

      {/* PayPal or sign-in */}
      <div className="mt-auto">
        {paid ? (
          <div className="rounded-md bg-green-50 p-3 text-center text-sm font-semibold text-green-700">
            ✓ Payment confirmed — redirecting…
          </div>
        ) : user ? (
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
        ) : (
          <Link
            to={`/auth?redirect=/`}
            className="btn-primary block w-full text-center text-sm"
          >
            Sign in to buy
          </Link>
        )}
      </div>
    </div>
  );
}
