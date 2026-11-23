import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools';
import { object } from './catalog.js';
import { overrideSchema, preferenceSchema, routeSchema } from './schemas.js';
import type RpConnections from './host.js';

export type ConnectionsToolPort = Pick<RpConnections, 'listConnections' | 'listAdapters' | 'discoverModels' | 'capabilities' | 'resolveRoute' | 'setPreference' | 'setModelOverride' | 'updateCatalog'>;

/** Ordinary-assistant actions never grant, reveal, bind or clear credentials. */
export function connectionsTool(host: ConnectionsToolPort): ToolDefinition {
  return defineTool({
    name: 'tavern_connections',
    description: '查看模型连接、拉取现有连接模型、识别模型能力，以及调整模型别名、预算和备用链。备用链默认在出字前报错时尝试下一条，errorPatterns 留空匹配所有错误，也可填文字或 /表达式/i。登录与密钥绑定在连接界面操作。',
    parameters: {
      action: { type: 'string', required: true, enum: ['list', 'adapters', 'discoverModels', 'capabilities', 'resolveRoute', 'setPreference', 'setModelOverride', 'updateCatalog'] },
      provider: { type: 'string', description: '现有连接的 provider 标识。' },
      model: { type: 'string', description: '原始模型 ID，保留前缀、方括号和斜杠。' },
      input: { type: 'json', description: 'resolveRoute 的路由、setPreference 的偏好或 setModelOverride 的能力字段。' },
    },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute(args, exec): Promise<string> {
      exec.signal.throwIfAborted();
      const provider = (): string => { if (!args.provider) throw new TypeError('先选择模型连接'); return args.provider; };
      const model = (): string => { if (!args.model) throw new TypeError('先填写原始模型 ID'); return args.model; };
      let result: unknown;
      switch (args.action) {
        case 'list': result = await host.listConnections(); break;
        case 'adapters': result = await host.listAdapters(); break;
        // Use only this existing route; model tools cannot send its key to a new endpoint.
        case 'discoverModels': result = await host.discoverModels({ provider: provider() }); break;
        case 'capabilities': result = await host.capabilities({ provider: provider(), model: model() }); break;
        case 'resolveRoute': result = await host.resolveRoute(routeSchema.parse(args.input)); break;
        case 'setPreference': result = await host.setPreference({ provider: provider(), preference: preferenceSchema.strict().parse(args.input) }); break;
        case 'setModelOverride': result = await host.setModelOverride({ provider: provider(), model: model(), override: overrideSchema.strict().parse(args.input) }); break;
        case 'updateCatalog': result = await host.updateCatalog(); break;
      }
      exec.signal.throwIfAborted();
      return JSON.stringify(result ?? object(result));
    },
  });
}
