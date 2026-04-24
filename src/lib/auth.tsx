import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "student" | "teacher";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  role: Role | null;
  fullName: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  session: null, user: null, role: null, fullName: null, loading: true, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => void hydrate(s.user.id), 0);
      } else {
        setRole(null); setFullName(null); setLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) void hydrate(data.session.user.id);
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function hydrate(uid: string) {
    const [{ data: rRow }, { data: pRow }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle(),
    ]);
    setRole((rRow?.role as Role | undefined) ?? null);
    setFullName(pRow?.full_name ?? null);
    setLoading(false);
  }

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, role, fullName, loading, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
