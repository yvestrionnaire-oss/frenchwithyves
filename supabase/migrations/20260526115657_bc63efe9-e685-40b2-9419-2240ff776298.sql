CREATE TABLE IF NOT EXISTS public.__cancel_lesson_test_results (
  test_name text PRIMARY KEY,
  outcome text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
TRUNCATE public.__cancel_lesson_test_results;

DO $$
DECLARE
  L1 uuid := '11111111-1111-1111-1111-111111111111';
  L2 uuid := '22222222-2222-2222-2222-222222222222';
  L3 uuid := '33333333-3333-3333-3333-333333333333';
  L4 uuid := '44444444-4444-4444-4444-444444444444';
  STUDENT_A constant uuid := 'eeadc6b7-a389-4083-8e07-66f8631ee48d';
  TEACHER   constant uuid := 'db866198-364d-480c-ac2c-240300d4ac82';
  STUDENT_B constant uuid := '00000000-0000-0000-0000-0000000000bb';
  t1 timestamptz := '2035-01-01 12:00:00+00';
  t2 timestamptz := now() + interval '2 minutes';
  t3 timestamptz := '2010-01-01 12:00:00+00';
  t4 timestamptz := '2035-02-01 12:00:00+00';
  bal_before int; bal_after int;
  row_status text;
  err_state text; err_msg text;
BEGIN
  ALTER TABLE public.lessons DISABLE TRIGGER prevent_lesson_overlap_before_save;

  INSERT INTO public.lessons (id, student_id, scheduled_at, duration_minutes, lesson_type, status, occupied_range) VALUES
    (L1, STUDENT_A, t1, 60,'regular','scheduled', tstzrange(t1, t1+interval '60 minutes','[)')),
    (L2, STUDENT_A, t2, 60,'regular','scheduled', tstzrange(t2, t2+interval '60 minutes','[)')),
    (L3, STUDENT_A, t3, 60,'regular','scheduled', tstzrange(t3, t3+interval '60 minutes','[)')),
    (L4, STUDENT_B, t4, 60,'regular','scheduled', tstzrange(t4, t4+interval '60 minutes','[)'));

  -- TEST 2
  PERFORM set_config('request.jwt.claims', json_build_object('sub', STUDENT_A, 'role','authenticated')::text, true);
  bal_before := public.credit_balance_for(STUDENT_A);
  PERFORM public.cancel_lesson(L1);
  SELECT status::text INTO row_status FROM public.lessons WHERE id = L1;
  bal_after := public.credit_balance_for(STUDENT_A);
  INSERT INTO public.__cancel_lesson_test_results VALUES
    ('TEST 2 student cancels >5min away', format('status=%s credit_before=%s credit_after=%s', row_status, bal_before, bal_after));

  -- TEST 3
  BEGIN
    PERFORM public.cancel_lesson(L2);
    INSERT INTO public.__cancel_lesson_test_results VALUES ('TEST 3 student cancels <5min away', 'UNEXPECTED SUCCESS');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err_state = RETURNED_SQLSTATE, err_msg = MESSAGE_TEXT;
    INSERT INTO public.__cancel_lesson_test_results VALUES
      ('TEST 3 student cancels <5min away', format('sqlstate=%s msg=%s', err_state, err_msg));
  END;

  -- TEST 4
  PERFORM set_config('request.jwt.claims', json_build_object('sub', TEACHER, 'role','authenticated')::text, true);
  PERFORM public.cancel_lesson(L2);
  SELECT status::text INTO row_status FROM public.lessons WHERE id = L2;
  INSERT INTO public.__cancel_lesson_test_results VALUES
    ('TEST 4 teacher cancels <5min away', format('status=%s', row_status));

  -- TEST 5
  PERFORM public.cancel_lesson(L3);
  SELECT status::text INTO row_status FROM public.lessons WHERE id = L3;
  INSERT INTO public.__cancel_lesson_test_results VALUES
    ('TEST 5 teacher cancels past lesson', format('status=%s', row_status));

  -- TEST 6
  PERFORM set_config('request.jwt.claims', json_build_object('sub', STUDENT_A, 'role','authenticated')::text, true);
  BEGIN
    PERFORM public.cancel_lesson(L4);
    INSERT INTO public.__cancel_lesson_test_results VALUES ('TEST 6 cross-student isolation', 'UNEXPECTED SUCCESS');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err_state = RETURNED_SQLSTATE, err_msg = MESSAGE_TEXT;
    INSERT INTO public.__cancel_lesson_test_results VALUES
      ('TEST 6 cross-student isolation', format('sqlstate=%s msg=%s', err_state, err_msg));
  END;

  DELETE FROM public.lessons WHERE id IN (L1, L2, L3, L4);
  ALTER TABLE public.lessons ENABLE TRIGGER prevent_lesson_overlap_before_save;
END $$;