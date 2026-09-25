-- Additive migration. Existing raw history remains unchanged.
CREATE TABLE IF NOT EXISTS bee_sync_state (
 channel integer PRIMARY KEY, cursor_at timestamptz, attempted_at timestamptz,
 succeeded_at timestamptz, last_error text, inserted bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS bee_sync_lease (
 id integer PRIMARY KEY CHECK (id=1), token text NOT NULL,
 expires_at timestamptz NOT NULL, next_allowed_at timestamptz NOT NULL
);
INSERT INTO bee_sync_state(channel) VALUES (1647964),(1705928),(2038308) ON CONFLICT DO NOTHING;
