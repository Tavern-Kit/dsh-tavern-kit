import { zipArchive } from './host-runtime.js';

// A fixed official-format v3 ZIP with two conversations. Independent of the importer under test.
const base64 = 'UEsDBBQAAAAIAPM2cl0fyGIjHQAAABsAAAANAAAAbWFuaWZlc3QuanNvbqtWSq0oyC8qiU/LL8pNLIkvSy0qzszPU7IyrgUAUEsDBBQAAAAIAPM2cl1SmtMCRQAAALsAAAAXAAAAY2hhdF9zZXNzaW9uX2luZGV4Lmpzb26LrlbKTFGyUipOzUlNLklNUdJRyswrTi0CMuMTS4ASRgZGZrqGhrqGFiEGBlZgFAVUVFqQkohfTa0O1Oi8/BJdGhgfCwBQSwMEFAAAAAgA8zZyXQaJo/gkAQAA5gEAABsAAABjaGF0X3Nlc3Npb25zL3NlbGVjdGVkLmpzb26rVspMUbJSKk7NSU0uSU1R0lEqySzJSQUKPdu6/cW+nc9ntTzftezpullAmcy84tQioKL4xBKgvJGBkZmuoaGuoUWIgYEVGEUBFSWXFhWl5pXE56YWFyemp8aDjDfSUYJyi5WsoiFWGuooFSSCVYJ4eaU5OTpKRflgm0ODXYOAJhWXJJaUAjUouXn6eQZ7uLoQ64S0osT0XKDJEMtKKgtAhga5Boa6BoeAXJifVwKUBYo92bvgxf4ZL9ZteLpv+rOOiU92r4F79+mE6Uq1sbU6EMcCPYDkWKDToS51DA72DA5x9AMZS23nBgf4+wW7orj36d7Jz1u2vd/T83RD/9NNs19O3Q9kQx0OdPXSvc+mL30xAUhue9rW+2J54+OGJpAnYmsBUEsDBBQAAAAIAPM2cl14/JLe9AAAAK4BAAAfAAAAY2hhdF9zZXNzaW9ucy9ub3Qtc2VsZWN0ZWQuanNvbqtWykxRslLKyy/RLU7NSU0uSU1R0lEqySzJSQUKP9nR+2JZ44v9jU9bl77YP/PZuq1Aycy84tQioLr4xBKgEiMDIzNdQ0NdQ4sQAwMrMIoCKkouLSpKzSuJz00tLk5MT40H2WKkowTlFitZRUNsNtRRKkgEqwTx8kpzcnSUivLBlocGuwYBTSouSSwpBWpQcvP08wz2cHUh1glpRYnpuUCTIZaVVBaADA1yDQx1DQ4BuTA/rwQoCxR72r/syY4GkOdqY2t1IO4CuhXJXUBXQh3lGBzsGRzi6AcygdouCw7w9wt2RXEaMAJeNnQ+2bEW5LTYWgBQSwECFAAUAAAACADzNnJdH8hiIx0AAAAbAAAADQAAAAAAAAAAAAAAAAAAAAAAbWFuaWZlc3QuanNvblBLAQIUABQAAAAIAPM2cl1SmtMCRQAAALsAAAAXAAAAAAAAAAAAAAAAAEgAAABjaGF0X3Nlc3Npb25faW5kZXguanNvblBLAQIUABQAAAAIAPM2cl0GiaP4JAEAAOYBAAAbAAAAAAAAAAAAAAAAAMIAAABjaGF0X3Nlc3Npb25zL3NlbGVjdGVkLmpzb25QSwECFAAUAAAACADzNnJdePyS3vQAAACuAQAAHwAAAAAAAAAAAAAAAAAfAgAAY2hhdF9zZXNzaW9ucy9ub3Qtc2VsZWN0ZWQuanNvblBLBQYAAAAABAAEABYBAABQAwAAAAA=';
export const deepseekArchive = (): Uint8Array => new Uint8Array(Buffer.from(base64, 'base64'));
export const materialBytes = (): Uint8Array => new TextEncoder().encode(JSON.stringify({
  spec: 'chara_card_v3', spec_version: '3.0', sourceExtension: '保留原字段',
  data: { name: '阿岚', description: '海边的药师。你叫我小岛长，我们约好日落时见。', first_mes: '', extensions: { unknownAuthor: { preserved: true } } },
}));

/** Literal v3 source messages, including empty, failed and filtered replies. */
export async function sourceStateArchive(): Promise<Uint8Array> {
  const at = '2026-11-18T00:00:00Z';
  const pairs = [
    { input: '正常的问题', status: 'FINISHED', reply: '最初保留的回复。', reasoning: '正常思考' },
    { input: '空回复的问题', status: 'FINISHED', reply: '', reasoning: '' },
    { input: '失败的问题', status: 'FAILED', reply: '失败的部分文字', reasoning: '失败思考' },
    { input: '被过滤的问题', status: 'CONTENT_FILTER', reply: '不应迁入的内容', reasoning: '' },
    { input: '最后的问题', status: 'FINISHED', reply: '最后保留的回复。', reasoning: '' },
  ];
  const messages = pairs.flatMap((pair, index) => {
    const userId = index * 2 + 1;
    return [
      { id: userId, parent_id: index ? userId - 1 : null, role: 'USER', status: 'FINISHED', inserted_at: at, fragments: [{ type: 'REQUEST', content: pair.input }] },
      { id: userId + 1, parent_id: userId, role: 'ASSISTANT', status: pair.status, inserted_at: at, fragments: [{ type: 'THINK', content: pair.reasoning, elapsed_secs: 1 }, { type: 'RESPONSE', content: pair.reply }] },
    ];
  });
  const json = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
  return zipArchive({
    'manifest.json': json({ export_format_version: 3 }),
    'chat_session_index.json': json([{ id: 'source-states', inserted_at: at, updated_at: at }]),
    'chat_sessions/source-states.json': json({ id: 'source-states', title: '来源状态保留', inserted_at: at, current_message_id: 10, messages }),
  });
}
