CREATE OR REPLACE FUNCTION public.prevent_lesson_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'cancelled'::public.lesson_status THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('public.lessons.full_duration_overlap_guard'));

  IF (TG_OP = 'INSERT' OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at)
     AND NEW.scheduled_at < now() THEN
    RAISE EXCEPTION 'Cannot book a past slot' USING errcode = 'P0001';
  END IF;

  IF NOT public.is_valid_slot(NEW.scheduled_at, NEW.duration_minutes) THEN
    RAISE EXCEPTION 'That time is no longer available — please pick another slot.' USING errcode = 'P0002';
  END IF;

  IF public.slot_conflicts(NEW.scheduled_at, NEW.duration_minutes, NEW.id) THEN
    RAISE EXCEPTION 'That time is no longer available — please pick another slot.' USING errcode = 'P0002';
  END IF;

  RETURN NEW;
END;
$function$;