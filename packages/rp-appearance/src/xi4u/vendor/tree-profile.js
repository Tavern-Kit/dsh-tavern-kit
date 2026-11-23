/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 AC.
 * Source: https://github.com/annac777/xi4u @ 336d2a38ed8c170a4599493f1bc20c6c1ef7962c, app/tree-profile.ts
 * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.
 */
import * as T from "three";
const ANCIENT_TREE_ORIGIN = [-4.12, 0.25, 0.1];
const ANCIENT_TRUNK_POINTS = [
  [0, 0, 0],
  [0.06, 0.8, -0.02],
  [0.22, 1.75, -0.1],
  [0.18, 2.65, -0.2],
  [0.48, 3.6, -0.43],
  [0.9, 4.45, -0.65],
  [1, 5.8, -0.8],
  [1.08, 6.08, -0.91],
  [1.23, 6.36, -1.08]
];
const TREE_LIFT_START = 2.7;
const TREE_LIFT_END = 6.3;
const TREE_CROWN_LIFT = 3.4;
const ANCIENT_CROWN_SPREADS = [0.86, 0.66];
const ANCIENT_TOP_SPREAD = 1.05;
const TREE_PROFILE = { origin: ANCIENT_TREE_ORIGIN, liftStart: TREE_LIFT_START, liftEnd: TREE_LIFT_END, crownLift: TREE_CROWN_LIFT, crownSpreads: ANCIENT_CROWN_SPREADS, topSpread: ANCIENT_TOP_SPREAD };
function treeHeight(y) {
  const u = T.MathUtils.clamp((y - TREE_LIFT_START) / (TREE_LIFT_END - TREE_LIFT_START), 0, 1);
  return y + TREE_CROWN_LIFT * u * u * (3 - 2 * u);
}
function treeHeightSlope(y) {
  const u = T.MathUtils.clamp((y - TREE_LIFT_START) / (TREE_LIFT_END - TREE_LIFT_START), 0, 1);
  return 1 + TREE_CROWN_LIFT * 6 * u * (1 - u) / (TREE_LIFT_END - TREE_LIFT_START);
}
function liftTreeLocalPoint(p) {
  return new T.Vector3(p.x, treeHeight(p.y), p.z);
}
function liftTreeMeshes(tree) {
  tree.updateMatrixWorld(true);
  tree.traverse((o) => {
    const mesh = o;
    if (!mesh.isMesh) return;
    const matrix = o.matrix.clone();
    for (let parent = o.parent; parent && parent !== tree; parent = parent.parent) matrix.premultiply(parent.matrix);
    const inverse = matrix.clone().invert(), geometry = mesh.geometry.clone(), p = geometry.getAttribute("position");
    let changed = false;
    for (let i = 0; i < p.count; i++) {
      const v = new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(matrix);
      if (v.y <= TREE_LIFT_START) continue;
      v.y = treeHeight(v.y);
      v.applyMatrix4(inverse);
      p.setXYZ(i, v.x, v.y, v.z);
      changed = true;
    }
    if (changed) {
      p.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      mesh.geometry = geometry;
    } else geometry.dispose();
  });
}
function liftTreeWorldPoint(p) {
  return new T.Vector3(p.x, ANCIENT_TREE_ORIGIN[1] + treeHeight(p.y - ANCIENT_TREE_ORIGIN[1]), p.z);
}
function unliftTreeWorldPoint(p) {
  const y = p.y - ANCIENT_TREE_ORIGIN[1];
  if (y <= TREE_LIFT_START) return p.clone();
  let lo = y - TREE_CROWN_LIFT, hi = y;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (treeHeight(m) < y) lo = m;
    else hi = m;
  }
  return new T.Vector3(p.x, (lo + hi) / 2 + ANCIENT_TREE_ORIGIN[1], p.z);
}
class LiftedTreeCurve extends T.Curve {
  constructor(base, originY = 0) {
    super();
    this.base = base;
    this.originY = originY;
    this.arcLengthDivisions = 400;
  }
  getPoint(t, target = new T.Vector3()) {
    this.base.getPoint(t, target);
    target.y = this.originY + treeHeight(target.y - this.originY);
    return target;
  }
  getTangent(t, target = new T.Vector3()) {
    const y = this.base.getPoint(t).y - this.originY;
    this.base.getTangent(t, target);
    target.y *= treeHeightSlope(y);
    return target.normalize();
  }
}
function createAncientCurve(points) {
  return new LiftedTreeCurve(new T.CatmullRomCurve3(points.map((p) => new T.Vector3(p[0], p[1], p[2]))));
}
function createAncientTrunkCurve() {
  return createAncientCurve(ANCIENT_TRUNK_POINTS);
}
function createTreeFlightCurve(points) {
  return new LiftedTreeCurve(new T.CatmullRomCurve3(points.map((p) => p.clone())), ANCIENT_TREE_ORIGIN[1]);
}
export {
  ANCIENT_CROWN_SPREADS,
  ANCIENT_TOP_SPREAD,
  ANCIENT_TREE_ORIGIN,
  ANCIENT_TRUNK_POINTS,
  TREE_CROWN_LIFT,
  TREE_LIFT_END,
  TREE_LIFT_START,
  TREE_PROFILE,
  createAncientCurve,
  createAncientTrunkCurve,
  createTreeFlightCurve,
  liftTreeLocalPoint,
  liftTreeMeshes,
  liftTreeWorldPoint,
  treeHeight,
  unliftTreeWorldPoint
};
