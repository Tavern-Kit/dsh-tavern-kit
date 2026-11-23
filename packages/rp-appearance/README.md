# 换个装扮

Tavern Kit 的外观插件，内置经典酒馆、好事岛、像素旅店和溪间四时。四套主题使用相同功能与数据契约，各自提供布局、浅／深配色、字体、插画和控件材质；溪间四时展示原作 3D 四季庭院。

在侧栏打开「换个装扮」，可选择主题、跟随系统或固定浅／深色、切换庭院四季，并调整聊天字号、阅读宽度、消息气泡与本地背景。季节、配色和阅读偏好分别持久化，刷新与重连后恢复。「导出这套偏好」仍生成偏好 JSON；「导出主题」带走完整主题 ZIP。

## 主题文件

[内置主题](<./themes/>)与导入文件采用同一解析、应用和导出路径。ZIP 根目录包含 `theme.json`、`layout.css`，其余为本地字体、插画、预览与完整许可。原始描述和全部资源保留；导出不依赖接收环境的字体或图片。可以用内置主题的描述文件和样式作为起点。

导入后可以预览、选择和再次导出。遇到同 ID 文件时，先展示名称、版本、作者与预览，玩家明确确认后才替换。主题 CSS 使用成熟 AST 解析，限定在 RP 区域；资源只从包内解析，不执行主题脚本或加载远程素材。

## 集成

- Host 服务 `rpAppearance`：`get()`、`update(patch)`、`reset()`、`export()` 管理显示偏好；`listThemes()`、`getTheme(id)`、`importTheme(input)`、`exportTheme(id)` 管理本地主题。公共类型见[类型出口](<./src/types.ts>)。
- Client `rpAppearanceUi.open()` 打开管理页；`renderScene('home' | 'chat')` 返回订阅自身偏好与系统配色的展示组件。聊天持有实际场景区域，同一视图只挂载一处庭院。
- `--tk-*` token 与主题 CSS 作用于 `.tk-rp`。`data-tk-skin`、`data-tk-scheme`、`data-tk-season`、`data-tk-bubbles` 分别表达主题、已解析配色、季节与气泡。
- 设置命名空间为 `tavern-kit-rp-appearance`，通过 DSH settings 保存，不把自定义主题 ID 写入内置 `ui-theme`。外观不读取聊天、模型或凭据。
- Client 使用宿主 React、公开 slot、`ctx.theme.overrideTokens()` 和生成的严格 Remote。卸载清理媒体查询监听、样式与覆盖层，并恢复原有属性；庭院的 GPU 和可见性清理由[受控场景组件](<./src/xi4u/README.md>)管理。
- 各主题带齐本地字体和许可。经典酒馆、好事岛、溪间四时的中文使用设备字体，拉丁与数字使用 Nunito；像素旅店使用 Fusion Pixel 简中字库。切换主题保留已有字号、宽度、气泡和自定义背景。

## 验证

```sh
node node_modules/vitest/vitest.mjs run packages/rp-appearance/src
```

测试覆盖真实主题 ZIP 往返、原件与资源保留、覆盖确认、本地导入、偏好与系统配色、独立季节、Host／工具共用操作、管理页和卸载清理。实际组合布局与真实 GPU 的效果由集成环境检查。

来源与字体许可见[来源说明](<./SOURCES.md>)；每个主题的描述分别列出包内许可文件，庭院代码另保留其原始 MIT 许可。
