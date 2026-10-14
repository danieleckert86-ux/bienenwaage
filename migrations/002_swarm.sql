CREATE TABLE IF NOT EXISTS bee_alarm_settings (
 id integer PRIMARY KEY CHECK(id=1),
 threshold_kg double precision NOT NULL DEFAULT 1 CHECK(threshold_kg BETWEEN 0.2 AND 10),
 recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
 enabled boolean NOT NULL DEFAULT true,
 active_since timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO bee_alarm_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS bee_alarm_pause (
 hive_key text PRIMARY KEY,
 started_at timestamptz NOT NULL DEFAULT now(),
 until_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS bee_alarm_events (
 id text PRIMARY KEY,
 hive_key text NOT NULL,
 detected_at timestamptz NOT NULL,
 confirmed_at timestamptz NOT NULL,
 loss_kg double precision NOT NULL,
 before_kg double precision NOT NULL,
 after_kg double precision NOT NULL,
 threshold_kg double precision NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(hive_key,detected_at)
);
CREATE TABLE IF NOT EXISTS bee_alarm_delivery (
 event_id text NOT NULL REFERENCES bee_alarm_events(id),
 recipient text NOT NULL,
 sent_at timestamptz,
 attempts integer NOT NULL DEFAULT 0,
 last_error text,
 PRIMARY KEY(event_id,recipient)
);
CREATE INDEX IF NOT EXISTS bee_alarm_events_hive_time ON bee_alarm_events(hive_key,detected_at DESC);
