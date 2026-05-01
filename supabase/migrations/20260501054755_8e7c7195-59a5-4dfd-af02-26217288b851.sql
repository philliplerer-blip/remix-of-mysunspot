select cron.schedule(
  'check-sunny-spots-every-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://pqrvemaaokhumfcnohfe.supabase.co/functions/v1/check-sunny-spots',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) as request_id;
  $$
);