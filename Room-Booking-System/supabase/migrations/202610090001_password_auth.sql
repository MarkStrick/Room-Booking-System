-- Apply after 202610080001_server_storage.sql. Backend access only.
BEGIN;
CREATE TABLE IF NOT EXISTS kku_private.credentials (
 key text PRIMARY KEY REFERENCES kku_private.users(key),
 payload jsonb NOT NULL,
 CHECK (payload->>'userId'=key),
 CHECK (payload->>'passwordHash' LIKE '$argon2id$%')
);
ALTER TABLE kku_private.credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON kku_private.credentials FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS kku_private.password_tokens (
 key text PRIMARY KEY,
 payload jsonb NOT NULL,
 CHECK(payload->>'tokenHash'=key),
 CHECK(payload->>'kind' IN ('register','reset')),
 CHECK(payload->>'passwordHash' IS NULL OR payload->>'passwordHash' LIKE '$argon2id$%')
);
CREATE INDEX IF NOT EXISTS password_tokens_expiry ON kku_private.password_tokens((payload->>'expiresAt'));
ALTER TABLE kku_private.password_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON kku_private.password_tokens FROM PUBLIC,anon,authenticated;
COMMIT;
