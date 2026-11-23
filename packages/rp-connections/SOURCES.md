# Sources and licenses

Tavern Kit is distributed under AGPL-3.0-only.

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), verified against 0.2.2-rc.3, MIT: existing providers, settings mutations, credential records and typed remote services. This package keeps credential ownership in the DSH facility rather than creating another key vault. The fixed-version public `dsh-llm-pi-ai/src/discovery.ts` helper supplies actual endpoint model discovery for pi-ai routes, including saved headers and the existing credential reference; it does not add an adapter or change the active profile. The original MIT notice is included in `DEEPSEEK-MIT.txt`.
- [pi-ai 1.5.2](https://github.com/earendil-works/pi/tree/v1.5.2/packages/ai), MIT: the SDK catalog used by the fixed-version official discovery helper. Its original repository license at the same release tag is preserved in `PI-AI-MIT.txt`; actual bundled dependency notices are collected in `lib/THIRD_PARTY_NOTICES.txt`.
- [models.dev](https://github.com/anomalyco/models.dev), MIT: public model capability metadata used by the online catalog. Capability matching runs locally and source provenance remains visible. Catalog prices are not used as relay prices.
- [new-api](https://github.com/QuantumNous/new-api), AGPL-3.0: public endpoint behavior checked against v0.13.2 and v1.0.0-rc.51 authentication families. The account adapter implements those HTTP contracts; no server implementation, database data, private error pattern or private rendering template is copied.
- [tough-cookie](https://github.com/salesforce/tough-cookie), BSD-3-Clause: Host-side account cookie handling.
- [Zod](https://github.com/colinhacks/zod), MIT: external-data and configuration validation.

Sponsor templates are maintained as a separate static list. They do not participate in capability matching or fallback ordering.
