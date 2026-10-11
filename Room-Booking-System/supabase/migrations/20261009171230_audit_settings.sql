BEGIN;
CREATE TABLE IF NOT EXISTS kku_private.settings(key text PRIMARY KEY CHECK(key='site'),payload jsonb NOT NULL);
ALTER TABLE kku_private.settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON kku_private.settings FROM PUBLIC,anon,authenticated;
DO $$ DECLARE owner_name text; BEGIN
 SELECT pg_get_userbyid(nspowner) INTO owner_name FROM pg_namespace WHERE nspname='kku_private';
 EXECUTE format('ALTER TABLE kku_private.settings OWNER TO %I',owner_name);
END $$;
COMMIT;
