import { useState } from "react";
import { BookOpen, CalendarDays, CheckCircle, CreditCard, Mail, Send, Star, Target, Users, Wallet } from "lucide-react";
import portrait from "@/assets/yves-trionnaire-real.jpg";
import introVideo from "@/assets/yves-introduction.mp4";

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
          <img
            src={portrait}
            alt="Yves Trionnaire, online French teacher"
            width={512}
            height={512}
            className="aspect-[4/3] w-full rounded-lg object-cover shadow-soft"
          />
        </div>
      </section>

      {/* Intro video */}
      <section>
        <div className="fw-card grid gap-6 p-5 lg:grid-cols-[1fr_0.75fr] lg:items-center">
          <video
            className="aspect-video w-full rounded-lg border border-border bg-muted object-cover"
            controls
            preload="metadata"
            src={introVideo}
          >
            Your browser does not support the video tag.
          </video>
          <div>
            <p className="text-sm font-bold text-primary">Introduction video</p>
            <h2 className="mt-2 text-2xl font-bold">A short welcome from Yves</h2>
            <p className="mt-3 text-secondaryText">
              Get a feel for his calm, structured teaching style before your next lesson.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<BookOpen className="h-5 w-5" />} value="8,537" label="Lessons taught" />
        <StatCard icon={<Star className="h-5 w-5" />} value="5.0 / 5.0" label="Average rating" />
        <StatCard icon={<Target className="h-5 w-5" />} value="9+ years" label="Teaching experience" />
        <StatCard icon={<Users className="h-5 w-5" />} value="22.6" label="Lessons per student" />
      </section>

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
            I personally email you a secure payment link from <strong>yvestrionnaire@gmail.com</strong>.
          </StepCard>
          <StepCard n="4" title="You pay" icon={<CreditCard className="h-5 w-5" />}>
            You complete the payment, and my bank notifies me as soon as it lands.
          </StepCard>
          <StepCard n="5" title="I confirm your credits" icon={<Wallet className="h-5 w-5" />}>
            I confirm payment in your dashboard — credits appear on your account immediately.
          </StepCard>
          <StepCard n="6" title="Book your slots" icon={<CalendarDays className="h-5 w-5" />}>
            The calendar unlocks. Pick any open time — a <strong>Google Meet</strong> invite is sent for each lesson.
          </StepCard>
        </div>
        <div className="mx-auto mt-8 max-w-2xl rounded-lg border border-primary/30 bg-primary/5 p-5 text-center">
          <p className="text-sm">
            <strong>🎁 Free trial lesson</strong> — request it, I'll confirm by email, and you can book a 30-min slot at no cost.
          </p>
        </div>
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-secondaryText">
          <strong>Need to reschedule?</strong> Cancel from your dashboard up to 5 minutes before your lesson and book a new slot any time.
        </p>
      </section>
    </div>
  );
}

function StepCard({ n, title, icon, children }: { n: string; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="fw-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-xl font-bold text-primary">{n}</div>
        <div className="text-primary">{icon}</div>
      </div>
      <h3 className="font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-secondaryText">{children}</p>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="fw-card p-5">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-secondaryText">{label}</div>
    </div>
  );
}

function ProfileTabs() {
  const [tab, setTab] = useState<"About" | "Specialties" | "Shared notes" | "Resume" | "Reviews">("About");
  return (
    <div className="fw-card overflow-hidden">
      <div className="flex overflow-auto border-b border-border">
        {(["About", "Specialties", "Shared notes", "Resume", "Reviews"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-4 text-sm font-bold transition ${
              tab === t ? "border-b-2 border-primary text-primary" : "text-secondaryText hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="p-6">
        {tab === "About" && <AboutPanel />}
        {tab === "Specialties" && <SpecialtiesPanel />}
        {tab === "Shared notes" && <SharedNotesPanel />}
        {tab === "Resume" && <ResumePanel />}
        {tab === "Reviews" && <ReviewsPanel />}
      </div>
    </div>
  );
}

function AboutPanel() {
  return (
    <>
      <div className="mb-5 rounded-lg border border-primary bg-secondary p-4">
        <strong>Trial lesson available</strong>
        <p className="mt-1 text-sm text-secondaryText">
          Start with a first lesson to discuss your interests, objectives, preferred schedule, and the best approach for regular progress.
        </p>
      </div>
      <p className="leading-relaxed text-secondaryText">
        Bonjour, I'm Yves, a French tutor from France and a DAEFLE certified teacher from the Alliance Française. I have been teaching French for more than nine years and offer classes adapted to your needs: conversation, vocabulary, grammar, pronunciation, exam preparation, business French, or long-term fluency. My approach is interactive and practical, with real-life communication from the start so students can quickly feel the use of the language.
      </p>
      <p className="mt-4 leading-relaxed text-secondaryText">
        In class, we focus on useful communication, clear corrections, and steady confidence. I adapt each lesson to your objective, whether you need natural conversation, stronger grammar, better pronunciation, preparation for DELF/TCF/TEF, or French for travel and work.
      </p>
    </>
  );
}

function SpecialtiesPanel() {
  const groups: [string, string[]][] = [
    ["Levels", ["Beginner", "Upper Beginner", "Intermediate", "Upper Intermediate", "Advanced", "Upper Advanced"]],
    ["Ages", ["All ages welcome", "Children", "Teenagers", "Adults", "Seniors"]],
    ["Language skills", ["Accent Reduction", "Grammar Development", "Listening Comprehension", "Phonetics", "Reading Comprehension", "Speaking Practice", "Vocabulary Development", "Writing Correction"]],
    ["Student Goals", ["DALF", "DELF", "Business French", "Interview Preparation", "Travel French", "Weekly guided learning"]],
  ];
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      {groups.map(([g, items]) => (
        <div key={g}>
          <h4 className="mb-3 font-bold">{g}</h4>
          <div className="flex flex-wrap gap-2">
            {items.map((x) => (
              <span className="pill" key={x}>{x}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SharedNotesPanel() {
  return (
    <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary md:h-16 md:w-16">
        <BookOpen className="h-6 w-6 md:h-8 md:w-8" />
      </div>
      <div>
        <h3 className="text-xl font-bold">A live Google Doc we both write in</h3>
        <p className="mt-3 leading-relaxed text-secondaryText">
          For every class I share a <strong>Google Doc</strong> that works as an interactive notepad — both of us can type in it during the lesson: vocabulary, corrections, grammar examples, homework. After class, I export the notes as a <strong>PDF</strong> and send it to you by email so you always have a clean record of what we covered.
        </p>
      </div>
    </div>
  );
}

function ResumePanel() {
  const sections = [
    {
      title: "Education",
      items: [
        ["2016–2017", "DAEFLE — Diplôme d'Aptitude à l'Enseignement du Français Langue Étrangère", "Alliance Française, Barcelona"],
        ["2009–2012", "M.Sc. in International Business Management", "Philipps Universität Marburg"],
        ["2009–2010", "Master's Degree", "INSEEC Business School, Paris"],
      ],
    },
    {
      title: "Teaching Experience",
      items: [
        ["2017–Present", "French Language Teacher", "Verbling · Online"],
        ["2017–2018", "English Language Teacher", "Helping Overcome Obstacles Peru"],
        ["2016–2017", "Assistant French & English Language Teacher", "EOI de Cornellà de Llobregat"],
        ["2016–2017", "French Language Teacher", "BCN Languages · Barcelona"],
      ],
    },
    {
      title: "Languages",
      items: [
        ["Native", "French", "Mother tongue"],
        ["C2", "English", "Fluent professional proficiency"],
        ["C1", "Spanish", "Fluent professional proficiency"],
        ["B1", "German", "Intermediate"],
        ["A1", "Mandarin", "Beginner"],
      ],
    },
  ];
  return (
    <div className="grid gap-6">
      {sections.map((section) => (
        <section key={section.title} className="rounded-lg border border-border bg-card">
          <h4 className="border-b border-border px-5 py-4 text-lg font-bold">{section.title}</h4>
          <div className="divide-y divide-border">
            {section.items.map(([date, title, place]) => (
              <div key={`${date}-${title}`} className="grid gap-2 px-5 py-4 md:grid-cols-[140px_1fr]">
                <div className="text-sm font-bold text-primary">{date}</div>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-1 text-sm text-secondaryText">{place}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ReviewsPanel() {
  const REVIEWS_LONG: [string, string][] = [
    ["Daniel · 18 lessons", "I had over 30 lessons with Yves over a 3 months period and I am going to carry on as he was an amazing teacher. My grammar and confidence in conversation improved a lot."],
    ["Nikolay · 26 lessons", "The lessons are very well-structured and cover conversation, writing, reading, and listening practices tailored to my travel and everyday life needs."],
    ["Marie · 68 lessons", "It is always a pleasure talking to Yves. He is very patient and corrects my mistakes in real time, which I totally appreciate."],
    ["Drysdale · 4 lessons", "A really professional, very kind, patient and informed teacher. He explains grammar well and gently corrects mistakes while keeping me motivated."],
    ["Atthawoot · 44 lessons", "Yves always engages me in conversation so that I can practice speaking French. He is a very motivational tutor and a true Grammar guru."],
    ["MELINA · 7 lessons", "Yves is a great teacher. He is very kind and patient and structures class so that you get practice in speaking, writing and listening."],
  ];
  return (
    <>
      <div className="mb-5 flex items-center gap-3">
        <span className="pill bg-secondary text-primary">5.0</span>
        <p className="text-sm text-secondaryText">Based on feedback from long-term students</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {REVIEWS_LONG.map(([name, q]) => (
          <div className="fw-card-flat p-4" key={name}>
            <strong>{name}</strong>
            <p className="my-2 text-primary">★★★★★</p>
            <p className="text-sm text-secondaryText">"{q}"</p>
          </div>
        ))}
      </div>
    </>
  );
}
