# Sources and licenses

Tavern Kit is distributed under AGPL-3.0-only. The format, archive and conversation conversion reused by this plugin come from [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), specifically @deepseek-ai/dsh-deepseek-chat-import **0.2.2-rc.3**, licensed MIT, Copyright (c) 2026 DeepSeek. The full original license is included in DEEPSEEK-MIT.txt.

The pinned source exports `src/archive.ts`, `src/format.ts` and `src/conversation.ts` provide ZIP reading, format validation, active-ancestor selection and text conversion. This package adds preview, per-conversation selection, source fingerprints and direct materialization into the RP owner store. It does not copy the official native Session persistence layer.

[fflate](https://github.com/101arrowz/fflate), MIT, and [Zod](https://github.com/colinhacks/zod), MIT, are used through the fixed official format dependency. The compiler bundles these source exports while retaining the MIT notice. [dsh-chat-migration](https://github.com/niushuanan/dsh-chat-migration/tree/6c0e1724f321b611adce04ebe44adc10dca42eac), MIT, was consulted for parse/preview/materialize separation; its profile and old Session writer are not distributed.

## SillyTavern JSONL

The local JSONL adapter is this project's implementation. Its standard one-to-one header/message interpretation was checked against [SillyTavern 1.18.0, commit 063141e433ac8bcd8eaeaa2c072c2ced299e61a4](https://github.com/SillyTavern/SillyTavern/tree/063141e433ac8bcd8eaeaa2c072c2ced299e61a4), AGPL-3.0. The relevant source is `public/script.js` (`ensureSwipes`, `syncMesToSwipe`, `syncSwipeToMes`, chat save header), `src/endpoints/chats.js` (JSONL import/export), `public/scripts/utils.js` (legacy UTC timestamps) and `public/scripts/reasoning.js` (`extra.reasoning`). Original `mes`/`extra` are authoritative for the active reply; inactive swipe occurrences and their own metadata remain separate.

Physical JSONL framing and independent edge-case examples were also compared with [dsh-Go, commit 246f503a1f51720091cbef173150fdf3939a23d4](https://github.com/ccch1mneyyy/dsh-Go/tree/246f503a1f51720091cbef173150fdf3939a23d4), AGPL-3.0: `packages/dsh_tavern/lib/src/io/st_chat_document.dart`, `packages/dsh_tavern/lib/src/io/chat_jsonl.dart` and `packages/dsh_tavern/test/chat_jsonl_test.dart`. No Dart runtime or app code is bundled. The handwritten test fixture uses synthetic people and messages, not a private chat.

The adapter retains original bytes and fingerprints them separately from source identity. A nonempty `chat_metadata.integrity` yields a namespaced source ID; legacy exports use filename, people and original start time. Renaming an export without integrity creates a different source identity. System events, extensions and unknown fields stay in the source file instead of becoming executable instructions. Original authors' code licenses remain unchanged.
