/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 AC.
 * Source: https://github.com/annac777/xi4u @ 336d2a38ed8c170a4599493f1bc20c6c1ef7962c, app/garden-atmosphere.ts
 * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.
 */
import * as T from "three";
function gardenWind(time) {
  const phase = ((time - 4) % 26 + 26) % 26;
  const envelope = phase < 7 ? Math.pow(Math.sin(Math.PI * phase / 7), 2) : 0;
  return {
    gust: envelope,
    cycle: Math.floor((time - 4) / 26),
    x: Math.sin(time * 0.63) * 15e-4 + envelope * (3e-3 + Math.sin(time * 1.5) * 17e-4),
    z: Math.sin(time * 0.5) * 18e-4 + envelope * (5e-3 + Math.sin(time * 1.2) * 2e-3)
  };
}
function normalizeGardenWeather(season, weather) {
  return weather === "snow" && season !== "winter" || weather === "rain" && season === "winter" ? "clear" : weather;
}
function springStorm(time, season, night, weather) {
  if (season !== "spring" || !night || weather !== "rain") return { flash: 0, rumble: 0, cycle: -1 };
  const p = ((time - 9) % 43 + 43) % 43;
  return {
    flash: p < 1.4 ? Math.sin(p / 1.4 * Math.PI) ** 2 * 0.26 : 0,
    rumble: p > 2.4 && p < 7.8 ? Math.sin((p - 2.4) / 5.4 * Math.PI) ** 2 : 0,
    cycle: Math.floor((time - 9) / 43)
  };
}
function createNightButterflies({ root, material }) {
  const group = new T.Group();
  group.name = "autumn-night-butterflies";
  root.add(group);
  const shape = new T.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.012, 0.03, 0.041, 0.039, 0.049, 0.02);
  shape.bezierCurveTo(0.061, -1e-3, 0.03, -6e-3, 0.042, -0.024);
  shape.bezierCurveTo(0.016, -0.046, 4e-3, -0.017, 0, 0);
  const geo = new T.ShapeGeometry(shape, 6);
  geo.rotateX(-Math.PI / 2);
  const mat = material("#bcb5a2", { side: T.DoubleSide, emissive: "#a7b5c0", emissiveIntensity: 0.13, roughness: 1 });
  const wings = new T.InstancedMesh(geo, mat, 10);
  wings.name = "night-butterfly-wings";
  group.add(wings);
  const bodies = new T.InstancedMesh(new T.SphereGeometry(1, 8, 6), material("#554f48"), 5);
  bodies.name = "night-butterfly-bodies";
  group.add(bodies);
  for (const o of [wings, bodies]) {
    o.castShadow = false;
    o.userData.inkOutline = false;
    o.frustumCulled = false;
  }
  const dummy = new T.Object3D(), parent = new T.Object3D(), matrix = new T.Matrix4();
  const anchors = [[-2.7, 0.7, 1.05], [-3.25, 0.85, 1.64], [-1.5, 0.84, 1.45], [0.6, 0.61, 2], [2.9, 0.74, 1.25]];
  function update(time, season, night) {
    group.visible = season === "autumn" && night;
    if (!group.visible) return;
    for (let i = 0; i < 5; i++) {
      const [x, y, z] = anchors[i], p = time * (0.3 + i * 0.016) + i * 2.2;
      parent.position.set(x + Math.sin(p) * 0.32, y + Math.sin(p * 1.7) * 0.12, z + Math.cos(p * 0.83) * 0.25);
      parent.rotation.set(0, Math.atan2(Math.cos(p), -Math.sin(p * 0.83) * 0.83), Math.sin(p * 1.2) * 0.15);
      parent.updateMatrix();
      for (const side of [-1, 1]) {
        const flap = 0.23 + Math.sin(time * 8.5 + i) * 0.68;
        dummy.position.set(side * 3e-3, 0, 0);
        dummy.rotation.set(0, 0, side < 0 ? Math.PI - flap : flap);
        dummy.scale.setScalar(0.86);
        dummy.updateMatrix();
        matrix.multiplyMatrices(parent.matrix, dummy.matrix);
        wings.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), matrix);
      }
      dummy.position.set(0, 0, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(45e-4, 45e-4, 0.025);
      dummy.updateMatrix();
      matrix.multiplyMatrices(parent.matrix, dummy.matrix);
      bodies.setMatrixAt(i, matrix);
    }
    wings.instanceMatrix.needsUpdate = true;
    bodies.instanceMatrix.needsUpdate = true;
  }
  group.visible = false;
  return { group, update };
}
export {
  createNightButterflies,
  gardenWind,
  normalizeGardenWeather,
  springStorm
};
