import type { Database, SqlValue, Statement } from "sql.js";

type SelectOptions = {
  columns?: string[];
  orderBy?: string;
};

type WhereClause = {
  field: string;
  value: SqlValue;
};

function buildSelect(tableName: string, options?: SelectOptions, where?: WhereClause) {
  const columns = options?.columns?.length ? options.columns.join(", ") : "*";
  let sql = `SELECT ${columns} FROM ${tableName}`;
  const values: SqlValue[] = [];
  if (where) {
    sql += ` WHERE ${where.field} = ?`;
    values.push(where.value);
  }
  if (options?.orderBy) {
    sql += ` ORDER BY ${options.orderBy}`;
  }
  return { sql, values };
}

function rowsFromStatement(statement: Statement) {
  const rows: Record<string, unknown>[] = [];
  while (statement.step()) {
    rows.push(statement.getAsObject());
  }
  return rows;
}

export function selectAll(db: Database, tableName: string, options?: SelectOptions) {
  const { sql, values } = buildSelect(tableName, options);
  const statement = db.prepare(sql);
  statement.bind(values);
  const rows = rowsFromStatement(statement);
  statement.free();
  return rows;
}

export function selectBy(
  db: Database,
  tableName: string,
  field: string,
  value: SqlValue,
  options?: SelectOptions
) {
  const { sql, values } = buildSelect(tableName, options, { field, value });
  const statement = db.prepare(sql);
  statement.bind(values);
  const rows = rowsFromStatement(statement);
  statement.free();
  return rows;
}

export function selectColumns(
  db: Database,
  tableName: string,
  columns: string[],
  where?: WhereClause,
  options?: Omit<SelectOptions, "columns">
) {
  const { sql, values } = buildSelect(tableName, { ...options, columns }, where);
  const statement = db.prepare(sql);
  statement.bind(values);
  const rows = rowsFromStatement(statement);
  statement.free();
  return rows;
}

export function insert(db: Database, tableName: string, columns: string[], values: SqlValue[]) {
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;
  const statement = db.prepare(sql);
  statement.bind(values);
  statement.step();
  statement.free();
}

export function insertMany(db: Database, tableName: string, columns: string[], rows: SqlValue[][]) {
  if (rows.length === 0) return;
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;
  const statement = db.prepare(sql);
  try {
    rows.forEach((row) => {
      statement.bind(row);
      statement.step();
      statement.reset();
    });
  } finally {
    statement.free();
  }
}

export function update(
  db: Database,
  tableName: string,
  setFields: Record<string, SqlValue>,
  identifierField: string,
  identifierValue: SqlValue
) {
  const keys = Object.keys(setFields);
  if (keys.length === 0) return;
  const assignments = keys.map((key) => `${key} = ?`).join(", ");
  const sql = `UPDATE ${tableName} SET ${assignments} WHERE ${identifierField} = ?`;
  const values = [...keys.map((key) => setFields[key]), identifierValue];
  const statement = db.prepare(sql);
  statement.bind(values);
  statement.step();
  statement.free();
}

export function deleteEntry(
  db: Database,
  tableName: string,
  identifierField: string,
  identifierValue: SqlValue
) {
  const sql = `DELETE FROM ${tableName} WHERE ${identifierField} = ?`;
  const statement = db.prepare(sql);
  statement.bind([identifierValue]);
  statement.step();
  statement.free();
}
