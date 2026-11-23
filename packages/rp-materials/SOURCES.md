# Sources and licenses

This package is distributed under **AGPL-3.0-only** as part of Tavern Kit.
The original containers and imported user documents remain data; the package does not execute imported scripts or retrieve remote resources.

The TypeScript implementation uses the following format and behavior references:

- `src/projection.ts` includes adapted format identification and normalization code under **AGPL-3.0-only**. The modified source and full license accompany this package.
- [SillyTavern](https://github.com/SillyTavern/SillyTavern/tree/063141e433ac8bcd8eaeaa2c072c2ced299e61a4), `src/character-card-parser.js`, `public/scripts/PromptManager.js`, `public/scripts/world-info.js`, `public/scripts/personas.js`, and `public/scripts/extensions/regex/engine.js` — **AGPL-3.0**. References for `ccv3` before `chara`, ST prompt order/depth, worldbook field semantics, player nickname/description, and regex placement identifiers. The local regex trial follows ST's capture substitution and trim rules; its inputs and output remain an unsaved preview. The package projects supported character, worldbook, preset and regex fields for use at runtime while retaining other source fields.
- [ccch1mneyyy/dsh-Go](https://github.com/ccch1mneyyy/dsh-Go/tree/246f503a1f51720091cbef173150fdf3939a23d4), `packages/dsh_tavern/lib/src/io/card_codec.dart`, `packages/dsh_tavern/lib/src/persona.dart`, and `packages/dsh_tavern/lib/src/store/persona_store.dart` — **AGPL-3.0**. References for separating original complete bytes, editable JSON, normalized runtime data, embedded/local resources, and reusable nickname/description/avatar records. Tavern Kit stores its `tavern-kit.persona` version 1 documents in the same immutable material version library, with avatar resources derived from the selected version. Its Flutter application and runtime are not included.
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), verified against installed **0.2.2-rc.3** — **MIT**. Its Host/lifecycle documentation informs service ownership and cleanup; the domain library exposes `close()` for its owning Host lifecycle. It does not change the installed DSH or user profile.

Container and JSON libraries retain their own licenses:

| Package | License | Use |
|---|---|---|
| [fflate](https://github.com/101arrowz/fflate) | MIT | ZIP/CharX extraction |
| [png-chunks-extract](https://github.com/hughsk/png-chunks-extract) | MIT | PNG chunk extraction and CRC validation |
| [png-chunk-text](https://github.com/hughsk/png-chunk-text) | MIT | PNG tEXt decoding |
| [jsonrepair](https://github.com/josdejong/jsonrepair) | ISC | Reading common repaired JSON exports without altering original bytes |

Node's built-in SQLite, cryptography, text and compression APIs provide local persistence, content fingerprints and extended PNG text decoding. No network client or model dependency is used by this package.
