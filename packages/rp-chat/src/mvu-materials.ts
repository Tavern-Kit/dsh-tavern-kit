import type { MaterialVersion } from '@tavern-kit/rp-materials/types';
import type { MvuBook } from './mvu/types.js';

/** Captured material versions supply init data, including disabled initvar entries. */
export function mvuBooks(materials: readonly MaterialVersion[]): MvuBook[] {
  return materials.flatMap(material => {
    const book = material.projection.worldbook;
    return book ? [{ id:`${material.id}@${material.version}`, name:book.name, entries:book.entries.map(entry=>({id:entry.id,comment:entry.name,content:entry.content})) }] : [];
  });
}
export function isMvuEnabled(materials: readonly MaterialVersion[], setting?: boolean, text = ''): boolean {
  if (setting !== undefined) return setting;
  if (mvuBooks(materials).some(book=>book.entries.some(entry=>/\[initvar\]/i.test(entry.comment)))) return true;
  const sources = [text, ...materials.flatMap(material => {
    const p=material.projection;
    return [...(p.character ? [p.character.firstMessage,p.character.description,p.character.systemPrompt,p.character.postHistoryInstructions] : []),...(p.worldbook?.entries.map(entry=>entry.content)??[]),...(p.preset?.prompts.map(entry=>entry.content)??[])];
  })];
  return sources.some(source=>/<(?:initvar|UpdateVariable|JSONPatch)\b|{{\s*(?:get|format)_message_variable\s*::/i.test(source));
}
