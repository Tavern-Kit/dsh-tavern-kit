/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 AC.
 * Source: https://github.com/annac777/xi4u @ 336d2a38ed8c170a4599493f1bc20c6c1ef7962c, app/canopy-fall.ts
 * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.
 */
import * as T from "three";
import { gardenWind } from "./garden-atmosphere.js";
function createCanopyFall({ slots, leafRecords, foliage, surfaces, inWater }) {
  const fract = (x) => x - Math.floor(x), hash = (i, s = 0) => fract(Math.sin(i * 127.1 + s * 311.7) * 43758.5453123);
  const smooth = (a2, b2, x) => T.MathUtils.smoothstep(x, a2, b2);
  const seasonal = {
    spring: leafRecords.filter((r) => r.treeId === 0 && r.keep < 0.76),
    summer: leafRecords.filter((r) => r.treeId === 0),
    autumn: leafRecords.filter((r) => r.treeId === 0 && r.keep < 0.48),
    winter: []
  };
  for (const pool of Object.values(seasonal)) pool.sort((a2, b2) => a2.p[1] - b2.p[1]);
  const geometry = slots[0]?.o.geometry.clone();
  geometry?.translate(0, 0, -0.48);
  const receiving = [], seen = /* @__PURE__ */ new Set();
  for (const surface of surfaces) {
    surface.object.updateWorldMatrix(true, true);
    surface.object.traverse((o) => {
      if (!o.isMesh || seen.has(o)) return;
      seen.add(o);
      o.geometry.computeBoundingBox();
      receiving.push({ object: o, kind: surface.kind, bounds: o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld) });
    });
  }
  const ray = new T.Raycaster(), segmentBox = new T.Box3(), a = new T.Vector3(), b = new T.Vector3(), direction = new T.Vector3(), normalMatrix = new T.Matrix3();
  const sourceMatrix = new T.Matrix4(), instanceMatrix = new T.Matrix4(), q = new T.Quaternion(), euler = new T.Euler(), scale = new T.Vector3(), point = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  const airQ = new T.Quaternion(), settledQ = new T.Quaternion(), yawQ = new T.Quaternion();
  const diagnostics = { paths: 0, rayTests: 0, sourceCount: seasonal.summer.length, lastBatchMs: 0, maxBatchMs: 0, receivingMeshes: receiving.length };
  function isVisible(o) {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  }
  const records = slots.map((slot, i) => {
    const baseMaterial = slot.o.material, mat = baseMaterial.clone();
    mat.transparent = true;
    mat.depthWrite = false;
    mat.opacity = 0;
    slot.o.material = mat;
    slot.o.geometry = geometry;
    slot.o.name = "ancient-canopy-falling-leaf";
    slot.o.userData.inkOutline = false;
    slot.o.renderOrder = 5;
    slot.o.castShadow = false;
    const size = 0.092 + hash(i, 2) * 0.036;
    slot.o.scale.set(size, size, size * 1.28);
    return { o: slot.o, mat, baseMaterial, i, size, period: 25 + hash(i, 9) * 6, offset: slot.seed, cycle: NaN, season: null, plan: null };
  });
  function sourceAt(record, birth, season) {
    const wind = gardenWind(birth);
    euler.copy(foliage.rotation);
    euler.x = wind.x;
    euler.z = wind.z;
    sourceMatrix.compose(foliage.position, q.setFromEuler(euler), foliage.scale);
    if (foliage.parent) {
      foliage.parent.updateWorldMatrix(true, false);
      sourceMatrix.premultiply(foliage.parent.matrixWorld);
    }
    const factor = season === "spring" ? 0.97 : season === "autumn" ? 0.94 : 1.13, s = record.s * factor;
    instanceMatrix.compose(point.fromArray(record.p), q.setFromEuler(euler.set(...record.r)), scale.set(s, s, s * 1.2));
    return new T.Vector3(0, 0, 0.48).applyMatrix4(instanceMatrix).applyMatrix4(sourceMatrix);
  }
  function rawPosition(plan, t, target) {
    const u = T.MathUtils.clamp(t / plan.duration, 0, 1), advance = 1 - Math.pow(1 - u, 1.4), bell = Math.sin(Math.PI * u);
    target.copy(plan.source);
    target.x += plan.dx * advance + Math.sin(t * 0.73 + plan.phase) * 0.17 * bell;
    target.z += plan.dz * advance + Math.cos(t * 0.59 + plan.phase) * 0.13 * bell;
    target.y -= plan.drop * u + Math.sin(t * 0.91 + plan.phase) * 0.045 * bell;
    return target;
  }
  function compile(r, cycle, season, birth) {
    const pool = seasonal[season];
    if (!pool?.length) return null;
    const stratum = r.i * 17 % 48, bandLo = Math.floor(stratum / 48 * pool.length), bandHi = Math.max(bandLo + 1, Math.floor((stratum + 1) / 48 * pool.length));
    const index = bandLo + Math.floor(hash(r.i + cycle * 53, 7) * (bandHi - bandLo));
    const record = pool[Math.min(pool.length - 1, index)], source = sourceAt(record, birth, season), key = r.i + cycle * 71;
    const wind = gardenWind(birth).gust;
    const speed = 0.57 + hash(key, 3) * 0.16, duration = Math.max(5, (source.y + 0.15) / speed);
    const plan = { source, sourceRecord: record, birth, duration, drop: source.y + 0.18, dx: 0.85 + hash(key, 4) * 2.15 + wind * 0.6, dz: 1.8 + hash(key, 5) * 2.3 + wind * 0.3, phase: hash(key, 8) * Math.PI * 2, contact: null, fallTime: duration, hold: 1 + hash(key, 6) * 1.1, fade: 1.15 };
    rawPosition(plan, 0, a);
    const steps = 42;
    for (let k = 1; k <= steps; k++) {
      const t = duration * k / steps;
      rawPosition(plan, t, b);
      direction.subVectors(b, a);
      const distance = direction.length();
      segmentBox.setFromPoints([a, b]);
      let nearest = null;
      ray.set(a, direction.normalize());
      ray.far = distance + 5e-4;
      for (const surface of receiving) {
        if (!segmentBox.intersectsBox(surface.bounds) || !isVisible(surface.object)) continue;
        diagnostics.rayTests++;
        for (const hit of ray.intersectObject(surface.object, false)) if (hit.distance <= distance + 5e-4 && (!nearest || hit.distance < nearest.hit.distance)) nearest = { hit, kind: surface.kind };
      }
      if (nearest) {
        const hit = nearest.hit;
        const normal = hit.face.normal.clone().applyMatrix3(normalMatrix.getNormalMatrix(hit.object.matrixWorld)).normalize();
        if (normal.y < 0) normal.negate();
        if (normal.y > 0.38) {
          const time = duration * (k - 1) / steps + (t - duration * (k - 1) / steps) * T.MathUtils.clamp(hit.distance / distance, 0, 1);
          plan.fallTime = time;
          plan.contact = { position: hit.point.clone().addScaledVector(normal, nearest.kind === "water" ? 0.012 : 6e-3), normal, kind: nearest.kind };
          plan.hold = nearest.kind === "water" ? 1.8 : plan.hold;
          break;
        }
      }
      a.copy(b);
    }
    if (!plan.contact) plan.fallTime = Math.max(1, (source.y - 0.24) / plan.drop * duration);
    diagnostics.paths++;
    return plan;
  }
  function update(time, season) {
    const started = performance.now(), limit = season === "winter" ? 0 : season === "autumn" ? 48 : season === "spring" ? 22 : 12;
    let compiled = false;
    for (const r of records) {
      if (r.i >= limit || !seasonal[season]?.length) {
        r.o.visible = false;
        continue;
      }
      const offset = 4 + 1.8 + hash(r.i, 19) * 3.2, cycle = Math.floor((time - offset) / 26), birth = cycle * 26 + offset, age = time - birth;
      if (r.cycle !== cycle || r.season !== season) {
        r.plan = compile(r, cycle, season, birth);
        r.cycle = cycle;
        r.season = season;
        compiled = true;
      }
      const p = r.plan;
      if (!p) {
        r.o.visible = false;
        continue;
      }
      const end = p.fallTime + (p.contact ? p.hold + p.fade : 0);
      if (age >= end) {
        r.o.visible = false;
        continue;
      }
      r.o.visible = true;
      r.mat.color.copy(r.baseMaterial.color);
      let opacity = smooth(0, 0.35, age);
      rawPosition(p, Math.min(age, p.fallTime), r.o.position);
      euler.set(0.38 * Math.sin(age * 1.45 + p.phase), p.phase + age * 0.58, 0.62 * Math.sin(age * 1.13 + p.phase));
      airQ.setFromEuler(euler);
      if (p.contact) {
        const c = p.contact, settle = smooth(Math.max(0, p.fallTime - 0.72), p.fallTime, age);
        settledQ.setFromUnitVectors(up, c.normal);
        yawQ.setFromAxisAngle(up, p.phase);
        settledQ.multiply(yawQ);
        r.o.quaternion.copy(airQ).slerp(settledQ, settle);
        rawPosition(p, p.fallTime, point);
        r.o.position.addScaledVector(c.position.clone().sub(point), settle);
        if (age >= p.fallTime) {
          r.o.position.copy(c.position);
          r.o.quaternion.copy(settledQ);
          const since = age - p.fallTime;
          if (c.kind === "water") {
            const dz = Math.min(since, 2.8) * 0.025;
            r.o.position.z += dz;
            if (!inWater(r.o.position.x, r.o.position.z)) {
              r.o.visible = false;
              continue;
            }
          }
          opacity *= 1 - smooth(p.hold, p.hold + p.fade, since);
        }
      } else {
        r.o.quaternion.copy(airQ);
        opacity *= 1 - smooth(Math.max(0, p.fallTime - 1.35), p.fallTime, age);
      }
      r.mat.opacity = opacity * 0.94;
      r.o.userData.canopyFall = { birth, age, source: p.source.toArray(), sourceHeight: p.sourceRecord.p[1], kind: p.contact?.kind || "air", fallTime: p.fallTime, landed: age >= p.fallTime, opacity: r.mat.opacity };
    }
    if (compiled) {
      diagnostics.lastBatchMs = performance.now() - started;
      diagnostics.maxBatchMs = Math.max(diagnostics.maxBatchMs, diagnostics.lastBatchMs);
    }
  }
  return { update, diagnostics, records };
}
export {
  createCanopyFall
};
