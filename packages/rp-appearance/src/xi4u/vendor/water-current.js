/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 AC.
 * Source: https://github.com/annac777/xi4u @ 336d2a38ed8c170a4599493f1bc20c6c1ef7962c, app/water-current.ts
 * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.
 */
import * as T from "three";
function createWaterCurrent({ root, mesh, cx, width, streamExtent }) {
  const group = new T.Group();
  group.name = "fine-downstream-current";
  root.add(group);
  const records = [];
  for (let i = 0; i < 34; i++) {
    const steps = 22, g = new T.BufferGeometry(), p = new Float32Array((steps + 1) * 6), ids = [];
    for (let j = 0; j < steps; j++) {
      const n = j * 2;
      ids.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
    }
    g.setAttribute("position", new T.BufferAttribute(p, 3));
    g.setIndex(ids);
    const mat = new T.MeshBasicMaterial({ color: i % 3 ? "#c2e0d9" : "#e0eee1", transparent: true, opacity: 0.16, depthWrite: false, side: T.DoubleSide });
    const object = mesh(g, mat, [0, 0, 0], group);
    object.name = "fine-flow-ribbon";
    object.castShadow = false;
    object.receiveShadow = false;
    object.renderOrder = 3;
    object.frustumCulled = false;
    records.push({ object, p, steps, lane: Math.sin(i * 2.399) * 0.81, phase: i * 0.6180339 % 1, length: 0.55 + i % 7 * 0.12, halfWidth: 7e-3 + i % 4 * 23e-4, speed: 0.16 + i % 5 * 0.018, seed: i * 1.73 });
  }
  function update(time, night = 0, rain = 0) {
    for (const r of records) {
      const z0 = -5.5 + (time * r.speed + r.phase * 11) % 11;
      for (let j = 0; j <= r.steps; j++) {
        const u = j / r.steps, z = z0 + (u - 0.5) * r.length, e = streamExtent(z, cx, width), center = (e.left + e.right) * 0.5 + r.lane * Math.max(0.02, (e.right - e.left) * 0.5 - 0.18) + Math.sin(z * 2.2 + r.seed + time * 0.14) * 0.034;
        const taper = Math.pow(Math.sin(Math.PI * u), 0.72) * T.MathUtils.smoothstep(z, -4.9, -4.55) * (1 - T.MathUtils.smoothstep(z, 3.88, 4.35));
        const w = r.halfWidth * taper, gleam = 1 + Math.sin(u * 17 + r.seed - time * 0.8) * 0.11;
        r.p.set([center - w * gleam, 0.078, z, center + w * gleam, 0.078, z], j * 6);
      }
      r.object.geometry.attributes.position.needsUpdate = true;
      r.object.material.opacity = (0.13 + 0.07 * (0.5 + 0.5 * Math.sin(time * 0.5 + r.seed))) * (1 - night * 0.22) * (1 - rain * 0.26);
    }
  }
  update(0);
  return { group, update };
}
export {
  createWaterCurrent
};
