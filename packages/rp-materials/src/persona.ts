import { z } from 'zod';
import { MaterialError, object } from './json.js';
import type { JsonObject, JsonValue, MaterialResource, PersonaAvatar, PersonaDraft, PersonaProjection } from './types.js';

const avatarSchema: z.ZodType<PersonaAvatar> = z.object({
  name: z.string().min(1),
  mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  base64: z.string().min(4).max(12 * 1024 * 1024).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u),
}).strict();
export const personaDraftSchema: z.ZodType<PersonaDraft> = z.object({
  name: z.string().trim().min(1, '给人设起个昵称吧'),
  description: z.string(),
  avatar: avatarSchema.nullable().optional(),
}).strict();
const avatarPath = (avatar: PersonaAvatar) => `persona/avatar.${avatar.mediaType === 'image/jpeg' ? 'jpg' : avatar.mediaType === 'image/webp' ? 'webp' : 'png'}`;

/** The avatar stays in the versioned document; projection carries only a local resource path. */
export function readPersona(raw: JsonValue): { projection: PersonaProjection; avatar?: PersonaAvatar } {
  const root = object(raw);
  if (root.format !== 'tavern-kit.persona' || root.version !== 1) throw new MaterialError('PERSONA_VERSION', '这份玩家人设版本尚未支持');
  if (typeof root.name !== 'string' || !root.name.trim() || typeof root.description !== 'string') throw new MaterialError('PERSONA_INVALID', '玩家人设需要昵称与人物设定');
  let avatar: PersonaAvatar | undefined;
  if (root.avatar !== undefined && root.avatar !== null) {
    const result = avatarSchema.safeParse(root.avatar);
    if (!result.success) throw new MaterialError('PERSONA_AVATAR', '请选择本地 PNG、JPEG 或 WebP 头像');
    avatar = result.data;
  }
  return { projection: { name: root.name, description: root.description, ...(avatar ? { avatarPath: avatarPath(avatar) } : {}) }, ...(avatar ? { avatar } : {}) };
}

export function personaDocument(input: PersonaDraft, previous?: JsonValue): JsonObject {
  const parsed = personaDraftSchema.safeParse(input);
  if (!parsed.success) throw new MaterialError('PERSONA_INVALID', parsed.error.issues.some(issue => issue.path[0] === 'avatar') ? '请选择本地 PNG、JPEG 或 WebP 头像' : '玩家人设需要昵称与人物设定');
  const draft = parsed.data;
  const root = previous === undefined ? {} : object(previous);
  if (previous !== undefined) readPersona(previous);
  return { ...structuredClone(root), format: 'tavern-kit.persona', version: 1, name: draft.name, description: draft.description,
    ...(draft.avatar === undefined ? {} : { avatar: draft.avatar === null ? null : { ...draft.avatar } }),
  };
}

export function personaResources(raw: JsonValue): MaterialResource[] {
  const { avatar } = readPersona(raw);
  if (!avatar) return [];
  return [{ path: avatarPath(avatar), mediaType: avatar.mediaType, bytes: Uint8Array.from(atob(avatar.base64), character => character.charCodeAt(0)) }];
}
