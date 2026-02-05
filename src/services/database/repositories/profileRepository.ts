import type { Database } from "sql.js";
import type { Profile } from "../../../state/types.js";
import { insertMany, selectAll } from "../dbFunctions.js";
import type { ProfileRepository } from "../types.js";

export function createProfileRepository(db: Database): ProfileRepository {
  return {
    getAll: () => {
      const rows = selectAll(db, "profile", { orderBy: "rowid ASC" }) as Profile[];
      return rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        updated: String(row.updated),
        freq: Number(row.freq),
        amp: Number(row.amp),
        noise: Number(row.noise)
      }));
    },
    replaceAll: (profiles) => {
      db.exec("BEGIN TRANSACTION");
      try {
        db.exec("DELETE FROM profile");
        const rows = profiles.map((profile) => [
          profile.id,
          profile.name,
          profile.updated,
          profile.freq,
          profile.amp,
          profile.noise
        ]);
        insertMany(db, "profile", ["id", "name", "updated", "freq", "amp", "noise"], rows);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
  };
}
