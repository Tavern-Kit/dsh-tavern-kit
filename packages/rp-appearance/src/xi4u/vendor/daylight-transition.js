/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 AC.
 * Source: https://github.com/annac777/xi4u @ 336d2a38ed8c170a4599493f1bc20c6c1ef7962c, app/daylight-transition.ts
 * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.
 */
function createDaylightTransition() {
  let start = 0, distance = 0, elapsed = 0, active = false;
  const duration = 4;
  return {
    start(from, to) {
      start = from;
      distance = ((to - from) % 24 + 24) % 24;
      elapsed = 0;
      active = distance > 1e-6;
    },
    cancel() {
      active = false;
    },
    get active() {
      return active;
    },
    update(seconds) {
      if (!active) return null;
      elapsed = Math.min(duration, elapsed + Math.max(0, Number.isFinite(seconds) ? seconds : 0));
      const t = elapsed / duration, eased = t * t * (3 - 2 * t);
      if (elapsed >= duration) active = false;
      return (start + distance * eased) % 24;
    }
  };
}
export {
  createDaylightTransition
};
