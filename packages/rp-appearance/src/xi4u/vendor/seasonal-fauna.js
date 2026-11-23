/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 AC.
 * Source: https://github.com/annac777/xi4u @ 336d2a38ed8c170a4599493f1bc20c6c1ef7962c, app/seasonal-fauna.ts
 * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.
 */
import * as T from "three";
import { rockCoating } from "./snow-surface.js";
import { createSpringCat } from "./spring-cat.js";
import { ANCIENT_TREE_ORIGIN, createAncientTrunkCurve, treeHeight } from "./tree-profile.js";
function createSeasonalFauna(ctx) {
  const { root, material, mesh, ellipsoid, line, beam, cx, width, ripple, birdPerch } = ctx;
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const clamp = T.MathUtils.clamp, lerp = T.MathUtils.lerp;
  const ease = (t) => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };
  const blend = (a, b, t) => lerp(a, b, ease(t));
  const group = (name, parent = root) => {
    const g = new T.Group();
    g.name = name;
    parent.add(g);
    return g;
  };
  const spring = group("event-spring-cat"), autumn = group("event-autumn-squirrel"), winter = group("event-winter-birds");
  const cream = material("#fff0cb"), milk = material("#f6f3df"), ginger = material("#d88737"), gold = material("#e7aa55");
  const stripe = material("#b76830"), rust = material("#a15a32"), pink = material("#d69487"), ink = material("#30352c");
  const squirrelCream = material("#f0d5a0"), squirrelOrange = material("#cb7835"), squirrelGold = material("#df9b49");
  const furDark = material("#ae652e"), white = material("#f6f4eb"), featherDark = material("#343b39"), featherGrey = material("#79817a");
  const blush = material("#d4b6ac"), toeMat = material("#777263"), stoneMat = material("#7e8b82", { flatShading: true });
  const stoneLight = material("#b9c4b4", { flatShading: true }), bark = material("#6a5c4b");
  function tapered(points, radii, mat, parent, steps = 36, sides = 9, flatten = 1) {
    const curve = new T.CatmullRomCurve3(points.map((p) => V(...p)));
    const frames = curve.computeFrenetFrames(steps, false), positions = [], indices = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, p = curve.getPoint(t), q = t * (radii.length - 1), k = Math.min(radii.length - 2, Math.floor(q));
      const r = lerp(radii[k], radii[k + 1], q - k);
      for (let j = 0; j <= sides; j++) {
        const a2 = j / sides * Math.PI * 2;
        const v = p.clone().addScaledVector(frames.normals[i], Math.cos(a2) * r).addScaledVector(frames.binormals[i], Math.sin(a2) * r * flatten);
        positions.push(v.x, v.y, v.z);
        if (i < steps && j < sides) {
          const n = i * (sides + 1) + j;
          indices.push(n, n + 1, n + sides + 1, n + 1, n + sides + 2, n + sides + 1);
        }
      }
    }
    const a = positions.length / 3;
    positions.push(...curve.getPoint(0).toArray(), ...curve.getPoint(1).toArray());
    for (let j = 0; j < sides; j++) {
      indices.push(a, j + 1, j);
      const n = steps * (sides + 1) + j;
      indices.push(a + 1, n, n + 1);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return { object: mesh(geo, mat, [0, 0, 0], parent), curve };
  }
  function triangle(points, mat, parent, thickness = 0.018) {
    const a = points[0], b = points[1], c = points[2], p = [];
    for (const z of [-thickness / 2, thickness / 2]) for (const q of [a, b, c]) p.push(q[0], q[1], q[2] + z);
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
    const indices = [0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 2, 0, 3, 2, 3, 5];
    if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    g.setIndex(indices);
    g.computeVertexNormals();
    return mesh(g, mat, [0, 0, 0], parent);
  }
  const quatFor = (up, forward) => {
    const z = forward.clone().normalize(), x = up.clone().cross(z).normalize(), y = z.clone().cross(x).normalize();
    return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
  };
  const springCat = createSpringCat({ ...ctx, root: spring });
  springCat.group.name = "sleeping-orange-white-cat";
  const squirrel = group("foraging-red-squirrel", autumn);
  squirrel.scale.setScalar(0.78);
  const sqTorso = group("squirrel-torso", squirrel);
  ellipsoid(0, 0.168, -0.034, 0.123, 0.132, 0.206, squirrelOrange, sqTorso, 14);
  ellipsoid(0, 0.191, 0.09, 0.098, 0.124, 0.099, squirrelGold, sqTorso, 12);
  ellipsoid(0, 0.155, 0.143, 0.073, 0.102, 0.032, squirrelCream, sqTorso, 12);
  for (const side of [-1, 1]) ellipsoid(side * 0.092, 0.104, -0.123, 0.077, 0.098, 0.106, squirrelGold, sqTorso, 12);
  const sqHead = group("squirrel-head", sqTorso);
  sqHead.position.set(0, 0.266, 0.172);
  ellipsoid(0, 0, 0, 0.12, 0.125, 0.114, squirrelGold, sqHead, 14);
  ellipsoid(0, -0.043, 0.09, 0.087, 0.068, 0.073, squirrelCream, sqHead, 12);
  ellipsoid(0, -0.02, 0.15, 0.022, 0.019, 0.021, ink, sqHead, 10);
  for (const side of [-1, 1]) {
    ellipsoid(side * 0.094, 0.015, 0.057, 0.018, 0.023, 0.011, ink, sqHead, 10);
    ellipsoid(side * 0.1, 0.023, 0.063, 48e-4, 55e-4, 3e-3, milk, sqHead, 6);
    ellipsoid(side * 0.085, 0.118, -0.025, 0.038, 0.066, 0.03, squirrelOrange, sqHead, 10);
    ellipsoid(side * 0.085, 0.122, 2e-3, 0.022, 0.04, 8e-3, pink, sqHead, 10);
    triangle([[side * 0.085 - 0.023, 0.151, -0.028], [side * 0.085 + 0.027, 0.154, -0.028], [side * 0.087, 0.209, -0.038]], furDark, sqHead, 0.022);
    for (let j = 0; j < 2; j++) line([[side * 0.077, -0.04 + j * 0.02, 0.133], [side * 0.134, -0.044 + j * 0.032, 0.138]], squirrelCream, 19e-4, sqHead);
  }
  line([[0, -0.04, 0.164], [0, -0.06, 0.149], [0.018, -0.061, 0.141]], furDark, 25e-4, sqHead);
  const sqTail = group("squirrel-bushy-curled-tail", sqTorso);
  const sqTailPoints = [[0, 0.142, -0.193], [0, 0.213, -0.311], [5e-3, 0.408, -0.352], [6e-3, 0.592, -0.26], [6e-3, 0.628, -0.104], [6e-3, 0.531, -0.07], [6e-3, 0.488, -0.145]];
  tapered(sqTailPoints, [0.048, 0.116, 0.132, 0.105, 0.039], squirrelOrange, sqTail, 42, 10, 0.88);
  for (const side of [-1, 1]) {
    tapered([[side * 0.075, 0.267, -0.334], [side * 0.085, 0.443, -0.32], [side * 0.069, 0.55, -0.244], [side * 0.065, 0.57, -0.137], [side * 0.041, 0.525, -0.103]], [0.027, 0.041, 0.035, 0.02], squirrelCream, sqTail, 26, 8);
    for (let i = 0; i < 7; i++) {
      const t = 0.17 + i * 0.087, curve = new T.CatmullRomCurve3(sqTailPoints.map((p2) => V(...p2))), p = curve.getPoint(t);
      triangle([[side * 0.056, p.y - 0.024, p.z - 0.04], [side * 0.056, p.y + 0.033, p.z + 0.015], [side * 0.065, p.y + 8e-3, p.z - 0.1]], i % 3 ? ginger : furDark, sqTail, 0.025);
    }
  }
  const legs = [];
  function bone(parent, rA, rB, mat) {
    const profile = [[0, -0.5], [rA * 0.7, -0.47], [rA, -0.31], [rA * 0.99, -0.1], [lerp(rA, rB, 0.65), 0.2], [rB, 0.39], [rB * 0.72, 0.47], [0, 0.5]];
    return mesh(new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(r, y)), 10), mat, [0, 0, 0], parent);
  }
  function placeBone(o, a, b) {
    const d = b.clone().sub(a);
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.scale.y = d.length();
    o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  }
  for (const side of [-1, 1]) for (const front of [false, true]) {
    const upper = bone(squirrel, front ? 0.058 : 0.075, front ? 0.048 : 0.058, squirrelOrange);
    const lower = bone(squirrel, front ? 0.045 : 0.051, front ? 0.031 : 0.033, squirrelGold);
    upper.name = front ? "squirrel-furry-upper-foreleg" : "squirrel-furry-thigh";
    lower.name = front ? "squirrel-furry-forearm" : "squirrel-furry-shin";
    const foot = group(front ? "squirrel-forepaw" : "squirrel-hindpaw", squirrel);
    ellipsoid(0, 0, 0.017, front ? 0.046 : 0.057, 0.031, front ? 0.061 : 0.077, squirrelGold, foot, 12);
    for (let j = -1; j <= 1; j++) {
      ellipsoid(j * (front ? 0.02 : 0.024), -3e-3, front ? 0.055 : 0.069, front ? 0.017 : 0.02, 0.019, 0.025, squirrelGold, foot, 8);
      line([[j * 0.02, -9e-3, front ? 0.068 : 0.081], [j * 0.021, -6e-3, front ? 0.079 : 0.094]], furDark, 27e-4, foot);
    }
    legs.push({ side, front, upper, lower, foot });
  }
  const coneHeld = group("squirrel-found-pinecone", sqTorso), coneGround = group("pinecone-in-leaves", autumn);
  function pinecone(parent) {
    ellipsoid(0, 0, 0, 0.037, 0.06, 0.037, rust, parent, 8);
    for (let row = 0; row < 4; row++) for (let j = 0; j < 6; j++) {
      const a = j / 6 * Math.PI * 2 + row % 2 * 0.52, r = Math.sin((row + 1) / 5 * Math.PI) * 0.032;
      const p = ellipsoid(Math.cos(a) * r, -0.043 + row * 0.029, Math.sin(a) * r, 0.019, 0.018, 0.012, j % 2 ? furDark : rust, parent, 6);
      p.rotation.y = -a;
    }
    beam([0, 0.05, 0], [6e-3, 0.072, 3e-3], 6e-3, 3e-3, bark, parent);
  }
  pinecone(coneHeld);
  pinecone(coneGround);
  coneHeld.position.set(0, 0.13, 0.259);
  coneHeld.rotation.x = 0.75;
  const leafCenter = V(-3.18, 0.292, 1.86);
  coneGround.position.copy(leafCenter).add(V(0.04, 0.045, 0.035));
  coneGround.rotation.z = 0.7;
  const leafMats = ["#b87036", "#ca8b3d", "#d5ad56", "#a85830", "#c1974d"].map((c) => material(c, { side: T.DoubleSide, flatShading: true }));
  const leafGeo = (() => {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute([0, 0.018, 0, -0.04, 0, -0.07, -0.085, 0, -0.013, -0.045, 0, 0.022, -0.036, 0, 0.073, 0, 5e-3, 0.052, 0.036, 0, 0.073, 0.045, 0, 0.022, 0.085, 0, -0.013, 0.04, 0, -0.07], 3));
    g.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6, 0, 6, 7, 0, 7, 8, 0, 8, 9, 0, 9, 1]);
    g.computeVertexNormals();
    return g;
  })();
  const leaves = [];
  for (let i = 0; i < 31; i++) {
    const a = i * 2.399, r = Math.sqrt((i + 0.5) / 31) * 0.34, x = leafCenter.x + Math.cos(a) * r, z = leafCenter.z + Math.sin(a) * r * 0.79;
    const o = mesh(leafGeo, leafMats[i % leafMats.length], [x, 0.288 + (1 - r / 0.4) * 0.033 + i % 3 * 6e-3, z], autumn);
    o.rotation.set(Math.sin(i * 3.7) * 0.12, a, Math.cos(i) * 0.1);
    o.scale.setScalar(0.72 + i % 5 * 0.12);
    leaves.push({ o, x, z, y: o.position.y, ry: a });
  }
  const trunk = ctx.treeTrunk || createAncientTrunkCurve(), treeOrigin = V(...ANCIENT_TREE_ORIGIN);
  function onTrunk(height, angle, down = true) {
    height = treeHeight(height);
    let lo = 0, hi = 1;
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      if (trunk.getPoint(mid).y < height) lo = mid;
      else hi = mid;
    }
    const t = (lo + hi) / 2, c = trunk.getPoint(t), tangent = trunk.getTangent(t).normalize(), radial = V(Math.sin(angle), 0, Math.cos(angle));
    radial.addScaledVector(tangent, -radial.dot(tangent)).normalize();
    const radius = lerp(0.48, 0.105, Math.pow(t, 0.7));
    return { p: c.add(treeOrigin).addScaledVector(radial, radius + 8e-3), q: quatFor(radial, tangent.multiplyScalar(down ? -1 : 1)) };
  }
  const frontAngle = 0.92, backAngle = 0.58 + Math.PI;
  const groundStart = V(-3.12, 0.301, 0.35);
  const walkCurve = new T.CatmullRomCurve3([groundStart, V(-2.76, 0.302, 0.72), V(-2.87, 0.303, 1.34), V(-3.1, 0.304, 1.66)]);
  const lastWalk = walkCurve.getPoint(1), walkEndQ = quatFor(V(0, 1, 0), walkCurve.getTangent(1));
  const groundQ = quatFor(V(0, 1, 0), walkCurve.getTangent(0));
  const reverseQ = (q) => q.clone().multiply(new T.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI));
  const reverseGroundQ = reverseQ(groundQ), reverseEndQ = reverseQ(walkEndQ);
  const nearTrunk = V(-3.52, 0.301, 0.24), nearQ = quatFor(V(0, 1, 0), groundStart.clone().sub(nearTrunk)), reverseNearQ = reverseQ(nearQ);
  const lowDown = onTrunk(0.31, frontAngle, true), lowUp = onTrunk(0.31, frontAngle, false);
  const SQ_CYCLE = 48, SQ_SCALE = 0.78, SQ_STANCE = 0.7, SQ_GROUND = 0.3, SQ_PAW = 0.031;
  const sqSmoother = (u) => {
    u = clamp(u, 0, 1);
    return u * u * u * (u * (u * 6 - 15) + 10);
  };
  const sqTravel = (u) => {
    u = clamp(u, 0, 1);
    const r = 0.14;
    return u < r ? u * u / (2 * r * (1 - r)) : u > 1 - r ? 1 - (1 - u) * (1 - u) / (2 * r * (1 - r)) : (u - r / 2) / (1 - r);
  };
  const sqStages = [];
  function sqStage(a, b, fn, surface = "ground", down = false) {
    const samples = [], count = 120;
    let length = 0, prior = null;
    for (let i = 0; i <= count; i++) {
      const u = i / count, p = fn(u);
      if (prior) length += p.p.distanceTo(prior.p) + p.q.angleTo(prior.q) * 0.115;
      samples.push({ u, d: length });
      prior = p;
    }
    const cycles = length < 1e-5 ? 0 : Math.max(1, Math.round(length / 0.155));
    const c0 = sqStages.length ? sqStages[sqStages.length - 1].c1 : 0.64;
    const bursts = [];
    if (cycles) {
      const activeTotal = (b - a) / 2.6, bouts = Math.min(cycles, Math.max(1, Math.ceil(activeTotal / 0.78)));
      let phase = 0, clock = 0;
      for (let i = 0; i < bouts; i++) {
        const next = Math.round((i + 1) * cycles / bouts), duration = activeTotal * (next - phase) / cycles;
        bursts.push({ start: clock, end: clock + duration, c0: c0 + phase, c1: c0 + next });
        phase = next;
        clock += duration + 0.3;
      }
    }
    sqStages.push({ a, b, fn, surface, down, samples, length, cycles, c0, c1: c0 + cycles, bursts });
  }
  const treeMove = (h0, h1, a0, a1, down) => (u) => onTrunk(lerp(h0, h1, sqTravel(u)), lerp(a0, a1, sqTravel(u)), down);
  const stillTree = (h, a, down) => () => onTrunk(h, a, down);
  const groundMove = (from, to, reverse = false) => (u) => {
    const v = lerp(from, to, sqTravel(u));
    return { p: walkCurve.getPoint(v), q: quatFor(V(0, 1, 0), walkCurve.getTangent(v).multiplyScalar(reverse ? -1 : 1)) };
  };
  const stillGround = (p, q) => () => ({ p: p.clone(), q: q.clone() });
  const transfer = (from, to, q0, q1) => (u) => {
    const v = sqTravel(u);
    return { p: from.clone().lerp(to, v), q: q0.clone().slerp(q1, v) };
  };
  sqStage(0, 0.65, stillTree(2.65, backAngle, true), "trunk", true);
  sqStage(0.65, 3.2, treeMove(2.65, 2.3, backAngle, frontAngle, true), "trunk", true);
  sqStage(3.2, 6.6, treeMove(2.3, 1.28, frontAngle, frontAngle, true), "trunk", true);
  sqStage(6.6, 7.5, stillTree(1.28, frontAngle, true), "trunk", true);
  sqStage(7.5, 10.7, treeMove(1.28, 0.31, frontAngle, frontAngle, true), "trunk", true);
  sqStage(10.7, 12.15, transfer(lowDown.p, nearTrunk, lowDown.q, nearQ), "transfer", true);
  sqStage(12.15, 13.4, transfer(nearTrunk, groundStart, nearQ, groundQ));
  sqStage(13.4, 15.6, groundMove(0, 0.49));
  sqStage(15.6, 16.15, () => groundMove(0, 0.49)(1));
  sqStage(16.15, 18.7, groundMove(0.49, 1));
  sqStage(18.7, 26, stillGround(lastWalk, walkEndQ));
  sqStage(26, 27.35, (u) => ({ p: lastWalk.clone(), q: walkEndQ.clone().slerp(reverseEndQ, ease(u)) }));
  sqStage(27.35, 32.55, groundMove(1, 0, true));
  sqStage(32.55, 33.7, transfer(groundStart, nearTrunk, reverseGroundQ, reverseNearQ));
  sqStage(33.7, 35.1, transfer(nearTrunk, lowUp.p, reverseNearQ, lowUp.q), "transfer", false);
  sqStage(35.1, 38, treeMove(0.31, 1.4, frontAngle, frontAngle, false), "trunk", false);
  sqStage(38, 38.8, stillTree(1.4, frontAngle, false), "trunk", false);
  sqStage(38.8, 41.25, treeMove(1.4, 2.3, frontAngle, frontAngle, false), "trunk", false);
  sqStage(41.25, 43.9, treeMove(2.3, 2.65, frontAngle, backAngle, false), "trunk", false);
  sqStage(43.9, 48, stillTree(2.65, backAngle, false), "trunk", false);
  function sqPoseAtPhase(s, c) {
    if (!s.cycles) return { ...s.fn(1), s, c };
    const d = clamp((c - s.c0) / s.cycles, 0, 1) * s.length;
    let lo = 0, hi = 120;
    while (hi - lo > 1) {
      const m = lo + hi >> 1;
      if (s.samples[m].d < d) lo = m;
      else hi = m;
    }
    const f = (d - s.samples[lo].d) / Math.max(1e-6, s.samples[hi].d - s.samples[lo].d), u = (lo + f) / 120;
    return { ...s.fn(u), s, c };
  }
  function sqAtTime(t) {
    const s = sqStages.find((s2) => t < s2.b) || sqStages[sqStages.length - 1], clock = t - s.a;
    let c = s.c0, active = false, burst = -1;
    for (let i = 0; i < s.bursts.length; i++) {
      const b = s.bursts[i];
      if (clock >= b.end) {
        c = b.c1;
        continue;
      }
      if (clock >= b.start) {
        c = lerp(b.c0, b.c1, sqTravel((clock - b.start) / (b.end - b.start)));
        active = true;
        burst = i;
      }
      break;
    }
    return { ...sqPoseAtPhase(s, c), t, active, burst };
  }
  function sqAtStep(c) {
    const s = sqStages.find((s2) => s2.cycles > 0 && c <= s2.c1) || sqStages[sqStages.length - 1];
    return sqPoseAtPhase(s, c);
  }
  function sqTreeContact(guess) {
    let lo = 0, hi = 1;
    const y = clamp(guess.y - treeOrigin.y, 0, trunk.getPoint(1).y);
    for (let i = 0; i < 18; i++) {
      const m = (lo + hi) / 2;
      if (trunk.getPoint(m).y < y) lo = m;
      else hi = m;
    }
    const t = (lo + hi) / 2, center = trunk.getPoint(t).add(treeOrigin), axis = trunk.getTangent(t).normalize();
    const n = guess.clone().sub(center);
    n.addScaledVector(axis, -n.dot(axis)).normalize();
    const r = lerp(0.48, 0.105, Math.pow(t, 0.7));
    return { p: center.addScaledVector(n, r + SQ_PAW * SQ_SCALE + 4e-3), n };
  }
  function sqMakeContact(l, k) {
    const at = sqAtStep(k + l.phase + SQ_STANCE * 0.5), climb = at.s.surface !== "ground";
    const spread = climb ? at.s.down ? l.front ? 0.112 : 0.139 : l.front ? 0.135 : 0.115 : l.front ? 0.096 : 0.118;
    const guess = V(l.side * spread, 0.034, l.front ? 0.181 : -0.154).multiplyScalar(SQ_SCALE).applyQuaternion(at.q).add(at.p);
    const flat = { p: V(guess.x, SQ_GROUND + SQ_PAW * SQ_SCALE, guess.z), n: V(0, 1, 0) }, tree = sqTreeContact(guess);
    let contact = at.s.surface === "ground" ? flat : tree;
    if (at.s.surface === "transfer") contact = guess.distanceTo(flat.p) < guess.distanceTo(tree.p) ? flat : tree;
    let forward = V(0, 0, 1).applyQuaternion(at.q);
    if (!l.front && at.s.down && contact === tree) forward.negate();
    forward.addScaledVector(contact.n, -forward.dot(contact.n));
    if (forward.lengthSq() < 1e-3) forward = V(0, 0, 1).addScaledVector(contact.n, -contact.n.z);
    contact.q = quatFor(contact.n, forward.normalize());
    contact.tree = contact === tree;
    return contact;
  }
  for (const l of legs) {
    l.phase = (l.front ? 0.5 : 0) + (l.side > 0 ? 0.08 : 0);
    l.contacts = [];
    l.upperLength = l.front ? 0.17 : 0.155;
    l.lowerLength = l.front ? 0.165 : 0.17;
    l.joint = ellipsoid(0, 0, 0, l.front ? 0.046 : 0.058, l.front ? 0.043 : 0.052, l.front ? 0.046 : 0.058, squirrelGold, squirrel, 10);
    l.joint.name = l.front ? "squirrel-elbow" : "squirrel-knee";
    for (let k = -1; k <= Math.ceil(sqStages[sqStages.length - 1].c1) + 2; k++) l.contacts[k + 1] = sqMakeContact(l, k);
  }
  function sqFootAt(l, c) {
    const step = c - l.phase, k = Math.floor(step), phase = step - k, A = l.contacts[k + 1], B = l.contacts[k + 2];
    const swing = clamp((phase - SQ_STANCE) / (1 - SQ_STANCE), 0, 1), u = sqSmoother(swing);
    const p = A.p.clone(), q = A.q.clone(), lift = 16 * swing * swing * (1 - swing) * (1 - swing);
    if (swing > 0) {
      const n = A.n.clone().lerp(B.n, u).normalize();
      p.lerp(B.p, u).addScaledVector(n, lift * (A.tree && B.tree ? 0.023 : 0.029));
      q.slerp(B.q, u);
    }
    return { p, q, lift, stance: swing === 0, phase, step: k };
  }
  function sqSolveJoint(a, b, l) {
    const delta = b.clone().sub(a), distance = delta.length(), direction = delta.clone().normalize();
    const d = clamp(distance, 1e-4, l.upperLength + l.lowerLength - 1e-5);
    const along = (l.upperLength * l.upperLength - l.lowerLength * l.lowerLength + d * d) / (2 * d);
    const rise = Math.sqrt(Math.max(0, l.upperLength * l.upperLength - along * along));
    const pole = V(l.side * 0.32, 0.035, l.front ? -1 : 1);
    pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    const center = a.clone().addScaledVector(direction, along), clearance = Math.max(0.075, b.y + 0.036);
    if (center.y + pole.y * rise < clearance) {
      const away = V(0, 1, 0).addScaledVector(direction, -direction.y).normalize();
      let lo = 0, hi = 1;
      for (let i = 0; i < 14; i++) {
        const u = (lo + hi) / 2, p = pole.clone().lerp(away, u).normalize();
        if (center.y + p.y * rise < clearance) lo = u;
        else hi = u;
      }
      pole.lerp(away, hi).normalize();
    }
    return { joint: center.addScaledVector(pole, rise), reach: distance / (l.upperLength + l.lowerLength) };
  }
  coneGround.position.copy(V(0, 0.045, 0.305).multiplyScalar(SQ_SCALE).applyQuaternion(walkEndQ).add(lastWalk));
  coneGround.quaternion.copy(walkEndQ).multiply(new T.Quaternion().setFromEuler(new T.Euler(0.75, 0, 0)));
  coneGround.scale.setScalar(SQ_SCALE);
  function poseSquirrel(t, at, sit = 0, sniff = 0, holding = false) {
    const inverse = at.q.clone().invert(), feet = legs.map((l) => sqFootAt(l, at.c));
    const climbing = 1 - clamp(V(0, 1, 0).applyQuaternion(at.q).y, 0, 1);
    let lateral = 0, longitudinal = 0;
    feet.forEach((f, i) => {
      lateral -= legs[i].side * f.lift;
      longitudinal += (legs[i].front ? -1 : 1) * f.lift;
    });
    sqTorso.position.set(lateral * 0.013, -0.016 * climbing + longitudinal * 5e-3 - 8e-3 * sniff + 0.01 * sit, longitudinal * 0.017 - 0.024 * sit);
    sqTorso.rotation.set(-0.13 * sit + (at.s.down ? -0.028 : 0.028) * climbing - longitudinal * 0.015, 0, lateral * 0.015);
    sqHead.rotation.set(sniff * 0.38 - sit * 0.2, Math.sin(t * 1.65) * 0.065 * sniff, Math.sin(t * 0.55) * 0.012);
    sqHead.position.y = 0.266 - 0.022 * sniff;
    sqTail.rotation.set(0.035 * sit - longitudinal * 0.016, 0, -lateral * 0.023 + Math.sin(t * 0.62) * 0.01);
    const torsoQ = new T.Quaternion().setFromEuler(sqTorso.rotation), records = [];
    for (let i = 0; i < legs.length; i++) {
      const l = legs[i], f = feet[i], foot = f.p.clone().sub(at.p).applyQuaternion(inverse).multiplyScalar(1 / SQ_SCALE);
      if (l.front && sit > 0) foot.lerp(V(l.side * 0.047, 0.149, 0.275).applyQuaternion(torsoQ).add(sqTorso.position), sit);
      const shoulder = V(l.side * (l.front ? 0.077 : 0.096), l.front ? 0.205 : 0.142, l.front ? 0.099 : -0.118).applyQuaternion(torsoQ).add(sqTorso.position);
      const ik = sqSolveJoint(shoulder, foot, l);
      placeBone(l.upper, shoulder, ik.joint);
      placeBone(l.lower, ik.joint, foot);
      l.joint.position.copy(ik.joint);
      l.foot.position.copy(foot);
      l.foot.quaternion.copy(inverse).multiply(f.q);
      if (l.front && sit > 0) l.foot.quaternion.slerp(new T.Quaternion().setFromEuler(new T.Euler(-0.6, 0, 0)), sit);
      records.push({ front: l.front, side: l.side, stance: f.stance && !(l.front && sit > 0), step: f.step, reach: ik.reach, world: f.p.toArray(), upper: l.upper.scale.y, lower: l.lower.scale.y });
    }
    squirrel.userData.motion = { phase: at.c, stage: [at.s.a, at.s.b], climbing, active: at.active, burst: at.burst, clock: t, feet: records };
    coneHeld.visible = holding;
    coneHeld.position.set(0, lerp(0.232, 0.148, sit), lerp(0.327, 0.259, sit));
  }
  const bankZ = 0.55, bankX = cx(bankZ) - width(bankZ), rockCenter = V(bankX + 0.2, 0, bankZ);
  const rockGeo = new T.BufferGeometry(), rockP = [], rockI = [], rockSides = 18;
  const rockRings = [[0.015, 0.89], [0.1, 1], [0.153, 0.87]];
  for (const [y, r] of rockRings) for (let i = 0; i < rockSides; i++) {
    const a = i / rockSides * Math.PI * 2, f = 1 + 0.035 * Math.sin(a * 3) + 0.02 * Math.cos(a * 5);
    rockP.push(Math.cos(a) * 0.4 * r * f, y, Math.sin(a) * 0.31 * r * f);
  }
  for (let j = 0; j < 2; j++) for (let i = 0; i < rockSides; i++) {
    const n = j * rockSides + i, k = j * rockSides + (i + 1) % rockSides;
    rockI.push(n, n + rockSides, k, k, n + rockSides, k + rockSides);
  }
  const top = rockP.length / 3;
  rockP.push(0, 0.153, 0, 0, 0.015, 0);
  for (let i = 0; i < rockSides; i++) {
    const n = 2 * rockSides + i, k = 2 * rockSides + (i + 1) % rockSides;
    rockI.push(top, k, n, top + 1, i, (i + 1) % rockSides);
  }
  rockGeo.setAttribute("position", new T.Float32BufferAttribute(rockP, 3));
  rockGeo.setIndex(rockI);
  rockGeo.computeVertexNormals();
  const rock = mesh(rockGeo, stoneMat, rockCenter.toArray(), ctx.root);
  rock.name = "bird-drinking-rock";
  const rockSnow = mesh(rockCoating(rockGeo, 4e-3), white, [0, 0, 0], rock);
  rockSnow.name = "bird-rock-attached-snow";
  const perch = V(bankX + 0.485, 0.157, bankZ - 0.018), branchPerch = birdPerch.clone();
  const bird = group("winter-long-tailed-tit", winter), birdTorso = group("bird-crouching-body", bird);
  const birdFeet = group("bird-planted-feet", bird), foldedWings = group("bird-folded-wings", birdTorso), openWings = group("bird-flight-wings", birdTorso);
  ellipsoid(0, 0.13, -0.014, 0.113, 0.134, 0.144, white, birdTorso, 14);
  ellipsoid(0, 0.171, -0.086, 0.077, 0.091, 0.08, featherDark, birdTorso, 12);
  ellipsoid(0, 0.072, 0.052, 0.087, 0.076, 0.077, milk, birdTorso, 12);
  const birdHead = group("bird-white-round-head", birdTorso);
  birdHead.position.set(0, 0.21, 0.08);
  ellipsoid(0, 0.02, -0.012, 0.105, 0.109, 0.104, white, birdHead, 14);
  const neckSteps = 14, neckSides = 14, neckPositions = new Float32Array(((neckSteps + 1) * (neckSides + 1) + 2) * 3), neckIndices = [];
  for (let i = 0; i < neckSteps; i++) for (let j = 0; j < neckSides; j++) {
    const n = i * (neckSides + 1) + j;
    neckIndices.push(n, n + 1, n + neckSides + 1, n + 1, n + neckSides + 2, n + neckSides + 1);
  }
  const neckCap = (neckSteps + 1) * (neckSides + 1);
  for (let j = 0; j < neckSides; j++) {
    neckIndices.push(neckCap, j + 1, j);
    const n = neckSteps * (neckSides + 1) + j;
    neckIndices.push(neckCap + 1, n, n + 1);
  }
  const neckGeo = new T.BufferGeometry();
  neckGeo.setAttribute("position", new T.BufferAttribute(neckPositions, 3));
  neckGeo.setIndex(neckIndices);
  const birdNeck = mesh(neckGeo, white, [0, 0, 0], birdTorso);
  birdNeck.name = "bird-continuous-white-neck";
  const neckStart = V(0, 0.168, 0.041), neckEnd = V(), neckAxis = V(), neckAcross = V(), neckUp = V(), neckPoint = V();
  function updateBirdNeck() {
    birdHead.updateMatrix();
    neckEnd.set(0, 5e-3, -0.05).applyMatrix4(birdHead.matrix);
    const positions = neckGeo.attributes.position, bend = Math.min(0.01, neckEnd.distanceToSquared(neckStart));
    for (let i = 0; i <= neckSteps; i++) {
      const u = i / neckSteps, bulge = Math.sin(Math.PI * u), r = lerp(0.064, 0.049, u) + 8e-3 * bulge;
      neckAxis.copy(neckEnd).sub(neckStart);
      neckAxis.y += bend * Math.PI * Math.cos(Math.PI * u);
      neckAxis.normalize();
      neckAcross.set(1, 0, 0).addScaledVector(neckAxis, -neckAxis.x).normalize();
      neckUp.crossVectors(neckAxis, neckAcross).normalize();
      for (let j = 0; j <= neckSides; j++) {
        const a = j / neckSides * Math.PI * 2, feathers = 1 + 0.025 * Math.cos(a * 5) * bulge;
        neckPoint.copy(neckStart).lerp(neckEnd, u);
        neckPoint.y += bend * bulge;
        neckPoint.addScaledVector(neckAcross, Math.cos(a) * r * feathers).addScaledVector(neckUp, Math.sin(a) * r * feathers);
        positions.setXYZ(i * (neckSides + 1) + j, neckPoint.x, neckPoint.y, neckPoint.z);
      }
    }
    positions.setXYZ(neckCap, neckStart.x, neckStart.y, neckStart.z);
    positions.setXYZ(neckCap + 1, neckEnd.x, neckEnd.y, neckEnd.z);
    positions.needsUpdate = true;
    neckGeo.computeVertexNormals();
    neckGeo.computeBoundingBox();
    neckGeo.computeBoundingSphere();
  }
  updateBirdNeck();
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.25;
    triangle([[-0.018, 0.1, -9e-3], [0.018, 0.1, -9e-3], [a * 0.024, 0.139 - Math.abs(i - 2) * 6e-3, -0.021]], white, birdHead, 0.019);
  }
  for (const side of [-1, 1]) {
    ellipsoid(side * 0.077, 0.035, 0.058, 0.012, 0.013, 9e-3, ink, birdHead, 10);
    ellipsoid(side * 0.08, 0.04, 0.063, 35e-4, 35e-4, 2e-3, white, birdHead, 6);
    ellipsoid(side * 0.1, 0.019, -0.04, 6e-3, 0.028, 0.038, featherGrey, birdHead, 10);
    const shoulder = ellipsoid(side * 0.102, 0.199, -6e-3, 0.021, 0.046, 0.051, blush, birdTorso, 12);
    shoulder.rotation.x = 0.35;
    const w = ellipsoid(side * 0.097, 0.132, -0.079, 0.032, 0.106, 0.137, featherDark, foldedWings, 12);
    w.rotation.x = 0.36;
    w.rotation.z = side * 0.16;
    for (let j = 0; j < 3; j++) {
      const f = ellipsoid(side * (0.106 + j * 1e-3), 0.131 - j * 0.017, -0.087 - j * 0.016, 9e-3, 0.067, 0.094, j === 1 ? white : featherGrey, foldedWings, 10);
      f.rotation.x = 0.57;
    }
  }
  const beak = mesh(new T.ConeGeometry(0.013, 0.03, 6), ink, [0, 0.015, 0.105], birdHead);
  beak.rotation.x = Math.PI / 2;
  const birdTail = group("bird-long-black-white-tail", birdTorso);
  birdTail.position.set(0, 0.092, -0.13);
  birdTail.rotation.x = 0.32;
  for (let i = -2; i <= 2; i++) {
    const feather = ellipsoid(i * 0.014, -8e-3, -0.17 + Math.abs(i) * 0.017, 0.013, 0.01, 0.19 - Math.abs(i) * 0.015, Math.abs(i) === 2 ? white : featherDark, birdTail, 10);
    feather.rotation.y = -i * 0.016;
  }
  line([[-0.025, 2e-3, -8e-3], [-0.025, -6e-3, -0.175], [-0.014, -0.01, -0.343]], white, 38e-4, birdTail);
  line([[0.023, 2e-3, -8e-3], [0.025, -6e-3, -0.17], [0.015, -0.01, -0.344]], white, 38e-4, birdTail);
  const birdWingRig = [];
  for (const side of [-1, 1]) {
    const wing = group("bird-spread-wing", openWings);
    wing.position.set(side * 0.074, 0.207, -0.018);
    const coords = [[0, 0, 0], [side * 0.11, -0.018, 0.019], [side * 0.26, -0.028, -0.076], [side * 0.286, -0.035, -0.195], [side * 0.129, -0.013, -0.153], [side * 0.027, 0, -0.076]];
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(coords.flat(), 3));
    g.setIndex([0, 1, 2, 0, 2, 4, 2, 3, 4, 0, 4, 5]);
    g.computeVertexNormals();
    const wm = material("#424944", { side: T.DoubleSide, flatShading: true });
    mesh(g, wm, [0, 0, 0], wing);
    for (let j = 0; j < 4; j++) line([[side * (0.05 + j * 0.035), -6e-3, -0.055], [side * (0.15 + j * 0.035), -0.026, -0.165 - j * 5e-3]], j % 2 ? featherGrey : white, 7e-3, wing);
    birdWingRig.push({ wing, side });
    const x = side * 0.038;
    beam([x, 0.06, -2e-3], [x, 0.02, 9e-3], 8e-3, 6e-3, toeMat, birdFeet);
    for (const dz of [-0.021, 0.01, 0.03]) line([[x, 0.02, 9e-3], [x + side * 0.016, 7e-3, dz], [x + side * 0.026, 3e-3, dz + 7e-3]], toeMat, 4e-3, birdFeet);
  }
  const landingQ = new T.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2);
  const branchYaw = ctx.birdPerchYaw ?? Math.PI / 2 - 0.74;
  const branchQ = new T.Quaternion().setFromAxisAngle(V(0, 1, 0), branchYaw);
  const branchFeet = group("bird-branch-gripping-feet", bird), gripSurfaces = ctx.birdGripSurfaces;
  ctx.root.updateMatrixWorld(true);
  const gripRay = new T.Raycaster(), gripInverse = branchQ.clone().invert(), gripTips = [];
  const gripWorld = (p) => p.clone().applyQuaternion(branchQ).add(branchPerch);
  const gripLocal = (p) => p.clone().sub(branchPerch).applyQuaternion(gripInverse);
  function gripSurface(x, z) {
    const w = gripWorld(V(x, 0, z));
    gripRay.set(V(w.x, branchPerch.y + 0.32, w.z), V(0, -1, 0));
    gripRay.far = 0.85;
    const hit = gripRay.intersectObjects(gripSurfaces, false)[0];
    if (!hit) throw new Error("Bird branch grip lies outside the supporting limb");
    return gripLocal(hit.point);
  }
  function settleGripMesh(o) {
    o.updateMatrix();
    const inv = o.matrix.clone().invert(), p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = V().fromBufferAttribute(p, i).applyMatrix4(o.matrix), surface = gripSurface(v.x, v.z);
      if (v.y < surface.y + 5e-4) {
        v.y = surface.y + 5e-4;
        v.applyMatrix4(inv);
        p.setXYZ(i, v.x, v.y, v.z);
      }
    }
    p.needsUpdate = true;
    o.geometry.computeVertexNormals();
    o.geometry.computeBoundingBox();
    o.geometry.computeBoundingSphere();
  }
  for (const side of [-1, 1]) {
    const x = side * 0.022, sole = gripSurface(x, 4e-3), ankle = sole.clone().add(V(0, 0.014, 0));
    const hip = V(side * 0.034, 0.06, -2e-3), knee = hip.clone().lerp(ankle, 0.55).add(V(side * 4e-3, 0.013, 4e-3));
    beam(hip, knee, 75e-4, 6e-3, toeMat, branchFeet).name = "bird-branch-upper-leg";
    beam(knee, ankle, 6e-3, 45e-4, toeMat, branchFeet).name = "bird-branch-lower-leg";
    ellipsoid(knee.x, knee.y, knee.z, 75e-4, 8e-3, 75e-4, toeMat, branchFeet, 8).name = "bird-branch-ankle-joint";
    for (let j = 0; j < 4; j++) {
      const end = j === 3 ? V(x - side * 3e-3, 0, -0.02) : V(x + (j - 1) * 8e-3, 0, 0.028 + (j === 1 ? 4e-3 : 0));
      const points = [];
      for (let k = 0; k <= 8; k++) {
        const u = k / 8, p = gripSurface(lerp(x, end.x, u), lerp(4e-3, end.z, u));
        p.y += 33e-4 + 0.0107 * (1 - u) * (1 - u);
        points.push(p.toArray());
      }
      const toe = line(points, toeMat, 28e-4, branchFeet);
      toe.name = "bird-branch-gripping-toe";
      settleGripMesh(toe);
      gripTips.push(gripWorld(V(...points[8])).toArray());
    }
  }
  branchFeet.visible = false;
  bird.userData.branchGrip = { tips: gripTips, yaw: branchYaw };
  const sky = branchPerch.y + 0.55;
  const inbound = new T.CatmullRomCurve3([branchPerch, branchPerch.clone().add(V(-0.18, 0.7, 0.6)), V(-2.65, 5.35, 1.35), V(-3.7, 3.1, 1.85), V(-3.35, 1.8, perch.z), perch.clone().add(V(-1, 0.68, 0)), perch.clone().add(V(-0.26, 0.12, 0)), perch]);
  const outbound = new T.CatmullRomCurve3([perch, perch.clone().add(V(0.24, 0.32, 0.17)), V(0.25, 1.75, 1.55), V(1.05, 3.8, 1.25), V(1.2, sky + 0.2, 0.2), V(0.55, sky + 0.3, -0.8), branchPerch.clone().add(V(0.65, 0.48, -0.28)), branchPerch.clone().add(V(0.25, 0.12, -0.12)), branchPerch]);
  inbound.arcLengthDivisions = 800;
  outbound.arcLengthDivisions = 800;
  bird.userData.branchPerch = branchPerch.toArray();
  bird.userData.drinkingPerch = perch.toArray();
  bird.userData.flightRoutes = { inbound: inbound.points.map((p) => p.toArray()), outbound: outbound.points.map((p) => p.toArray()) };
  let lastSip = -1;
  function flyBird(curve, u, t, fromQ, toQ) {
    branchFeet.visible = false;
    birdFeet.visible = true;
    const e = ease(u);
    bird.position.copy(curve.getPointAt(e));
    const tangent = curve.getTangentAt(clamp(e, 2e-3, 0.998)).normalize(), heading = V(tangent.x, 0, tangent.z).normalize();
    const pitch = -clamp(Math.atan2(tangent.y, Math.hypot(tangent.x, tangent.z)) * 0.16, -0.12, 0.12);
    const q = quatFor(V(0, 1, 0), heading).multiply(new T.Quaternion().setFromAxisAngle(V(1, 0, 0), pitch));
    const arrival = ease((u - 0.84) / 0.16), departure = ease(u / 0.12);
    bird.quaternion.copy(fromQ).slerp(q, departure).slerp(toQ, arrival);
    const flapEnvelope = Math.min(1, u / 0.07, (1 - u) / 0.18);
    const ahead = curve.getTangentAt(clamp(e + 0.025, 0, 1));
    ahead.y = 0;
    ahead.normalize();
    const turn = Math.atan2(heading.clone().cross(ahead).y, heading.dot(ahead)), bank = clamp(-turn * 1.6, -0.2, 0.2) * Math.sin(u * Math.PI);
    birdTorso.rotation.set(0, 0, bank);
    birdTorso.position.y = 6e-3 + 3e-3 * Math.sin(t * 34) * Math.sin(Math.PI * u);
    birdHead.position.set(0, 0.21, 0.08);
    birdHead.rotation.set(-0.05, 0, 0);
    birdTail.rotation.x = 0.32 + 0.1 * Math.sin(u * Math.PI);
    foldedWings.visible = false;
    openWings.visible = true;
    for (const { wing, side } of birdWingRig) {
      const beat = Math.sin(t * 34);
      wing.rotation.z = side * (0.12 + beat * 0.88 * flapEnvelope);
      wing.rotation.y = side * Math.cos(t * 34) * 0.17 * flapEnvelope;
      wing.scale.x = (0.32 + 0.68 * clamp(flapEnvelope, 0, 1)) * (1 - Math.max(0, beat) * 0.15);
    }
    birdFeet.rotation.x = 0.4 * Math.sin(Math.PI * u);
    bird.userData.flightPose = { u, pitch, bank };
  }
  function perchBird(position, q, t, drink = 0, swallow = 0, look = 0, nod = 0) {
    branchFeet.visible = position === branchPerch;
    birdFeet.visible = !branchFeet.visible;
    bird.position.copy(position);
    bird.quaternion.copy(q);
    foldedWings.visible = true;
    openWings.visible = false;
    birdFeet.rotation.x = 0;
    const theta = 0.28, totalPitch = 1.38, reachZ = 0.155;
    const reachY = (0.078 - perch.y - 0.034 + reachZ * Math.sin(theta) - 0.015 * Math.cos(totalPitch) + 0.12 * Math.sin(totalPitch)) / Math.cos(theta);
    birdTorso.position.y = 6e-3 + 0.028 * drink;
    birdTorso.rotation.set(theta * drink, 0, 0);
    birdHead.position.set(0, lerp(0.21, reachY, drink) - nod * 9e-3, lerp(0.08, reachZ, drink) + nod * 2e-3);
    birdHead.rotation.set((totalPitch - theta) * drink + nod * 0.095 - 0.18 * swallow, look * (1 - drink), 0.012 * Math.sin(t * 0.8) * (1 - drink));
    birdTail.rotation.x = 0.32 - 0.06 * drink;
    const b = 1 + 6e-3 * Math.sin(t * 2.1) * (1 - drink);
    birdTorso.scale.set(1, b, 1);
  }
  let season = "", epoch = 0, resetEpoch = true, autumnDawnEpoch = 0;
  function setSeason(s) {
    spring.visible = s === "spring";
    autumn.visible = s === "autumn";
    winter.visible = s === "winter";
    rockSnow.visible = s === "winter";
    if (s !== season) {
      season = s;
      resetEpoch = true;
      lastSip = -1;
      squirrel.visible = false;
      autumnDawnEpoch = 0;
      springCat.reset();
    }
  }
  function update(time, night = false) {
    if (resetEpoch) {
      epoch = time;
      resetEpoch = false;
      lastSip = -1;
    }
    const age = Math.max(0, time - epoch);
    if (season === "spring") {
      springCat.update(age, night);
      return;
    }
    if (season === "autumn") {
      if (night) {
        squirrel.visible = false;
        coneGround.visible = true;
        autumnDawnEpoch = age;
        for (const l of leaves) {
          l.o.position.set(l.x, l.y, l.z);
          l.o.rotation.y = l.ry;
        }
        return;
      }
      const t = (age - autumnDawnEpoch) % SQ_CYCLE, at = sqAtTime(t);
      let sit = 0, sniff = 0, holding = t >= 22.4;
      squirrel.visible = t >= 0.65 && t < 43.9;
      coneGround.visible = t < 22.4;
      squirrel.position.copy(at.p);
      squirrel.quaternion.copy(at.q);
      if (t >= 18.7 && t < 21) {
        const u = (t - 18.7) / 2.3;
        sniff = Math.sin(u * Math.PI) * (0.16 + 0.28 * Math.pow(Math.max(0, Math.sin(u * Math.PI * 2)), 2));
      }
      if (t >= 21 && t < 22.4) {
        const u = (t - 21) / 1.4;
        sniff = 0.27 * Math.sin(u * Math.PI);
        sit = 0.2 * Math.sin(u * Math.PI);
      }
      if (t >= 22.4 && t < 26) sit = ease((t - 22.4) / 0.9) * (1 - ease((t - 25.25) / 0.75));
      if (t >= 6.6 && t < 7.5 || t >= 38 && t < 38.8) sniff = 0.09 * Math.sin((t - at.s.a) / (at.s.b - at.s.a) * Math.PI);
      poseSquirrel(t, at, sit, sniff, holding);
      if (t >= 22.4 && t < 23.3) {
        const u = ease((t - 22.4) / 0.9);
        coneHeld.position.set(0, lerp(0.045, 0.148, u), lerp(0.305, 0.259, u));
      }
      for (let i = 0; i < leaves.length; i++) {
        const l = leaves[i], a = t - 21, dist = Math.hypot(l.x - leafCenter.x, l.z - leafCenter.z), active = a > 0 && a < 1.4 && i % 7 === 0 && dist < 0.23;
        const u = active ? Math.sin(a / 1.4 * Math.PI) : 0;
        l.o.position.set(l.x + u * 0.018, l.y + u * 0.037, l.z + u * 0.014);
        l.o.rotation.y = l.ry + u * 0.24;
      }
      return;
    }
    if (season === "winter") {
      const t = age % 52, cycle = Math.floor(age / 52);
      bird.visible = true;
      birdTorso.scale.set(1, 1, 1);
      if (t < 2) perchBird(branchPerch, branchQ, t, 0, 0, -0.08);
      else if (t < 7.8) flyBird(inbound, (t - 2) / 5.8, t, branchQ, landingQ);
      else if (t < 24.5) {
        let drink = 0, swallow = 0, look = 0, nod = 0, pendingSip = -1;
        const starts = [9, 13.5, 18];
        for (let i = 0; i < starts.length; i++) {
          const p = t - starts[i];
          if (p >= 0 && p < 0.43) drink = ease(p / 0.43);
          else if (p >= 0.43 && p < 1.1) drink = 1;
          else if (p >= 1.1 && p < 1.6) {
            const u = ease((p - 1.1) / 0.5);
            drink = 1 - u;
            swallow = Math.sin(u * Math.PI) * 0.38;
          } else if (p >= 1.6 && p < 2.13) swallow = Math.sin((p - 1.6) / 0.53 * Math.PI) * 0.55;
          for (let j = 0; j < 2; j++) {
            const n = (p - (0.48 + j * 0.29)) / 0.18;
            if (n > 0 && n < 1) nod = Math.pow(Math.sin(n * Math.PI), 2);
            const key = cycle * 6 + i * 2 + j;
            if (n >= 0.48 && n < 1.8 && lastSip < key) {
              pendingSip = key;
            }
          }
        }
        if (t > 21) look = Math.sin((t - 21) * 0.9) * 0.18;
        perchBird(perch, landingQ, t, drink, swallow, look, nod);
        if (pendingSip >= 0) {
          lastSip = pendingSip;
          bird.updateMatrixWorld(true);
          const contact = V(0, 0.015, 0.12).applyMatrix4(birdHead.matrixWorld);
          ripple?.(contact.x, contact.z, 0.12);
        }
        bird.userData.sipNod = nod;
        bird.userData.drinkAmount = drink;
      } else if (t < 29.6) flyBird(outbound, (t - 24.5) / 5.1, t, landingQ, branchQ);
      else {
        const glance = t > 37 && t < 39 ? Math.sin((t - 37) / 2 * Math.PI) * 0.22 : 0;
        perchBird(branchPerch, branchQ, t, 0, 0, glance);
      }
      updateBirdNeck();
    }
  }
  setSeason("summer");
  return { setSeason, update, groups: { spring, autumn, winter } };
}
export {
  createSeasonalFauna
};
