-- Override kinds
DO $$ BEGIN
  CREATE TYPE public.availability_override_kind AS ENUM ('block', 'open');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.availability_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.availability_override_kind NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT availability_overrides_valid_range CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS availability_overrides_range_idx
  ON public.availability_overrides (starts_at, ends_at);

ALTER TABLE public.availability_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "any signed-in user can read overrides" ON public.availability_overrides;
CREATE POLICY "any signed-in user can read overrides"
  ON public.availability_overrides FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "teacher inserts overrides" ON public.availability_overrides;
CREATE POLICY "teacher inserts overrides"
  ON public.availability_overrides FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'teacher'::public.app_role));

DROP POLICY IF EXISTS "teacher deletes overrides" ON public.availability_overrides;
CREATE POLICY "teacher deletes overrides"
  ON public.availability_overrides FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::public.app_role));

DROP POLICY IF EXISTS "teacher updates overrides" ON public.availability_overrides;
CREATE POLICY "teacher updates overrides"
  ON public.availability_overrides FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'::public.app_role));

-- Replace is_valid_slot to consult overrides:
--   - if any 'block' fully or partially covers [_at, _at + duration) → invalid
--   - else valid if inside default teaching hours
--   - else valid if some 'open' override fully covers [_at, _at + duration)
CREATE OR REPLACE FUNCTION public.is_valid_slot(_at timestamp with time zone, _duration_minutes integer DEFAULT 60)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _pet timestamp;
  _start_minutes int;
  _end_minutes int;
  _slot_end timestamptz;
  _in_default_hours boolean;
  _has_open boolean;
  _has_block boolean;
BEGIN
  IF _duration_minutes IS NULL OR _duration_minutes <= 0 OR _duration_minutes % 30 <> 0 THEN
    RETURN FALSE;
  END IF;

  _pet := (_at AT TIME ZONE 'America/Lima');
  IF EXTRACT(MINUTE FROM _pet)::int NOT IN (0, 30) THEN RETURN FALSE; END IF;
  IF EXTRACT(SECOND FROM _pet)::int <> 0 THEN RETURN FALSE; END IF;

  _slot_end := _at + (_duration_minutes || ' minutes')::interval;

  -- Block overrides take precedence
  SELECT EXISTS (
    SELECT 1 FROM public.availability_overrides
    WHERE kind = 'block'
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(_at, _slot_end, '[)')
  ) INTO _has_block;
  IF _has_block THEN RETURN FALSE; END IF;

  _start_minutes := EXTRACT(HOUR FROM _pet)::int * 60 + EXTRACT(MINUTE FROM _pet)::int;
  _end_minutes := _start_minutes + _duration_minutes;
  _in_default_hours := _start_minutes >= 330 AND _end_minutes <= 1140;

  IF _in_default_hours THEN RETURN TRUE; END IF;

  -- Outside default hours: only valid if an 'open' override fully covers the slot
  SELECT EXISTS (
    SELECT 1 FROM public.availability_overrides
    WHERE kind = 'open'
      AND starts_at <= _at
      AND ends_at >= _slot_end
  ) INTO _has_open;
  RETURN _has_open;
END $function$;