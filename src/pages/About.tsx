import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import AboutContent from "@/components/AboutContent";
import { Seo } from "@/components/Seo";

export default function About() {
  const { user, role } = useAuth();
  const backHref = user ? (role === "teacher" ? "/teacher" : "/student") : "/";
  const backLabel = user ? "Back to dashboard" : "Back to home";

  return (
    <div className="min-h-dvh bg-background">
      <Seo
        title="About Yves Trionnaire — DAEFLE Certified French Teacher"
        description="Meet Yves, your DAEFLE certified native French teacher. 9+ years teaching, 5.0 rating from 9,000+ lessons. Learn his method, background, and student reviews."
        path="/about"
      />
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Button asChild variant="ghost" size="sm">
            <Link to={backHref}>
              <ArrowLeft className="h-4 w-4" /> {backLabel}
            </Link>
          </Button>
          <div className="text-sm font-semibold tracking-tight">French with Yves</div>
        </div>
      </header>
      <main className="app-container py-10">
        <AboutContent />
      </main>
    </div>
  );
}
