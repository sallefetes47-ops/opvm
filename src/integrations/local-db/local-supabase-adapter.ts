// Minimal supabase-js compatible shim, backed by PGlite.
// Supports the subset of the API that this codebase uses:
//   .from(table).select(cols).eq().neq().in().is().ilike().or().order().limit().single().maybeSingle()
//   .from(table).insert(row|rows).select().single()
//   .from(table).update(patch).eq()...
//   .from(table).delete().eq()...
//   .rpc(name, args)
//   .auth.signInWithPassword / signUp / signOut / getSession / onAuthStateChange / getUser

import { getLocalDb, sha256Hex } from './pglite-client';

type Result<T = any> = { data: T | null; error: { message: string } | null };

interface Filter {
  op: string;
  col: string;
  val: any;
}

const ident = (name: string) => '"' + String(name).replace(/"/g, '""') + '"';

function buildWhere(filters: Filter[], startIdx = 1): { sql: string; params: any[]; nextIdx: number } {
  if (!filters.length) return { sql: '', params: [], nextIdx: startIdx };
  const parts: string[] = [];
  const params: any[] = [];
  let i = startIdx;
  for (const f of filters) {
    const col = ident(f.col);
    switch (f.op) {
      case 'eq':  parts.push(`${col} = $${i++}`); params.push(f.val); break;
      case 'neq': parts.push(`${col} <> $${i++}`); params.push(f.val); break;
      case 'gt':  parts.push(`${col} > $${i++}`); params.push(f.val); break;
      case 'gte': parts.push(`${col} >= $${i++}`); params.push(f.val); break;
      case 'lt':  parts.push(`${col} < $${i++}`); params.push(f.val); break;
      case 'lte': parts.push(`${col} <= $${i++}`); params.push(f.val); break;
      case 'like':  parts.push(`${col} LIKE $${i++}`); params.push(f.val); break;
      case 'ilike': parts.push(`${col} ILIKE $${i++}`); params.push(f.val); break;
      case 'is':
        if (f.val === null) parts.push(`${col} IS NULL`);
        else parts.push(`${col} IS ${f.val ? 'TRUE' : 'FALSE'}`);
        break;
      case 'in': {
        const arr = Array.isArray(f.val) ? f.val : [];
        if (!arr.length) { parts.push('FALSE'); break; }
        const placeholders = arr.map(() => `$${i++}`).join(', ');
        parts.push(`${col} IN (${placeholders})`);
        params.push(...arr);
        break;
      }
      case 'not':
        parts.push(`NOT (${col} = $${i++})`); params.push(f.val); break;
      default:
        // unknown operator: ignore quietly
        break;
    }
  }
  return { sql: parts.length ? ' WHERE ' + parts.join(' AND ') : '', params, nextIdx: i };
}

class QueryBuilder<T = any> implements PromiseLike<Result<T>> {
  private filters: Filter[] = [];
  private orderBy: { col: string; asc: boolean }[] = [];
  private limitN: number | null = null;
  private mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private cols = '*';
  private payload: any = null;
  private returnSelect = false;
  private singleMode: null | 'single' | 'maybeSingle' = null;

  constructor(private table: string) {}

  select(cols = '*') {
    if (this.mode === 'select') this.cols = cols;
    else this.returnSelect = true;
    return this;
  }
  insert(payload: any) { this.mode = 'insert'; this.payload = payload; return this; }
  update(payload: any) { this.mode = 'update'; this.payload = payload; return this; }
  delete() { this.mode = 'delete'; return this; }

  eq(col: string, val: any)  { this.filters.push({ op: 'eq', col, val }); return this; }
  neq(col: string, val: any) { this.filters.push({ op: 'neq', col, val }); return this; }
  gt(col: string, val: any)  { this.filters.push({ op: 'gt', col, val }); return this; }
  gte(col: string, val: any) { this.filters.push({ op: 'gte', col, val }); return this; }
  lt(col: string, val: any)  { this.filters.push({ op: 'lt', col, val }); return this; }
  lte(col: string, val: any) { this.filters.push({ op: 'lte', col, val }); return this; }
  like(col: string, val: any)  { this.filters.push({ op: 'like', col, val }); return this; }
  ilike(col: string, val: any) { this.filters.push({ op: 'ilike', col, val }); return this; }
  is(col: string, val: any)    { this.filters.push({ op: 'is', col, val }); return this; }
  in(col: string, vals: any[]) { this.filters.push({ op: 'in', col, val: vals }); return this; }
  not(col: string, _op: string, val: any) { this.filters.push({ op: 'not', col, val }); return this; }
  or(_expr: string) { /* not supported — passthrough */ return this; }
  match(obj: Record<string, any>) {
    for (const [k, v] of Object.entries(obj)) this.filters.push({ op: 'eq', col: k, val: v });
    return this;
  }
  order(col: string, opts: { ascending?: boolean } = {}) {
    this.orderBy.push({ col, asc: opts.ascending !== false });
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  range(from: number, to: number) {
    this.limitN = to - from + 1;
    return this;
  }
  single() { this.singleMode = 'single'; return this; }
  maybeSingle() { this.singleMode = 'maybeSingle'; return this; }

  private async execute(): Promise<Result<T>> {
    try {
      const db = await getLocalDb();
      const tbl = ident(this.table);
      let sql = '';
      let params: any[] = [];

      if (this.mode === 'select') {
        sql = `SELECT ${this.cols === '*' ? '*' : this.cols} FROM ${tbl}`;
        const w = buildWhere(this.filters);
        sql += w.sql; params = w.params;
        if (this.orderBy.length) {
          sql += ' ORDER BY ' + this.orderBy.map((o) => `${ident(o.col)} ${o.asc ? 'ASC' : 'DESC'}`).join(', ');
        }
        if (this.limitN != null) sql += ` LIMIT ${this.limitN}`;
      } else if (this.mode === 'insert') {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
        if (!rows.length) return { data: [] as any, error: null };
        const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
        const placeholders: string[] = [];
        let i = 1;
        for (const r of rows) {
          const ph = cols.map((c) => {
            params.push(r[c] ?? null);
            return `$${i++}`;
          });
          placeholders.push(`(${ph.join(', ')})`);
        }
        sql = `INSERT INTO ${tbl} (${cols.map(ident).join(', ')}) VALUES ${placeholders.join(', ')} RETURNING *`;
      } else if (this.mode === 'update') {
        const entries = Object.entries(this.payload || {});
        if (!entries.length) return { data: null, error: { message: 'Empty update payload' } };
        let i = 1;
        const setSql = entries.map(([k]) => `${ident(k)} = $${i++}`).join(', ');
        params = entries.map(([, v]) => v);
        const w = buildWhere(this.filters, i);
        params.push(...w.params);
        sql = `UPDATE ${tbl} SET ${setSql}${w.sql} RETURNING *`;
      } else if (this.mode === 'delete') {
        const w = buildWhere(this.filters);
        params = w.params;
        sql = `DELETE FROM ${tbl}${w.sql} RETURNING *`;
      }

      const res = await db.query(sql, params);
      const rows = (res as any).rows ?? [];

      if (this.singleMode === 'single') {
        if (rows.length !== 1) {
          return { data: null, error: { message: `Expected single row, got ${rows.length}` } };
        }
        return { data: rows[0], error: null };
      }
      if (this.singleMode === 'maybeSingle') {
        return { data: rows[0] ?? null, error: null };
      }
      return { data: rows, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e?.message || String(e) } };
    }
  }

  then<TR1 = Result<T>, TR2 = never>(
    onfulfilled?: ((value: Result<T>) => TR1 | PromiseLike<TR1>) | null,
    onrejected?: ((reason: any) => TR2 | PromiseLike<TR2>) | null,
  ): PromiseLike<TR1 | TR2> {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }
}

// ---- Local Auth ----------------------------------------------------------
type Session = { user: { id: string; email: string }; access_token: string };
type AuthListener = (event: string, session: Session | null) => void;

const SESSION_KEY = 'opvm.localSession';
const listeners: AuthListener[] = [];

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveSession(s: Session | null) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
  listeners.forEach((l) => l(s ? 'SIGNED_IN' : 'SIGNED_OUT', s));
}

const auth = {
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const db = await getLocalDb();
      const hash = await sha256Hex(password);
      const res: any = await db.query(
        'SELECT id, email FROM local_users WHERE email = $1 AND password_hash = $2 LIMIT 1',
        [email, hash],
      );
      const row = res.rows?.[0];
      if (!row) return { data: { session: null, user: null }, error: { message: 'بيانات الدخول غير صحيحة' } };
      const session: Session = { user: row, access_token: 'local-' + row.id };
      saveSession(session);
      return { data: { session, user: row }, error: null };
    } catch (e: any) {
      return { data: { session: null, user: null }, error: { message: e?.message || 'Auth error' } };
    }
  },
  async signUp({ email, password, options }: any) {
    try {
      const db = await getLocalDb();
      const hash = await sha256Hex(password);
      const fullName = options?.data?.full_name ?? null;
      const ins: any = await db.query(
        'INSERT INTO local_users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email',
        [email, hash, fullName],
      );
      const u = ins.rows[0];
      await db.query('INSERT INTO profiles (user_id, full_name, email) VALUES ($1, $2, $3)', [u.id, fullName, email]);
      await db.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'employee')", [u.id]);
      const session: Session = { user: u, access_token: 'local-' + u.id };
      saveSession(session);
      return { data: { session, user: u }, error: null };
    } catch (e: any) {
      return { data: { session: null, user: null }, error: { message: e?.message || 'Sign-up error' } };
    }
  },
  async signOut() { saveSession(null); return { error: null }; },
  async getSession() { return { data: { session: loadSession() }, error: null }; },
  async getUser() {
    const s = loadSession();
    return { data: { user: s?.user ?? null }, error: null };
  },
  onAuthStateChange(cb: AuthListener) {
    listeners.push(cb);
    // emit current state on next tick (matches supabase-js behaviour)
    setTimeout(() => cb(loadSession() ? 'SIGNED_IN' : 'SIGNED_OUT', loadSession()), 0);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            const i = listeners.indexOf(cb);
            if (i >= 0) listeners.splice(i, 1);
          },
        },
      },
    };
  },
};

// ---- Storage / Functions stubs (offline) ---------------------------------
const offlineError = { message: 'هذه الميزة تتطلب اتصالاً بالإنترنت' };

const functions = {
  async invoke(_name: string, _opts?: any) {
    return { data: null, error: offlineError };
  },
};

const storage = {
  from(_bucket: string) {
    return {
      async upload() { return { data: null, error: offlineError }; },
      async download() { return { data: null, error: offlineError }; },
      async remove() { return { data: null, error: offlineError }; },
      getPublicUrl(path: string) { return { data: { publicUrl: path } }; },
    };
  },
};

// ---- RPCs ----------------------------------------------------------------
async function rpc(name: string, args: Record<string, any> = {}): Promise<Result> {
  try {
    const db = await getLocalDb();
    if (name === 'soft_delete_file') {
      await db.query('UPDATE files SET is_deleted = true, deleted_at = now() WHERE id = $1', [args._file_id]);
      return { data: null, error: null };
    }
    if (name === 'has_role') {
      const r: any = await db.query(
        'SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = $1 AND role = $2) AS ok',
        [args._user_id, args._role],
      );
      return { data: r.rows?.[0]?.ok ?? false, error: null };
    }
    if (name === 'get_user_role') {
      const r: any = await db.query('SELECT role FROM user_roles WHERE user_id = $1 LIMIT 1', [args._user_id]);
      return { data: r.rows?.[0]?.role ?? null, error: null };
    }
    return { data: null, error: { message: `RPC not supported offline: ${name}` } };
  } catch (e: any) {
    return { data: null, error: { message: e?.message || 'RPC error' } };
  }
}

export const localSupabase = {
  from<T = any>(table: string) { return new QueryBuilder<T>(table); },
  rpc,
  auth,
  functions,
  storage,
  // Channels/realtime not supported offline — provide a no-op
  channel(_name: string) {
    const noop = { on() { return noop; }, subscribe() { return noop; }, unsubscribe() { return noop; } };
    return noop as any;
  },
  removeChannel(_c: any) {},
};

export type LocalSupabase = typeof localSupabase;
