import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { BookOpen, CalendarDays, CheckCircle, CreditCard, Mail, Send, Sparkles, Star, Target, Users, Wallet } from "lucide-react";
import portrait from "@/assets/yves-trionnaire-real.jpg";
import introVideo from "@/assets/yves-introduction.mp4";
import { useAuth } from "@/lib/auth";

export default function Landing() {
  const { user, role, loading } = useAuth();
  if (!loading && user && role) {
    return <Navigate to={role === "teacher" ? "/teacher" : "/student"} replace />;
  }
  return (
    <main>
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
            <Link to="/auth?trial=1" className="btn-primary"><Sparkles className="h-4 w-4" /> Request free trial</Link>
            <a href="#about" className="btn-secondary">Learn more about Yves</a>
          </div>
          <p className="mt-6 flex items-center gap-2 text-sm text-secondaryText">
            <Star className="h-4 w-4 fill-primary text-primary" /> 5.0 average rating · 8,500+ lessons taught · 9+ years teaching
          </p>
        </div>
        <div className="relative">
          <img src={portrait} alt="Yves Trionnaire, online French teacher" width={512} height={512} className="aspect-[4/3] w-full rounded-lg object-cover shadow-soft" />
          <div className="absolute left-4 top-10 grid gap-3">
            <div className="fw-card flex items-center gap-3 px-4 py-3">
              <Star className="h-5 w-5 fill-primary text-primary" />
              <div><strong className="block leading-none">5.0</strong><p className="text-xs text-secondaryText">Average rating</p></div>
            </div>
            <div className="fw-card flex items-center gap-3 px-4 py-3">
              <BookOpen className="h-5 w-5 text-primary" />
              <div><strong className="block leading-none">8,537</strong><p className="text-xs text-secondaryText">Lessons taught</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* Intro video */}
      <section className="app-container pb-8">
        <div className="fw-card grid gap-6 p-5 lg:grid-cols-[1fr_0.75fr] lg:items-center">
          <video className="aspect-video w-full rounded-lg border border-border bg-muted object-cover" controls preload="metadata" src={introVideo}>
            Your browser does not support the video tag.
          </video>
          <div>
            <p className="text-sm font-bold text-primary">Introduction video</p>
            <h2 className="mt-2 text-2xl font-bold">Meet Yves before your first lesson</h2>
            <p className="mt-3 text-secondaryText">A short welcome from Yves so you can get a feel for his calm, structured teaching style.</p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="app-container grid gap-4 py-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<BookOpen className="h-5 w-5" />} value="8,537" label="Lessons taught" />
        <StatCard icon={<Star className="h-5 w-5" />} value="5.0 / 5.0" label="Average rating" />
        <StatCard icon={<Target className="h-5 w-5" />} value="9+ years" label="Teaching experience" />
        <StatCard icon={<Users className="h-5 w-5" />} value="22.6" label="Lessons per student" />
      </section>

      {/* Profile tabs */}
      <section id="about" className="app-container py-10">
        <h2 className="section-title mb-7 text-center">About Yves</h2>
        <ProfileTabs />
      </section>

      {/* Pricing */}
      <Section title="Lesson packages">
        <p className="mx-auto -mt-3 mb-7 max-w-2xl text-center text-secondaryText">
          One hour at <strong>$20</strong>. Buy a package and save more as you commit to your progress. <span className="font-semibold text-primary">The 30-minute trial lesson is free.</span>
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

      {/* Booking CTA */}
      <section id="book" className="app-container py-10">
        <h2 className="section-title mb-3 text-center">Ready to start?</h2>
        <p className="mx-auto mb-7 max-w-2xl text-center text-secondaryText">
          Create your free account in 30 seconds. Request a trial or a full package — booking unlocks as soon as payment is confirmed.
        </p>

        <div className="fw-card mx-auto max-w-3xl border-2 border-primary/40 bg-primary/5 p-6 text-center">
          <h3 className="mb-2 text-xl font-bold">Get started</h3>
          <p className="mx-auto mb-5 max-w-xl text-sm text-secondaryText">
            Sign up, pick a package or request a trial, and we'll be in touch by email.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth?trial=1" className="btn-primary"><Sparkles className="h-4 w-4" /> Request free trial</Link>
            <Link to="/auth" className="btn-secondary"><CalendarDays className="h-4 w-4" /> Sign up & pick a package</Link>
          </div>
          <p className="mt-4 text-xs text-secondaryText">
            Already have an account? <Link to="/auth?mode=signin" className="font-semibold text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </section>

      {/* Reviews removed per request */}


      {/* Contact */}
      <section className="app-container py-10">
        <div className="fw-card flex flex-col gap-5 bg-secondary p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold">A question before booking?</h2>
            <p className="mt-2 text-secondaryText">All communication happens by email. Write to me at <strong>yvestrionnaire@gmail.com</strong> and I'll get back to you personally.</p>
          </div>
          <a href="mailto:yvestrionnaire@gmail.com" className="btn-primary"><Mail className="h-4 w-4" /> yvestrionnaire@gmail.com</a>
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
        <a href="#home" className="flex items-center gap-3">
          <img src={portrait} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/20" />
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

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="fw-card p-5">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-secondaryText">{label}</div>
    </div>
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

function ProfileTabs() {
  const [tab, setTab] = useState<"About" | "Specialties" | "Shared notes" | "Resume" | "Reviews">("About");
  return (
    <div className="fw-card overflow-hidden">
      <div className="flex overflow-auto border-b border-border">
        {(["About", "Specialties", "Shared notes", "Resume", "Reviews"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-4 text-sm font-bold transition ${tab === t ? "border-b-2 border-primary text-primary" : "text-secondaryText hover:text-foreground"}`}
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

function AboutPanel() {
  return (
    <>
      <div className="mb-5 rounded-lg border border-primary bg-secondary p-4">
        <strong>Trial lesson available</strong>
        <p className="mt-1 text-sm text-secondaryText">Start with a first lesson to discuss your interests, objectives, preferred schedule, and the best approach for regular progress.</p>
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
            {items.map((x) => <span className="pill" key={x}>{x}</span>)}
          </div>
        </div>
      ))}
    </div>
  );
}

function ResumePanel() {
  const sections = [
    { title: "Education", items: [
      ["2016–2017", "DAEFLE — Diplôme d'Aptitude à l'Enseignement du Français Langue Étrangère", "Alliance Française, Barcelona"],
      ["2009–2012", "M.Sc. in International Business Management", "Philipps Universität Marburg"],
      ["2009–2010", "Master's Degree in Business Administration", "INSEEC Business School, Paris"],
    ] },
    { title: "Teaching Experience", items: [
      ["2017–Present", "French Language Teacher", "Verbling · Online"],
      ["2017–2018", "English Language Teacher", "Helping Overcome Obstacles Peru"],
      ["2016–2017", "Assistant French & English Language Teacher", "EOI de Cornellà de Llobregat"],
      ["2016–2017", "French Language Teacher", "BCN Languages · Barcelona"],
    ] },
    { title: "Languages", items: [
      ["Native", "French", "Mother tongue"],
      ["C2", "English", "Fluent professional proficiency"],
      ["C1", "Spanish", "Fluent professional proficiency"],
      ["B1", "German", "Intermediate"],
      ["A1", "Mandarin", "Beginner"],
    ] },
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
  const [visible, setVisible] = useState(6);
  const shown = REVIEWS_LONG.slice(0, visible);
  const hasMore = visible < REVIEWS_LONG.length;
  return (
    <>
      <div className="mb-5 flex items-center gap-3">
        <span className="pill bg-secondary text-primary">5.0</span>
        <p className="text-sm text-secondaryText">Based on {REVIEWS_LONG.length}+ reviews from long-term students</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {shown.map(([name, q], i) => (
          <div className="fw-card-flat p-4" key={`${name}-${i}`}>
            <strong>{name}</strong>
            <p className="my-2 text-primary">★★★★★</p>
            <p className="text-sm text-secondaryText">"{q}"</p>
          </div>
        ))}
      </div>
      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setVisible((v) => v + 6)}
            className="rounded-lg border border-primary bg-secondary px-6 py-3 text-sm font-bold text-primary transition hover:bg-primary hover:text-primary-foreground"
          >
            Load more reviews
          </button>
        </div>
      )}
    </>
  );
}


const REVIEWS_LONG: [string, string][] = [
  ["Stephi · 141 lessons", "Patient and helpful all the time."],
  ["Evelyn · 25 lessons", "He is amenable to trying whatever approach helps me."],
  ["Matt · 10 lessons", "Yves is a great teacher and emphasizes conversation. He engages with you and makes you work to get out of your comfort zone!"],
  ["pauline · 2 lessons", "Just right."],
  ["Martha · 11 lessons", "Merci beaucoup!!"],
  ["MELINA · 7 lessons", "Yves is a great teacher. He is very kind and patient and structures class so that you get practice in speaking, writing and listening."],
  ["Atthawoot · 45 lessons", "I really had a great time with Yves in class. He pushed but not being pushy."],
  ["Atthawoot · 44 lessons", "Yves is a true Grammar guru."],
  ["Atthawoot · 42 lessons", "Yves always tries to engage me in conversation so that I could practice speaking French — which I really appreciate. He is a very motivational tutor."],
  ["Marie · 68 lessons", "It is always a pleasure talking to Yves. He is always very patient and corrects my mistakes in real time, which I totally appreciate."],
  ["Evelyn · 15 lessons", "C'était super!! Yves est gentil! Il m'aide beaucoup!"],
  ["Mohammed · 24 lessons", "I studied French for a year then stopped and felt like I lost a lot of it, so I decided to take lessons with Yves. After 20 lessons I'm so happy with the results — I can communicate fast, read and write. I now watch French YouTube videos and understand about 65% of the dialogue. Thank you Yves!"],
  ["Drysdale · 4 lessons", "Une leçon fabuleuse, comme toujours. Yves a la patience d'un saint!"],
  ["Mohammed · 8 lessons", "Amazing classes as usual! Thanks Yves."],
  ["banafsheh · 7 lessons", "He is a good teacher. My daughter enjoys learning French with him. Thanks for being patient."],
  ["Nikolay · 26 lessons", "I first met Yves in late July 2024, and by December I can confidently say I am more than happy to be guided by such a dedicated professional. The lessons are very well-structured and cover conversation, writing, reading and listening practices tailored to my travel and everyday-life needs. My recent visit to France confirmed my skills have grown to a much more comfortable level. Highly recommended."],
  ["Mohammed · 3 lessons", "I had booked with 3 teachers on different platforms but none actually understood my needs and requirements like Yves. Totally recommended for anyone who wants to grasp the French language. Thank you Yves."],
  ["Lewis · 2 lessons", "I am really enjoying my lessons with Yves. After 4 lessons I can already notice an improvement in my confidence, vocabulary, and more."],
  ["Мар'яна · 12 lessons", "Yves is always in a good mood and it's helping me to keep going."],
  ["Мар'яна · 9 lessons", "Lessons with Yves are always interesting and enthusiastic. He can explain the rules and small differences between them very well. 👍"],
  ["Drysdale · 2 lessons", "Another great lesson. He is amiable, cordial, organised, professional and an expert in his field. Highly recommended."],
  ["Shelley · 11 lessons", "I appreciate Yves' patience in helping me learn French."],
  ["Luz · 11 lessons", "I really enjoyed having classes with Yves. I recommend him, absolutely!"],
  ["Drysdale · 1 lesson", "Great lesson. Very organised and prepared. A really professional, very kind, patient and informed teacher. He explains grammar well and gently corrected my one million mistakes while keeping me motivated. Great teacher all round."],
  ["Geoffrey · 3 lessons", "Yves is a patient and friendly tutor. I take longer to absorb information so I am glad that he is able to slow down for my speed. Merci beaucoup et à la prochaine!"],
  ["Мар'яна · 3 lessons", "The teacher charges you with good energy and a positive mood. He is a good motivator. The lesson with him is easy going."],
  ["Мар'яна · 2 lessons", "The teacher is very open and flexible. It was a pleasure to talk and to do exercises online. Hope for more interesting lessons soon."],
  ["Andrew · 3 lessons", "I am a beginner in French and Yves has been fantastic. Had 3 lessons already and looking forward to more. He is patient, friendly and my initial nerves have vanished. Highly recommend Yves."],
  ["Marie · 13 lessons", "My vocabulary increases with each lesson."],
  ["Daniel · 18 lessons", "I had over 30 lessons with Yves over a 3 month period and I'm going to carry on — he was an amazing teacher! Yves is sensitive to my specific learning needs and has a range of really helpful teaching techniques which helped me progress very quickly. My grammar and confidence in conversation improved a lot."],
  ["Marie · 2 lessons", "Yves is easy to talk to and presents interesting topics."],
  ["Nabila · 3 lessons", "I really appreciate that Yves made the effort to find out about what I need and tailor the class accordingly."],
  ["Anne · 12 lessons", "Excellent, excellent, excellent — choose Yves as your French teacher."],
  ["Nicola · 28 lessons", "Yves is an excellent teacher for beginner and intermediate French students. He is very patient and very passionate about making sure you understand grammar and correct pronunciation."],
  ["Helen · 5 lessons", "My son loves his class. He finds the class very helpful and fun at the same time."],
  ["Nia · 3 lessons", "Fun, fun and fun."],
  ["Tobias · 3 lessons", "Great as always. A tricky lesson for me but Yves was very patient and always helped me when I forgot a word or phrase."],
  ["Nia · 2 lessons", "I love it. I recommend him to all students."],
  ["Tobias · 2 lessons", "Fantastic as always! We're gradually developing a good system for me to learn and build my vocabulary."],
  ["Annalisa · 2 lessons", "La leçon est amusante et intéressante, Yves est un professeur attentif, il vous corrige pendant que vous parlez et donne d'excellents points. Je suis très heureuse d'avoir commencé ce parcours d'apprentissage du français avec lui!"],
  ["Christopher · 4 lessons", "Great lesson! Learning a lot!"],
  ["Christopher · 3 lessons", "Excellent class. Fantastic teacher!"],
  ["Christopher · 1 lesson", "Great lesson. Great teacher."],
  ["Joe · 4 lessons", "Yves est très patient avec moi."],
  ["Ethan · 12 lessons", "Good structure for intermediate learners."],
  ["Greg · 21 lessons", "Making progress — very happy."],
  ["Ethan · 6 lessons", "Yves structures every lesson very well to cover all aspects of speaking, comprehension, writing, etc., and works on your weak points without stress. I felt that I make small progress with each lesson. Thanks a lot!"],
  ["Rachel · 2 lessons", "Yves is a good teacher! Comfortable and qualified!"],
  ["Ethan · 2 lessons", "Productive lesson with a mix of conversation, comprehension and grammar in 1 hour. Well planned and I learn a lot. Thanks."],
  ["paulmshepherd · 2 lessons", "I'm really happy to be on track in my preparation for my B2 DELF exam with Yves."],
  ["Samantha · 10 lessons", "This teacher is the best I have ever worked with. Yves can adapt and plan a lesson not only suitable for me, but also full of engaging content. I'm impressed at his skills in organizing and anticipating unpredictable aspects of learning. Time passed so quickly that I forgot 30 minutes had passed. If a student seeks a very competent teacher who is capable of rendering learning fun and personalized, Yves is a perfect choice."],
  ["Atthawoot · 35 lessons", "Yves has been my go-to French tutor for many years. He's been keeping up with his quality. After so many years, he remains the best tutor I've ever had. Thank you Yves."],
  ["I. Vera · 2 lessons", "¡Siempre geniales las clases con Yves!"],
  ["Monica · 4 lessons", "Yves is a great teacher. He's very patient and kind."],
  ["Solamon · 1 lesson", "Yves has been very kind, patient, and practical so far!"],
  ["Benjamin · 32 lessons", "I've been taking lessons with Yves for months now and I look forward to our lessons every time! He is kind, patient, flexible, and always incorporates a (much needed) grammar lesson into our conversations."],
  ["Rae · 9 lessons", "Great teacher! Highly recommend!"],
  ["Adam · 35 lessons", "What a fantastic initial lesson. Yves very quickly established my level and pitched the lesson just right. Lots of correction, which I really need. I'm looking forward to my next lesson."],
  ["Mohamed · 1 lesson", "Good listener with patience to give time for the learner to think out sentences. I am pleased to work with Yves and I will book further hours."],
  ["Oleg · 1 lesson", "The trial class with Yves was convincing enough for me to book a course with him."],
  ["Kathy · 1 lesson", "Excellent 1st class with Yves. He was well prepared and really positive and easy to talk with. I look forward to future lessons. Thank you!"],
  ["Kerri · 2 lessons", "Organised, professional and encouraging! Well structured class with good pace and approach — awesome!"],
  ["Sungmi Kary · 147 lessons", "He was indeed the perfect teacher for me!"],
  ["Ewa · 131 lessons", "This teacher knows how to teach and how to make progress every single class. Thank you, Yves!"],
  ["gerry · 1 lesson", "J'aime bien sa patience et il corrige mes fautes."],
  ["Luke · 1 lesson", "Super start, looking forward to more. I really liked the trial class. I think he's a good teacher."],
  ["Jamie · 1 lesson", "Yves was very patient and helped my confidence greatly. Will be scheduling many sessions with him. Merci beaucoup!"],
  ["Ewa · 122 lessons", "I'm happy from my first lesson. Very good explanation and many tips. Thank you Yves."],
  ["Leea · 25 lessons", "Yves is an awesome teacher. He is punctual, prepared, and patient! Merci!"],
  ["Natalia · 1 lesson", "Great teacher! Fun, effective class :)"],
  ["Heather · 1 lesson", "Excellent! I am so happy because Yves got me speaking French during the first lesson and gave me the confidence to want to continue. I can't wait for my next class!"],
  ["Leea · 24 lessons", "Yves provided a phenomenal class! He is knowledgeable and skilled at teaching while being patient and pleasant. I learned a lot and had fun!"],
  ["Curt · 36 lessons", "Yves is a very capable teacher and does a great job training multiple skills during the same lesson (speaking, listening, reading, etc.). Yves is a congenial guy and great to talk with."],
  ["Ian · 1 lesson", "Il est vraiment patient et bien informé. Yves est définitivement quelqu'un que je recommanderais comme professeur. :D"],
  ["Sara · 27 lessons", "Great first lesson! I was nervous at the beginning because I hadn't spoken French for almost 20 years but Yves had prepared a very good and useful lesson."],
];
