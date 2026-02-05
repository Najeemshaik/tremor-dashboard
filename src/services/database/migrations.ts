import type { Database } from "sql.js";
import { SCHEMA_SQL } from "./schema.js";

const SCHEMA_VERSION_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_version (
  version     INTEGER NOT NULL,
  applied_at  TEXT    NOT NULL,
  description TEXT
);
`;

type Migration = {
  version: number;
  description: string;
  statements: string[];
};

const migrations: Migration[] = [
  {
    version: 1,
    description: "Initial schema",
    statements: [SCHEMA_SQL]
  }
];

function getCurrentVersion(db: Database) {
  db.exec(SCHEMA_VERSION_TABLE_SQL);
  const result = db.exec("SELECT MAX(version) AS version FROM schema_version");
  if (result.length === 0 || result[0].values.length === 0) return 0;
  const value = result[0].values[0][0];
  return typeof value === "number" ? value : 0;
}

export function applyMigrations(db: Database) {
  const currentVersion = getCurrentVersion(db);
  const pending = migrations.filter((migration) => migration.version > currentVersion);

  pending.forEach((migration) => {
    db.exec("BEGIN TRANSACTION");
    try {
      migration.statements.forEach((statement) => db.exec(statement));
      const appliedAt = new Date().toISOString();
      const insert = db.prepare(
        "INSERT INTO schema_version (version, applied_at, description) VALUES (?, ?, ?)"
      );
      insert.bind([migration.version, appliedAt, migration.description]);
      insert.step();
      insert.free();
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  });
}
