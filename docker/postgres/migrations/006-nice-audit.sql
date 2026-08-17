CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS audit_events (
    id BIGSERIAL PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(255),
    user_login VARCHAR(255),
    genesys_user_id VARCHAR(255),
    profile VARCHAR(100),
    access_group VARCHAR(100),
    division_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    conversation_id VARCHAR(255),
    recording_id VARCHAR(255),
    media_kind VARCHAR(20),
    source_system VARCHAR(50) NOT NULL DEFAULT 'GENESYS_CLOUD',
    source_ip INET,
    user_agent TEXT,
    result VARCHAR(20) NOT NULL,
    correlation_id UUID NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    previous_hash VARCHAR(64),
    event_hash VARCHAR(64) NOT NULL,
    CONSTRAINT chk_audit_result CHECK (result IN ('SUCCESS', 'FAILURE', 'BLOCKED')),
    CONSTRAINT chk_audit_media_kind CHECK (media_kind IS NULL OR media_kind IN ('audio', 'video'))
);

CREATE INDEX IF NOT EXISTS idx_audit_events_occurred_at ON audit_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_user ON audit_events (user_login, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events (action, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_recording ON audit_events (recording_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_conversation ON audit_events (conversation_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_result ON audit_events (result, occurred_at DESC);

CREATE OR REPLACE FUNCTION prepare_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    last_hash VARCHAR(64);
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('audit_events_hash_chain'));
    SELECT event_hash INTO last_hash FROM audit_events ORDER BY id DESC LIMIT 1;

    NEW.occurred_at := COALESCE(NEW.occurred_at, CURRENT_TIMESTAMP);
    NEW.previous_hash := last_hash;
    NEW.event_hash := encode(
        digest(
            concat_ws('|', COALESCE(last_hash, ''), NEW.occurred_at::text,
                COALESCE(NEW.user_id, ''), COALESCE(NEW.user_login, ''),
                COALESCE(NEW.genesys_user_id, ''), COALESCE(NEW.profile, ''),
                COALESCE(NEW.access_group, ''), COALESCE(NEW.division_id, ''),
                NEW.action, COALESCE(NEW.conversation_id, ''),
                COALESCE(NEW.recording_id, ''), COALESCE(NEW.media_kind, ''),
                NEW.source_system, COALESCE(NEW.source_ip::text, ''),
                COALESCE(NEW.user_agent, ''), NEW.result,
                NEW.correlation_id::text, NEW.details::text),
            'sha256'
        ), 'hex'
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prepare_audit_event ON audit_events;
CREATE TRIGGER trg_prepare_audit_event BEFORE INSERT ON audit_events
FOR EACH ROW EXECUTE FUNCTION prepare_audit_event();

CREATE OR REPLACE FUNCTION reject_audit_event_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_audit_event_mutation ON audit_events;
CREATE TRIGGER trg_reject_audit_event_mutation BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION reject_audit_event_mutation();

COMMENT ON TABLE audit_events IS 'Log canonico, imutavel e encadeado de auditoria do SearchAudio e SearchVideo';
