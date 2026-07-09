-- Read-only SQL tool for the Oracle (Telegram AI agent).
-- Safety model: not regex trust, but an engine-enforced read-only transaction.
-- Even if a malicious/hallucinated query text slips past the guards below
-- (e.g. by calling a function that itself writes), `transaction_read_only`
-- makes Postgres itself reject any write attempt inside this call.
create or replace function public.oracle_readonly_query(query_text text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
  cleaned text;
begin
  cleaned := btrim(query_text);
  cleaned := regexp_replace(cleaned, ';\s*$', '');

  if cleaned !~* '^\s*(select|with)\s' then
    raise exception 'Only SELECT/WITH queries are allowed';
  end if;

  if cleaned ~ ';' then
    raise exception 'Multiple statements are not allowed';
  end if;

  perform set_config('statement_timeout', '5000', true);
  set local transaction_read_only = on;

  begin
    execute format(
      'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s) t limit 200',
      cleaned
    ) into result;
  exception
    when others then
      return jsonb_build_object('error', sqlerrm);
  end;

  return result;
end;
$$;

revoke all on function public.oracle_readonly_query(text) from public;
grant execute on function public.oracle_readonly_query(text) to service_role;

comment on function public.oracle_readonly_query(text) is
  'Read-only SQL execution for the Oracle Telegram agent. Enforced via transaction_read_only (engine-level, not regex-only), 5s statement_timeout, single-statement guard, and an outer LIMIT 200. Called only by service_role from vanguard-oracle.';
