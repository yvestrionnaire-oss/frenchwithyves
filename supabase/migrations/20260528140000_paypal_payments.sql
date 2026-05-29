-- Add PayPal payment tracking to purchase_requests
alter table public.purchase_requests
  add column if not exists paypal_order_id text,
  add column if not exists paypal_capture_id text;

-- Allow service role to insert paid purchase requests (for PayPal webhook)
create policy "service role insert purchase requests"
  on public.purchase_requests
  for insert
  to service_role
  with check (true);

create policy "service role update purchase requests"
  on public.purchase_requests
  for update
  to service_role
  using (true);

-- Function to record a completed PayPal payment and grant credits
create or replace function public.record_paypal_payment(
  _student_id uuid,
  _package_slug text,
  _paypal_order_id text,
  _paypal_capture_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _package_id uuid;
  _credits integer;
begin
  -- Look up package
  select id, credits into _package_id, _credits
  from public.packages
  where slug = _package_slug
  limit 1;

  if _package_id is null then
    raise exception 'Unknown package slug: %', _package_slug;
  end if;

  -- Prevent duplicate captures
  if exists (
    select 1 from public.purchase_requests
    where paypal_order_id = _paypal_order_id
  ) then
    raise exception 'Order already captured: %', _paypal_order_id;
  end if;

  -- Insert paid purchase request
  insert into public.purchase_requests (
    student_id, package_id, status, credits_granted,
    paypal_order_id, paypal_capture_id, paid_at
  ) values (
    _student_id, _package_id, 'paid', _credits,
    _paypal_order_id, _paypal_capture_id, now()
  );
end;
$$;
