import type { JsonObject } from '@tavern-kit/rp-materials/types';

/** JSON-only MVU carrier; unknown persisted extension fields survive round trips. */
export interface MvuState extends JsonObject {
  stat_data: JsonObject;
  schema: JsonObject;
  initialized_lorebooks: JsonObject;
  display_data: JsonObject;
  delta_data: JsonObject;
}

export interface MvuIssue {
  code: string;
  message: string;
  source?: string;
  offset?: number;
}

export interface MvuResult {
  state: MvuState;
  issues: MvuIssue[];
}

export type MvuExpand = (text: string) => string;

export interface MvuBook {
  id: string;
  name: string;
  entries: { id?: string; comment: string; content: string }[];
}
