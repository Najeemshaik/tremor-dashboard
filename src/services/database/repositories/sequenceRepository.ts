import type { Database } from "sql.js";
import type { Sequence } from "../../../state/types.js";
import { insertMany, selectAll } from "../dbFunctions.js";
import type { SequenceRepository } from "../types.js";

type SequenceRow = {
  id: string;
  name: string;
};

type SequenceStepRow = {
  sequence_id: string;
  step_order: number;
  duration: number;
  freq: number;
  amp: number;
  noise: number;
};

export function createSequenceRepository(db: Database): SequenceRepository {
  return {
    getAll: () => {
      const sequences = selectAll(db, "sequence", { orderBy: "rowid ASC" }) as SequenceRow[];
      const steps = selectAll(db, "sequence_step", {
        orderBy: "sequence_id ASC, step_order ASC"
      }) as SequenceStepRow[];
      const stepsBySequence = new Map<string, Sequence["steps"]>();
      steps.forEach((row) => {
        const list = stepsBySequence.get(row.sequence_id) ?? [];
        list.push({
          duration: Number(row.duration),
          freq: Number(row.freq),
          amp: Number(row.amp),
          noise: Number(row.noise)
        });
        stepsBySequence.set(row.sequence_id, list);
      });
      return sequences.map((sequence) => ({
        id: String(sequence.id),
        name: String(sequence.name),
        steps: stepsBySequence.get(sequence.id) ?? []
      }));
    },
    replaceAll: (sequences) => {
      db.exec("BEGIN TRANSACTION");
      try {
        db.exec("DELETE FROM sequence_step");
        db.exec("DELETE FROM sequence");

        const sequenceRows = sequences.map((sequence) => [sequence.id, sequence.name]);
        insertMany(db, "sequence", ["id", "name"], sequenceRows);

        const stepRows: Array<[string, number, number, number, number, number]> = [];
        sequences.forEach((sequence) => {
          sequence.steps.forEach((step, index) => {
            stepRows.push([
              sequence.id,
              index,
              step.duration,
              step.freq,
              step.amp,
              step.noise
            ]);
          });
        });
        insertMany(
          db,
          "sequence_step",
          ["sequence_id", "step_order", "duration", "freq", "amp", "noise"],
          stepRows
        );

        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
  };
}
