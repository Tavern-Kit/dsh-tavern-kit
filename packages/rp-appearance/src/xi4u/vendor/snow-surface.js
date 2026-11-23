/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 AC.
 * Source: https://github.com/annac777/xi4u @ 336d2a38ed8c170a4599493f1bc20c6c1ef7962c, app/snow-surface.ts
 * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.
 */
import * as T from "three";
function branchSnowSurface(curve, r0, r1) {
  const positions = [], indices = [], steps = 40, sides = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, p = curve.getPoint(t), tangent = curve.getTangent(t).normalize();
    const up = new T.Vector3(0, 1, 0).addScaledVector(tangent, -tangent.y), exposure = up.length();
    if (exposure < 1e-3) up.set(1, 0, 0);
    else up.normalize();
    const across = new T.Vector3().crossVectors(tangent, up).normalize();
    const end = Math.min(1, t * 12, (1 - t) * 12), spread = (0.02 + 0.98 * Math.sin(end * Math.PI / 2)) * T.MathUtils.smoothstep(exposure, 0.08, 0.5);
    const radius = T.MathUtils.lerp(r0, r1, Math.pow(t, 0.7));
    for (let j = 0; j <= sides; j++) {
      const s = j / sides * 2 - 1, angle = s * 1.12 * spread;
      const thickness = (4e-3 + 0.023 * Math.pow(1 - s * s, 1.4)) * spread * (0.92 + 0.08 * Math.sin(t * 23));
      const point = p.clone().addScaledVector(up, Math.cos(angle) * (radius + thickness)).addScaledVector(across, Math.sin(angle) * (radius + thickness));
      positions.push(...point.toArray());
      if (i < steps && j < sides) {
        const a = i * (sides + 1) + j;
        indices.push(a, a + 1, a + sides + 1, a + 1, a + sides + 2, a + sides + 1);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function rockCoating(rock, offset = 9e-3) {
  const source = rock.index ? rock.toNonIndexed() : rock, p = source.getAttribute("position"), n = source.getAttribute("normal"), positions = [];
  for (let i = 0; i < p.count; i += 3) {
    const height = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, up = (n.getY(i) + n.getY(i + 1) + n.getY(i + 2)) / 3;
    if (height < 0.06 || up < 0.18) continue;
    for (let j = 0; j < 3; j++) positions.push(p.getX(i + j) + n.getX(i + j) * offset, p.getY(i + j) + n.getY(i + j) * offset, p.getZ(i + j) + n.getZ(i + j) * offset);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  if (source !== rock) source.dispose();
  return geometry;
}
export {
  branchSnowSurface,
  rockCoating
};
