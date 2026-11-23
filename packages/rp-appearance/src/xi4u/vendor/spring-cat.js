/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 AC.
 * Source: https://github.com/annac777/xi4u @ 336d2a38ed8c170a4599493f1bc20c6c1ef7962c, app/spring-cat.ts
 * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.
 */
import * as T from "three";
function createSpringCat({ root, material, mesh, ellipsoid, line, beam }) {
  const group = new T.Group();
  group.name = "event-spring-cat";
  group.position.set(0.35, 0.945, -0.94);
  group.rotation.y = 0.1;
  root.add(group);
  const body = new T.Group();
  body.name = "cat-breathing-ribcage";
  group.add(body);
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const orange = new T.Color("#d99b56"), orangeLight = new T.Color("#e2ae70"), orangeShadow = new T.Color("#c38445");
  const tabby = new T.Color("#bc8147"), ivory = new T.Color("#f1e9d8"), creamColor = new T.Color("#e7dbc3");
  const coat = material("#ffffff", { vertexColors: true, roughness: 0.96 });
  const fur = material("#d99b56", { roughness: 0.96 }), furLight = material("#e3ae71", { roughness: 0.96 });
  const milk = material("#f1e9d8", { roughness: 0.96 }), cream = material("#e7dbc3", { roughness: 0.96 });
  const earPink = material("#cc9e8d", { roughness: 1 }), earShade = material("#a87966", { roughness: 1 });
  const nosePink = material("#bb8375", { roughness: 0.9 }), noseShade = material("#9c6f62", { roughness: 1 });
  const ink = material("#54483c", { roughness: 1 }), toeLine = material("#bcad98", { roughness: 1 });
  const whisker = material("#f7f0dd", { roughness: 1 });
  const smoothMin = (a, b, k) => {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
  };
  function ellipsoidDistance(x, y, z, cx, cy, cz, rx, ry, rz, angle = 0) {
    x -= cx;
    y -= cy;
    z -= cz;
    const c = Math.cos(angle), s = Math.sin(angle), xx = x * c - z * s, zz = x * s + z * c;
    const k0 = Math.hypot(xx / rx, y / ry, zz / rz), k1 = Math.hypot(xx / (rx * rx), y / (ry * ry), zz / (rz * rz));
    return k1 < 1e-8 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1) / k1;
  }
  const masses = [
    [-0.15, 0.085, -0.035, 0.09, 0.088, 0.092, 0.24],
    [-0.055, 0.119, -0.102, 0.139, 0.121, 0.111, 0.12],
    [0.104, 0.105, -0.051, 0.132, 0.109, 0.126, -0.3],
    [0.047, 0.052, 0.034, 0.112, 0.053, 0.097, -0.2]
  ];
  function torsoField(x, y, z) {
    let d = ellipsoidDistance(x, y, z, ...masses[0]);
    for (let i = 1; i < masses.length; i++) d = smoothMin(d, ellipsoidDistance(x, y, z, ...masses[i]), 0.041);
    return Math.max(d, -y);
  }
  function torsoColor(x, y, z) {
    if (y < 0.055 || z > 0.01 && x < 0.115 || x < -0.133 && z > -0.075) return ivory;
    const flowing = x + 0.02 * Math.sin(z * 18) + 0.014 * Math.sin(y * 17);
    if (y > 0.12 && z < 0.018 && [[-0.092, 75e-4], [0.028, 9e-3], [0.137, 7e-3]].some(([a, w]) => Math.abs(flowing - a) < w)) return tabby;
    return y > 0.205 ? orangeLight : orange;
  }
  function implicitGeometry(field, color, min, max, spacing = 0.011) {
    const nx = Math.ceil((max[0] - min[0]) / spacing), ny = Math.ceil((max[1] - min[1]) / spacing), nz = Math.ceil((max[2] - min[2]) / spacing);
    const dx = (max[0] - min[0]) / nx, dy = (max[1] - min[1]) / ny, dz = (max[2] - min[2]) / nz;
    const strideX = ny + 1, strideZ = (nx + 1) * (ny + 1), values = new Float32Array((nx + 1) * (ny + 1) * (nz + 1));
    const index = (x, y, z) => z * strideZ + x * strideX + y;
    for (let z = 0; z <= nz; z++) for (let x = 0; x <= nx; x++) for (let y = 0; y <= ny; y++) values[index(x, y, z)] = field(min[0] + x * dx, min[1] + y * dy, min[2] + z * dz);
    const pos = [], normals = [], colors = [], edgeCache = /* @__PURE__ */ new Map(), normalCache = /* @__PURE__ */ new WeakMap();
    const cube = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
    const tetra = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]];
    const gradient = (p) => {
      const e = 6e-4;
      return V(field(p.x + e, p.y, p.z) - field(p.x - e, p.y, p.z), field(p.x, p.y + e, p.z) - field(p.x, p.y - e, p.z), field(p.x, p.y, p.z + e) - field(p.x, p.y, p.z - e)).normalize();
    };
    function emit(a, b, c) {
      const cross = b.clone().sub(a).cross(c.clone().sub(a));
      if (cross.lengthSq() < 1e-28) return;
      const mid = a.clone().add(b).add(c).multiplyScalar(1 / 3), out = gradient(mid);
      if (cross.dot(out) < 0) [b, c] = [c, b];
      const col = color(mid.x, mid.y, mid.z);
      for (const p of [a, b, c]) {
        let n = normalCache.get(p);
        if (!n) {
          n = gradient(p);
          normalCache.set(p, n);
        }
        pos.push(...p.toArray());
        normals.push(...n.toArray());
        colors.push(col.r, col.g, col.b);
      }
    }
    for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) {
      const gridIds = cube.map((q) => index(x + q[0], y + q[1], z + q[2])), f = gridIds.map((i) => values[i]);
      if (f.every((a) => a >= 0) || f.every((a) => a < 0)) continue;
      const p = cube.map((q) => V(min[0] + (x + q[0]) * dx, min[1] + (y + q[1]) * dy, min[2] + (z + q[2]) * dz));
      for (const ids of tetra) {
        const inside = ids.filter((k) => f[k] < 0), outside = ids.filter((k) => f[k] >= 0);
        if (!inside.length || !outside.length) continue;
        const edge = (a, b) => {
          const ia = gridIds[a], ib = gridIds[b], key = Math.min(ia, ib) * values.length + Math.max(ia, ib);
          let q = edgeCache.get(key);
          if (!q) {
            q = p[a].clone().lerp(p[b], f[a] / (f[a] - f[b]));
            edgeCache.set(key, q);
          }
          return q;
        };
        if (inside.length === 1) emit(...outside.map((k) => edge(inside[0], k)));
        else if (outside.length === 1) emit(...inside.map((k) => edge(outside[0], k)));
        else {
          const a = edge(inside[0], outside[0]), b = edge(inside[0], outside[1]), c = edge(inside[1], outside[0]), d = edge(inside[1], outside[1]);
          emit(a, b, c);
          emit(b, d, c);
        }
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    return g;
  }
  const torso = mesh(implicitGeometry(torsoField, torsoColor, [-0.27, -0.014, -0.252], [0.261, 0.266, 0.174]), coat, [0, 0, 0], body);
  torso.name = "cat-continuous-curled-torso";
  const head = new T.Group();
  head.name = "cat-resting-head";
  const profile = [[-0.081, 0.013, 2e-3, 8e-3], [-0.071, 0.013, 0.045, 0.044], [-0.052, 0.011, 0.073, 0.064], [-0.024, 4e-3, 0.088, 0.072], [5e-3, -5e-3, 0.09, 0.068], [0.03, -0.013, 0.079, 0.056], [0.05, -0.022, 0.06, 0.039], [0.067, -0.033, 0.039, 0.026], [0.079, -0.039, 0.019, 0.015], [0.083, -0.04, 1e-3, 1e-3]];
  const hpos = [], hidx = [], hcolors = [], hsides = 24;
  profile.forEach(([z, cy, w, h], i) => {
    for (let j = 0; j <= hsides; j++) {
      const a = j / hsides * Math.PI * 2, x = Math.cos(a) * w, y = cy + Math.sin(a) * h;
      hpos.push(x, y, z);
      let c = orange;
      if (y < -0.012 && z > 0.015 || Math.abs(x) < Math.max(4e-3, 0.022 - y * 0.31) && z > 0.027) c = ivory;
      else if (y > 0.026 && z > 8e-3 && Math.abs(x) > 8e-3 && Math.abs(x) < 0.057 && Math.abs(Math.sin((x + y * 0.1) * 96)) > 0.92) c = tabby;
      else if (y > 0.041) c = orangeLight;
      hcolors.push(c.r, c.g, c.b);
      if (i < profile.length - 1 && j < hsides) {
        const n = i * (hsides + 1) + j;
        hidx.push(n, n + 1, n + hsides + 1, n + 1, n + hsides + 2, n + hsides + 1);
      }
    }
  });
  const capStart = hpos.length / 3;
  hpos.push(0, profile[0][1], profile[0][0], 0, profile.at(-1)[1], profile.at(-1)[0]);
  hcolors.push(orange.r, orange.g, orange.b, ivory.r, ivory.g, ivory.b);
  for (let j = 0; j < hsides; j++) {
    hidx.push(capStart, j + 1, j);
    const n = (profile.length - 1) * (hsides + 1) + j;
    hidx.push(capStart + 1, n, n + 1);
  }
  const hg = new T.BufferGeometry();
  hg.setAttribute("position", new T.Float32BufferAttribute(hpos, 3));
  hg.setAttribute("color", new T.Float32BufferAttribute(hcolors, 3));
  hg.setIndex(hidx);
  hg.computeVertexNormals();
  const skull = mesh(hg, coat, [0, 0, 0], head);
  skull.name = "cat-shaped-skull";
  skull.updateMatrixWorld(true);
  function onFace(x, y, offset = 15e-4) {
    const hit = new T.Raycaster(V(x, y, 0.3), V(0, 0, -1)).intersectObject(skull, false)[0];
    return [x, y, (hit ? hit.point.z : 0.045) + offset];
  }
  const muzzleGeo = new T.SphereGeometry(1, 20, 12), mp = muzzleGeo.attributes.position;
  for (let i = 0; i < mp.count; i++) {
    const x = mp.getX(i), y = mp.getY(i), z = mp.getZ(i);
    mp.setXYZ(i, x * 0.053, -0.04 + y * 0.022, 0.066 + z * 0.022 + 5e-3 * Math.sin(Math.abs(x) * Math.PI) * Math.max(0, z));
  }
  muzzleGeo.computeVertexNormals();
  const muzzle = mesh(muzzleGeo, milk, [0, 0, 0], head);
  muzzle.name = "cat-bilobed-whisker-muzzle";
  const noseGeo = new T.BufferGeometry();
  noseGeo.setAttribute("position", new T.Float32BufferAttribute([-0.012, -0.024, 0.091, 0.012, -0.024, 0.091, 0, -0.035, 0.097, 0, -0.024, 0.099, 0, -0.031, 0.086], 3));
  noseGeo.setIndex([0, 2, 3, 3, 2, 1, 0, 3, 1, 0, 4, 2, 2, 4, 1, 1, 4, 0]);
  noseGeo.computeVertexNormals();
  mesh(noseGeo, nosePink, [0, 0, 0], head).name = "cat-small-nose";
  line([[-9e-3, -0.028, 0.094], [-5e-3, -0.029, 0.097]], noseShade, 1e-3, head);
  line([[9e-3, -0.028, 0.094], [5e-3, -0.029, 0.097]], noseShade, 1e-3, head);
  line([[0, -0.035, 0.095], [0, -0.043, 0.09], [-0.012, -0.049, 0.087]], ink, 13e-4, head);
  line([[0, -0.043, 0.09], [0.012, -0.049, 0.087]], ink, 13e-4, head);
  for (const side of [-1, 1]) {
    line([[side * 0.074, 0], [side * 0.059, -6e-3], [side * 0.039, -6e-3], [side * 0.027, -1e-3]].map(([x, y]) => onFace(x, y, 17e-4)), ink, 21e-4, head);
    for (let j = 0; j < 3; j++) {
      const y = -0.038 - j * 8e-3;
      line([[side * 0.038, y, 0.086], [side * 0.079, y + 7e-3 - j * 8e-3, 0.102], [side * (0.112 + j * 5e-3), y + 0.014 - j * 0.011, 0.091 - j * 5e-3]], whisker, 85e-5, head);
      ellipsoid(side * (0.03 + j * 8e-3), -0.043 + j % 2 * 6e-3, 0.09, 17e-4, 17e-4, 12e-4, noseShade, head, 6);
    }
  }
  const ears = [];
  function ear(side) {
    const rig = new T.Group();
    rig.name = "cat-cupped-ear";
    rig.position.set(side * 0.068, 0.047, -0.033);
    rig.rotation.z = -side * 0.12;
    rig.rotation.y = side * 0.17;
    head.add(rig);
    const boundary = [[-0.034, -0.01, 0.01], [-0.036, 0.015, 3e-3], [-0.022, 0.052, -5e-3], [0.014, 0.087, -0.014], [0.033, 0.034, -6e-3], [0.036, 4e-3, 8e-3], [0.018, -0.018, 0.019], [-0.015, -0.018, 0.019]].map(([x, y, z]) => V(x * side, y, z));
    const inner = boundary.map((p) => V(p.x * 0.63, 0.022 + (p.y - 0.022) * 0.71, p.z - 2e-3));
    const back = boundary.map((p) => V(p.x * 0.96, p.y, p.z - 0.013));
    const positions = [], indices = [], parts = [];
    function face(a, b, c, m, desired) {
      const normal = b.clone().sub(a).cross(c.clone().sub(a));
      if (normal.dot(desired) < 0) [b, c] = [c, b];
      const i = positions.length / 3;
      positions.push(...a.toArray(), ...b.toArray(), ...c.toArray());
      indices.push(i, i + 1, i + 2);
      parts.push(m);
    }
    const backCenter = V(0, 0.025, -0.032), bowl = V(side * 2e-3, 0.019, -8e-3), forward = V(0, 0, 1);
    for (let i = 0; i < 8; i++) {
      const k = (i + 1) % 8;
      face(boundary[i], boundary[k], inner[i], 0, forward);
      face(boundary[k], inner[k], inner[i], 0, forward);
      face(inner[i], inner[k], bowl, i < 4 ? 1 : 2, forward);
      face(back[i], backCenter, back[k], 0, V(0, 0, -1));
      const outward = boundary[i].clone().add(boundary[k]).multiplyScalar(0.5).sub(V(0, 0.025, -8e-3));
      outward.z = 0;
      face(boundary[i], back[i], boundary[k], 0, outward);
      face(boundary[k], back[i], back[k], 0, outward);
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    parts.forEach((m, i) => g.addGroup(i * 3, 3, m));
    mesh(g, [fur, earPink, earShade], [0, 0, 0], rig);
    line([[side * 0.017, -0.011, 0.019], [side * 0.028, 2e-3, 0.013], [side * 0.021, 0.01, 4e-3]], cream, 32e-4, rig);
    line([[-side * 0.023, -4e-3, 0.019], [-side * 0.018, 0.016, 9e-3]], milk, 22e-4, rig);
    ears.push(rig);
  }
  ear(-1);
  ear(1);
  head.position.set(-0.157, 0.104, 0.066);
  head.rotation.set(0.14, 0.28, -0.1);
  group.add(head);
  function paw(name, x, z, w = 0.04, d = 0.047, angle = 0) {
    const geo = new T.SphereGeometry(1, 18, 10), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i), v = p.getY(i), q = p.getZ(i);
      const toes = 17e-4 * Math.cos((u + 1) * Math.PI * 3.5) * Math.pow(Math.max(0, q), 4);
      p.setXYZ(i, u * w, Math.max(0, 0.018 + v * 0.021), q * d + toes);
    }
    geo.computeVertexNormals();
    const g = new T.Group();
    g.name = name;
    g.position.set(x, 0, z);
    g.rotation.y = angle;
    group.add(g);
    mesh(geo, milk, [0, 0, 0], g);
    for (let i = -1; i <= 1; i++) line([[i * w * 0.44, 0.024, d * 0.9], [i * w * 0.43, 0.033, d * 0.72]], toeLine, 11e-4, g);
    return g;
  }
  paw("cat-tucked-left-forepaw", -0.127, 0.154, 0.039, 0.047, 0.16);
  paw("cat-tucked-right-forepaw", -0.057, 0.134, 0.035, 0.042, -0.22);
  paw("cat-tucked-hind-toes", 0.072, 0.102, 0.044, 0.049, -0.68);
  const tailCurve = new T.CatmullRomCurve3([[0.17, 0.08, 0.018], [0.223, 0.052, 0.08], [0.208, 0.03, 0.143], [0.132, 0.024, 0.178], [0.025, 0.02, 0.18], [-0.075, 0.014, 0.148]].map((p) => V(...p)));
  const radiusStops = [0.029, 0.026, 0.023, 0.019, 0.012, 13e-4], tsteps = 52, tsides = 12, tp = [], ti = [], tc = [];
  const radiusAt = (t) => {
    const q = t * (radiusStops.length - 1), k = Math.min(radiusStops.length - 2, Math.floor(q));
    return T.MathUtils.lerp(radiusStops[k], radiusStops[k + 1], q - k);
  };
  for (let i = 0; i <= tsteps; i++) {
    const t = i / tsteps, p = tailCurve.getPoint(t), tangent = tailCurve.getTangent(t).normalize(), across = V(0, 1, 0).cross(tangent).normalize(), up = tangent.clone().cross(across).normalize(), r = radiusAt(t);
    for (let j = 0; j <= tsides; j++) {
      const a = j / tsides * Math.PI * 2, q = p.clone().addScaledVector(across, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r * 0.84);
      tp.push(q.x, Math.max(1e-3, q.y), q.z);
      const c = t > 0.91 ? ivory : t > 0.36 && t < 0.41 || t > 0.64 && t < 0.7 ? tabby : orange;
      tc.push(c.r, c.g, c.b);
      if (i < tsteps && j < tsides) {
        const n = i * (tsides + 1) + j;
        ti.push(n, n + 1, n + tsides + 1, n + 1, n + tsides + 2, n + tsides + 1);
      }
    }
  }
  const tcap = tp.length / 3;
  tp.push(...tailCurve.getPoint(0).toArray(), ...tailCurve.getPoint(1).toArray());
  tc.push(orange.r, orange.g, orange.b, ivory.r, ivory.g, ivory.b);
  for (let j = 0; j < tsides; j++) {
    ti.push(tcap, j + 1, j);
    const n = tsteps * (tsides + 1) + j;
    ti.push(tcap + 1, n, n + 1);
  }
  const tg = new T.BufferGeometry();
  tg.setAttribute("position", new T.Float32BufferAttribute(tp, 3));
  tg.setAttribute("color", new T.Float32BufferAttribute(tc, 3));
  tg.setIndex(ti);
  tg.computeVertexNormals();
  mesh(tg, coat, [0, 0, 0], group).name = "cat-continuous-short-wrapped-tail";
  const sleepSpots = { day: V(0.35, 0.945, -0.94), night: V(-2.95, 0.3005, 0.39) };
  const fadeMeshes = [], fadeMaterials = /* @__PURE__ */ new Set();
  group.traverse((o) => {
    if (!o.isMesh) return;
    fadeMeshes.push({ o, shadow: o.castShadow });
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) fadeMaterials.add(m);
  });
  let lastTime = null, restingNight = false, targetNight = false, visibility = 1, phase = "rest";
  function settle(night) {
    restingNight = night;
    group.position.copy(night ? sleepSpots.night : sleepSpots.day);
    group.userData.sleepSite = night ? "tree-ground" : "veranda";
  }
  function update(time = 0, night = false) {
    const t = Number.isFinite(time) ? time : 0;
    if (lastTime === null || t < lastTime) {
      targetNight = !!night;
      settle(targetNight);
      visibility = 1;
      phase = "rest";
      lastTime = t;
    }
    let dt = Math.max(0, t - lastTime);
    lastTime = t;
    if (!!night !== targetNight) {
      targetNight = !!night;
      phase = targetNight === restingNight ? "in" : "out";
      dt = 0;
    }
    for (let pass = 0; pass < 3 && dt > 0 && phase !== "rest"; pass++) {
      if (phase === "out") {
        const step = Math.min(visibility, dt / 0.65);
        visibility -= step;
        dt -= step * 0.65;
        if (visibility <= 1e-8) {
          visibility = 0;
          settle(targetNight);
          phase = "in";
          dt = 0;
        }
      } else {
        const step = Math.min(1 - visibility, dt / 0.8);
        visibility += step;
        dt -= step * 0.8;
        if (visibility >= 1 - 1e-8) {
          visibility = 1;
          phase = "rest";
        }
      }
    }
    const opacity = visibility * visibility * (3 - 2 * visibility), fading = opacity < 0.999999;
    for (const m of fadeMaterials) {
      if (m.transparent !== fading) {
        m.transparent = fading;
        m.depthWrite = !fading;
        m.needsUpdate = true;
      }
      m.opacity = opacity;
    }
    for (const { o, shadow } of fadeMeshes) o.castShadow = shadow && !fading;
    group.visible = opacity > 1e-6;
    group.userData.sleepOpacity = opacity;
    group.userData.sleepTransition = phase;
    const breath = 0.5 + 0.5 * Math.sin(t * 1.1);
    body.scale.y = 1 + breath * 6e-3;
    const twitch = Math.pow(Math.max(0, Math.sin(t * 0.18 - 0.8)), 22) * Math.sin(t * 4.4) * 0.032;
    ears[0].rotation.z = 0.12 + twitch;
    ears[1].rotation.z = -0.12 - twitch * 0.26;
  }
  function reset() {
    lastTime = null;
  }
  return { group, update, reset };
}
export {
  createSpringCat
};
