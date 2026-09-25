// lib/pgstore.ts
// Small Mongo-like document store backed by Postgres (Neon).
// Documents live in the `documents` table as JSONB, keyed by (collection, id).
// It supports the subset of the Mongoose API this project actually uses:
// findOne / findById / find / create / updateOne / updateMany /
// findOneAndUpdate / findByIdAndUpdate / deleteOne / deleteMany /
// countDocuments, plus .lean() .exec() .sort() .limit() .skip() .select()
// and document .save().

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { ensureSchema, isDatabaseConfigured, query } from "./db";

export type AnyDoc = Record<string, any>;

/**
 * In-memory fallback so the whole app still works when DATABASE_URL is not
 * configured (local preview). Data lives only for the server process lifetime.
 */
const memStore = new Map<string, Map<string, { id: string; data: AnyDoc; created_at: Date; updated_at: Date }>>();

function memCollection(name: string) {
  let c = memStore.get(name);
  if (!c) {
    c = new Map();
    memStore.set(name, c);
  }
  return c;
}

function memPersist(collection: string, id: string, doc: AnyDoc) {
  const c = memCollection(collection);
  const now = new Date();
  const prev = c.get(id);
  c.set(id, {
    id,
    data: serialize({ ...doc, _id: id }),
    created_at: prev?.created_at ?? now,
    updated_at: now,
  });
}

function memLoadAll(collection: string) {
  const c = memCollection(collection);
  return [...c.values()].map((row) => ({ ...row }));
}

function newId(): string {
  return crypto.randomBytes(12).toString("hex");
}

function getPath(obj: any, path: string): any {
  if (obj == null) return undefined;
  if (!path.includes(".")) return obj[path];
  return path.split(".").reduce((acc: any, key) => {
    if (acc == null) return undefined;
    if (Array.isArray(acc)) {
      const mapped = acc.map((item) => (item == null ? undefined : item[key]));
      return mapped.flat();
    }
    return acc[key];
  }, obj);
}

function setPath(obj: any, path: string, value: any) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (cur[key] == null || typeof cur[key] !== "object") cur[key] = {};
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
}

function unsetPath(obj: any, path: string) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur?.[parts[i]];
    if (cur == null) return;
  }
  delete cur[parts[parts.length - 1]];
}

function valueEquals(actual: any, expected: any): boolean {
  if (expected instanceof Date) {
    return new Date(actual).getTime() === expected.getTime();
  }
  if (Array.isArray(actual)) {
    return actual.some((item) => valueEquals(item, expected));
  }
  if (actual instanceof Date || (typeof actual === "string" && expected instanceof Date)) {
    return new Date(actual).getTime() === new Date(expected as any).getTime();
  }
  return actual === expected || String(actual) === String(expected);
}

function matchOperator(actual: any, op: string, expected: any): boolean {
  switch (op) {
    case "$eq":
      return valueEquals(actual, expected);
    case "$ne":
      return !valueEquals(actual, expected);
    case "$in":
      return (expected as any[]).some((e) => valueEquals(actual, e));
    case "$nin":
      return !(expected as any[]).some((e) => valueEquals(actual, e));
    case "$exists":
      return (actual !== undefined && actual !== null) === Boolean(expected);
    case "$regex": {
      const re = expected instanceof RegExp ? expected : new RegExp(expected);
      return typeof actual === "string" && re.test(actual);
    }
    case "$gt":
      return toComparable(actual) > toComparable(expected);
    case "$gte":
      return toComparable(actual) >= toComparable(expected);
    case "$lt":
      return toComparable(actual) < toComparable(expected);
    case "$lte":
      return toComparable(actual) <= toComparable(expected);
    case "$elemMatch":
      return Array.isArray(actual) && actual.some((item) => matchFilter(item, expected));
    default:
      return false;
  }
}

function toComparable(v: any): any {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string" && !Number.isNaN(Date.parse(v)) && /\d{4}-\d{2}-\d{2}/.test(v)) {
    return Date.parse(v);
  }
  return v;
}

export function matchFilter(doc: AnyDoc, filter: AnyDoc = {}): boolean {
  for (const [key, cond] of Object.entries(filter || {})) {
    if (key === "$or") {
      if (!(cond as AnyDoc[]).some((sub) => matchFilter(doc, sub))) return false;
      continue;
    }
    if (key === "$and") {
      if (!(cond as AnyDoc[]).every((sub) => matchFilter(doc, sub))) return false;
      continue;
    }
    if (key === "$nor") {
      if ((cond as AnyDoc[]).some((sub) => matchFilter(doc, sub))) return false;
      continue;
    }

    const actual = getPath(doc, key);

    if (cond && typeof cond === "object" && !Array.isArray(cond) && !(cond instanceof Date) && !(cond instanceof RegExp)) {
      const ops = Object.keys(cond);
      if (ops.length && ops.every((o) => o.startsWith("$"))) {
        for (const op of ops) {
          if (!matchOperator(actual, op, (cond as AnyDoc)[op])) return false;
        }
        continue;
      }
    }

    if (cond instanceof RegExp) {
      if (!(typeof actual === "string" && cond.test(actual))) return false;
      continue;
    }

    if (!valueEquals(actual, cond)) return false;
  }
  return true;
}

export function applyUpdate(doc: AnyDoc, update: AnyDoc = {}): AnyDoc {
  const next = JSON.parse(JSON.stringify(doc ?? {}));
  const hasOperators = Object.keys(update).some((k) => k.startsWith("$"));

  if (!hasOperators) {
    for (const [k, v] of Object.entries(update)) setPath(next, k, serialize(v));
    return next;
  }

  for (const [op, payload] of Object.entries(update)) {
    switch (op) {
      case "$set":
        for (const [k, v] of Object.entries(payload as AnyDoc)) setPath(next, k, serialize(v));
        break;
      case "$unset":
        for (const k of Object.keys(payload as AnyDoc)) unsetPath(next, k);
        break;
      case "$inc":
        for (const [k, v] of Object.entries(payload as AnyDoc)) {
          setPath(next, k, Number(getPath(next, k) || 0) + Number(v));
        }
        break;
      case "$push":
        for (const [k, v] of Object.entries(payload as AnyDoc)) {
          const arr = getPath(next, k);
          const list = Array.isArray(arr) ? arr : [];
          const value: any = v as any;
          if (value && typeof value === "object" && "$each" in value) {
            list.push(...(value.$each as any[]).map(serialize));
          } else {
            list.push(serialize(value));
          }
          setPath(next, k, list);
        }
        break;
      case "$pull":
        for (const [k, v] of Object.entries(payload as AnyDoc)) {
          const arr = getPath(next, k);
          if (Array.isArray(arr)) {
            setPath(
              next,
              k,
              arr.filter((item) =>
                typeof v === "object" && v !== null ? !matchFilter(item, v as AnyDoc) : !valueEquals(item, v)
              )
            );
          }
        }
        break;
      case "$addToSet":
        for (const [k, v] of Object.entries(payload as AnyDoc)) {
          const arr = getPath(next, k);
          const list = Array.isArray(arr) ? arr : [];
          if (!list.some((item) => JSON.stringify(item) === JSON.stringify(v))) list.push(serialize(v));
          setPath(next, k, list);
        }
        break;
      case "$setOnInsert":
        break;
      default:
        break;
    }
  }
  return next;
}

function serialize(value: any): any {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    const out: AnyDoc = {};
    for (const [k, v] of Object.entries(value)) out[k] = serialize(v);
    return out;
  }
  return value;
}

export interface ModelOptions {
  collection: string;
  defaults?: AnyDoc | (() => AnyDoc);
  hashFields?: string[];
  idFrom?: string; // take _id from this field when creating
}

class Query<T> implements PromiseLike<T> {
  private sortSpec: AnyDoc | null = null;
  private limitN: number | null = null;
  private skipN = 0;
  private selectSpec: string | AnyDoc | null = null;

  constructor(private runner: (q: Query<T>) => Promise<T>) {}

  get _sort() {
    return this.sortSpec;
  }
  get _limit() {
    return this.limitN;
  }
  get _skip() {
    return this.skipN;
  }
  get _select() {
    return this.selectSpec;
  }

  sort(spec: AnyDoc | string) {
    this.sortSpec = typeof spec === "string" ? { [spec.replace(/^-/, "")]: spec.startsWith("-") ? -1 : 1 } : spec;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  skip(n: number) {
    this.skipN = n;
    return this;
  }
  select(spec: string | AnyDoc) {
    this.selectSpec = spec;
    return this;
  }
  lean() {
    return this;
  }
  exec(): Promise<T> {
    return this.runner(this);
  }
  populate() {
    return this;
  }
  then<R1 = T, R2 = never>(
    onfulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return this.runner(this).then(onfulfilled, onrejected);
  }
  catch(onrejected: any) {
    return this.runner(this).catch(onrejected);
  }
}

export class Model {
  readonly collection: string;
  private defaults: ModelOptions["defaults"];
  private hashFields: string[];
  private idFrom?: string;

  constructor(opts: ModelOptions) {
    this.collection = opts.collection;
    this.defaults = opts.defaults;
    this.hashFields = opts.hashFields || [];
    this.idFrom = opts.idFrom;
  }

  private baseDefaults(): AnyDoc {
    const d = typeof this.defaults === "function" ? (this.defaults as () => AnyDoc)() : this.defaults;
    return d ? JSON.parse(JSON.stringify(d)) : {};
  }

  private hydrate(row: { id: string; data: AnyDoc; created_at: Date; updated_at: Date }): AnyDoc {
    const doc: AnyDoc = {
      ...this.baseDefaults(),
      ...row.data,
      _id: row.data?._id ?? row.id,
      createdAt: row.data?.createdAt ?? row.created_at,
      updatedAt: row.data?.updatedAt ?? row.updated_at,
    };
    return this.attachMethods(doc);
  }

  private attachMethods(doc: AnyDoc): AnyDoc {
    const model = this;
    Object.defineProperty(doc, "save", {
      enumerable: false,
      configurable: true,
      writable: true,
      value: async function save() {
        await model.persist(String(this._id), this);
        return this;
      },
    });
    Object.defineProperty(doc, "toObject", {
      enumerable: false,
      configurable: true,
      writable: true,
      value: function toObject() {
        return JSON.parse(JSON.stringify(this));
      },
    });
    Object.defineProperty(doc, "toJSON", {
      enumerable: false,
      configurable: true,
      writable: true,
      value: function toJSON() {
        return JSON.parse(JSON.stringify(this));
      },
    });
    return doc;
  }

  private async hashIfNeeded(data: AnyDoc): Promise<AnyDoc> {
    for (const field of this.hashFields) {
      const value = data[field];
      if (typeof value === "string" && value && !/^\$2[aby]\$/.test(value)) {
        data[field] = await bcrypt.hash(value, 10);
      }
    }
    return data;
  }

  private async persist(id: string, doc: AnyDoc) {
    if (!isDatabaseConfigured()) {
      memPersist(this.collection, id, doc);
      return;
    }
    await ensureSchema();
    const data = serialize({ ...doc, _id: id });
    delete (data as AnyDoc).createdAt;
    await this.hashIfNeeded(data);
    await query(
      `INSERT INTO documents (collection, id, data, updated_at)
       VALUES ($1, $2, $3::jsonb, now())
       ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [this.collection, id, JSON.stringify(data)]
    );
  }

  private async loadAll(filter: AnyDoc = {}): Promise<AnyDoc[]> {
    if (!isDatabaseConfigured()) {
      const rows = memLoadAll(this.collection).map((r) => this.hydrate(r));
      return rows.filter((d) => matchFilter(d, filter));
    }
    await ensureSchema();
    const direct = filter?._id && (typeof filter._id === "string" || typeof filter._id === "number");
    const res = direct
      ? await query(`SELECT id, data, created_at, updated_at FROM documents WHERE collection = $1 AND id = $2`, [
          this.collection,
          String(filter._id),
        ])
      : await query(
          `SELECT id, data, created_at, updated_at FROM documents WHERE collection = $1 ORDER BY updated_at DESC`,
          [this.collection]
        );
    return res.rows.map((r: any) => this.hydrate(r)).filter((d) => matchFilter(d, filter));
  }

  private finish(docs: AnyDoc[], q: Query<any>): AnyDoc[] {
    let out = docs;
    if (q._sort) {
      const entries = Object.entries(q._sort);
      out = [...out].sort((a, b) => {
        for (const [key, dir] of entries) {
          const av = toComparable(getPath(a, key));
          const bv = toComparable(getPath(b, key));
          if (av === bv) continue;
          return (av > bv ? 1 : -1) * (Number(dir) < 0 ? -1 : 1);
        }
        return 0;
      });
    }
    if (q._skip) out = out.slice(q._skip);
    if (q._limit != null) out = out.slice(0, q._limit);
    if (q._select) {
      const spec = q._select;
      const excluded =
        typeof spec === "string"
          ? spec.split(/\s+/).filter((s) => s.startsWith("-")).map((s) => s.slice(1))
          : Object.entries(spec).filter(([, v]) => !v).map(([k]) => k);
      const included =
        typeof spec === "string"
          ? spec.split(/\s+/).filter((s) => s && !s.startsWith("-"))
          : Object.entries(spec).filter(([, v]) => v).map(([k]) => k);
      out = out.map((doc) => {
        const copy: AnyDoc = { ...doc };
        if (included.length) {
          const picked: AnyDoc = { _id: copy._id };
          for (const k of included) picked[k] = copy[k];
          return picked;
        }
        for (const k of excluded) delete copy[k];
        return copy;
      });
    }
    return out;
  }

  find(filter: AnyDoc = {}) {
    return new Query<AnyDoc[]>(async (q) => this.finish(await this.loadAll(filter), q));
  }

  findOne(filter: AnyDoc = {}) {
    return new Query<AnyDoc | null>(async (q) => {
      const docs = this.finish(await this.loadAll(filter), q);
      return docs[0] ?? null;
    });
  }

  findById(id: any) {
    return this.findOne({ _id: String(id) });
  }

  async countDocuments(filter: AnyDoc = {}): Promise<number> {
    return (await this.loadAll(filter)).length;
  }

  async estimatedDocumentCount(): Promise<number> {
    return this.countDocuments({});
  }

  async create(input: AnyDoc | AnyDoc[]): Promise<any> {
    if (Array.isArray(input)) return Promise.all(input.map((i) => this.create(i)));
    const now = new Date().toISOString();
    const id =
      input._id != null
        ? String(input._id)
        : this.idFrom && input[this.idFrom]
          ? String(input[this.idFrom])
          : newId();
    const doc: AnyDoc = {
      ...this.baseDefaults(),
      ...serialize(input),
      _id: id,
      createdAt: input.createdAt ? serialize(input.createdAt) : now,
      updatedAt: now,
    };
    await this.persist(id, doc);
    return this.attachMethods(doc);
  }

  async insertMany(docs: AnyDoc[]) {
    return this.create(docs);
  }

  async updateOne(filter: AnyDoc, update: AnyDoc, options: AnyDoc = {}) {
    const docs = await this.loadAll(filter);
    if (!docs.length) {
      if (options.upsert) {
        const seed = applyUpdate({ ...filter, ...(update.$setOnInsert || {}) }, update);
        await this.create(seed);
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
      }
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    }
    const next = applyUpdate(docs[0], update);
    next.updatedAt = new Date().toISOString();
    await this.persist(String(docs[0]._id), next);
    return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
  }

  async updateMany(filter: AnyDoc, update: AnyDoc, options: AnyDoc = {}) {
    const docs = await this.loadAll(filter);
    if (!docs.length && options.upsert) {
      await this.create(applyUpdate({ ...filter, ...(update.$setOnInsert || {}) }, update));
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
    }
    for (const doc of docs) {
      const next = applyUpdate(doc, update);
      next.updatedAt = new Date().toISOString();
      await this.persist(String(doc._id), next);
    }
    return { matchedCount: docs.length, modifiedCount: docs.length, upsertedCount: 0 };
  }

  findOneAndUpdate(filter: AnyDoc, update: AnyDoc, options: AnyDoc = {}) {
    return new Query<AnyDoc | null>(async () => {
      const docs = await this.loadAll(filter);
      if (!docs.length) {
        if (options.upsert || options.new === undefined ? options.upsert : false) {
          const created = await this.create(applyUpdate({ ...filter, ...(update.$setOnInsert || {}) }, update));
          return created;
        }
        return null;
      }
      const current = docs[0];
      const next = applyUpdate(current, update);
      next.updatedAt = new Date().toISOString();
      await this.persist(String(current._id), next);
      return this.attachMethods(options.new === false ? current : next);
    });
  }

  findByIdAndUpdate(id: any, update: AnyDoc, options: AnyDoc = {}) {
    return this.findOneAndUpdate({ _id: String(id) }, update, { new: true, ...options });
  }

  async deleteOne(filter: AnyDoc) {
    const docs = await this.loadAll(filter);
    if (!docs.length) return { deletedCount: 0 };
    await query(`DELETE FROM documents WHERE collection = $1 AND id = $2`, [this.collection, String(docs[0]._id)]);
    return { deletedCount: 1 };
  }

  findByIdAndDelete(id: any) {
    return this.deleteOne({ _id: String(id) });
  }

  async deleteMany(filter: AnyDoc = {}) {
    const docs = await this.loadAll(filter);
    for (const doc of docs) {
      await query(`DELETE FROM documents WHERE collection = $1 AND id = $2`, [this.collection, String(doc._id)]);
    }
    return { deletedCount: docs.length };
  }
}

export function defineModel(opts: ModelOptions): Model {
  return new Model(opts);
}

export { newId };
