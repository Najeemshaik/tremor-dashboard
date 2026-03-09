-- Tremor Dashboard — Supabase seed data
-- Run this in the Supabase SQL editor to populate initial profiles, sequences, and sessions.
--
-- STEP 1: Create the app_state table if it doesn't exist yet.
-- Skip this block if you already created the table.

CREATE TABLE IF NOT EXISTS app_state (
  id      TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);

-- STEP 2: Insert seed data.
-- Uses upsert (ON CONFLICT DO UPDATE) so it is safe to re-run.

INSERT INTO app_state (id, payload)
VALUES (
  'default',
  '{
    "profiles": [
      {
        "id": "p1",
        "name": "PD Rest Tremor",
        "updated": "2024-03-14 09:12",
        "freq": 5,
        "amp": 45,
        "noise": 8
      },
      {
        "id": "p2",
        "name": "Essential Tremor",
        "updated": "2024-03-18 15:44",
        "freq": 7,
        "amp": 35,
        "noise": 15
      },
      {
        "id": "p3",
        "name": "Postural Tremor",
        "updated": "2024-03-21 11:05",
        "freq": 5,
        "amp": 25,
        "noise": 12
      }
    ],
    "sequences": [
      {
        "id": "s1",
        "name": "Medication Response",
        "steps": [
          { "duration": 10, "freq": 5, "amp": 50, "noise": 10 },
          { "duration": 15, "freq": 5, "amp": 35, "noise": 8  },
          { "duration": 10, "freq": 4, "amp": 20, "noise": 6  }
        ]
      }
    ],
    "sessions": [
      {
        "id": "session-morning-001",
        "name": "Morning Assessment",
        "start": "2024-03-20 08:02",
        "durationSec": 420,
        "sampleCount": 2100,
        "samples": [],
        "summary": {
          "avg": 0.8,
          "rms": 29.7,
          "peak": 42.0,
          "noise": 4.2
        }
      },
      {
        "id": "session-postmed-001",
        "name": "Post-Medication",
        "start": "2024-03-21 16:28",
        "durationSec": 300,
        "sampleCount": 1800,
        "samples": [],
        "summary": {
          "avg": 0.5,
          "rms": 19.8,
          "peak": 28.0,
          "noise": 2.8
        }
      }
    ]
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE
  SET payload = EXCLUDED.payload;
