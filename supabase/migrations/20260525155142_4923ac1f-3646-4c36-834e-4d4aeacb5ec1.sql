DO $$ BEGIN
  CREATE TYPE public.availability_override_kind AS ENUM ('open', 'block');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.availability_overrides (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       public.availability_override_kind NOT NULL,
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT availability_overrides_range_chk CHECK (ends_at > starts_at)
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'availability_overrides_range_chk'
      AND conrelid = 'public.availability_overrides'::regclass
  ) THEN
    ALTER TABLE public.availability_overrides
      ADD CONSTRAINT availability_overrides_range_chk CHECK (ends_at > starts_at);
  END IF;
END $$;

ALTER TABLE public.availability_overrides ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'availability_overrides'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.availability_overrides', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "any signed-in user reads overrides"
  ON public.availability_overrides
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "teacher inserts overrides"
  ON public.availability_overrides
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'teacher'::public.app_role));

CREATE POLICY "teacher updates overrides"
  ON public.availability_overrides
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'::public.app_role));

CREATE POLICY "teacher deletes overrides"
  ON public.availability_overrides
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::public.app_role));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'availability_overrides'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.availability_overrides;
  END IF;
END $$;