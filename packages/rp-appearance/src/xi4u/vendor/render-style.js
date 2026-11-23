/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 AC.
 * Source: https://github.com/annac777/xi4u @ 336d2a38ed8c170a4599493f1bc20c6c1ef7962c, app/render-style.ts
 * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.
 */
const PIXEL_SIZE_CSS = 2;
const renderStyles = [
  { id: "clear", labelZh: "\u539F\u751F", labelEn: "ORIGINAL" },
  { id: "pixel", labelZh: "\u50CF\u7D20", labelEn: "PIXEL" }
];
function isGardenRenderStyle(value) {
  return renderStyles.some((style) => style.id === value);
}
export {
  PIXEL_SIZE_CSS,
  isGardenRenderStyle,
  renderStyles
};
