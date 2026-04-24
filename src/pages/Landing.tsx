import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { GraduationCap, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import portrait from "@/assets/yves-trionnaire-real.jpg";
import introVideo from "@/assets/yves-introduction.mp4";

type Mode = "login" | "signup";
type Role = "student" | "teacher";

export default function Landing() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<Role>("student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName, role },
          },
        });
        if (error) throw error;
        toast.success("Welcome! You're signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in.");
      }
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="app-container grid gap-10 py-10 lg:grid-cols-[1.1fr_1fr] lg:py-16">
        {/* Hero */}
        <section className="flex flex-col justify-center">
          <span className="pill mb-5 w-fit"><Sparkles className="h-3.5 w-3.5 text-primary" /> Private French lessons with Yves</span>
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            Bonjour ! Welcome back to your French learning space.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-secondaryText">
            Sign in to your student account to book lessons, track your credits, and message Yves.
            New here? Create an account in 30 seconds.
          </p>

          <div className="mt-8 flex items-center gap-4">
            <img src={portrait} alt="Yves Trionnaire — French teacher" className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/20" />
            <div>
              <div className="font-semibold">Yves Trionnaire</div>
              <div className="text-sm text-secondaryText">Native French teacher · Verbling-style 1-on-1</div>
            </div>
          </div>

          <div className="mt-8 fw-card overflow-hidden">
            <video src={introVideo} controls playsInline preload="metadata" className="h-auto w-full" poster="" />
          </div>
        </section>

        {/* Auth card */}
        <section className="flex items-start justify-center lg:items-center">
          <div className="fw-card w-full max-w-md p-7">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-primary">
                <GraduationCap className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-xl font-bold">{mode === "login" ? "Sign in" : "Create your account"}</h2>
                <p className="text-sm text-secondaryText">
                  {mode === "login" ? "Welcome back." : "It only takes a few seconds."}
                </p>
              </div>
            </div>

            <div className="mb-5 flex rounded-lg border border-border bg-muted/40 p-1">
              <button type="button" onClick={() => setMode("login")} className={`flex-1 rounded-md px-3 py-2 text-sm font-bold ${mode === "login" ? "bg-card text-primary shadow-sm" : "text-secondaryText"}`}>Sign in</button>
              <button type="button" onClick={() => setMode("signup")} className={`flex-1 rounded-md px-3 py-2 text-sm font-bold ${mode === "signup" ? "bg-card text-primary shadow-sm" : "text-secondaryText"}`}>Sign up</button>
            </div>

            <form onSubmit={submit} className="grid gap-4">
              {mode === "signup" && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Full name</label>
                    <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="fw-input" placeholder="Marie Dupont" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">I am a</label>
                    <div className="flex rounded-lg border border-border p-1">
                      <button type="button" onClick={() => setRole("student")} className={`flex-1 rounded-md px-3 py-2 text-sm font-bold ${role === "student" ? "bg-secondary text-primary" : "text-secondaryText"}`}>Student</button>
                      <button type="button" onClick={() => setRole("teacher")} className={`flex-1 rounded-md px-3 py-2 text-sm font-bold ${role === "teacher" ? "bg-secondary text-primary" : "text-secondaryText"}`}>Teacher (Yves)</button>
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Email</label>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="fw-input" placeholder="you@example.com" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Password</label>
                <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="fw-input" placeholder="At least 6 characters" />
              </div>
              <button type="submit" disabled={busy} className="btn-primary mt-2 w-full">
                {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
              </button>
              <p className="mt-1 text-center text-xs text-mutedText">
                {mode === "login" ? "New student? " : "Already have an account? "}
                <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} className="font-semibold text-accent">
                  {mode === "login" ? "Create an account" : "Sign in"}
                </button>
              </p>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
