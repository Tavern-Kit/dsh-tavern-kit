/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 AC.
 * Source: https://github.com/annac777/xi4u @ 336d2a38ed8c170a4599493f1bc20c6c1ef7962c, app/veranda-plant.ts
 * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.
 */
import * as T from "three";
function createVerandaPlant({ root, material, mesh, lathe, line }, x, z, name) {
  const group = new T.Group();
  group.name = name;
  group.position.set(x, 0.945, z);
  root.add(group);
  const glaze = material("#658777", { roughness: 0.55 }), rim = material("#91ab83", { roughness: 0.6 });
  const earth = material("#675444"), stem = material("#527d49"), vein = material("#9bb477");
  lathe([[0.1, 0], [0.115, 8e-3], [0.119, 0.035], [0.157, 0.244], [0.173, 0.258], [0.173, 0.279], [0.155, 0.291], [0.145, 0.28], [0.143, 0.249]], glaze, [0, 0, 0], group);
  mesh(new T.TorusGeometry(0.159, 0.013, 6, 36), rim, [0, 0.275, 0], group).rotation.x = Math.PI / 2;
  mesh(new T.CylinderGeometry(0.143, 0.14, 0.018, 28), earth, [0, 0.242, 0], group);
  const leafMat = material("#ffffff", { vertexColors: true, roughness: 0.8, side: T.DoubleSide });
  for (let i = 0; i < 8; i++) {
    const a = i * 2.399 + 0.4, dx = Math.cos(a), dz = Math.sin(a), h = 0.3 + i % 3 * 0.043, spread = 0.16 + i % 3 * 0.035;
    const base = new T.Vector3(dx * 0.024, 0.247, dz * 0.024), start = new T.Vector3(dx * 0.035, 0.32, dz * 0.035);
    line([base.toArray(), start.toArray(), [dx * 0.055, 0.4, dz * 0.055]], stem, 6e-3, group);
    const curve = new T.CatmullRomCurve3([start, new T.Vector3(dx * 0.045, 0.32 + h * 0.63, dz * 0.045), new T.Vector3(dx * spread * 0.7, 0.32 + h, dz * spread * 0.7), new T.Vector3(dx * spread, 0.3 + h * 0.81, dz * spread)]);
    const p = [], c = [], indices = [], steps = 24, sides = 8;
    for (let j = 0; j <= steps; j++) {
      const u = j / steps, at = curve.getPoint(u), t = curve.getTangent(u).normalize(), across = new T.Vector3(-dz, 0, dx), up = t.clone().cross(across).normalize();
      const breadth = 3e-3 + Math.pow(Math.sin(Math.PI * u), 0.8) * (0.033 + i % 2 * 0.01);
      for (let k = 0; k <= sides; k++) {
        const b = k / sides * Math.PI * 2, v = at.clone().addScaledVector(across, Math.cos(b) * breadth).addScaledVector(up, Math.sin(b) * (25e-4 + Math.sin(Math.PI * u) * 3e-3));
        p.push(...v.toArray());
        const color = new T.Color(Math.sin(b) > 0.1 ? i % 2 ? "#568b54" : "#477d4c" : "#37654a");
        color.offsetHSL(0, 0, u * 0.06);
        c.push(color.r, color.g, color.b);
        if (j < steps && k < sides) {
          const n = j * (sides + 1) + k;
          indices.push(n, n + sides + 1, n + 1, n + 1, n + sides + 1, n + sides + 2);
        }
      }
    }
    const cap = p.length / 3;
    p.push(...curve.getPoint(0).toArray(), ...curve.getPoint(1).toArray());
    c.push(0.1, 0.25, 0.12, 0.1, 0.25, 0.12);
    for (let k = 0; k < sides; k++) {
      indices.push(cap, k, k + 1);
      const n = steps * (sides + 1) + k;
      indices.push(cap + 1, n + 1, n);
    }
    for (let j = 0; j < indices.length; j += 3) [indices[j + 1], indices[j + 2]] = [indices[j + 2], indices[j + 1]];
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(c, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    mesh(g, leafMat, [0, 0, 0], group).name = "potted-curved-green-leaf";
    const veins = [];
    for (let j = 0; j <= 12; j++) {
      const u = j / 12, t = curve.getTangent(u).normalize(), up = t.clone().cross(new T.Vector3(-dz, 0, dx)).normalize();
      veins.push(curve.getPoint(u).addScaledVector(up, 6e-3).toArray());
    }
    line(veins, vein, 16e-4, group);
  }
  return group;
}
export {
  createVerandaPlant
};
