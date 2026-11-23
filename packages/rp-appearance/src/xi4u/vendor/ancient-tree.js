/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 AC.
 * Source: https://github.com/annac777/xi4u @ 336d2a38ed8c170a4599493f1bc20c6c1ef7962c, app/ancient-tree.ts
 * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.
 */
import * as T from "three";
import { ANCIENT_TREE_ORIGIN, ANCIENT_TRUNK_POINTS, ANCIENT_CROWN_SPREADS, ANCIENT_TOP_SPREAD, createAncientCurve, liftTreeLocalPoint, liftTreeWorldPoint, liftTreeMeshes } from "./tree-profile.js";
function createAncientTree({ root, material, mesh, ellipsoid, line, addLeaves, snowOnBranch, rr, v }) {
  const tree = new T.Group();
  tree.name = "ancient-tree";
  tree.position.set(...ANCIENT_TREE_ORIGIN);
  root.add(tree);
  const bark = material("#655644", { roughness: 1, vertexColors: true }), groove = material("#403e31"), lichen = material("#87996b"), moss = material("#658765");
  function limb(points, r0, r1) {
    const curve = createAncientCurve(points), base = curve.base, steps = 40, sides = 22, frames = base.computeFrenetFrames(steps, false), p = [], colors = [], idx = [];
    for (let i = 0; i <= steps; i++) {
      let t = i / steps, center = base.getPoint(t), r = T.MathUtils.lerp(r0, r1, Math.pow(t, 0.7));
      for (let j = 0; j <= sides; j++) {
        let a = j / sides * Math.PI * 2, ridge = 1 + Math.sin(a * 9 + t * 5) * 0.045 + Math.sin(a * 17 - t * 3) * 0.025, point = center.clone().addScaledVector(frames.normals[i], Math.cos(a) * r * ridge).addScaledVector(frames.binormals[i], Math.sin(a) * r * ridge);
        p.push(...point.toArray());
        let c = new T.Color().setHSL(0.105, 0.19, 0.61 + Math.sin(a * 9 + t * 5) * 0.1);
        colors.push(c.r, c.g, c.b);
        if (i < steps && j < sides) {
          let n = i * (sides + 1) + j;
          idx.push(n, n + 1, n + sides + 1, n + 1, n + sides + 2, n + sides + 1);
        }
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    curve.supportMesh = mesh(g, bark, [0, 0, 0], tree);
    return curve;
  }
  const trunkTip = 0.035, trunk = limb(ANCIENT_TRUNK_POINTS, 0.48, trunkTip);
  for (let i = 0; i < 9; i++) {
    let a = i * 2.4, r = rr(0.65, 1.12);
    limb([[0.04, 0.65, -0.03], [Math.cos(a) * 0.31, 0.24, Math.sin(a) * 0.29], [Math.cos(a) * r, 0.05, Math.sin(a) * r], [Math.cos(a) * (r + 0.18), 0, Math.sin(a) * (r + 0.18)]], 0.18, 0.014);
  }
  const climbers = new T.Group();
  climbers.name = "ancient-tree-climbers";
  tree.add(climbers);
  for (let j = 0; j < 18; j++) {
    let a = j / 18 * Math.PI * 2, pts = [];
    for (let i = 0; i < 24; i++) {
      let t = i / 26, c = trunk.base.getPoint(t), r = T.MathUtils.lerp(0.49, trunkTip, Math.pow(t, 0.7));
      pts.push([c.x + Math.cos(a + Math.sin(t * 6) * 0.06) * r, c.y, c.z + Math.sin(a + Math.sin(t * 6) * 0.06) * r]);
    }
    line(pts, groove, 6e-3, tree);
  }
  const ivyShape = new T.Shape();
  ivyShape.moveTo(0, -0.1);
  ivyShape.lineTo(-0.075, -0.025);
  ivyShape.lineTo(-0.09, 0.055);
  ivyShape.lineTo(-0.034, 0.035);
  ivyShape.lineTo(0, 0.13);
  ivyShape.lineTo(0.038, 0.037);
  ivyShape.lineTo(0.088, 0.055);
  ivyShape.lineTo(0.07, -0.027);
  ivyShape.closePath();
  const ivyGeo = new T.ShapeGeometry(ivyShape);
  moss.side = T.DoubleSide;
  lichen.side = T.DoubleSide;
  for (let i = 0; i < 36; i++) {
    let t = rr(0.03, 0.64), c = trunk.base.getPoint(t), a = rr(-0.9, 2.3), r = T.MathUtils.lerp(0.48, 0.105, Math.pow(t, 0.7)) + 9e-3;
    let o = mesh(ivyGeo, i % 3 ? moss : lichen, [c.x + Math.cos(a) * r, c.y, c.z + Math.sin(a) * r], climbers);
    o.rotation.set(0, Math.PI / 2 - a, rr(-0.3, 0.3));
    o.scale.setScalar(rr(0.62, 1));
  }
  const crowns = [], birdGripSurfaces = [];
  let birdPerch = null, birdPerchCurve = null, birdPerchYaw = 0;
  const limbs = [
    [[0.18, 2.15, -0.12], [-0.35, 2.8, 0.28], [-1.12, 3.3, 0.65], [-1.45, 4.25, 0.68]],
    [[0.28, 2.9, -0.27], [0.9, 3.4, -0.52], [1.7, 4.42, -0.9], [2.2, 5.15, -1.25]],
    [[0.45, 3.65, -0.44], [-0.13, 4.25, -0.82], [-0.75, 4.95, -1.3], [-0.8, 5.6, -1.6]],
    [[0.78, 4.3, -0.65], [1.45, 4.7, 0.02], [2.05, 5.22, 0.45], [2.65, 5.85, 0.62]],
    [[0.94, 4.9, -0.76], [0.32, 5.28, 0.17], [-0.2, 5.84, 0.62], [-0.12, 6.3, 0.65]],
    [[1, 5.25, -0.8], [1.58, 5.65, -1.27], [1.75, 6.2, -1.64], [1.84, 6.5, -1.84]]
  ];
  limbs.forEach((pts, i) => {
    const radius = 0.21 - i * 0.016, curve = limb(pts, radius, 0.025);
    const cap = snowOnBranch(curve.base, null, radius, 0.025, tree.position, liftTreeLocalPoint);
    for (let k of [-1, 1]) {
      let end2 = pts.at(-1), mid = pts[2], a = i * 1.47 + k * 0.8, d = [end2[0] + Math.cos(a) * 0.7, end2[1] + rr(0.17, 0.5), end2[2] + Math.sin(a) * 0.58];
      const twigCurve = limb([mid, [end2[0] * 0.94, end2[1] - 0.08, end2[2] * 0.94], d], 0.055, 6e-3);
      crowns.push(liftTreeWorldPoint(v(-4.12 + d[0], 0.47 + d[1], 0.1 + d[2])));
      snowOnBranch(twigCurve.base, null, 0.055, 6e-3, tree.position, liftTreeLocalPoint);
    }
    const end = pts.at(-1);
    crowns.push(liftTreeWorldPoint(v(-4.12 + end[0], 0.48 + end[1], 0.1 + end[2])));
  });
  crowns.forEach((c, i) => {
    if (c.x < -4.5) c.x += 0.35;
    addLeaves(c, 170, ANCIENT_CROWN_SPREADS[i % 3 === 0 ? 0 : 1], 1.08, 0);
    const limbCurve = createAncientCurve(limbs[Math.floor(i / 3)]);
    const shoulder = limbCurve.getPoint(0.7 + i % 3 * 0.065).add(tree.position);
    shoulder.y += 0.22;
    addLeaves(shoulder, 60, 0.53, 1.06, 0);
  });
  addLeaves(liftTreeWorldPoint(v(-3.16, 6.27, -0.64)), 440, ANCIENT_TOP_SPREAD, 1.07, 0);
  const newWood = [], newSnow = [], growthCrowns = [];
  function growingBranch(points, r0, r1, name) {
    const curve = limb(points, r0, r1);
    curve.supportMesh.name = name;
    newWood.push(curve.supportMesh);
    curve.snowCap = snowOnBranch(curve.base, null, r0, r1, tree.position, liftTreeLocalPoint);
    newSnow.push(curve.snowCap);
    return curve;
  }
  function leafAlong(curve, t, count, spread, seed) {
    const p = curve.base.getPoint(t);
    p.y += 0.09;
    const center = liftTreeLocalPoint(p).add(tree.position);
    growthCrowns.push(center.clone());
    addLeaves(center, count, spread, 1.04, 0, seed);
  }
  const middleGrowth = [
    { parent: 0, at: 0.4, r: 0.09, points: [[-0.42, 3.16, 0.6], [-0.23, 3.48, 0.43], [-0.32, 3.94, 0.39]] },
    { parent: 1, at: 0.18, r: 0.09, points: [[0.72, 3.42, -0.02], [1.02, 3.79, 0.2], [1.11, 4.3, 0.25]] },
    { parent: 0, at: 0.84, r: 0.075, points: [[-0.81, 3.82, 0.82], [-0.43, 4.2, 0.2], [-0.18, 4.7, 0.17]] },
    { parent: 3, at: 0.42, r: 0.07, points: [[1.11, 4.86, -0.18], [0.76, 5.13, -0.05], [0.56, 5.5, 0.12]] }
  ];
  middleGrowth.forEach((spec, i) => {
    const source = createAncientCurve(limbs[spec.parent]).base, anchor = { p: source.getPoint(spec.at), tangent: source.getTangent(spec.at) }, neck = anchor.p.clone().addScaledVector(anchor.tangent, 0.13);
    const parent = growingBranch([anchor.p.toArray(), neck.toArray(), ...spec.points], spec.r, 0.022, "middle-canopy-bough");
    leafAlong(parent, 0.74, 235, 0.47, 391424 + i * 97);
    for (let j = 0; j < 3; j++) {
      const t = 0.3 + j * 0.245, start = parent.base.getPoint(t), direction = parent.base.getTangent(t);
      const sign = (i % 2 === 0 ? -1 : 1) * (j === 1 ? -1 : 1), dx = sign * (0.2 + j * 0.018), dz = 0.14 - j * 0.055 + i % 2 * 0.08;
      const neck2 = start.clone().addScaledVector(direction, 0.105);
      const mid = start.clone().add(v(dx * 0.55, 0.14 + j * 0.013, dz * 0.6));
      const end = start.clone().add(v(dx, 0.27 + j * 0.04, dz));
      const twig = growingBranch([start.toArray(), neck2.toArray(), mid.toArray(), end.toArray()], 0.04 - j * 6e-3, 6e-3, "middle-canopy-fork");
      leafAlong(twig, 0.56, 145, 0.36, 435968 + i * 97 + j * 13);
      leafAlong(twig, 0.94, 145, 0.4, 506880 + i * 97 + j * 13);
    }
  });
  const roofGrowth = [
    { at: 0.38, r: 0.105, points: [[1.12, 3.84, -0.78], [2.42, 3.88, -1.22], [3.57, 4.06, -1.42]] },
    { at: 0.51, r: 0.09, points: [[1.87, 4.14, -1.08], [2.98, 4.18, -1.7], [4.08, 4.32, -2.19]] }
  ];
  roofGrowth.forEach((spec, i) => {
    const source = createAncientCurve(limbs[1]).base, start = source.getPoint(spec.at), tangent = source.getTangent(spec.at);
    const neck = start.clone().addScaledVector(tangent, 0.15);
    const parent = growingBranch([start.toArray(), neck.toArray(), ...spec.points], spec.r, 0.022, "roof-canopy-bough");
    if (i === 1) {
      birdPerchCurve = parent;
      parent.supportMesh.name = "bird-roof-perch-bough";
      parent.snowCap.name = "bird-roof-perch-snow";
      birdGripSurfaces.push(parent.supportMesh, parent.snowCap);
      newWood.splice(newWood.indexOf(parent.supportMesh), 1);
      newSnow.splice(newSnow.indexOf(parent.snowCap), 1);
    }
    leafAlong(parent, 0.94, 240, 0.48, 643856 + i * 173);
    for (let j = 0; j < 3; j++) {
      const start2 = parent.base.getPoint(0.4 + j * 0.21), direction = parent.base.getTangent(0.4 + j * 0.21);
      const dx = 0.35 + (j === 1 ? 0.04 : 0), dy = 0.17 + j * 0.04, dz = (j % 2 === 0 ? 1 : -1) * (i === 0 ? 1 : -1) * (0.29 + j * 0.025);
      const neck2 = start2.clone().addScaledVector(direction, 0.13);
      const mid = start2.clone().add(v(dx * 0.56, dy * 0.65, dz * 0.58));
      const end = start2.clone().add(v(dx, dy, dz));
      const twig = growingBranch([start2.toArray(), neck2.toArray(), mid.toArray(), end.toArray()], 0.045 - j * 5e-3, 6e-3, "roof-canopy-fork");
      leafAlong(twig, 0.56, 125, 0.4, 680448 + i * 173 + j * 19);
      leafAlong(twig, 0.94, 125, 0.46, 757248 + i * 173 + j * 19);
    }
  });
  function mergeGrowth(objects, name) {
    const geo = new T.BufferGeometry(), names = Object.keys(objects[0].geometry.attributes), indices = [];
    let offset = 0;
    for (const name2 of names) {
      const source = objects[0].geometry.attributes[name2], values = [];
      for (const o of objects) values.push(...o.geometry.attributes[name2].array);
      geo.setAttribute(name2, new T.Float32BufferAttribute(values, source.itemSize));
    }
    for (const o of objects) {
      const g = o.geometry, index = g.index;
      if (index) for (const n of index.array) indices.push(n + offset);
      else for (let n = 0; n < g.attributes.position.count; n++) indices.push(n + offset);
      offset += g.attributes.position.count;
    }
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const merged = mesh(geo, objects[0].material, [0, 0, 0], objects[0].parent);
    merged.name = name;
    for (const o of objects) {
      o.removeFromParent();
      o.geometry.dispose();
    }
    return merged;
  }
  mergeGrowth(newWood, "ancient-tree-middle-branches");
  mergeGrowth(newSnow, "ancient-tree-middle-branch-snow");
  tree.userData.middleGrowth = { boughs: 6, forks: 18, addedLeaves: 6400, roofBoughs: 2, roofForks: 6, roofLeaves: 1980, crowns: growthCrowns.map((p) => p.toArray()) };
  liftTreeMeshes(tree);
  root.updateMatrixWorld(true);
  const perchT = 0.68, perchCenter = birdPerchCurve.getPoint(perchT).add(tree.position), perchTangent = birdPerchCurve.getTangent(perchT);
  const perchRay = new T.Raycaster(perchCenter.clone().add(v(0, 0.45, 0)), v(0, -1, 0), 0, 0.9), perchHit = perchRay.intersectObjects(birdGripSurfaces, false)[0];
  if (!perchHit) throw new Error("Roof bough has no bird support surface");
  birdPerch = perchHit.point.clone().add(v(0, 0.012, 0));
  birdPerchYaw = Math.atan2(-perchTangent.x, -perchTangent.z);
  tree.userData.birdRoofPerch = { t: perchT, point: birdPerch.toArray(), yaw: birdPerchYaw, slope: Math.atan2(perchTangent.y, Math.hypot(perchTangent.x, perchTangent.z)) };
  return { group: tree, crowns, birdPerch, birdPerchYaw, birdGripSurfaces, trunk, setSeason(s) {
    climbers.visible = s !== "winter";
    climbers.children.forEach((o, i) => o.visible = s === "spring" ? i % 3 === 0 : s === "autumn" ? i % 5 !== 0 : true);
    moss.color.set(s === "autumn" ? "#c67c42" : "#658765");
    lichen.color.set(s === "autumn" ? "#deac62" : "#87996b");
  } };
}
export {
  createAncientTree
};
