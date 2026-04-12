import * as schema from './schema.js';

export const mockStore = {
  users: [] as any[],
  properties: [] as any[],
  property_owners: [] as any[],
  payments: [] as any[],
  assessments: [] as any[],
  messages: [] as any[],
  direct_messages: [] as any[],
  admin_logs: [] as any[],
  taxpayer_logs: [] as any[],
  login_patterns: [
    { id: 1, word: 'WELCOME' },
    { id: 2, word: 'ADMIN' },
    { id: 3, word: 'SECURE' }
  ],
  inquiries: [] as any[],
  barangays: [] as any[],
  custom_computation_types: [] as any[],
};

type MockTable = keyof typeof mockStore;

const schemaTableMap = new Map<any, MockTable>([
  [schema.users, 'users'],
  [schema.properties, 'properties'],
  [schema.propertyOwners, 'property_owners'],
  [schema.payments, 'payments'],
  [schema.assessments, 'assessments'],
  [schema.messages, 'messages'],
  [schema.directMessages, 'direct_messages'],
  [schema.adminLogs, 'admin_logs'],
  [schema.taxpayerLogs, 'taxpayer_logs'],
  [schema.loginPatterns, 'login_patterns'],
  [schema.inquiries, 'inquiries'],
  [schema.barangays, 'barangays'],
  [schema.customComputationTypes, 'custom_computation_types'],
]);

export function getTableName(table: any): MockTable | undefined {
  return schemaTableMap.get(table);
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export function mapObjToSnake(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toSnakeCase(key)] = value;
  }
  return result;
}

function nextId(tableName: MockTable): number {
  const arr = mockStore[tableName] as any[];
  if (arr.length === 0) return 1;
  return Math.max(...arr.map((r: any) => r.id ?? 0)) + 1;
}

interface WhereCondition {
  col: string;
  op: string;
  val: any;
}

function evaluateCondition(row: any, cond: WhereCondition): boolean {
  const val = row[cond.col];
  switch (cond.op) {
    case '=': return val == cond.val;
    case '!=': return val != cond.val;
    case '>': return val > cond.val;
    case '<': return val < cond.val;
    case '>=': return val >= cond.val;
    case '<=': return val <= cond.val;
    case 'ilike': return String(val ?? '').toLowerCase().includes(String(cond.val ?? '').replace(/%/g, '').toLowerCase());
    case 'is null': return val === null || val === undefined;
    case 'is not null': return val !== null && val !== undefined;
    case 'in': return Array.isArray(cond.val) && cond.val.includes(val);
    case 'any': return Array.isArray(cond.val) && cond.val.includes(val);
    default: return true;
  }
}

function extractConditions(where: any): WhereCondition[] {
  const conditions: WhereCondition[] = [];
  if (!where) return conditions;

  if (where.type === 'eq' && where.table && where.column) {
    conditions.push({ col: where.column, op: '=', val: where.value });
  } else if (where.type === 'ne' && where.table && where.column) {
    conditions.push({ col: where.column, op: '!=', val: where.value });
  } else if (where.type === 'gt' && where.table && where.column) {
    conditions.push({ col: where.column, op: '>', val: where.value });
  } else if (where.type === 'lt' && where.table && where.column) {
    conditions.push({ col: where.column, op: '<', val: where.value });
  } else if (where.type === 'ilike' && where.table && where.column) {
    conditions.push({ col: where.column, op: 'ilike', val: where.value });
  } else if (where.type === 'isNull' && where.column) {
    conditions.push({ col: where.column, op: 'is null', val: null });
  } else if (where.type === 'isNotNull' && where.column) {
    conditions.push({ col: where.column, op: 'is not null', val: null });
  } else if (where.type === 'inArray' && where.column) {
    conditions.push({ col: where.column, op: 'in', val: where.value });
  } else if (where.type === 'and' && Array.isArray(where.conditions)) {
    for (const c of where.conditions) {
      conditions.push(...extractConditions(c));
    }
  } else if (where.type === 'or' && Array.isArray(where.conditions)) {
    const orResults = where.conditions.map((c: any) => extractConditions(c));
    conditions.push({ col: '__or__', op: 'or', val: orResults });
  } else if (where.type === 'sql' && where.query) {
    conditions.push({ col: '__sql__', op: 'sql_expr', val: where.query });
  } else if (where.type === 'exists' && where.subquery) {
    conditions.push({ col: '__exists__', op: 'exists', val: where.subquery });
  } else if (where.type === 'not' && where.conditions) {
    conditions.push({ col: '__not__', op: 'not', val: extractConditions(where.conditions[0] || where.conditions) });
  }

  return conditions;
}

function filterRowsWithOr(rows: any[], conditions: WhereCondition[]): any[] {
  return rows.filter(row => {
    return conditions.every(cond => {
      if (cond.op === 'or') {
        return (cond.val as WhereCondition[][]).some(group =>
          filterRowsWithOr([row], group).length > 0
        );
      }
      if (cond.op === 'not') {
        return !filterRowsWithOr([row], cond.val as WhereCondition[]).length;
      }
      if (cond.op === 'exists') {
        return true;
      }
      if (cond.op === 'sql_expr') {
        return true;
      }
      return evaluateCondition(row, cond);
    });
  });
}

export class MockSelect {
  private _table: any;
  private _fields: any;
  private _joins: { type: string; table: any; on: any }[] = [];
  private _whereClause: any = null;
  private _orderByClause: any[] = [];
  private _limitVal: number | null = null;
  private _offsetVal: number | null = null;

  constructor(table: any, fields?: any) {
    this._table = table;
    this._fields = fields;
  }

  from(table: any): MockSelect {
    this._table = table;
    return this;
  }

  innerJoin(table: any, on: any): MockSelect {
    this._joins.push({ type: 'inner', table, on });
    return this;
  }

  leftJoin(table: any, on: any): MockSelect {
    this._joins.push({ type: 'left', table, on });
    return this;
  }

  where(condition: any): MockSelect {
    this._whereClause = condition;
    return this;
  }

  orderBy(...clauses: any[]): MockSelect {
    this._orderByClause = clauses;
    return this;
  }

  limit(n: number): MockSelect {
    this._limitVal = n;
    return this;
  }

  offset(n: number): MockSelect {
    this._offsetVal = n;
    return this;
  }

  async then(resolve: any, reject?: any): Promise<any> {
    const result = await this.execute();
    return resolve(result);
  }

  async execute(): Promise<any[]> {
    const tableName = getTableName(this._table);
    if (!tableName) return [];

    let rows = [...(mockStore[tableName] as any[])];

    if (this._whereClause) {
      const conditions = extractConditions(this._whereClause);
      rows = filterRowsWithOr(rows, conditions);
    }

    if (this._orderByClause.length > 0) {
      rows.sort((a, b) => {
        for (const clause of this._orderByClause) {
          if (clause && typeof clause === 'object' && clause.column) {
            const col = clause.column;
            const dir = clause.direction || 'asc';
            const aVal = a[col] ?? '';
            const bVal = b[col] ?? '';
            const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            if (cmp !== 0) return dir === 'desc' ? -cmp : cmp;
          }
        }
        return 0;
      });
    }

    if (this._offsetVal) {
      rows = rows.slice(this._offsetVal);
    }
    if (this._limitVal !== null) {
      rows = rows.slice(0, this._limitVal);
    }

    if (this._fields && typeof this._fields === 'object' && !Array.isArray(this._fields)) {
      const fieldEntries = Object.entries(this._fields);
      if (fieldEntries.length > 0) {
        rows = rows.map(row => {
          const mapped: any = {};
          for (const [alias, colDef] of fieldEntries) {
            if (typeof colDef === 'object' && colDef !== null && 'column' in colDef) {
              mapped[alias] = row[(colDef as any).column];
            } else if (typeof colDef === 'string') {
              mapped[alias] = row[colDef];
            } else {
              mapped[alias] = row[alias];
            }
          }
          return mapped;
        });
      }
    }

    return rows;
  }
}

export class MockInsert {
  private _table: any;
  private _values: any[] = [];
  private _returningFields: string[] = [];
  private _onConflictClause: string = '';

  constructor(table: any) {
    this._table = table;
  }

  values(vals: any): MockInsert {
    this._values = Array.isArray(vals) ? vals : [vals];
    return this;
  }

  returning(...fields: any[]): MockInsert {
    if (fields.length === 1 && typeof fields[0] === 'object' && !Array.isArray(fields[0])) {
      this._returningFields = Object.keys(fields[0]);
    } else {
      this._returningFields = fields.flat();
    }
    return this;
  }

  onConflict(clause: string): MockInsert {
    this._onConflictClause = clause;
    return this;
  }

  async then(resolve: any, reject?: any): Promise<any> {
    const result = await this.execute();
    return resolve(result);
  }

  async execute(): Promise<any[]> {
    const tableName = getTableName(this._table);
    if (!tableName) return [];

    const results: any[] = [];
    for (const val of this._values) {
      const snakeVal = mapObjToSnake(val);
      const id = nextId(tableName);
      const newRow = { id, ...snakeVal };
      (mockStore[tableName] as any[]).push(newRow);
      results.push(newRow);
    }

    if (this._returningFields.length > 0) {
      return results.map(row => {
        const filtered: any = {};
        for (const field of this._returningFields) {
          filtered[field] = row[field];
        }
        return filtered;
      });
    }

    return results;
  }
}

export class MockUpdate {
  private _table: any;
  private _setValues: Record<string, any> = {};
  private _whereClause: any = null;
  private _returningFields: string[] = [];

  constructor(table: any) {
    this._table = table;
  }

  set(values: Record<string, any>): MockUpdate {
    this._setValues = mapObjToSnake(values);
    return this;
  }

  where(condition: any): MockUpdate {
    this._whereClause = condition;
    return this;
  }

  returning(...fields: any[]): MockUpdate {
    if (fields.length === 1 && typeof fields[0] === 'object' && !Array.isArray(fields[0])) {
      this._returningFields = Object.keys(fields[0]);
    } else {
      this._returningFields = fields.flat();
    }
    return this;
  }

  async then(resolve: any, reject?: any): Promise<any> {
    const result = await this.execute();
    return resolve(result);
  }

  async execute(): Promise<any[]> {
    const tableName = getTableName(this._table);
    if (!tableName) return [];

    let rows = mockStore[tableName] as any[];
    const conditions = this._whereClause ? extractConditions(this._whereClause) : [];
    const matching = filterRowsWithOr(rows, conditions);

    for (const row of matching) {
      Object.assign(row, this._setValues);
    }

    if (this._returningFields.length > 0) {
      return matching.map(row => {
        const filtered: any = {};
        for (const field of this._returningFields) {
          filtered[field] = row[field];
        }
        return filtered;
      });
    }

    return matching;
  }
}

export class MockDelete {
  private _table: any;
  private _whereClause: any = null;
  private _returningFields: string[] = [];

  constructor(table: any) {
    this._table = table;
  }

  where(condition: any): MockDelete {
    this._whereClause = condition;
    return this;
  }

  returning(...fields: any[]): MockDelete {
    this._returningFields = fields.flat();
    return this;
  }

  async then(resolve: any, reject?: any): Promise<any> {
    const result = await this.execute();
    return resolve(result);
  }

  async execute(): Promise<any[]> {
    const tableName = getTableName(this._table);
    if (!tableName) return [];

    const conditions = this._whereClause ? extractConditions(this._whereClause) : [];
    const store = mockStore[tableName] as any[];
    const toDelete = filterRowsWithOr(store, conditions);

    if (this._returningFields.length > 0) {
      const returned = toDelete.map(row => {
        const filtered: any = {};
        for (const field of this._returningFields) {
          filtered[field] = row[field];
        }
        return filtered;
      });
      mockStore[tableName] = store.filter((row: any) => !toDelete.includes(row));
      return returned;
    }

    mockStore[tableName] = store.filter((row: any) => !toDelete.includes(row));
    return toDelete;
  }
}

class MockTransaction {
  select(fields?: any) {
    return new MockSelect(null, fields);
  }

  insert(table: any) {
    return new MockInsert(table);
  }

  update(table: any) {
    return new MockUpdate(table);
  }

  delete(table: any) {
    return new MockDelete(table);
  }

  async execute(sqlQuery: any) {
    return { rows: [], rowCount: 0 };
  }
}

export class MockDb {
  select(fields?: any): MockSelect {
    return new MockSelect(null, fields);
  }

  insert(table: any): MockInsert {
    return new MockInsert(table);
  }

  update(table: any): MockUpdate {
    return new MockUpdate(table);
  }

  delete(table: any): MockDelete {
    return new MockDelete(table);
  }

  async transaction<T>(fn: (tx: MockTransaction) => Promise<T>): Promise<T> {
    const tx = new MockTransaction();
    return fn(tx);
  }

  async execute(sqlQuery: any): Promise<{ rows: any[]; rowCount: number }> {
    if (typeof sqlQuery === 'object' && sqlQuery.sql) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  }

  async run(sqlQuery: any): Promise<{ rows: any[]; rowCount: number }> {
    return { rows: [], rowCount: 0 };
  }

  $with: any;
}
