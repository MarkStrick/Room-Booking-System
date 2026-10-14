-- Apply after the operator has bound the deployment token into Vault.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM kku_private.worker_schedule WHERE id=1) THEN
  RAISE EXCEPTION 'Configure the worker token before closing bootstrap permissions';
 END IF;
END $$;
REVOKE EXECUTE ON FUNCTION kku_private.configure_worker_secret(text) FROM kku_server;
COMMIT;
