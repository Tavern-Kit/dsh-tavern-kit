# 来源与许可

本包源码采用 AGPL-3.0-only。

- DeepSeek Harness 0.2.2-rc.3 的官方开发文档与公开 Client／设置／主题接口用于集成核对，DSH 保持其 MIT 许可。未复制其内部客户端模块。
- 经典酒馆、好事岛、像素旅店与溪间四时分别提供独立配色、布局和本地素材；[animal-island-ui](https://github.com/guokaigdg/animal-island-ui) 为好事岛的视觉参考，保持 MIT 许可。本包窗灯书月、读信兔子、花茶、像素旅店及主题包静态预览均为原创 SVG；像素图由整数网格矩形与阶梯路径绘制，未引入游戏素材。布局、字体与本地插画保存在各自的[主题目录](<./themes/>)，内置和导入文件采用同一解析与导出路径。
- 溪间四时的真实庭院来自 [annac777/xi4u](https://github.com/annac777/xi4u)，固定提交 `336d2a38ed8c170a4599493f1bc20c6c1ef7962c`，Copyright (c) 2026 AC，MIT。完整许可及 31 个 vendor 模块的移植差异、更新方法见[庭院说明](<./src/xi4u/README.md>)与[原始许可](<./src/xi4u/LICENSE>)；主题导出另带[该许可的原文副本](<./themes/xi4u/licenses/XI4U-MIT.txt>)。展示接入去除原作全局页面修改与自动时间线，由玩家季节和已解析配色控制；不分发缺少逐曲来源资料的音乐。
- Three.js `0.180.0`（MIT）用于随插件发布的受控庭院渲染器，原始许可见[THREE-MIT.txt](<./licenses/THREE-MIT.txt>)。展示只操作自身区域，卸载和可见性清理由庭院外壳管理，不由主题文件执行脚本。
- fflate `0.8.3`（MIT）用于完整本地 ZIP，css-tree `3.2.1`（MIT）用于 CSS AST 和本地资源解析，`@xmldom/xmldom` `0.8.15`（MIT）用于本地 SVG 结构读取。已安装版本的原始许可逐字节保存在[FFLATE-MIT.txt](<./licenses/FFLATE-MIT.txt>)、[CSS-TREE-MIT.txt](<./licenses/CSS-TREE-MIT.txt>)、[XMLDOM-MIT.txt](<./licenses/XMLDOM-MIT.txt>)。
- Nunito 通过 `@fontsource/nunito` 5.3.0 提供，Copyright 2014 The Nunito Project Authors (https://github.com/googlefonts/nunito)，按 SIL Open Font License 1.1 分发。完整字体许可保存在同包 `NUNITO-OFL.txt`，字体许可不因源码许可变化。
- Fusion Pixel Font 来自 [TakWolf/fusion-pixel-font 2026.11.10](https://github.com/TakWolf/fusion-pixel-font/releases/tag/2026.11.10) 的原始发布包 `fusion-pixel-font-12px-proportional-otf.woff2-v2026.11.10.zip`。本包仅使用未修改的 `fusion-pixel-12px-proportional-zh_hans.otf.woff2`（694824 字节，SHA-256 `4f0ccc75b874c97b79d0cbfa5babcd51d1fdc7da5be4ddc7f2895ccae3bc301d`），以 SIL Open Font License 1.1 随包提供。原始 Fusion Pixel、Ark Pixel、Cubic 11 与 Galmuri 四份版权／许可全文保存在 `src/assets/fusion-pixel/`，顶层 `FUSION-PIXEL-OFL.txt` 为 Fusion Pixel 原许可的字节副本。字体与上游字形的许可独立于本包源码许可；没有采用字体构建程序代码。
- React 使用宿主提供的实例，保留 React 的 MIT 许可；Zod 与其他依赖保持原许可。
