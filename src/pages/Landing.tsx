import { Link, Navigate } from "react-router-dom";
import { BookOpen, CalendarDays, CheckCircle, CreditCard, Mail, Send, Sparkles, Star, Wallet } from "lucide-react";
import portrait from "@/assets/yves-trionnaire-real.jpg";

import { useAuth } from "@/lib/auth";
import { PACKAGES, packageMath, type PackageDef } from "@/lib/packages";
import { ProfileTabs, StatsGrid, StepCard } from "@/components/sections/ProfileSections";
import { Seo } from "@/components/Seo";

export default function Landing() {
  const { user, role, loading } = useAuth();
  if (!loading && user && role) {
    return <Navigate to={role === "teacher" ? "/teacher" : "/student"} replace />;
  }
  return (
    <main>
      <Seo
        title="Yves Trionnaire — Private French Lessons Online"
        description="Book private online French lessons with Yves Trionnaire, DAEFLE certified native French teacher. 5.0 rating, 8,500+ lessons taught."
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
            Private online French lessons for beginners, professionals, and long-term learners. Pick a time on my calendar — I'll send you a payment link, and once it's settled, your spot is confirmed.
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
              <div><strong className="block leading-none">8,537</strong><p className="text-xs text-secondaryText">Lessons taught</p></div>
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
          Each lesson lasts one hour. Packages are paid upfront via the secure link I send by email.
        </p>
      </Section>

      {/* How it works (payment flow) */}
      <section id="how-it-works" className="app-container py-10">
        <h2 className="section-title mb-7 text-center">How booking & payment works</h2>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <StepCard n="1" title="Choose a package" icon={<BookOpen className="h-5 w-5" />}>
            Sign up, then pick the package that fits your goals — single lesson, 5, 10 or 20.
          </StepCard>
          <StepCard n="2" title="Yves gets a notification" icon={<Mail className="h-5 w-5" />}>
            Your request appears in my dashboard the moment you submit it.
          </StepCard>
          <StepCard n="3" title="Payment link by email" icon={<Send className="h-5 w-5" />}>
            I personally email you a secure payment link from my email address.
          </StepCard>
          <StepCard n="4" title="You pay" icon={<CreditCard className="h-5 w-5" />}>
            You complete the payment, and my bank notifies me as soon as it lands.
          </StepCard>
          <StepCard n="5" title="I confirm your lessons" icon={<Wallet className="h-5 w-5" />}>
            I confirm payment in your dashboard — your lessons appear on your account immediately.
          </StepCard>
          <StepCard n="6" title="Book your slots" icon={<CalendarDays className="h-5 w-5" />}>
            The calendar unlocks. Pick any open time — a <strong>Google Meet</strong> invite is sent for each lesson.
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
          Create your free account in 30 seconds. Pick a package — booking unlocks as soon as payment is confirmed.
        </p>

        <div className="fw-card mx-auto max-w-3xl border-2 border-primary/40 bg-primary/5 p-6 text-center">
          <h3 className="mb-2 text-xl font-bold">Get started</h3>
          <p className="mx-auto mb-5 max-w-xl text-sm text-secondaryText">
            Sign up, pick a package, and we'll be in touch by email.
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
          <a href="mailto:" className="btn-primary"><Mail className="h-4 w-4" /> Email me</a>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-secondaryText">
        © {new Date().getFullYear()} Yves Trionnaire — Private French lessons.
      </footer>
    </main>
  );
}

/* ---------------- helpers ---------------- */

function Header() {
  const { user, role } = useAuth();
  const dashboardHref = role === "teacher" ? "/teacher" : "/student";
  return (
    <header className="border-b border-border bg-card">
      <div className="app-container flex items-center justify-between py-4">
        <a href="#home" className="flex items-center gap-3" aria-label="Yves Trionnaire — home">
          <img src={portrait} alt="Yves Trionnaire" className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/20" />
          <div className="leading-tight">
            <div className="font-bold">Yves Trionnaire</div>
            <div className="text-xs text-secondaryText">Native French teacher</div>
          </div>
        </a>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-secondaryText md:flex">
          <a href="#about" className="hover:text-primary">About</a>
          <a href="#how-it-works" className="hover:text-primary">How it works</a>
          <a href="mailto:yvestrionnaire@gmail.com" className="hover:text-primary">Contact</a>
        </nav>
        {user ? (
          <Link to={dashboardHref} className="btn-primary !py-2 !text-xs">Go to dashboard</Link>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/auth?mode=signin" className="text-sm font-semibold text-secondaryText hover:text-primary">Sign in</Link>
            <Link to="/auth" className="btn-primary !py-2 !text-xs">Sign up</Link>
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
  const { subtotal, discountPct, pricePerHour } = packageMath(pkg);
  const highlight = pkg.highlight;
  return (
    <div className={`fw-card relative p-6 ${highlight ? "ring-2 ring-primary" : ""}`}>
      {highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
          Most popular
        </span>
      )}
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
  );
}
