# 溪间四时：受控的 xi4u 3D 庭院

庭院保留原作程序化 3D 回廊、古树、溪流、木桥、植被、动物和四季物件。正常路径使用 Three.js 场景；加载与错误时才显示本地静态院景。该目录只拥有展示，不读取对话、模型、凭据或外观偏好的持久化数据。

## 接入

[入口](<./index.tsx>)公开：

```tsx
import { Xi4uScene } from './xi4u/index.js';

<Xi4uScene season="spring" scheme="light" className="my-garden" />
```

```ts
function Xi4uScene(props: {
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  scheme: 'light' | 'dark';
  className?: string;
}): React.ReactElement;
```

父布局给出确定高度；组件占满这块区域，不给整个页面设置高度。同一视图挂载一处真实庭院，画布不要放在按钮内部。四季与已解析的浅／深配色由外部传入，偏好持久化和系统配色监听归外观插件。浅色固定原作时钟 12 点，深色固定 22 点；时钟不自行推进，不自动换季。

低层[控制器](<./garden.ts>)提供 `createGarden(host, appearance, onError, graphics?)`，返回 `update(appearance)` 和幂等 `dispose()`。可选 `graphics` 仅替换浏览器 GPU 渲染表面，不替换真实庭院场景图。React 接入通常无需调用这个接口。

## 生命周期与错误

[生命周期适配器](<./lifecycle.ts>)统一持有一条 `requestAnimationFrame`：后台标签、离屏、零尺寸时取消；恢复可见时重置计时，避免补跑后台时间。减少动态时保留静止的真实庭院，季节或配色变更仍重绘，不恢复常驻帧循环。OrbitControls 在绘制中发出的更新合并到当前帧，避免重入。

卸载清理帧、可见性／尺寸／媒体查询监听、控件与临时 Control 键监听，释放共享几何、材质、纹理、渲染目标、阴影和 WebGL 上下文，移除自身画布并还原自身局部背景。只在组件宿主设置 `--xi4u-background`，不修改 document、body、html、标题、语言或 meta。

初始化、绘制及 WebGL 上下文丢失会结束当前实例，保留真实错误和「重试庭院」。重试重新创建实例；卸载后的异步加载不会挂载新画布。错误与加载时的[静态院景](<./StaticGarden.tsx>)使用本地 SVG，无远程资源。

## 原作与许可

来源：[annac777/xi4u](https://github.com/annac777/xi4u)，固定提交 `336d2a38ed8c170a4599493f1bc20c6c1ef7962c`。原作者为 AC，Copyright (c) 2026 AC；保留完整 [MIT 许可](<./LICENSE>)及各 vendor 文件的来源头。Three.js 依赖固定 `0.180.0`（MIT）；项目自己的严格类型外壳使用当前仓库许可。

[vendor 目录](<./vendor/world.js>)来自原作 `app/*.ts` 的 31 个场景模块，去除 TypeScript 语法后作为明确的 JavaScript 第三方边界保存。上游大量使用隐式 JavaScript 与 `@ts-nocheck`；本移植未把它们伪称为已经逐行严格类型化，也没有降低项目 strict 设置或在外壳中新增 `any`、忽略注释。公开边界由[类型](<./types.ts>)和 [world 声明](<./vendor/world.d.ts>)约束。

没有复制原作完整页面、音乐、字体、工具面板、MCP、天气／昼夜自动时间线。音乐没有独立逐曲来源资料，因此不随本目录分发。场景纹理、几何和四季物件仍由原作本地程序生成。

### 可复现更新

在仓库根目录，已存在参考克隆且提交完全匹配时运行：

```sh
node packages/rp-appearance/src/xi4u/sync-vendor.mjs
```

[同步脚本](<./sync-vendor.mjs>)校验固定提交，不安装依赖、不运行或修改参考项目；使用工作区已有 esbuild 输出 vendor JavaScript，并逐字复制原作许可。集成改动集中在脚本内：

- 原作几何与动物模块保留；默认使用原生清晰风格，DPR 上限 2、阴影 2048。
- 移除原作页面级 RAF、尺寸监听、自动昼夜／天气与全局背景写入，改为局部宿主和外部四季／配色。
- 竖屏取景以自身宿主的 8px 内边距计算，不依赖原网页的页头或控制面板。
- 增加初始化中断的资源释放、共享资源去重释放和上下文丢失处理。
- 为 Three.js 0.180.0 补清理 OrbitControls 临时注册的 Control `keyup` 监听。这一版本绑定留在 vendor 集成处，不扩散到公开类型。

## 验证

```sh
node node_modules/vitest/vitest.mjs run \
  packages/rp-appearance/src/xi4u/lifecycle.test.ts \
  packages/rp-appearance/src/xi4u/world.test.ts \
  packages/rp-appearance/src/xi4u/Xi4uScene.test.tsx
```

测试使用真实 Three.js 场景图、季节模块、材质和时钟；仅替代 jsdom 不具备的 WebGL、Canvas 2D 与浏览器可见性信号。覆盖原作场景与动物存在、固定四季／昼夜、共享资源只释放一次、局部背景／键盘监听清理、初始 GPU 失败、挂载后上下文丢失、React 错误重试、后台／离屏／减少动态与绘制重入。

这些检查不代替真实 GPU 的取景、着色、手机触摸、帧率与最终主题布局验收；浏览器检查由集成者在同一预览环境完成。
