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
import { Seo } from "@/components/Seo";

export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, role, loading } = useAuth();
  const initialMode = params.get("mode") === "signin" ? "signin" : "signup";
  const [mode, setMode] = useState<"signup" | "signin" | "forgot">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already authenticated? Redirect
  useEffect(() => {
    if (loading) return;
    if (user && role) {
      const dest = role === "teacher" ? "/teacher" : "/student";
      navigate(dest, { replace: true });
    }
  }, [user, role, loading, navigate]);

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
          title: "Check your email",
          description: "We sent you a confirmation link. Click it to activate your account.",
        });
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Welcome back!" });
      } else {
        // forgot password
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({
          title: "Check your email",
          description: "If an account exists for that address, we sent a reset link.",
        });
        setMode("signin");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      const failTitle =
        mode === "signup" ? "Signup failed" : mode === "signin" ? "Sign in failed" : "Couldn't send reset email";
      toast({ title: failTitle, description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
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
            {mode === "signup" ? "Create your account" : mode === "signin" ? "Sign in" : "Reset your password"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Sign up to request a lesson package and book your slots."
              : mode === "signin"
                ? "Welcome back. Sign in to view your dashboard."
                : "Enter your email and we'll send you a link to set a new password."}
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
            {mode !== "forgot" && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
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
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Please wait…
                </>
              ) : mode === "signup" ? (
                "Create account"
              ) : mode === "signin" ? (
                "Sign in"
              ) : (
                "Send reset link"
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
            ) : mode === "signin" ? (
              <>
                New here?{" "}
                <button onClick={() => setMode("signup")} className="font-medium text-primary hover:underline">
                  Create an account
                </button>
              </>
            ) : (
              <>
                Remembered it?{" "}
                <button onClick={() => setMode("signin")} className="font-medium text-primary hover:underline">
                  Back to sign in
                </button>
              </>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
