CREATE OR REPLACE FUNCTION public.is_valid_slot(
  _at timestamp with time zone,
  _duration_minutes integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _pet            timestamp;
  _offset         int;
  _cell_start     timestamptz;
  _cell_end       timestamptz;
  _cell_minutes   int;
BEGIN
  IF _duration_minutes IS NULL
     OR _duration_minutes <= 0
     OR _duration_minutes % 30 <> 0
  THEN
    RETURN FALSE;
  END IF;

  _pet := (_at AT TIME ZONE 'America/Lima');
  IF EXTRACT(MINUTE FROM _pet)::int NOT IN (0, 30) THEN RETURN FALSE; END IF;
  IF EXTRACT(SECOND FROM _pet)::int <> 0          THEN RETURN FALSE; END IF;

  _offset := 0;
  WHILE _offset < _duration_minutes LOOP
    _cell_start := _at + (_offset || ' minutes')::interval;
    _cell_end   := _cell_start + interval '30 minutes';

    _cell_minutes :=
        EXTRACT(HOUR   FROM (_cell_start AT TIME ZONE 'America/Lima'))::int * 60
      + EXTRACT(MINUTE FROM (_cell_start AT TIME ZONE 'America/Lima'))::int;

    IF _cell_minutes >= 330 AND _cell_minutes + 30 <= 1140 THEN
      -- inside default window, OK
    ELSIF EXISTS (
      SELECT 1 FROM public.availability_overrides
      WHERE kind = 'open'::public.availability_override_kind
        AND starts_at <= _cell_start
        AND ends_at   >= _cell_end
    ) THEN
      -- covered by an open override, OK
    ELSE
      RETURN FALSE;
    END IF;

    _offset := _offset + 30;
  END LOOP;

  RETURN TRUE;
END;
$function$;