# 模型连接

Tavern Kit 的独立 DSH 插件，支持沿用已有连接、自定义模型服务、模型列表与能力调整、备用链，以及 new-api 站点账号。

## 使用

在「连接模型」中选择「沿用 DSH 现有连接」，或添加名称、API 地址、聊天 key 和协议。保存连接不会替任何对话切换模型；在聊天设置中选定要用于该段对话的连接。

模型请求保留服务返回的原始 ID，包含前缀、方括号与斜杠。刷新模型列表会保留手填项、已选模型、别名与人工配置。高级设置可确认基础模型匹配、调整输入预算与能力，以及按顺序设置跨连接备用链。备用默认关闭，配置时「400 报错时也换备用」初始开启。

「站点账号」分别设置账号站点地址与模型 API 地址，支持原版 new-api v0.13.2 的登录／二步验证，以及 v1.0.0-rc.51 的登录验证、JWT 刷新会话与个人访问令牌。查看分组不会更改已有 key 的业务分组；选中一个已有 key 并点击「用于聊天」才会绑定。退出账号与解除聊天 key 分开操作。

账户与聊天 key 的秘密通过 DSH 凭据服务保存。读取连接与账号信息只返回界面所需状态，不返回已保存的 key、密码、认证令牌或 Cookie。账号额度和当前 key 额度分别显示，保留站点的单位、换算与无限额状态。

能力目录随包附带基础快照，可下载完整 models.dev 公开元数据更新。模型匹配在本地进行；更新失败继续使用原有资料。目录不提供中转站价格。

## 公开集成

基线为 DSH 0.2.2-rc.3。Host 服务名与 Remote 命名空间均为 `rpConnections`，通过 Cordis `inject` 消费。Host 使用公开 `llm`、`settings`、`credentials` 和 `typert`；配置以原有 adapter 的 settings namespace 按字段更新，保留未知字段和凭据引用。

主要方法包括：

- `listConnections`、`listAdapters`、`saveConnection`、`discoverModels`
- `setPreference`、`setModelOverride`、`capabilities`
- `resolveRoute`、`resolveCall`、`getFallback`、`fallbackOn400`
- `listAccounts`、`saveAccount`、`status`、`login`、`verify`、`loginPat`
- `self`、`groups`、`models`、`listKeys`、`bindKey`
- `accountBalance`、`keyBalance`、`logout`、`clearCredential`

`Route`、调用参数、模型与账号公共类型由 `@tavern-kit/rp-connections/types` 导出。实际请求及候选的备用执行归 RP 会话插件；连接插件只提供路由、能力及默认链，不接收聊天正文。

存在 DSH 工具服务时，插件提供普通助手工具 `tavern_connections`，与界面调用相同 Host 方法。该工具用于查看连接、拉取现有连接的模型、能力识别和偏好调整。登录、凭据保存、获取 key、绑定和解除由玩家在界面完成。

Client 从公开生成贡献挂载 Remote 后，再注册主面板与侧栏入口。插件使用宿主 React，不替换应用根节点。社区伙伴清单为独立静态数据；点击模板后才填写地址，不自动选择连接、模型或备用顺序。

## 验证

本包测试覆盖共享配置与凭据引用、原始模型 ID、模型目录匹配、备用分类、普通助手工具、两种 new-api 认证族的本地 HTTP 会话，以及使用真实领域服务的面板交互。模型目录来源许可见 [models.dev 许可](docs/models-dev-license.txt)。
