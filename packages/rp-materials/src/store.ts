import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type SQLInputValue, type SQLOutputValue } from 'node:sqlite';
import { decodeMaterial } from './codec.js';
import { MaterialError, cloneJson, mergeJson, object, text, validateJson } from './json.js';
import { currentJson, projectMaterial } from './projection.js';
import { personaDocument, personaResources } from './persona.js';
import { MATERIAL_KINDS } from './types.js';
import type {
  MaterialInput, MaterialMetadata, MaterialRecord, MaterialRevision, MaterialVersion,
  MaterialVersionRef, MaterialBindings, MaterialQuery, MaterialSummary, MaterialExport,
  MaterialResource, MaterialBundle, MaterialBundleRestore, MaterialKind, MaterialFormat,
  MaterialProjection, MaterialCapability, DecodedMaterial, PortableOriginal, PortableMaterial,
  JsonValue, JsonObject, PersonaDraft,
} from './types.js';

type Row = Record<string, SQLOutputValue>;
const timestamp = () => new Date().toISOString();
const emptyBindings = (): MaterialBindings => ({ worldbooks: [], preset: null });
const referenceKey = (ref: MaterialVersionRef) => `${ref.id}@${ref.version}`;
const parseStored = (value: SQLOutputValue | undefined): JsonValue => {
  if (typeof value !== 'string') throw new MaterialError('STORE_INVALID', '本地素材记录不完整');
  return validateJson(JSON.parse(value) as unknown);
};
const rowText = (row: Row, key: string): string => {
  if (typeof row[key] !== 'string') throw new MaterialError('STORE_INVALID', '本地素材记录不完整');
  return row[key];
};
const rowNumber = (row: Row, key: string): number => {
  if (typeof row[key] !== 'number') throw new MaterialError('STORE_INVALID', '本地素材记录不完整');
  return row[key];
};
const needString = (value: JsonValue | undefined, name: string): string => {
  if (typeof value !== 'string') throw new MaterialError('BUNDLE_INVALID', `素材备份的${name}无效`);
  return value;
};
const needNumber = (value: JsonValue | undefined, name: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new MaterialError('BUNDLE_INVALID', `素材备份的${name}无效`);
  return value;
};
function parseRef(value: JsonValue | undefined): MaterialVersionRef {
  const root = object(value);
  return { id: needString(root.id, '素材编号'), version: needNumber(root.version, '素材版本') };
}
function parseBindings(value: JsonValue | undefined): MaterialBindings {
  const root = object(value);
  if (!Array.isArray(root.worldbooks)) throw new MaterialError('BUNDLE_INVALID', '素材备份的世界书引用无效');
  return { worldbooks: root.worldbooks.map(parseRef), preset: root.preset === null ? null : parseRef(root.preset) };
}
function materialKind(value: JsonValue | undefined): MaterialKind {
  if (typeof value !== 'string' || !MATERIAL_KINDS.some(kind => kind === value)) throw new MaterialError('BUNDLE_INVALID', '素材类型无效');
  return value as MaterialKind;
}
function parseCapabilities(value: JsonValue | undefined): MaterialCapability[] {
  if (!Array.isArray(value)) throw new MaterialError('BUNDLE_INVALID', '素材能力记录无效');
  return value.map(item => {
    const record = object(item);
    if (record.status !== 'used' && record.status !== 'archived') throw new MaterialError('BUNDLE_INVALID', '素材能力状态无效');
    return { path: needString(record.path, '字段来源'), label: needString(record.label, '能力名称'), status: record.status, ...(record.reason === undefined ? {} : { reason: needString(record.reason, '能力说明') }) };
  });
}
function checkProjection(value: JsonValue | undefined): MaterialProjection {
  const root = object(value);
  const kind = materialKind(root.kind);
  const string = (value: JsonValue | undefined) => needString(value, '运行投影文字');
  const number = (value: JsonValue | undefined): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new MaterialError('BUNDLE_INVALID', '素材运行投影数值无效');
    return value;
  };
  const nullableNumber = (value: JsonValue | undefined): number | null => value === null ? null : number(value);
  const boolean = (value: JsonValue | undefined): boolean => {
    if (typeof value !== 'boolean') throw new MaterialError('BUNDLE_INVALID', '素材运行投影开关无效');
    return value;
  };
  const array = (value: JsonValue | undefined): JsonValue[] => {
    if (!Array.isArray(value)) throw new MaterialError('BUNDLE_INVALID', '素材运行投影列表无效');
    return value;
  };
  const strings = (value: JsonValue | undefined) => array(value).map(string);
  const choice = <T extends string | number>(value: JsonValue | undefined, choices: readonly T[]): T => {
    if (!choices.some(item => item === value)) throw new MaterialError('BUNDLE_INVALID', '素材运行投影选项无效');
    return value as T;
  };
  const role = (value: JsonValue | undefined) => choice(value, ['system', 'user', 'assistant'] as const);
  const character = root.character === null ? null : (() => {
    const entry = object(root.character);
    return {
      name: string(entry.name), description: string(entry.description), personality: string(entry.personality),
      scenario: string(entry.scenario), firstMessage: string(entry.firstMessage), alternateGreetings: strings(entry.alternateGreetings),
      messageExamples: string(entry.messageExamples), systemPrompt: string(entry.systemPrompt),
      postHistoryInstructions: string(entry.postHistoryInstructions), creatorNotes: string(entry.creatorNotes), tags: strings(entry.tags),
    };
  })();
  const worldbook = root.worldbook === null ? null : (() => {
    const book = object(root.worldbook);
    if (book.recursive !== false) throw new MaterialError('BUNDLE_INVALID', '素材世界书运行模式无效');
    return {
      name: string(book.name), scanDepth: nullableNumber(book.scanDepth), budget: nullableNumber(book.budget), recursive: false as const,
      entries: array(book.entries).map(value => {
        const entry = object(value);
        return {
          id: string(entry.id), name: string(entry.name), content: string(entry.content), keys: strings(entry.keys), secondaryKeys: strings(entry.secondaryKeys),
          selective: boolean(entry.selective), selectiveLogic: choice(entry.selectiveLogic, [0, 1, 2, 3] as const), constant: boolean(entry.constant),
          enabled: boolean(entry.enabled), caseSensitive: boolean(entry.caseSensitive), wholeWords: boolean(entry.wholeWords), scanDepth: nullableNumber(entry.scanDepth),
          order: number(entry.order), position: choice(entry.position, ['before', 'after', 'depth'] as const), depth: number(entry.depth), role: role(entry.role), sourcePath: string(entry.sourcePath),
        };
      }),
    };
  })();
  const preset = root.preset === null ? null : (() => {
    const entry = object(root.preset);
    const sampling = object(entry.sampling);
    return {
      prompts: array(entry.prompts).map(value => {
        const prompt = object(value);
        return { identifier: string(prompt.identifier), name: string(prompt.name), enabled: boolean(prompt.enabled), role: role(prompt.role), content: string(prompt.content), marker: boolean(prompt.marker), ...(prompt.forbidOverrides === undefined ? {} : { forbidOverrides: boolean(prompt.forbidOverrides) }), position: choice(prompt.position, ['relative', 'depth'] as const), depth: number(prompt.depth), order: number(prompt.order), sourcePath: string(prompt.sourcePath) };
      }),
      sampling: {
        ...(sampling.temperature === undefined ? {} : { temperature: number(sampling.temperature) }),
        ...(sampling.maxTokens === undefined ? {} : { maxTokens: number(sampling.maxTokens) }),
        ...(sampling.reasoningEffort === undefined ? {} : { reasoningEffort: string(sampling.reasoningEffort) }),
        ...(sampling.stop === undefined ? {} : { stop: strings(sampling.stop) }),
      },
    };
  })();
  const persona = root.persona === undefined ? undefined : (() => {
    const entry = object(root.persona);
    return { name: string(entry.name), description: string(entry.description), ...(entry.avatarPath === undefined ? {} : { avatarPath: string(entry.avatarPath) }) };
  })();
  if (kind === 'character' && !character || kind === 'worldbook' && !worldbook || kind === 'preset' && !preset || kind === 'persona' && !persona) throw new MaterialError('BUNDLE_INVALID', '素材运行投影缺少对应内容');
  return {
    kind, name: string(root.name), ...(persona ? { persona } : {}), character, worldbook, preset,
    regex: array(root.regex).map(value => {
      const entry = object(value);
      return { id: string(entry.id), name: string(entry.name), findRegex: string(entry.findRegex), replaceString: string(entry.replaceString), trimStrings: strings(entry.trimStrings), placements: array(entry.placements).map(value => choice(value, ['input', 'output', 'worldbook', 'reasoning'] as const)), displayOnly: boolean(entry.displayOnly), promptOnly: boolean(entry.promptOnly), disabled: boolean(entry.disabled), runOnEdit: boolean(entry.runOnEdit), minDepth: nullableNumber(entry.minDepth), maxDepth: nullableNumber(entry.maxDepth), substituteRegex: number(entry.substituteRegex), sourcePath: string(entry.sourcePath) };
    }),
    quickReplies: array(root.quickReplies).map(value => { const entry = object(value); return { id: string(entry.id), label: string(entry.label), message: string(entry.message), enabled: boolean(entry.enabled), sourcePath: string(entry.sourcePath) }; }),
  };
}
function summaryFromRow(row: Row): MaterialSummary {
  const tags = parseStored(row.tags_json);
  if (!Array.isArray(tags) || !tags.every(item => typeof item === 'string')) throw new MaterialError('STORE_INVALID', '素材标签记录无效');
  return { id: rowText(row, 'id'), name: rowText(row, 'name'), kind: materialKind(rowText(row, 'kind')), category: rowText(row, 'category'), tags, enabled: rowNumber(row, 'enabled') === 1, currentVersion: rowNumber(row, 'current_version'), createdAt: rowText(row, 'created_at'), updatedAt: rowText(row, 'updated_at') };
}
function versionFromRow(row: Row): MaterialVersion {
  return { id: rowText(row, 'material_id'), version: rowNumber(row, 'version'), originalId: rowText(row, 'original_id'), createdAt: rowText(row, 'created_at'), raw: parseStored(row.raw_json), projection: checkProjection(parseStored(row.projection_json)), capabilities: parseCapabilities(parseStored(row.capabilities_json)), bindings: parseBindings(parseStored(row.bindings_json)) };
}
function normalizedMetadata(input: MaterialMetadata, base: MaterialMetadata & { name: string }): Required<MaterialMetadata> {
  const name = input.name === undefined ? base.name : input.name.trim();
  if (!name) throw new MaterialError('NAME_EMPTY', '给这份素材起个名字吧');
  const tags = input.tags ?? base.tags ?? [];
  if (!Array.isArray(tags) || !tags.every(item => typeof item === 'string')) throw new MaterialError('TAGS_INVALID', '标签需要使用文字');
  return { name, category: input.category ?? base.category ?? '', tags: [...new Set(tags.map(tag => tag.trim()).filter(Boolean))], enabled: input.enabled ?? base.enabled ?? true };
}

/** A local SQLite capability owner. Host wrappers share this same service instance. */
export class MaterialsLibrary {
  private readonly db: DatabaseSync;
  private closed = false;
  constructor(readonly databasePath: string) {
    if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS materials (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, category TEXT NOT NULL,
        tags_json TEXT NOT NULL, enabled INTEGER NOT NULL, current_version INTEGER NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS originals (
        id TEXT PRIMARY KEY, file_name TEXT NOT NULL, format TEXT NOT NULL,
        content_hash TEXT NOT NULL, bytes BLOB NOT NULL, raw_text TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS resources (
        original_id TEXT NOT NULL REFERENCES originals(id), path TEXT NOT NULL,
        media_type TEXT NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(original_id, path)
      );
      CREATE TABLE IF NOT EXISTS versions (
        material_id TEXT NOT NULL REFERENCES materials(id), version INTEGER NOT NULL,
        original_id TEXT NOT NULL REFERENCES originals(id), created_at TEXT NOT NULL,
        raw_json TEXT NOT NULL, projection_json TEXT NOT NULL, capabilities_json TEXT NOT NULL,
        bindings_json TEXT NOT NULL, PRIMARY KEY(material_id, version)
      );
      CREATE INDEX IF NOT EXISTS material_library ON materials(deleted, kind, category, updated_at);
    `);
  }
  private transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = operation(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  private row(id: string): Row {
    const row = this.db.prepare('SELECT * FROM materials WHERE id = ?').get(id);
    if (!row) throw new MaterialError('MATERIAL_NOT_FOUND', '没有找到这份素材');
    return row;
  }
  private saveOriginal(decoded: DecodedMaterial): string {
    const originalId = decoded.contentHash;
    this.db.prepare('INSERT OR IGNORE INTO originals (id, file_name, format, content_hash, bytes, raw_text) VALUES (?, ?, ?, ?, ?, ?)')
      .run(originalId, decoded.fileName, decoded.format, decoded.contentHash, decoded.originalBytes, decoded.rawText);
    for (const resource of decoded.resources) this.db.prepare('INSERT OR IGNORE INTO resources (original_id, path, media_type, bytes) VALUES (?, ?, ?, ?)')
      .run(originalId, resource.path, resource.mediaType, resource.bytes);
    return originalId;
  }
  private saveMetadata(summary: MaterialSummary): void {
    this.db.prepare('INSERT INTO materials (id, name, kind, category, tags_json, enabled, current_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(summary.id, summary.name, summary.kind, summary.category, JSON.stringify(summary.tags), Number(summary.enabled), summary.currentVersion, summary.createdAt, summary.updatedAt);
  }
  private saveVersion(version: MaterialVersion): void {
    this.db.prepare('INSERT INTO versions (material_id, version, original_id, created_at, raw_json, projection_json, capabilities_json, bindings_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(version.id, version.version, version.originalId, version.createdAt, JSON.stringify(version.raw), JSON.stringify(version.projection), JSON.stringify(version.capabilities), JSON.stringify(version.bindings));
  }
  import(input: MaterialInput, metadata: MaterialMetadata = {}): MaterialRecord {
    const decoded = decodeMaterial(input);
    const now = timestamp();
    const summary: MaterialSummary = { id: randomUUID(), kind: decoded.projection.kind, ...normalizedMetadata(metadata, { name: decoded.projection.name }), currentVersion: 1, createdAt: now, updatedAt: now };
    this.transaction(() => {
      const originalId = this.saveOriginal(decoded);
      this.saveMetadata(summary);
      this.saveVersion({ id: summary.id, version: 1, originalId, createdAt: now, raw: decoded.raw, projection: decoded.projection, capabilities: decoded.capabilities, bindings: emptyBindings() });
    });
    return this.get(summary.id);
  }
  createPersona(draft: PersonaDraft): MaterialRecord {
    const raw = personaDocument(draft);
    return this.import({ name: `${draft.name}.persona.json`, bytes: new TextEncoder().encode(JSON.stringify(raw, null, 2)) });
  }
  revisePersona(id: string, draft: PersonaDraft): MaterialVersion {
    const current = this.get(id);
    if (current.kind !== 'persona') throw new MaterialError('PERSONA_KIND', '请选择玩家人设');
    return this.revise(id, { raw: personaDocument(draft, current.current.raw) });
  }
  get(id: string): MaterialRecord {
    const summary = summaryFromRow(this.row(id));
    return { ...summary, current: this.readVersion({ id, version: summary.currentVersion }) };
  }
  list(query: MaterialQuery = {}): MaterialSummary[] {
    const clauses = ['m.deleted = 0'];
    const args: SQLInputValue[] = [];
    if (query.kind !== undefined) { clauses.push('m.kind = ?'); args.push(query.kind); }
    if (query.category !== undefined) { clauses.push('m.category = ?'); args.push(query.category); }
    if (query.enabled !== undefined) { clauses.push('m.enabled = ?'); args.push(Number(query.enabled)); }
    if (query.tag !== undefined) { clauses.push('EXISTS(SELECT 1 FROM json_each(m.tags_json) WHERE value = ?)'); args.push(query.tag); }
    if (query.search) { clauses.push("instr(lower(m.name || ' ' || m.category || ' ' || m.tags_json || ' ' || v.raw_json), lower(?)) > 0"); args.push(query.search); }
    const limit = query.limit === undefined ? -1 : Math.max(0, Math.floor(query.limit));
    const offset = Math.max(0, Math.floor(query.offset ?? 0));
    return this.db.prepare(`SELECT m.* FROM materials m JOIN versions v ON v.material_id = m.id AND v.version = m.current_version WHERE ${clauses.join(' AND ')} ORDER BY m.updated_at DESC, m.id LIMIT ? OFFSET ?`)
      .all(...args, limit, offset).map(summaryFromRow);
  }
  readVersion(ref: MaterialVersionRef): MaterialVersion {
    const row = this.db.prepare('SELECT * FROM versions WHERE material_id = ? AND version = ?').get(ref.id, ref.version);
    if (!row) throw new MaterialError('VERSION_NOT_FOUND', '没有找到这份素材版本');
    return versionFromRow(row);
  }
  versions(id: string): MaterialVersionRef[] {
    this.row(id);
    return this.db.prepare('SELECT version FROM versions WHERE material_id = ? ORDER BY version DESC').all(id).map(row => ({ id, version: rowNumber(row, 'version') }));
  }
  private validateBindings(bindings: MaterialBindings, ownerKind: MaterialKind): MaterialBindings {
    const parsed = parseBindings(validateJson(bindings));
    if (ownerKind !== 'character' && (parsed.worldbooks.length || parsed.preset)) throw new MaterialError('BINDING_OWNER', '只有角色卡可以绑定世界书或预设');
    for (const ref of parsed.worldbooks) if (this.readVersion(ref).projection.kind !== 'worldbook') throw new MaterialError('BINDING_KIND', '请绑定世界书素材');
    if (parsed.preset && this.readVersion(parsed.preset).projection.kind !== 'preset') throw new MaterialError('BINDING_KIND', '请绑定聊天预设');
    return parsed;
  }
  revise(id: string, revision: MaterialRevision): MaterialVersion {
    const current = this.get(id);
    if (revision.raw !== undefined && revision.patch !== undefined) throw new MaterialError('REVISION_CONFLICT', '整份编辑和字段编辑请使用其中一种');
    const raw = revision.raw !== undefined ? validateJson(revision.raw) : revision.patch ? mergeJson(current.current.raw, object(validateJson(revision.patch))) : cloneJson(current.current.raw);
    const projected = projectMaterial(raw, current.name, current.kind);
    if (projected.projection.kind !== current.kind) throw new MaterialError('KIND_CHANGED', '保存编辑时请保留当前素材类型，其他类型可以另行导入');
    const bindings = this.validateBindings(revision.bindings ?? current.current.bindings, current.kind);
    const now = timestamp();
    const version: MaterialVersion = { id, version: current.currentVersion + 1, originalId: current.current.originalId, createdAt: now, raw, ...projected, bindings };
    this.transaction(() => {
      this.saveVersion(version);
      this.db.prepare('UPDATE materials SET current_version = ?, updated_at = ? WHERE id = ?').run(version.version, now, id);
    });
    return this.readVersion(version);
  }
  setBindings(id: string, bindings: MaterialBindings): MaterialVersion { return this.revise(id, { bindings }); }
  /** Remove only the library entry. Referenced immutable versions remain available to old conversations. */
  delete(id: string): void {
    this.row(id);
    this.db.prepare('UPDATE materials SET deleted = 1, updated_at = ? WHERE id = ?').run(timestamp(), id);
  }
  updateMetadata(id: string, metadata: MaterialMetadata): MaterialRecord {
    const current = this.get(id);
    const values = normalizedMetadata(metadata, current);
    this.db.prepare('UPDATE materials SET name = ?, category = ?, tags_json = ?, enabled = ?, updated_at = ? WHERE id = ?')
      .run(values.name, values.category, JSON.stringify(values.tags), Number(values.enabled), timestamp(), id);
    return this.get(id);
  }
  copy(id: string, metadata: MaterialMetadata = {}): MaterialRecord {
    const current = this.get(id);
    const newId = randomUUID();
    const now = timestamp();
    const summary: MaterialSummary = { ...current, ...normalizedMetadata(metadata, { ...current, name: `${current.name} 副本` }), id: newId, currentVersion: 1, createdAt: now, updatedAt: now };
    this.transaction(() => { this.saveMetadata(summary); this.saveVersion({ ...current.current, id: newId, version: 1, createdAt: now }); });
    return this.get(newId);
  }
  private resolve(ref: string | MaterialVersionRef): MaterialVersion { return typeof ref === 'string' ? this.get(ref).current : this.readVersion(ref); }
  exportOriginal(ref: string | MaterialVersionRef): MaterialExport {
    const version = this.resolve(ref);
    const row = this.db.prepare('SELECT * FROM originals WHERE id = ?').get(version.originalId);
    if (!row || !(row.bytes instanceof Uint8Array)) throw new MaterialError('ORIGINAL_NOT_FOUND', '没有找到这份素材原件');
    const format = rowText(row, 'format');
    return { name: rowText(row, 'file_name'), mediaType: format === 'png' ? 'image/png' : format === 'charx' || format === 'zip' ? 'application/zip' : format === 'script' ? 'text/javascript' : 'application/json', bytes: Uint8Array.from(row.bytes) };
  }
  exportCurrent(ref: string | MaterialVersionRef): MaterialExport {
    const version = this.resolve(ref);
    return { name: `${version.projection.name}.json`, mediaType: 'application/json', bytes: new TextEncoder().encode(JSON.stringify(currentJson(version.raw, version.projection.kind), null, 2)) };
  }
  resources(ref: MaterialVersionRef): MaterialResource[] {
    const version = this.readVersion(ref);
    if (version.projection.kind === 'persona') return personaResources(version.raw);
    return this.db.prepare('SELECT * FROM resources WHERE original_id = ? ORDER BY path').all(version.originalId).map(row => {
      if (!(row.bytes instanceof Uint8Array)) throw new MaterialError('RESOURCE_NOT_FOUND', '素材本地资源不完整');
      return { path: rowText(row, 'path'), mediaType: rowText(row, 'media_type'), bytes: Uint8Array.from(row.bytes) };
    });
  }
  exportBundle(refs: readonly MaterialVersionRef[]): MaterialBundle {
    const queued = [...refs];
    const seen = new Set<string>();
    const materials = new Map<string, PortableMaterial>();
    const originals = new Map<string, PortableOriginal>();
    while (queued.length) {
      const ref = queued.shift()!;
      if (seen.has(referenceKey(ref))) continue;
      seen.add(referenceKey(ref));
      const version = this.readVersion(ref);
      const existing = materials.get(ref.id) ?? { metadata: summaryFromRow(this.row(ref.id)), versions: [] };
      existing.versions.push(version);
      materials.set(ref.id, existing);
      queued.push(...version.bindings.worldbooks, ...(version.bindings.preset ? [version.bindings.preset] : []));
      if (!originals.has(version.originalId)) {
        const original = this.db.prepare('SELECT * FROM originals WHERE id = ?').get(version.originalId);
        if (!original || !(original.bytes instanceof Uint8Array)) throw new MaterialError('ORIGINAL_NOT_FOUND', '备份缺少素材原件');
        originals.set(version.originalId, {
          id: version.originalId, fileName: rowText(original, 'file_name'), format: rowText(original, 'format') as MaterialFormat,
          contentHash: rowText(original, 'content_hash'), base64: Buffer.from(original.bytes).toString('base64'),
          resources: this.resources(ref).map(resource => ({ path: resource.path, mediaType: resource.mediaType, base64: Buffer.from(resource.bytes).toString('base64') })),
        });
      }
    }
    for (const material of materials.values()) {
      material.versions.sort((a, b) => a.version - b.version);
      material.metadata.currentVersion = Math.max(...material.versions.map(version => version.version));
    }
    return { format: 'tavern-kit.materials', version: 1, materials: [...materials.values()], originals: [...originals.values()] };
  }
  importBundle(value: unknown): MaterialBundleRestore {
    const bundle = parseBundle(value);
    const ids = new Map(bundle.materials.map(material => [material.metadata.id, randomUUID()]));
    const references = bundle.materials.flatMap(material => material.versions.map(version => ({ from: { id: version.id, version: version.version }, to: { id: ids.get(version.id)!, version: version.version } })));
    const remap = (ref: MaterialVersionRef): MaterialVersionRef => ({ id: ids.get(ref.id)!, version: ref.version });
    this.transaction(() => {
      for (const original of bundle.originals) {
        this.db.prepare('INSERT OR IGNORE INTO originals (id, file_name, format, content_hash, bytes, raw_text) VALUES (?, ?, ?, ?, ?, ?)')
          .run(original.id, original.fileName, original.format, original.contentHash, Buffer.from(original.base64, 'base64'), '');
        for (const resource of original.resources) this.db.prepare('INSERT OR IGNORE INTO resources (original_id, path, media_type, bytes) VALUES (?, ?, ?, ?)')
          .run(original.id, resource.path, resource.mediaType, Buffer.from(resource.base64, 'base64'));
      }
      for (const material of bundle.materials) this.saveMetadata({ ...material.metadata, id: ids.get(material.metadata.id)! });
      for (const material of bundle.materials) for (const version of material.versions) this.saveVersion({
        ...version, id: ids.get(version.id)!, bindings: { worldbooks: version.bindings.worldbooks.map(remap), preset: version.bindings.preset ? remap(version.bindings.preset) : null },
      });
    });
    return { references };
  }
  close(): void { if (!this.closed) { this.closed = true; this.db.close(); } }
}

function parseBundle(value: unknown): MaterialBundle {
  const root = object(validateJson(value));
  if (root.format !== 'tavern-kit.materials' || root.version !== 1) throw new MaterialError('BUNDLE_VERSION', '这份素材备份版本尚未支持');
  if (!Array.isArray(root.materials) || !Array.isArray(root.originals)) throw new MaterialError('BUNDLE_INVALID', '素材备份不完整');
  const originals: PortableOriginal[] = root.originals.map(value => {
    const entry = object(value);
    const id = needString(entry.id, '原件编号');
    const contentHash = needString(entry.contentHash, '原件指纹');
    const base64 = needString(entry.base64, '原件内容');
    if (createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex') !== contentHash || id !== contentHash) throw new MaterialError('BUNDLE_HASH', '素材备份原件校验没有通过');
    const format = needString(entry.format, '原件类型');
    if (!['json', 'png', 'charx', 'zip', 'script'].includes(format) || !Array.isArray(entry.resources)) throw new MaterialError('BUNDLE_INVALID', '素材原件信息不完整');
    return { id, fileName: needString(entry.fileName, '原件文件名'), format: format as MaterialFormat, contentHash, base64, resources: entry.resources.map(value => {
      const resource = object(value);
      const path = needString(resource.path, '资源路径');
      if (path !== 'ccdefault:' && (!path || path.startsWith('/') || /[\\:\u0000-\u001f]/u.test(path) || path.split('/').some(part => part === '..' || part === '.'))) throw new MaterialError('BUNDLE_INVALID', '素材资源路径无效');
      return { path, mediaType: needString(resource.mediaType, '资源类型'), base64: needString(resource.base64, '资源内容') };
    }) };
  });
  const materials: PortableMaterial[] = root.materials.map(value => {
    const entry = object(value);
    const raw = object(entry.metadata);
    const id = needString(raw.id, '素材编号');
    if (!Array.isArray(raw.tags) || !raw.tags.every(item => typeof item === 'string') || typeof raw.enabled !== 'boolean' || !Array.isArray(entry.versions) || !entry.versions.length) throw new MaterialError('BUNDLE_INVALID', '素材资料不完整');
    const metadata: MaterialSummary = { id, name: needString(raw.name, '素材名称'), kind: materialKind(raw.kind), category: needString(raw.category, '素材分类'), tags: raw.tags, enabled: raw.enabled, currentVersion: needNumber(raw.currentVersion, '当前版本'), createdAt: needString(raw.createdAt, '创建时间'), updatedAt: needString(raw.updatedAt, '更新时间') };
    const versions: MaterialVersion[] = entry.versions.map(value => {
      const version = object(value);
      if (version.id !== id || version.raw === undefined) throw new MaterialError('BUNDLE_INVALID', '素材版本所属编号无效');
      const projection = checkProjection(version.projection);
      if (projection.kind !== metadata.kind) throw new MaterialError('BUNDLE_INVALID', '素材版本类型不一致');
      return { id, version: needNumber(version.version, '素材版本'), originalId: needString(version.originalId, '原件引用'), createdAt: needString(version.createdAt, '版本时间'), raw: version.raw, projection, capabilities: parseCapabilities(version.capabilities), bindings: parseBindings(version.bindings) };
    });
    if (!versions.some(version => version.version === metadata.currentVersion)) throw new MaterialError('BUNDLE_INVALID', '素材备份缺少当前版本');
    return { metadata, versions };
  });
  const available = new Map<string, MaterialVersion>();
  const materialIds = new Set<string>();
  for (const material of materials) {
    if (materialIds.has(material.metadata.id)) throw new MaterialError('BUNDLE_INVALID', '素材编号重复');
    materialIds.add(material.metadata.id);
    for (const version of material.versions) {
      const key = referenceKey(version);
      if (available.has(key)) throw new MaterialError('BUNDLE_INVALID', '素材版本重复');
      available.set(key, version);
      if (!originals.some(original => original.id === version.originalId)) throw new MaterialError('BUNDLE_REFERENCE', '素材备份缺少引用的原件');
    }
  }
  for (const version of available.values()) {
    for (const ref of version.bindings.worldbooks) if (available.get(referenceKey(ref))?.projection.kind !== 'worldbook') throw new MaterialError('BUNDLE_REFERENCE', '素材备份缺少引用的世界书版本');
    if (version.bindings.preset && available.get(referenceKey(version.bindings.preset))?.projection.kind !== 'preset') throw new MaterialError('BUNDLE_REFERENCE', '素材备份缺少引用的预设版本');
  }
  return { format: 'tavern-kit.materials', version: 1, originals, materials };
}
