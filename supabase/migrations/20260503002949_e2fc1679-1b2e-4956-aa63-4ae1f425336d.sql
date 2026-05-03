ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS occupied_range tstzrange;

CREATE OR REPLACE FUNCTION public.set_lesson_occupied_range()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.occupied_range := tstzrange(
    NEW.scheduled_at,
    NEW.scheduled_at + (NEW.duration_minutes || ' minutes')::interval,
    '[)'
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS set_lesson_occupied_range_before_save ON public.lessons;
CREATE TRIGGER set_lesson_occupied_range_before_save
BEFORE INSERT OR UPDATE OF scheduled_at, duration_minutes
ON public.lessons
FOR EACH ROW
EXECUTE FUNCTION public.set_lesson_occupied_range();

UPDATE public.lessons
SET occupied_range = tstzrange(
  scheduled_at,
  scheduled_at + (duration_minutes || ' minutes')::interval,
  '[)'
)
WHERE occupied_range IS NULL
   OR occupied_range <> tstzrange(scheduled_at, scheduled_at + (duration_minutes || ' minutes')::interval, '[)');

ALTER TABLE public.lessons
  ALTER COLUMN occupied_range SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lessons_no_scheduled_overlap'
      AND conrelid = 'public.lessons'::regclass
  ) THEN
    ALTER TABLE public.lessons
      ADD CONSTRAINT lessons_no_scheduled_overlap
      EXCLUDE USING gist (occupied_range WITH &&)
      WHERE (status <> 'cancelled'::public.lesson_status);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.slot_conflicts(_at timestamp with time zone, _duration_minutes integer, _exclude_lesson uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.status <> 'cancelled'
      AND (_exclude_lesson IS NULL OR l.id <> _exclude_lesson)
      AND l.occupied_range && tstzrange(_at, _at + (_duration_minutes || ' minutes')::interval, '[)')
  );
$function$;

CREATE OR REPLACE FUNCTION public.booked_ranges(_from timestamp with time zone, _to timestamp with time zone)
 RETURNS TABLE(start_at timestamp with time zone, end_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT lower(l.occupied_range) AS start_at,
         upper(l.occupied_range) AS end_at
  FROM public.lessons l
  WHERE l.status <> 'cancelled'
    AND l.occupied_range && tstzrange(_from, _to, '[)');
$function$;