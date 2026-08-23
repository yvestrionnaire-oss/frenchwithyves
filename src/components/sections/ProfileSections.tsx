import { useState } from "react";
import { BookOpen, Clock, Star, Target, Users } from "lucide-react";

/* Shared building blocks used by both the public Landing page and the
   authenticated About page. Single source of truth for stats, profile tabs,
   reviews, etc. — edit copy here once. */

export function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="fw-card p-5">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-secondaryText">{label}</div>
    </div>
  );
}

export function StepCard({ n, title, icon, children }: { n: string; title: string; icon: React.ReactNode; children: React.ReactNode }) {
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

export function StatsGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
      <StatCard icon={<BookOpen className="h-5 w-5" />} value="9,203" label="Lessons taught" />
      <StatCard icon={<Star className="h-5 w-5" />} value="5.0 / 5.0" label="Average rating" />
      <StatCard icon={<Target className="h-5 w-5" />} value="9+ years" label="Teaching experience" />
      <StatCard icon={<Users className="h-5 w-5" />} value="521" label="Students taught" />
      <StatCard icon={<Clock className="h-5 w-5" />} value="23 hrs" label="Avg. per student" />
    </div>
  );
}

function AboutPanel() {
  return (
    <>
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

const REVIEWS_LONG: [string, string][] = [
  ["Stephi · 141 lessons", "Patient and helpful all the time."],
  ["Evelyn · 25 lessons", "He is amenable to trying whatever approach helps me."],
  ["Matt · 10 lessons", "Yves is a great teacher and emphasizes conversation. He engages with you and makes you work to get out of your comfort zone!"],
  ["Martha · 11 lessons", "Merci beaucoup!!"],
  ["MELINA · 7 lessons", "Yves is a great teacher. He is very kind and patient and structures class so that you get practice in speaking, writing and listening."],
  ["Atthawoot · 45 lessons", "I really had a great time with Yves in class. He pushed but not being pushy."],
  ["Atthawoot · 44 lessons", "Yves is a true Grammar guru."],
  ["Marie · 68 lessons", "It is always a pleasure talking to Yves. He is always very patient and corrects my mistakes in real time, which I totally appreciate."],
  ["Mohammed · 24 lessons", "After 20 lessons I'm so happy with the results — I can communicate fast, read and write. I now watch French YouTube videos and understand about 65% of the dialogue."],
  ["Nikolay · 26 lessons", "The lessons are very well-structured and cover conversation, writing, reading and listening practices tailored to my travel and everyday-life needs. Highly recommended."],
  ["Daniel · 18 lessons", "Yves is sensitive to my specific learning needs and has a range of really helpful teaching techniques which helped me progress very quickly."],
  ["Samantha · 10 lessons", "This teacher is the best I have ever worked with. Yves can adapt and plan a lesson not only suitable for me, but also full of engaging content."],
  ["Adam · 35 lessons", "Yves very quickly established my level and pitched the lesson just right. Lots of correction, which I really need."],
  ["Ewa · 131 lessons", "This teacher knows how to teach and how to make progress every single class. Thank you, Yves!"],
  ["Sungmi Kary · 147 lessons", "He was indeed the perfect teacher for me!"],
  ["Heather · 1 lesson", "Yves got me speaking French during the first lesson and gave me the confidence to want to continue. I can't wait for my next class!"],
];

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
            <p className="my-2 text-primary" aria-label="5 out of 5 stars">★★★★★</p>
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

export function ProfileTabs() {
  const [tab, setTab] = useState<"About" | "Specialties" | "Shared notes" | "Resume" | "Reviews">("About");
  return (
    <div className="fw-card overflow-hidden">
      <div className="flex overflow-auto border-b border-border" role="tablist">
        {(["About", "Specialties", "Shared notes", "Resume", "Reviews"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
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
