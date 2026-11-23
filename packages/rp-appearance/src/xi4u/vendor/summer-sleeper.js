/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 AC.
 * Source: https://github.com/annac777/xi4u @ 336d2a38ed8c170a4599493f1bc20c6c1ef7962c, app/summer-sleeper.ts
 * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.
 */
import * as T from "three";
function createSummerSleeper({ root, material, mesh, box, ellipsoid, line, beam, rr }) {
  const group = new T.Group();
  group.name = "event-summer-sleeper";
  group.position.set(-0.105, 0.945, -0.74);
  group.rotation.y = -Math.PI / 2;
  group.scale.setScalar(0.8);
  root.add(group);
  const v = (p) => new T.Vector3(...p);
  const mat = (c) => material(c, { roughness: 0.94, flatShading: true });
  const skin = mat("#d8a888"), skinLight = mat("#e4b99b"), skinShade = mat("#bc8971");
  const nail = mat("#e9c5ab");
  const sage = mat("#879077"), sageLight = mat("#a1a68a"), sageShade = mat("#69765f"), sageSeam = mat("#747e67");
  const indigo = mat("#626f80"), indigoLight = mat("#81909c"), indigoShade = mat("#4b596b"), stitch = mat("#a8ad9f");
  const hairDark = mat("#433b38"), hair = mat("#574641"), hairWarm = mat("#6a5045"), hairLight = mat("#806153");
  const linen = mat("#d8cead"), linenLight = mat("#e4ddc3"), linenSeam = mat("#b9b093");
  const cover = mat("#a87559"), coverShade = mat("#805944"), coverEdge = mat("#c89671");
  const pages = mat("#e9ddbe"), pageShadow = mat("#c5b79b"), pageLight = mat("#f3e9cc");
  const gilt = mat("#d9bd85");
  function sweep(name, rings, m, parent = group, sides = 8) {
    const p = [], ids = [];
    rings.forEach((r, i) => {
      const center = v(r.slice(0, 3));
      const previous = v(rings[Math.max(0, i - 1)].slice(0, 3));
      const next = v(rings[Math.min(rings.length - 1, i + 1)].slice(0, 3));
      const tangent = next.sub(previous).normalize();
      let across = new T.Vector3(0, 1, 0).cross(tangent).normalize();
      if (across.lengthSq() < 0.01) across.set(1, 0, 0);
      const up = tangent.clone().cross(across).normalize();
      for (let j = 0; j < sides; j++) {
        const a = j / sides * Math.PI * 2;
        const q = center.clone().addScaledVector(across, Math.cos(a) * r[3]).addScaledVector(up, Math.sin(a) * r[4]);
        p.push(q.x, q.y, q.z);
      }
      if (i) for (let j = 0; j < sides; j++) {
        const a = (i - 1) * sides + j, b = (i - 1) * sides + (j + 1) % sides, c = i * sides + j, d = i * sides + (j + 1) % sides;
        ids.push(a, b, c, b, d, c);
      }
    });
    const last = (rings.length - 1) * sides;
    for (let j = 1; j < sides - 1; j++) ids.push(0, j + 1, j, last, last + j, last + j + 1);
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(p, 3));
    geo.setIndex(ids);
    geo.computeVertexNormals();
    const o = mesh(geo, m, [0, 0, 0], parent);
    o.name = name;
    return o;
  }
  function patch(name, points, m, parent = group) {
    const g = new T.BufferGeometry(), ids = [];
    g.setAttribute("position", new T.Float32BufferAttribute(points.flat(), 3));
    for (let i = 1; i < points.length - 1; i++) ids.push(0, i, i + 1);
    g.setIndex(ids);
    g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) {
      for (let i = 0; i < ids.length; i += 3) [ids[i + 1], ids[i + 2]] = [ids[i + 2], ids[i + 1]];
      g.setIndex(ids);
      g.computeVertexNormals();
    }
    const o = mesh(g, m, [0, 0, 0], parent);
    o.name = name;
    return o;
  }
  function seam(points, m = sageSeam, r = 3e-3, parent = group) {
    return line(points, m, r, parent);
  }
  function stitchRun(a, b, count, parent = group, m = stitch) {
    const start = v(a), end = v(b);
    for (let i = 0; i < count; i++) {
      const p = start.clone().lerp(end, (i + 0.12) / count), q = start.clone().lerp(end, (i + 0.48) / count);
      beam(p, q, 16e-4, 16e-4, m, parent);
    }
  }
  const pillow = new T.Group();
  pillow.name = "sleeper-linen-cushion";
  group.add(pillow);
  const cushion = box(0.48, 0.045, 0.355, linen, [0, 0.0225, -0.845], pillow, 0.026);
  cushion.rotation.y = -0.035;
  const pillowTop = box(0.447, 0.017, 0.325, linenLight, [0, 0.04, -0.845], pillow, 0.025);
  pillowTop.rotation.y = -0.035;
  seam([[-0.206, 0.034, -1.005], [0.195, 0.034, -1.02], [0.23, 0.033, -0.71], [0.2, 0.033, -0.683], [-0.222, 0.033, -0.692], [-0.229, 0.034, -0.987], [-0.206, 0.034, -1.005]], linenSeam, 25e-4, pillow);
  for (const s of [-1, 1]) {
    seam([[s * 0.231, 0.034, -0.935], [s * 0.194, 0.043, -0.927], [s * 0.172, 0.047, -0.904]], linenSeam, 2e-3, pillow);
    seam([[s * 0.227, 0.028, -0.751], [s * 0.2, 0.04, -0.767], [s * 0.179, 0.045, -0.775]], linenSeam, 2e-3, pillow);
    for (let i = 0; i < 3; i++) box(0.019, 2e-3, 2e-3, linenLight, [s * 0.238, 0.025, -0.92 + i * 0.054], pillow);
  }
  const head = new T.Group();
  head.name = "sleeper-head";
  group.add(head);
  ellipsoid(0, 0.118, -0.823, 0.15, 0.083, 0.17, hairDark, head, 12);
  ellipsoid(0, 0.159, -0.805, 0.12, 0.101, 0.145, skin, head, 12);
  ellipsoid(-0.121, 0.145, -0.787, 0.018, 0.029, 0.022, skinShade, head, 8);
  ellipsoid(0.121, 0.145, -0.787, 0.018, 0.029, 0.022, skin, head, 8);
  sweep("sleeper-neck", [[0, 0.097, -0.7, 0.065, 0.052], [0, 0.105, -0.621, 0.057, 0.055], [0, 0.111, -0.584, 0.065, 0.05]], skin, group);
  function lock(points, widths, m, parent = head) {
    const p = [], ids = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
      const dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz) || 1;
      const nx = -dz / length, nz = dx / length, [x, y, z] = points[i], w = widths[i];
      p.push(x + nx * w, y, z + nz * w, x, y + 0.011, z, x - nx * w, y, z - nz * w, x, y - 5e-3, z);
      if (i) for (let j = 0; j < 4; j++) {
        const a2 = (i - 1) * 4 + j, b2 = (i - 1) * 4 + (j + 1) % 4, c = i * 4 + j, d = i * 4 + (j + 1) % 4;
        ids.push(a2, c, b2, b2, c, d);
      }
    }
    ids.push(0, 1, 2, 0, 2, 3);
    const k = (points.length - 1) * 4;
    ids.push(k, k + 2, k + 1, k, k + 3, k + 2);
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
    g.setIndex(ids);
    g.computeVertexNormals();
    const o = mesh(g, m, [0, 0, 0], parent);
    o.name = "sleeper-hair-lock";
    return o;
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const n = i / 6, x = side * (0.063 + 0.014 * i), end = side * (0.177 + 0.011 * Math.sin(i * 1.7));
      lock(
        [[x, 0.18 - 0.014 * n, -0.95 + 0.019 * n], [side * (0.15 + 0.035 * n), 0.105, -0.882 + 0.025 * n], [side * (0.19 + 0.031 * n), 0.062, -0.744 + 0.014 * i], [end + side * 0.029, 0.037, -0.634 + 0.015 * i], [end, 0.026, -0.568 + 0.02 * i]],
        [0.024, 0.027, 0.024, 0.017, 25e-4],
        [hair, hairDark, hairWarm, hair, hairLight, hair, hairWarm][i]
      );
      if (i === 2 || i === 5) lock([[side * (0.177 + 0.025 * n), 0.108, -0.844], [side * (0.21 + 0.025 * n), 0.064, -0.735], [side * (0.203 + 0.03 * n), 0.042, -0.664]], [45e-4, 5e-3, 15e-4], hairLight);
    }
    lock([[side * 0.014, 0.155, -0.986], [side * 0.096, 0.095, -1.009], [side * 0.175, 0.054, -0.972], [side * 0.215, 0.038, -0.924]], [0.025, 0.025, 0.018, 2e-3], hairWarm);
    lock([[side * 0.038, 0.146, -0.974], [side * 0.123, 0.076, -1.004], [side * 0.208, 0.038, -0.988]], [0.019, 0.019, 2e-3], hairDark);
  }
  box(0.246, 0.024, 0.19, indigoShade, [0, 0.012, 0.087], group, 9e-3).name = "sleeper-shorts-flattened-back";
  sweep("sleeper-shorts-seat", [[0, 0.105, -0.039, 0.151, 0.09], [0, 0.114, 0.057, 0.171, 0.105], [7e-3, 0.113, 0.176, 0.172, 0.101], [9e-3, 0.11, 0.237, 0.147, 0.094]], indigo);
  const legPose = {
    left: { hip: v([-0.092, 0.114, 0.17]), knee: v([-0.183, 0.184, 0.53]), ankle: v([-0.144, 0.051, 0.881]) },
    right: { hip: v([0.092, 0.114, 0.17]), knee: v([0.109641129, 0.081237903, 0.545]), ankle: v([0.127, 0.049, 0.914]) }
  };
  for (const pose of Object.values(legPose)) pose.q = new T.Quaternion().setFromUnitVectors(v([0, 0, 1]), pose.knee.clone().sub(pose.hip).normalize());
  const thighPoint = (pose, p) => v(p).sub(pose.hip).applyQuaternion(pose.q).add(pose.hip);
  for (const side of [-1, 1]) {
    const x = side * 0.092, offset = side === 1 ? -0.026 : 0.012, pose = side < 0 ? legPose.left : legPose.right;
    const legCloth = new T.Group();
    legCloth.name = side < 0 ? "sleeper-left-shorts-pose" : "sleeper-right-shorts-pose";
    legCloth.quaternion.copy(pose.q);
    legCloth.position.copy(pose.hip).sub(pose.hip.clone().applyQuaternion(pose.q));
    group.add(legCloth);
    sweep("sleeper-shorts-leg", [[x, 0.115, 0.151, 0.09, 0.092], [x + side * 0.01, 0.119, 0.263 + offset, 0.101, 0.091], [x + side * 0.015, 0.106, 0.399 + offset, 0.095, 0.079]], indigo, legCloth);
    sweep("sleeper-shorts-rolled-hem", [[x + side * 0.015, 0.106, 0.371 + offset, 0.099, 0.081], [x + side * 0.016, 0.104, 0.403 + offset, 0.1, 0.08], [x + side * 0.017, 0.101, 0.422 + offset, 0.093, 0.074]], indigoLight, legCloth);
    seam([[x + side * 0.079, 0.133, 0.13], [x + side * 0.093, 0.126, 0.248], [x + side * 0.081, 0.12, 0.366 + offset]], indigoShade, 3e-3, legCloth);
    seam([[x - side * 0.038, 0.197, 0.116], [x - side * 0.021, 0.204, 0.18], [x - side * 0.013, 0.196, 0.223]], indigoShade, 3e-3, legCloth);
    seam([[x + side * 0.068, 0.177, 0.219], [x + side * 0.041, 0.195, 0.239], [x + side * 0.013, 0.202, 0.257]], indigoLight, 38e-4, legCloth);
    seam([[x + side * 0.014, 0.185, 0.314 + offset], [x + side * 0.05, 0.169, 0.333 + offset], [x + side * 0.076, 0.139, 0.339 + offset]], indigoShade, 35e-4, legCloth);
    stitchRun([x - side * 0.063, 0.164, 0.409 + offset], [x + side * 0.064, 0.162, 0.409 + offset], 6, legCloth);
  }
  sweep("sleeper-shorts-waistband", [[0, 0.114, -0.026, 0.156, 0.095], [0, 0.117, 9e-3, 0.165, 0.102]], indigoShade);
  seam([[0, 0.214, 0.016], [0.016, 0.214, 0.089], [0.012, 0.203, 0.166]], indigoShade, 4e-3);
  box(0.016, 6e-3, 0.016, stitch, [0, 0.217, 0.019], group, 3e-3);
  for (let x of [-0.115, 0.101]) box(0.021, 5e-3, 0.048, indigoLight, [x, 0.195, 5e-3], group, 3e-3);
  const lp = legPose.left, rp = legPose.right;
  const leftStart = thighPoint(lp, [-0.098, 0.105, 0.397]), leftExit = thighPoint(lp, [-0.109, 0.11, 0.453]);
  const leftLeg = sweep("sleeper-left-leg", [
    [...leftStart.toArray(), 0.064, 0.062],
    [...leftExit.toArray(), 0.062, 0.06],
    [-0.177, 0.18, 0.494, 0.061, 0.06],
    [...lp.knee.toArray(), 0.06, 0.058],
    [-0.178, 0.169, 0.581, 0.057, 0.054],
    [-0.163, 0.113, 0.726, 0.049, 0.045],
    [...lp.ankle.toArray(), 0.037, 0.033]
  ], skin);
  const rightAt = (z) => rp.hip.clone().lerp(rp.ankle, (z - rp.hip.z) / (rp.ankle.z - rp.hip.z));
  const rightLeg = sweep("sleeper-right-leg", [
    [...rightAt(0.374).toArray(), 0.064, 0.061],
    [...rightAt(0.459).toArray(), 0.061, 0.061],
    [...rp.knee.toArray(), 0.06, 0.063],
    [...rightAt(0.679).toArray(), 0.053, 0.049],
    [...rightAt(0.81).toArray(), 0.043, 0.038],
    [...rp.ankle.toArray(), 0.036, 0.033]
  ], skin);
  function skinPoint(o, x, z, lift = 2e-3) {
    const p = o.geometry.attributes.position, idx = o.geometry.index.array, ray = new T.Ray(v([x, 2, z]), v([0, -1, 0]));
    const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), hit = new T.Vector3();
    let highest = -Infinity;
    for (let i = 0; i < idx.length; i += 3) {
      a.fromBufferAttribute(p, idx[i]);
      b.fromBufferAttribute(p, idx[i + 1]);
      c.fromBufferAttribute(p, idx[i + 2]);
      if (ray.intersectTriangle(a, b, c, false, hit)) highest = Math.max(highest, hit.y);
    }
    return [x, (Number.isFinite(highest) ? highest : 0) + lift, z];
  }
  seam([[-0.174, 0.607], [-0.16, 0.736], [-0.145, 0.848]].map(([x, z]) => skinPoint(leftLeg, x, z)), skinLight, 43e-4);
  seam([0.591, 0.724, 0.863].map((z) => {
    const p = rightAt(z);
    return skinPoint(rightLeg, p.x - 4e-3, z);
  }), skinLight, 43e-4);
  const leftKneecap = ellipsoid(lp.knee.x, lp.knee.y + 0.04, lp.knee.z + 4e-3, 0.042, 0.024, 0.041, skinLight, group, 8);
  leftKneecap.rotation.x = 0.13;
  ellipsoid(rp.knee.x, rp.knee.y + 0.044, rp.knee.z, 0.042, 0.023, 0.043, skinLight, group, 8);
  for (const [side, pose] of [["left", lp], ["right", rp]]) {
    const anchor = new T.Group();
    anchor.name = "sleeper-" + side + "-knee-anchor";
    anchor.position.copy(pose.knee);
    group.add(anchor);
  }
  function foot(name, x, z, angle2) {
    const g = new T.Group();
    g.name = name;
    g.position.set(x, 0.0261, z);
    g.rotation.y = angle2;
    group.add(g);
    sweep(name + "-instep", [[0, 5e-3, -0.023, 0.034, 0.033], [0, 0.021, 0.021, 0.042, 0.047], [0, 0.02, 0.08, 0.05, 0.036], [3e-3, 0.011, 0.118, 0.049, 0.022]], skin, g);
    for (let i = 0; i < 5; i++) {
      const side = i - 2, tx = side * 0.018, tip = 0.143 - Math.abs(i - 1) * 7e-3;
      sweep(name + "-toe-" + i, [[tx, 9e-3, 0.101, 0.0105, 0.018], [tx + 2e-3, 0.01, tip, 0.0102, 0.016], [tx + 2e-3, 8e-3, tip + 0.016, 75e-4, 0.0105]], i < 2 ? skinLight : skin, g, 6);
      const n = box(0.011, 18e-4, 0.012, nail, [tx + 2e-3, 0.026, tip + 2e-3], g, 2e-3);
      n.rotation.x = -0.18;
    }
    seam([[-0.026, 0.065, 0.012], [1e-3, 0.07, 0.024], [0.028, 0.05, 0.052]], skinShade, 2e-3, g);
    return g;
  }
  foot("sleeper-left-foot", -0.145, 0.889, -0.18);
  foot("sleeper-right-foot", 0.128, 0.921, 0.08);
  const breathing = new T.Group();
  breathing.name = "sleeper-breathing-torso";
  group.add(breathing);
  box(0.276, 0.036, 0.437, sageShade, [0, 0.018, -0.303], breathing, 0.014).name = "sleeper-shirt-flattened-back";
  sweep("sleeper-sage-shirt", [[0, 0.111, -0.603, 0.081, 0.072], [0, 0.13, -0.53, 0.179, 0.108], [0, 0.137, -0.442, 0.198, 0.118], [4e-3, 0.128, -0.322, 0.186, 0.117], [5e-3, 0.112, -0.16, 0.162, 0.103], [3e-3, 0.108, -0.024, 0.163, 0.092], [5e-3, 0.105, 0.043, 0.176, 0.083]], sage, breathing);
  patch("sleeper-left-collar", [[-0.056, 0.192, -0.602], [-0.132, 0.222, -0.525], [-0.081, 0.254, -0.458], [-0.014, 0.222, -0.554]], sageLight, breathing);
  patch("sleeper-right-collar", [[0.056, 0.192, -0.602], [0.014, 0.222, -0.553], [0.072, 0.252, -0.461], [0.128, 0.219, -0.526]], sageLight, breathing);
  seam([[-0.056, 0.194, -0.6], [-0.13, 0.224, -0.525], [-0.081, 0.256, -0.46], [-0.015, 0.225, -0.552]], sageSeam, 3e-3, breathing);
  seam([[0.056, 0.194, -0.6], [0.128, 0.222, -0.526], [0.074, 0.255, -0.461], [0.015, 0.225, -0.552]], sageSeam, 3e-3, breathing);
  seam([[6e-3, 0.243, -0.483], [9e-3, 0.255, -0.391], [0.012, 0.232, -0.236], [0.011, 0.207, -0.057], [0.013, 0.189, 0.021]], sageLight, 8e-3, breathing);
  seam([[-6e-3, 0.245, -0.478], [-3e-3, 0.257, -0.39], [2e-3, 0.234, -0.235], [2e-3, 0.21, -0.055]], sageSeam, 22e-4, breathing);
  for (const [z, y] of [[-0.439, 0.25], [-0.337, 0.252], [-0.225, 0.234], [-0.111, 0.215], [0.012, 0.196]]) {
    const b = mesh(new T.CylinderGeometry(55e-4, 55e-4, 35e-4, 8), linenLight, [0.011, y, z], breathing);
    b.name = "sleeper-shirt-button";
    box(15e-4, 1e-3, 3e-3, sageShade, [0.011, y + 22e-4, z], breathing);
  }
  patch("sleeper-shirt-pocket", [[0.067, 0.245, -0.429], [0.143, 0.229, -0.429], [0.137, 0.229, -0.341], [0.101, 0.24, -0.318], [0.068, 0.249, -0.34]], sageLight, breathing);
  seam([[0.068, 0.25, -0.341], [0.1, 0.243, -0.32], [0.137, 0.232, -0.342], [0.144, 0.232, -0.429]], sageSeam, 22e-4, breathing);
  seam([[0.066, 0.249, -0.426], [0.143, 0.232, -0.426]], sageShade, 3e-3, breathing);
  for (const s of [-1, 1]) {
    seam([[s * 0.124, 0.224, -0.491], [s * 0.172, 0.208, -0.445], [s * 0.176, 0.189, -0.379]], sageLight, 35e-4, breathing);
    seam([[s * 0.166, 0.175, -0.248], [s * 0.126, 0.203, -0.193], [s * 0.11, 0.212, -0.167]], sageShade, 35e-4, breathing);
    seam([[s * 0.17, 0.145, -0.111], [s * 0.131, 0.18, -0.057], [s * 0.122, 0.184, -0.025]], sageLight, 38e-4, breathing);
    seam([[s * 0.17, 0.107, 0.035], [s * 0.143, 0.147, 0.023], [s * 0.107, 0.17, 0.026]], sageShade, 35e-4, breathing);
  }
  seam([[-0.137, 0.151, 0.04], [-0.075, 0.18, 0.053], [0.011, 0.19, 0.041], [0.085, 0.18, 0.048], [0.147, 0.147, 0.038]], sageLight, 3e-3, breathing);
  sweep("sleeper-left-upper-arm", [[-0.171, 0.125, -0.501, 0.065, 0.062], [-0.24, 0.091, -0.351, 0.051, 0.047], [-0.281, 0.055, -0.22, 0.044, 0.039]], skin);
  sweep("sleeper-left-forearm", [[-0.281, 0.055, -0.22, 0.044, 0.039], [-0.305, 0.051, -0.105, 0.039, 0.034], [-0.313, 0.048, 0.044, 0.027, 0.023]], skin);
  sweep("sleeper-right-upper-arm", [[0.171, 0.13, -0.502, 0.065, 0.062], [0.246, 0.106, -0.351, 0.051, 0.05], [0.302, 0.073, -0.189, 0.046, 0.041]], skin);
  sweep("sleeper-right-forearm", [[0.302, 0.073, -0.189, 0.045, 0.041], [0.228, 0.132, -0.204, 0.043, 0.04], [0.105, 0.229, -0.27, 0.029, 0.027]], skin, breathing);
  for (const side of [-1, 1]) {
    const shoulder = [side * 0.169, 0.13, -0.501], middle = [side * 0.209, 0.118, -0.431], end = [side * 0.25, 0.097, -0.331];
    sweep("sleeper-shirt-sleeve", [[...shoulder, 0.08, 0.08], [...middle, 0.081, 0.074], [...end, 0.072, 0.06]], sage, breathing);
    sweep("sleeper-shirt-sleeve-cuff", [[side * 0.242, 0.102, -0.352, 0.075, 0.065], [side * 0.257, 0.094, -0.321, 0.073, 0.061]], sageLight, breathing);
    seam([[side * 0.189, 0.2, -0.487], [side * 0.233, 0.172, -0.425], [side * 0.253, 0.153, -0.36]], sageShade, 34e-4, breathing);
    seam([[side * 0.236, 0.16, -0.349], [side * 0.265, 0.143, -0.329], [side * 0.285, 0.116, -0.321]], sageSeam, 25e-4, breathing);
  }
  seam([[-0.307, 0.08, -0.106], [-0.317, 0.072, 0.027]], skinLight, 3e-3);
  seam([[0.27, 0.116, -0.183], [0.192, 0.18, -0.212], [0.118, 0.25, -0.252]], skinLight, 35e-4, breathing);
  const fingerRecords = [];
  function hand(name, position, angle2, parent, movingHand = false) {
    const g = new T.Group();
    g.name = name;
    g.position.set(...position);
    g.rotation.y = angle2;
    parent.add(g);
    sweep(name + "-palm", [[0, 0, -0.045, 0.025, 0.018], [0, 2e-3, -0.012, 0.038, 0.021], [0, 0, 0.03, 0.036, 0.018], [2e-3, -1e-3, 0.046, 0.03, 0.015]], skin, g);
    const knuckles = [-0.027, -9e-3, 0.01, 0.028];
    knuckles.forEach((x, i) => {
      const f = new T.Group();
      f.name = name + "-finger-" + i;
      f.position.set(x, 0, 0.033);
      f.rotation.y = (i - 1.45) * 0.075;
      g.add(f);
      const length = [0.061, 0.071, 0.067, 0.051][i], bend = [6e-3, 2e-3, 4e-3, 9e-3][i];
      sweep(f.name, [[0, 0, 0, 9e-3, 0.012], [0, 2e-3, length * 0.45, 85e-4, 0.0105], [2e-3, -bend, length * 0.78, 75e-4, 9e-3], [3e-3, -bend - 2e-3, length, 5e-3, 6e-3]], skinLight, f, 6);
      const n = box(9e-3, 18e-4, 0.012, nail, [2e-3, 8e-3 - bend, length - 0.011], f, 2e-3);
      n.rotation.x = 0.11;
      seam([[-6e-3, 0.011, length * 0.47], [6e-3, 0.011, length * 0.47]], skinShade, 12e-4, f);
      fingerRecords.push({ g: f, base: 0, side: movingHand ? 1 : 0, index: i });
    });
    const thumb = new T.Group();
    thumb.name = name + "-thumb";
    thumb.position.set(-0.028, -2e-3, -0.013);
    thumb.rotation.y = -0.68;
    g.add(thumb);
    sweep(name + "-thumb-shape", [[0, 0, 0, 0.013, 0.014], [0, 1e-3, 0.027, 0.012, 0.012], [5e-3, -4e-3, 0.048, 8e-3, 0.01], [8e-3, -6e-3, 0.06, 5e-3, 6e-3]], skin, thumb, 6);
    box(0.01, 18e-4, 0.013, nail, [6e-3, 5e-3, 0.047], thumb, 2e-3);
    fingerRecords.push({ g: thumb, base: 0, side: movingHand ? 1 : 0, index: 4 });
    seam([[-0.024, 0.021, -0.014], [-8e-3, 0.023, 5e-3], [0.019, 0.019, 0.016]], skinShade, 14e-4, g);
    return g;
  }
  const leftHand = hand("sleeper-relaxed-hand", [-0.313, 0.048, 0.083], -0.09, group);
  const rightHand = hand("sleeper-resting-hand", [0.066, 0.257, -0.302], Math.PI + 0.35, breathing, true);
  rightHand.rotation.z = -0.08;
  const book = new T.Group();
  book.name = "sleeper-face-book";
  book.position.set(0, 0.398, -0.819);
  book.rotation.y = -0.055;
  group.add(book);
  const pageWidth = 0.303, pageDepth = 0.439, angle = 0.733;
  for (const side of [-1, 1]) {
    const wing = new T.Group();
    wing.name = side < 0 ? "sleeper-book-back-cover" : "sleeper-book-front-cover";
    wing.rotation.z = -side * angle;
    book.add(wing);
    box(pageWidth, 0.012, pageDepth, cover, [side * (pageWidth / 2 + 5e-3), 0, 0], wing, 3e-3);
    box(pageWidth - 0.018, 0.031, pageDepth - 0.018, pages, [side * (pageWidth / 2 + 9e-3), -0.022, 0], wing, 2e-3);
    box(0.015, 0.014, pageDepth + 2e-3, coverShade, [side * 0.011, -2e-3, 0], wing, 2e-3);
    for (let i = 0; i < 6; i++) {
      const y = -95e-4 - i * 52e-4;
      for (const z of [-(pageDepth / 2 - 8e-3), pageDepth / 2 - 8e-3]) box(pageWidth - 0.023, 15e-4, 26e-4, i % 2 ? pageLight : pageShadow, [side * (pageWidth / 2 + 9e-3), y, z], wing);
      box(28e-4, 17e-4, pageDepth - 0.027, i % 2 ? pageShadow : pageLight, [side * (pageWidth + 1e-3), y, 0], wing);
    }
    const c = side * (pageWidth / 2 + 4e-3);
    for (let z of [-0.185, 0.185]) box(0.241, 18e-4, 4e-3, gilt, [c, 7e-3, z], wing);
    for (let x of [c - 0.12, c + 0.12]) box(4e-3, 18e-4, 0.37, gilt, [x, 7e-3, 0], wing);
    box(0.073, 18e-4, 3e-3, coverEdge, [c, 7e-3, -0.112], wing);
    box(0.1, 18e-4, 3e-3, coverEdge, [c, 7e-3, -0.101], wing);
    const stem = seam([[c - 0.031, 8e-3, 0.063], [c, 8e-3, 0.011], [c + 0.027, 8e-3, -0.048]], gilt, 2e-3, wing);
    for (let j = 0; j < 3; j++) {
      const z = 0.039 - j * 0.033, x = c - 0.018 + j * 0.016;
      const leaf = box(0.027, 22e-4, 0.012, gilt, [x + (j % 2 ? -0.012 : 0.012), 8e-3, z], wing, 3e-3);
      leaf.rotation.y = j % 2 ? -0.7 : 0.7;
    }
  }
  const spine = mesh(new T.CylinderGeometry(0.013, 0.013, pageDepth + 9e-3, 8), coverShade, [0, 4e-3, 0], book);
  spine.rotation.x = Math.PI / 2;
  for (let z of [-0.17, 0.17]) {
    const band = mesh(new T.CylinderGeometry(0.014, 0.014, 0.012, 8), gilt, [0, 4e-3, z], book);
    band.rotation.x = Math.PI / 2;
  }
  const ribbon = box(0.018, 2e-3, 0.084, material("#708176", { roughness: 1 }), [0.029, 0.33, -1.07], group);
  ribbon.rotation.x = -0.7;
  ribbon.rotation.z = 0.18;
  function update(time = 0) {
    if (!group.visible) return;
    const t = Number.isFinite(time) ? time : 0;
    const breath = Math.sin(t * 0.82) * 0.5 + 0.5;
    breathing.scale.y = 1 + breath * 0.011;
    head.rotation.z = Math.sin(t * 0.41) * 12e-4;
    book.position.y = 0.398 + breath * 65e-5;
    book.rotation.z = Math.sin(t * 0.41) * 11e-4;
    const stir = Math.pow(Math.max(0, Math.sin(t * 0.225 - 1.2)), 18);
    for (const r of fingerRecords) {
      const pulse = r.side ? Math.sin(t * 0.82 + 0.4 + r.index * 0.15) * 7e-3 : stir * Math.sin(t * 1.3 + r.index * 0.38) * 0.047;
      r.g.rotation.x = r.base + pulse;
    }
  }
  function setSeason(season) {
    group.visible = season === "summer";
    if (group.visible) update(0);
  }
  setSeason("summer");
  return { group, setSeason, update };
}
export {
  createSummerSleeper
};
