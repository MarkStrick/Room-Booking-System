-- Supabase-only operational migration. No production tokens in SQL/history.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE TABLE kku_private.worker_schedule(
 id integer PRIMARY KEY CHECK(id=1),secret_id uuid NOT NULL,
 last_request_id bigint,last_attempt_at timestamptz);
ALTER TABLE kku_private.worker_schedule ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON kku_private.worker_schedule FROM PUBLIC,anon,authenticated,kku_server;
GRANT SELECT ON kku_private.worker_schedule TO kku_server;
CREATE POLICY server_read ON kku_private.worker_schedule FOR SELECT TO kku_server USING(true);

CREATE FUNCTION kku_private.dispatch_worker() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE worker_token text;request_id bigint;
BEGIN
 SELECT v.decrypted_secret INTO worker_token FROM kku_private.worker_schedule s JOIN vault.decrypted_secrets v ON v.id=s.secret_id WHERE s.id=1;
 IF worker_token IS NULL THEN RETURN NULL; END IF;
 SELECT net.http_get(
  url:='https://kku-room-booking-markstrick.vercel.app/api/internal/jobs',
  headers:=jsonb_build_object('Authorization','Bearer '||worker_token),
  timeout_milliseconds:=55000
 ) INTO request_id;
 UPDATE kku_private.worker_schedule SET last_request_id=request_id,last_attempt_at=current_timestamp WHERE id=1;
 RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION kku_private.dispatch_worker() FROM PUBLIC,anon,authenticated,kku_server;
-- Disabled until the operator installs the existing deployment token via a bind.
SELECT cron.schedule('kku-space-worker-every-minute','* * * * *','SELECT kku_private.dispatch_worker();');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='kku-space-worker-every-minute'),active:=false);

CREATE FUNCTION kku_private.configure_worker_secret(worker_token text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE secret_key uuid;
BEGIN
 IF length(worker_token)<32 THEN RAISE EXCEPTION 'Worker token is missing' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM kku_private.worker_schedule) THEN RAISE EXCEPTION 'Worker is already configured' USING ERRCODE='23514'; END IF;
 SELECT vault.create_secret(worker_token,'kku_space_worker_token','KKU Space scheduler authorization') INTO secret_key;
 INSERT INTO kku_private.worker_schedule(id,secret_id) VALUES(1,secret_key);
 PERFORM cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='kku-space-worker-every-minute'),active:=true);
END $$;
REVOKE ALL ON FUNCTION kku_private.configure_worker_secret(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION kku_private.configure_worker_secret(text) TO kku_server;
-- Network request queues contain authorization headers. Keep them administrator-only.
REVOKE ALL ON SCHEMA net FROM PUBLIC,anon,authenticated,kku_server;
REVOKE ALL ON ALL TABLES IN SCHEMA net FROM PUBLIC,anon,authenticated,kku_server;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA net FROM PUBLIC,anon,authenticated,kku_server;
COMMIT;
