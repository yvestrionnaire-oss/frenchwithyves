import { BookOpen, CalendarDays, CheckCircle, CreditCard, Mail, Send, Star, Wallet } from "lucide-react";
import portrait from "@/assets/yves-trionnaire-real.jpg";
import { ProfileTabs, StatsGrid, StepCard } from "@/components/sections/ProfileSections";

/**
 * Standalone About / profile content shared between the public Landing page
 * and the authenticated /about page available from the student dashboard.
 */
export default function AboutContent() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <span className="pill mb-4">
            <CheckCircle className="h-3.5 w-3.5 text-primary" /> Native French teacher · DAEFLE certified
          </span>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-5xl">
            Meet Yves — your French teacher
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-secondaryText">
            A short introduction to who Yves is, how he teaches, and what to expect from your lessons.
          </p>
          <p className="mt-6 flex items-center gap-2 text-sm text-secondaryText">
            <Star className="h-4 w-4 fill-primary text-primary" /> 5.0 average rating · 8,500+ lessons taught · 9+ years teaching
          </p>
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
        </div>
      </section>

      {/* Stats */}
      <StatsGrid />

      {/* Profile tabs */}
      <section>
        <h2 className="section-title mb-7 text-center">About Yves</h2>
        <ProfileTabs />
      </section>

      {/* How booking & payment works */}
      <section>
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
    </div>
  );
}
