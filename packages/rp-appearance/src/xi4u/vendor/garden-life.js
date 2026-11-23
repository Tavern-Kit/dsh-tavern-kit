/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 AC.
 * Source: https://github.com/annac777/xi4u @ 336d2a38ed8c170a4599493f1bc20c6c1ef7962c, app/garden-life.ts
 * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.
 */
import * as T from "three";
import { createGardenPlanting } from "./garden-planting.js";
function createGardenLife({ root, material, mesh, box, ellipsoid, line, beam, lathe, wood, woodDark, woodEdge, stone, moss, snowMat, leafGeometry, rr, cx, width, withinGarden }) {
  const garden = new T.Group();
  garden.name = "garden-landscape";
  root.add(garden);
  const iron = material("#52696b", { metalness: 0.65, roughness: 0.5 }), darkIron = material("#35494c", { metalness: 0.45, roughness: 0.72 }), rope = material("#baac7f"), terra = material("#b77957"), cream = material("#dccaa3"), leafMat = material("#64925e", { side: T.DoubleSide }), soil = material("#7c7260");
  const seasonalSnow = new T.Group();
  garden.add(seasonalSnow);
  seasonalSnow.visible = false;
  const bridgeZ = 3.22, center = cx(bridgeZ), half = width(bridgeZ) + 0.42, bridge = new T.Group();
  bridge.name = "wooden-footbridge";
  bridge.position.set(center, 0, bridgeZ);
  garden.add(bridge);
  const deckY = (x) => 0.43 + 0.105 * (1 - Math.pow(Math.min(Math.abs(x) / half, 1), 2)), boardCount = 21, boardW = half * 2 / boardCount;
  const grain = material("#a48d69"), split = material("#60584b"), oldWood = ["#d5c39c", "#b3ad96", "#cab591", "#dfcba2", "#a2a38f"];
  for (let i = 0; i < boardCount; i++) {
    const x = -half + (i + 0.5) * boardW, w = boardW - rr(0.014, 0.031), length = rr(0.92, 1.3), offset = rr(-0.075, 0.075), y = deckY(x) + rr(-0.012, 0.012);
    const group = new T.Group();
    group.name = "weathered-plank";
    group.position.set(x, y, offset);
    group.rotation.set(rr(-0.018, 0.018), rr(-0.028, 0.028), -0.16 * x / (half * half));
    bridge.add(group);
    const front2 = -length / 2, back = length / 2, chip = i % 3 === 0 ? 0.13 : 0.025, shape = new T.Shape();
    const border = [[-w / 2, front2 + 0.035], [-w * 0.15, front2], [-w * 0.08, front2 + chip], [w * 0.035, front2 + 0.012], [w / 2, front2 + rr(0.015, 0.07)], [w / 2, back - 0.035], [w * 0.23, back], [w * 0.12, back - chip * 0.8], [w * 0.04, back - 0.01], [-w / 2, back - rr(0.015, 0.08)]];
    border.forEach(([px, pz], j) => j ? shape.lineTo(px, pz) : shape.moveTo(px, pz));
    shape.closePath();
    const geometry = new T.ExtrudeGeometry(shape, { depth: 0.075, bevelEnabled: true, bevelSize: 4e-3, bevelThickness: 3e-3, bevelSegments: 1, steps: 1 });
    geometry.rotateX(Math.PI / 2);
    const mat = wood.clone();
    mat.color.set(oldWood[i % oldWood.length]);
    mesh(geometry, mat, [0, 0, 0], group);
    for (let j = 0; j < 5; j++) {
      const len = rr(0.09, 0.35);
      box(rr(6e-3, 0.014), 2e-3, len, j % 2 ? grain : split, [rr(-w * 0.34, w * 0.34), 5e-3, rr(front2 + 0.23, back - 0.23)], group);
    }
    for (let z of [-0.33, 0.33]) mesh(new T.CylinderGeometry(9e-3, 9e-3, 3e-3, 6), darkIron, [w * 0.22, 6e-3, z], group);
    if (i % 3 === 1) line([[-w * 0.25, 6e-3, front2 + 0.04], [-w * 0.23, 6e-3, front2 + 0.22], [-w * 0.08, 6e-3, front2 + 0.32]], split, 3e-3, group);
    const snow = box(w - 0.018, 0.022, length * 0.62, snowMat, [0, 0.019, -0.025], group, 8e-3);
    seasonalSnow.userData.planks ??= [];
    seasonalSnow.userData.planks.push(snow);
    snow.visible = false;
  }
  for (let z of [-0.33, 0.33]) {
    const pts = [];
    for (let i = 0; i < 9; i++) {
      let x = -half + i / 8 * half * 2;
      pts.push([x, deckY(x) - 0.125, z]);
    }
    line(pts, woodDark, 0.065, bridge);
  }
  for (let x of [-half + 0.11, -half * 0.34, half * 0.34, half - 0.11]) for (let z of [-0.33, 0.33]) {
    beam([x, -0.16, z], [x, deckY(x) - 0.09, z], 0.047, 0.036, woodDark, bridge);
    beam([x, -0.13, z], [x, 0.035, z], 0.05, 0.046, moss, bridge);
  }
  const planting = createGardenPlanting({ garden, material, mesh, line, leafGeometry, rr, cx, width, bridgeZ, center, half, withinGarden });
  const paths = [[center + half + 0.2, 3.22], [2.95, 2.7], [3.12, 2.19], [3.21, 1.62], [3.4, 1.04], [3.51, 0.47], [3.71, -0.1]];
  for (const [x, z] of paths) {
    let p = mesh(new T.CylinderGeometry(rr(0.21, 0.27), 0.26, 0.052, 7), stone, [x, 0.288, z], garden);
    p.scale.z = 0.77;
    p.rotation.y = rr(0, 6.28);
  }
  const rack = new T.Group();
  rack.name = "farm-tool-rack";
  rack.position.set(4.39, 0.26, -0.6);
  rack.rotation.y = Math.PI / 2;
  garden.add(rack);
  for (let x of [-0.78, 0.78]) for (let z of [-0.27, 0.27]) box(0.06, 1.85, 0.06, woodDark, [x, 0.925, z], rack);
  for (let y of [0.13, 0.65, 1.2, 1.78]) {
    for (let j = 0; j < 4; j++) box(1.66, 0.045, 0.143, wood, [0, y, -0.235 + j * 0.157], rack);
    box(1.68, 0.065, 0.045, woodEdge, [0, y - 0.025, 0.31], rack);
  }
  beam([-0.76, 0.14, -0.285], [0.76, 1.73, -0.285], 0.027, 0.027, woodEdge, rack);
  beam([0.76, 0.14, -0.29], [-0.76, 1.73, -0.29], 0.027, 0.027, woodEdge, rack);
  box(1.79, 0.055, 0.75, woodDark, [0, 1.92, 0], rack, 0.015);
  const rackSnow = box(0.75, 0.055, 1.79, snowMat, [4.39, 2.24, -0.6], seasonalSnow, 0.02);
  const toolsGroup = new T.Group();
  toolsGroup.name = "hanging-farm-tools";
  rack.add(toolsGroup);
  function handle(x) {
    beam([x, 0.28, 0.405], [x, 1.67, 0.405], 0.015, 0.013, woodEdge, toolsGroup);
    mesh(new T.TorusGeometry(0.031, 6e-3, 4, 12), darkIron, [x, 1.69, 0.404], toolsGroup);
  }
  handle(-0.56);
  beam([-0.78, 0.4, 0.418], [-0.33, 0.4, 0.418], 0.017, 0.017, iron, toolsGroup);
  for (let x = -0.76; x < -0.32; x += 0.059) beam([x, 0.4, 0.418], [x, 0.29, 0.45], 9e-3, 5e-3, iron, toolsGroup);
  handle(-0.04);
  box(0.26, 0.14, 0.023, iron, [-0.04, 0.335, 0.448], toolsGroup);
  box(0.25, 0.017, 0.08, darkIron, [-0.04, 0.271, 0.484], toolsGroup);
  handle(0.49);
  const bladeShape = new T.Shape();
  bladeShape.moveTo(-0.08, 0.1);
  bladeShape.lineTo(0.08, 0.1);
  bladeShape.lineTo(0.092, -0.04);
  bladeShape.quadraticCurveTo(0, -0.16, -0.092, -0.04);
  bladeShape.closePath();
  const blade = mesh(new T.ExtrudeGeometry(bladeShape, { depth: 0.016, bevelEnabled: true, bevelSize: 8e-3, bevelThickness: 5e-3, bevelSegments: 2, steps: 1 }), iron, [0.49, 0.38, 0.414], toolsGroup);
  line([[0.49, 0.27, 0.442], [0.49, 0.44, 0.444]], cream, 4e-3, toolsGroup);
  for (let x of [-0.47, 0.1]) {
    const crate = box(0.45, 0.29, 0.38, wood, [x, 0.3, 0], rack, 0.02);
    for (let y of [0.21, 0.31, 0.4]) box(0.43, 0.012, 6e-3, woodDark, [x, y, 0.195], rack);
    box(0.16, 0.08, 6e-3, cream, [x, 0.32, 0.202], rack);
  }
  for (let x of [-0.5, -0.19]) {
    lathe([[0.06, 0], [0.105, 0.15], [0.12, 0.17], [0.12, 0.19], [0.094, 0.19], [0.086, 0.04]], terra, [x, 0.676, 0.01], rack);
    lathe([[0.05, 0], [0.088, 0.14], [0.105, 0.17]], terra, [x, 0.817, 0.01], rack);
  }
  const can = new T.Group();
  can.position.set(0.43, 0.68, -5e-3);
  rack.add(can);
  lathe([[0.1, 0], [0.14, 0.03], [0.14, 0.24], [0.12, 0.27]], material("#65968a", { metalness: 0.25 }), [0, 0, 0], can);
  line([[0.08, 0.08, 0], [0.22, 0.14, 0], [0.3, 0.28, 0]], iron, 0.025, can);
  ellipsoid(0.3, 0.28, 0, 0.035, 0.026, 0.05, iron, can, 16);
  line([[-0.1, 0.23, 0], [-0.24, 0.25, 0], [-0.24, 0.04, 0], [-0.1, 0.03, 0]], iron, 0.015, can);
  for (let i = 0; i < 2; i++) {
    const g = box(0.31, 0.22, 0.28, cream, [-0.48 + i * 0.35, 1.33, 0], rack, 0.055);
    g.rotation.y = (i - 0.5) * 0.12;
    line([[-0.48 + i * 0.35, 1.22, 0.153], [-0.48 + i * 0.35, 1.41, 0.16], [-0.48 + i * 0.35, 1.45, 0]], rope, 8e-3, rack);
  }
  const spool = mesh(new T.CylinderGeometry(0.08, 0.08, 0.13, 16), rope, [0.38, 1.29, 0], rack);
  for (let y = 1.23; y < 1.36; y += 0.018) mesh(new T.TorusGeometry(0.08, 4e-3, 4, 20), woodDark, [0.38, y, 0], rack).rotation.x = Math.PI / 2;
  for (let i = 0; i < 2; i++) {
    box(0.095, 0.025, 0.18, material("#768e89"), [0.51 + i * 0.075, 1.235, 0.095], rack, 0.017);
    for (let j = 0; j < 4; j++) box(0.013, 0.018, 0.072, cream, [0.48 + i * 0.075 + j * 0.019, 1.244, 0.211], rack, 4e-3);
  }
  const hat = new T.Group();
  hat.position.set(0.83, 1.14, 0.02);
  hat.rotation.y = Math.PI / 2;
  rack.add(hat);
  let brim = mesh(new T.CylinderGeometry(0.245, 0.245, 0.016, 36), rope, [0, 0, 0], hat);
  brim.rotation.x = Math.PI / 2;
  ellipsoid(0, 0, 0.06, 0.145, 0.145, 0.083, rope, hat, 24);
  for (let r of [0.17, 0.2, 0.23]) mesh(new T.TorusGeometry(r, 35e-4, 4, 36), woodDark, [0, 0, 0.01], hat);
  const bike = new T.Group();
  bike.name = "garden-bicycle";
  bike.position.set(4.06, 0.3, 1.77);
  bike.rotation.y = Math.PI / 2;
  garden.add(bike);
  const enamel = material("#709f91", { metalness: 0.33, roughness: 0.4 }), rubber = material("#344644"), chrome = material("#a5b8ad", { metalness: 0.8, roughness: 0.3 }), leather = material("#806247");
  const wheels = [];
  for (let x of [-0.64, 0.64]) {
    mesh(new T.TorusGeometry(0.345, 0.032, 10, 64), rubber, [x, 0.376, 0], bike);
    mesh(new T.TorusGeometry(0.31, 9e-3, 6, 64), chrome, [x, 0.376, 0], bike);
    let hub = mesh(new T.CylinderGeometry(0.035, 0.035, 0.1, 16), chrome, [x, 0.376, 0], bike);
    hub.rotation.x = Math.PI / 2;
    for (let j = 0; j < 28; j++) {
      let a = j / 28 * Math.PI * 2;
      beam([x, 0.376, j % 2 ? 0.028 : -0.028], [x + Math.cos(a) * 0.305, 0.376 + Math.sin(a) * 0.305, 0], 25e-4, 25e-4, chrome, bike);
    }
    const pts = [];
    for (let j = 0; j <= 22; j++) {
      let a = 0.07 + j / 22 * Math.PI * 0.95;
      pts.push([x + Math.cos(a) * 0.39, 0.376 + Math.sin(a) * 0.39, 0]);
    }
    line(pts, enamel, 0.02, bike);
    wheels.push(x);
  }
  const rear = [-0.64, 0.376, 0], bb = [-0.14, 0.35, 0], seat = [-0.28, 0.91, 0], neck = [0.43, 0.91, 0], front = [0.64, 0.376, 0];
  for (const [a, b] of [[rear, bb], [bb, seat], [rear, seat]]) beam(a, b, 0.018, 0.018, enamel, bike);
  line([seat, [-0.17, 0.64, 0], [0.14, 0.52, 0], neck], enamel, 0.025, bike);
  beam(bb, [0.36, 0.74, 0], 0.022, 0.022, enamel, bike);
  beam([0.38, 1.015, 0], front, 0.022, 0.019, enamel, bike);
  beam([-0.28, 0.9, 0], [-0.29, 1, 0], 0.016, 0.016, chrome, bike);
  ellipsoid(-0.31, 1.01, 0, 0.15, 0.035, 0.09, leather, bike, 24);
  line([[0.38, 0.97, 0], [0.34, 1.17, 0], [0.21, 1.17, 0.17]], chrome, 0.013, bike);
  line([[0.34, 1.17, 0], [0.21, 1.17, -0.17]], chrome, 0.013, bike);
  for (let z of [-0.17, 0.17]) beam([0.16, 1.17, z], [0.28, 1.17, z], 0.021, 0.021, leather, bike);
  line([[0.24, 1.17, 0.17], [0.52, 0.92, 0.08], [0.52, 0.73, 0.02]], darkIron, 35e-4, bike);
  line([[0.24, 1.17, -0.17], [0.11, 0.75, -0.1], [-0.14, 0.41, -0.08]], darkIron, 35e-4, bike);
  mesh(new T.TorusGeometry(0.108, 8e-3, 6, 32), chrome, [-0.14, 0.35, 0.041], bike);
  beam([-0.14, 0.35, 0.05], [-0.12, 0.25, 0.12], 0.012, 0.012, chrome, bike);
  box(0.115, 0.035, 0.09, rubber, [-0.12, 0.25, 0.14], bike);
  beam([-0.14, 0.35, -0.05], [-0.16, 0.45, -0.12], 0.012, 0.012, chrome, bike);
  box(0.115, 0.035, 0.09, rubber, [-0.16, 0.45, -0.14], bike);
  line([[-0.14, 0.455, 0.04], [-0.62, 0.424, 0.04], [-0.67, 0.373, 0.04], [-0.61, 0.325, 0.04], [-0.14, 0.246, 0.04]], darkIron, 6e-3, bike);
  beam([-0.17, 0.4, 0], [-0.23, 0.04, 0.2], 0.01, 0.01, chrome, bike);
  box(0.38, 0.025, 0.2, enamel, [-0.61, 0.8, 0], bike);
  for (let z of [-0.085, 0.085]) beam([-0.78, 0.79, z], [-0.64, 0.376, z], 7e-3, 7e-3, chrome, bike);
  const basket = new T.Group();
  basket.position.set(0.62, 1, 0);
  bike.add(basket);
  for (let y of [0, 0.1, 0.22]) {
    line([[-0.16, y, -0.14], [0.16, y, -0.14], [0.16, y, 0.14], [-0.16, y, 0.14], [-0.16, y, -0.14]], rope, 6e-3, basket);
  }
  for (let x = -0.15; x <= 0.16; x += 0.05) for (let z of [-0.14, 0.14]) beam([x, 0, z], [x, 0.22, z], 4e-3, 4e-3, rope, basket);
  for (let z = -0.1; z <= 0.11; z += 0.05) for (let x of [-0.16, 0.16]) beam([x, 0, z], [x, 0.22, z], 4e-3, 4e-3, rope, basket);
  box(0.29, 0.016, 0.26, wood, [0, 0, 0], basket);
  ellipsoid(0.64, 0.9, 0.033, 0.045, 0.044, 0.04, cream, bike, 20);
  ellipsoid(-0.79, 0.78, 0.015, 0.022, 0.03, 0.012, terra, bike, 16);
  return { bridge, setSeason(s) {
    seasonalSnow.visible = s === "winter";
    for (const snow of seasonalSnow.userData.planks || []) snow.visible = s === "winter";
    planting.setSeason(s);
  }, update(time) {
    planting.update(time);
  }, bounds: { bridgeCenter: center, bridgeHalf: half, bridgeZ, deckY } };
}
export {
  createGardenLife
};
