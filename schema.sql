CREATE TABLE IF NOT EXISTS schema_version (
    version     INTEGER NOT NULL,
    applied_at  TEXT    NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS profile (
    id      TEXT PRIMARY KEY,
    name    TEXT NOT NULL,
    updated TEXT NOT NULL,
    freq    REAL NOT NULL,
    amp     REAL NOT NULL,
    noise   REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS sequence (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sequence_step (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sequence_id TEXT    NOT NULL,
    step_order  INTEGER NOT NULL,
    duration    REAL    NOT NULL,
    freq        REAL    NOT NULL,
    amp         REAL    NOT NULL,
    noise       REAL    NOT NULL,
    FOREIGN KEY (sequence_id) REFERENCES sequence(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sequence_step_seq
    ON sequence_step(sequence_id, step_order);

CREATE TABLE IF NOT EXISTS session (
    id            TEXT PRIMARY KEY,
    name          TEXT    NOT NULL,
    start         TEXT    NOT NULL,
    duration_sec  INTEGER NOT NULL,
    sample_count  INTEGER NOT NULL,
    summary_avg   REAL,
    summary_rms   REAL,
    summary_peak  REAL,
    summary_noise REAL
);

CREATE TABLE IF NOT EXISTS session_sample (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT    NOT NULL,
    sample_idx INTEGER NOT NULL,
    value      REAL    NOT NULL,
    FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_sample_session
    ON session_sample(session_id, sample_idx);
