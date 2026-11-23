/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 AC.
 * Source: https://github.com/annac777/xi4u @ 336d2a38ed8c170a4599493f1bc20c6c1ef7962c, app/garden-clock.ts
 * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.
 */
const GARDEN_SEASONS = ["spring", "summer", "autumn", "winter"];
const GARDEN_PERIOD_NAMES = ["\u5B50\u65F6", "\u4E11\u65F6", "\u5BC5\u65F6", "\u536F\u65F6", "\u8FB0\u65F6", "\u5DF3\u65F6", "\u5348\u65F6", "\u672A\u65F6", "\u7533\u65F6", "\u9149\u65F6", "\u620C\u65F6", "\u4EA5\u65F6"];
const GARDEN_DAY_SECONDS = 360;
const GARDEN_SEASON_SECONDS = 720;
const GARDEN_YEAR_SECONDS = GARDEN_SEASON_SECONDS * GARDEN_SEASONS.length;
const GARDEN_LATITUDE_DEGREES = 35;
const GARDEN_DECLINATION_DEGREES = 20;
const GARDEN_TWILIGHT_DEGREES = 12;
const DEG = Math.PI / 180;
const HOURS_PER_SECOND = 24 / GARDEN_DAY_SECONDS;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function wrap(value, period) {
  const remainder = value % period;
  const positive = remainder < 0 ? remainder + period : remainder;
  return positive === 0 || positive === period ? 0 : positive;
}
function smoothstep(lo, hi, value) {
  const t = clamp((value - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
}
function sampleGardenSky(hour, season, seasonProgress = 0) {
  const h = Number.isFinite(hour) ? wrap(hour, 24) : 10;
  const index = GARDEN_SEASONS.indexOf(season);
  const seasonIndex = index < 0 ? 1 : index;
  const progress = Number.isFinite(seasonProgress) ? clamp(seasonProgress, 0, 1) : 0;
  const latitude = GARDEN_LATITUDE_DEGREES * DEG;
  const declination = Math.sin((seasonIndex + progress) * Math.PI / 2) * GARDEN_DECLINATION_DEGREES * DEG;
  const hourAngle = (h - 12) * Math.PI / 12;
  const cosDeclination = Math.cos(declination), sinDeclination = Math.sin(declination);
  const cosLatitude = Math.cos(latitude), sinLatitude = Math.sin(latitude);
  const cosHour = Math.cos(hourAngle);
  const sunDirection = [
    cosDeclination * Math.sin(hourAngle),
    sinLatitude * sinDeclination + cosLatitude * cosDeclination * cosHour,
    sinLatitude * cosDeclination * cosHour - cosLatitude * sinDeclination
  ];
  const moonDirection = [-sunDirection[0], -sunDirection[1], -sunDirection[2]];
  const sunAltitude = Math.asin(clamp(sunDirection[1], -1, 1));
  const nightMix = 1 - smoothstep(-GARDEN_TWILIGHT_DEGREES * DEG, GARDEN_TWILIGHT_DEGREES * DEG, sunAltitude);
  const sunsetAngle = Math.acos(clamp(-Math.tan(latitude) * Math.tan(declination), -1, 1));
  const halfDayHours = sunsetAngle * 12 / Math.PI;
  return {
    // A tiny tolerance gives exact computed sunrise/sunset a stable horizon classification.
    night: sunDirection[1] <= 1e-12,
    nightMix,
    daylight: 1 - nightMix,
    sunDirection,
    moonDirection,
    sunAltitude,
    moonAltitude: -sunAltitude,
    sunriseHour: 12 - halfDayHours,
    sunsetHour: 12 + halfDayHours,
    dayLengthHours: 2 * halfDayHours
  };
}
function createGardenClock() {
  let daySeconds = 10 / HOURS_PER_SECOND;
  let seasonIndex = 1;
  let seasonSeconds = 0;
  let running = true;
  function getSnapshot() {
    const hour = daySeconds * HOURS_PER_SECOND;
    const season = GARDEN_SEASONS[seasonIndex];
    const seasonProgress = seasonSeconds / GARDEN_SEASON_SECONDS;
    const periodIndex = Math.floor(wrap(hour + 1, 24) / 2);
    return {
      hour,
      season,
      running,
      seasonProgress,
      periodIndex,
      periodName: GARDEN_PERIOD_NAMES[periodIndex],
      ...sampleGardenSky(hour, season, seasonProgress)
    };
  }
  return {
    update(dtSeconds) {
      if (running && Number.isFinite(dtSeconds) && dtSeconds > 0) {
        daySeconds = wrap(daySeconds + dtSeconds % GARDEN_DAY_SECONDS, GARDEN_DAY_SECONDS);
        const yearSeconds = wrap(seasonIndex * GARDEN_SEASON_SECONDS + seasonSeconds + dtSeconds % GARDEN_YEAR_SECONDS, GARDEN_YEAR_SECONDS);
        seasonIndex = Math.floor(yearSeconds / GARDEN_SEASON_SECONDS);
        seasonSeconds = yearSeconds - seasonIndex * GARDEN_SEASON_SECONDS;
      }
      return getSnapshot();
    },
    setHour(hour) {
      if (Number.isFinite(hour)) daySeconds = wrap(hour, 24) / HOURS_PER_SECOND;
      return getSnapshot();
    },
    setSeason(season) {
      const next = GARDEN_SEASONS.indexOf(season);
      if (next >= 0) {
        seasonIndex = next;
        seasonSeconds = 0;
      }
      return getSnapshot();
    },
    setRunning(value) {
      if (typeof value === "boolean") running = value;
      return getSnapshot();
    },
    getSnapshot
  };
}
export {
  GARDEN_DAY_SECONDS,
  GARDEN_DECLINATION_DEGREES,
  GARDEN_LATITUDE_DEGREES,
  GARDEN_PERIOD_NAMES,
  GARDEN_SEASONS,
  GARDEN_SEASON_SECONDS,
  GARDEN_TWILIGHT_DEGREES,
  GARDEN_YEAR_SECONDS,
  createGardenClock,
  sampleGardenSky
};
