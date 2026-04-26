import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, role, loading } = useAuth();
  const initialMode = params.get("mode") === "signin" ? "signin" : "signup";
  const requestTrial = params.get("trial") === "1";
  const [mode, setMode] = useState<"signup" | "signin">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already authenticated? Redirect
  useEffect(() => {
    if (loading) return;
    if (user && role) {
      const dest = role === "teacher" ? "/teacher" : requestTrial ? "/student?trial=1" : "/student";
      navigate(dest, { replace: true });
    }
  }, [user, role, loading, navigate, requestTrial]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      if (mode === "signup") {
        const redirectUrl = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast({
          title: "Check your inbox",
          description: "We've sent you a confirmation email. Click the link to sign in.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Welcome back!" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: mode === "signup" ? "Signup failed" : "Sign in failed", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>
      </header>

      <main className="container mx-auto flex max-w-md flex-col px-4 py-12">
        <Card className="p-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signup" ? "Create your account" : "Sign in"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup"
              ? requestTrial
                ? "Sign up to request your free trial lesson."
                : "Sign up to request a lesson package and book your slots."
              : "Welcome back. Sign in to view your dashboard."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Marie Dupont"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Please wait…
                </>
              ) : mode === "signup" ? (
                "Create account"
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button onClick={() => setMode("signin")} className="font-medium text-primary hover:underline">
                  Sign in
                </button>
              </>
            ) : (
              <>
                New here?{" "}
                <button onClick={() => setMode("signup")} className="font-medium text-primary hover:underline">
                  Create an account
                </button>
              </>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
