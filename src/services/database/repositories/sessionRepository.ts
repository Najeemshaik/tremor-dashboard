import type { Database } from "sql.js";
import type { Session, SessionSummary } from "../../../state/types.js";
import { insertMany, selectAll } from "../dbFunctions.js";
import type { SessionRepository } from "../types.js";

type SessionRow = {
  id: string;
  name: string;
  start: string;
  duration_sec: number;
  sample_count: number;
  summary_avg: number | null;
  summary_rms: number | null;
  summary_peak: number | null;
  summary_noise: number | null;
};

type SessionSampleRow = {
  session_id: string;
  sample_idx: number;
  value: number;
};

function normalizeSummary(row: SessionRow): SessionSummary {
  return {
    avg: Number(row.summary_avg ?? 0),
    rms: Number(row.summary_rms ?? 0),
    peak: Number(row.summary_peak ?? 0),
    noise: Number(row.summary_noise ?? 0)
  };
}

export function createSessionRepository(db: Database): SessionRepository {
  return {
    getAll: () => {
      const sessions = selectAll(db, "session", { orderBy: "rowid ASC" }) as SessionRow[];
      const samples = selectAll(db, "session_sample", {
        orderBy: "session_id ASC, sample_idx ASC"
      }) as SessionSampleRow[];
      const samplesBySession = new Map<string, number[]>();
      samples.forEach((row) => {
        const list = samplesBySession.get(row.session_id) ?? [];
        list.push(Number(row.value));
        samplesBySession.set(row.session_id, list);
      });

      return sessions.map((session) => {
        const sessionSamples = samplesBySession.get(session.id) ?? [];
        return {
          id: String(session.id),
          name: String(session.name),
          start: String(session.start),
          durationSec: Number(session.duration_sec),
          sampleCount:
            Number.isFinite(Number(session.sample_count)) && Number(session.sample_count) > 0
              ? Number(session.sample_count)
              : sessionSamples.length,
          samples: sessionSamples,
          summary: normalizeSummary(session)
        } as Session;
      });
    },
    replaceAll: (sessions) => {
      db.exec("BEGIN TRANSACTION");
      try {
        db.exec("DELETE FROM session_sample");
        db.exec("DELETE FROM session");

        const sessionRows = sessions.map((session) => {
          const summary = session.summary ?? { avg: 0, rms: 0, peak: 0, noise: 0 };
          return [
            session.id,
            session.name,
            session.start,
            session.durationSec,
            session.sampleCount ?? session.samples.length,
            summary.avg,
            summary.rms,
            summary.peak,
            summary.noise
          ];
        });
        insertMany(
          db,
          "session",
          [
            "id",
            "name",
            "start",
            "duration_sec",
            "sample_count",
            "summary_avg",
            "summary_rms",
            "summary_peak",
            "summary_noise"
          ],
          sessionRows
        );

        const sampleRows: Array<[string, number, number]> = [];
        sessions.forEach((session) => {
          session.samples.forEach((value, index) => {
            sampleRows.push([session.id, index, value]);
          });
        });
        insertMany(db, "session_sample", ["session_id", "sample_idx", "value"], sampleRows);

        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
  };
}
