import type { Sponsor } from './types.js';

/** A reviewed, versioned list; importing it never selects or changes a route. */
export const sponsors: readonly Sponsor[] = Object.freeze([
  { id: 'rua-chat', name: 'rua.chat', description: '提供模型 API 服务，采用好事岛界面，站内有多种优惠活动。好事岛主题也由站长提供给 Tavern Kit。', logo: 'assets/rua-chat.png', siteURL: 'https://api.rua.chat', apiURL: 'https://api.rua.chat/v1', label: '社区共创伙伴' },
]);
