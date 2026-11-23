/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 AC.
 * Source: https://github.com/annac777/xi4u @ 336d2a38ed8c170a4599493f1bc20c6c1ef7962c, app/weather-cycle.ts
 * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.
 */
function precipitationChance(season, night) {
  return season === "spring" ? 0.62 : season === "summer" ? 0.28 : season === "autumn" ? 0.34 : night ? 0.76 : 0.42;
}
function createWeatherCycle(random = Math.random) {
  let remaining = 60;
  function schedule() {
    remaining = 60 + random() * 60;
  }
  return {
    // Only active automatic-clock seconds count. Manual choices last two minutes.
    hold() {
      remaining = 120;
    },
    update(seconds, season, night) {
      if (!Number.isFinite(seconds) || seconds <= 0) return null;
      remaining -= seconds;
      if (remaining > 0) return null;
      const wet = random() < precipitationChance(season, night);
      schedule();
      return wet ? season === "winter" ? "snow" : "rain" : "clear";
    }
  };
}
export {
  createWeatherCycle,
  precipitationChance
};
