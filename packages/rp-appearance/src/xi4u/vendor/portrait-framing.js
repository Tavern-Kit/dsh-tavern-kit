/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 AC.
 * Source: https://github.com/annac777/xi4u @ 336d2a38ed8c170a4599493f1bc20c6c1ef7962c, app/portrait-framing.ts
 * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.
 */
import * as T from "three";
function createPortraitFraming(camera, controls, points, safeArea = { top: 0, bottom: 0 }) {
  let initialized = false, width = 1, height = 1;
  const baseTarget = new T.Vector3(-0.25, 2.7, 0);
  function framing(w, h) {
    const portrait = w / h < 0.94, phone = w <= 680;
    const azimuth = T.MathUtils.degToRad(portrait ? 30 : 24), elevation = T.MathUtils.degToRad(portrait ? 37 : 35);
    const outward = new T.Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
    const right = new T.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth)), up = outward.clone().cross(right).normalize();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      const x = p.dot(right), y = p.dot(up);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const spanX = maxX - minX, spanY = maxY - minY, cx = (maxX + minX) * 0.5, cy = (maxY + minY) * 0.5;
    const short = h <= 730, landscape = h <= 520 && !phone;
    const left = 8, rightMargin = 8, top = 8, bottom = 8;
    const usableW = Math.max(1, w - left - rightMargin), usableH = Math.max(1, h - top - bottom);
    const pixelsPerUnit = Math.min(usableW / spanX, usableH / spanY) / 1.025;
    const artH = spanY * pixelsPerUnit;
    const screenX = w * 0.5;
    const preferredY = h * 0.5;
    const screenY = T.MathUtils.clamp(preferredY, top + artH * 0.5, h - bottom - artH * 0.5);
    const target = baseTarget.clone().addScaledVector(right, cx - (screenX - w * 0.5) / pixelsPerUnit - baseTarget.dot(right)).addScaledVector(up, cy + (screenY - h * 0.5) / pixelsPerUnit - baseTarget.dot(up));
    const half = h / (2 * pixelsPerUnit), aspect = w / h;
    return { target, position: target.clone().addScaledVector(outward, 24), half, aspect };
  }
  function projection(f) {
    camera.left = -f.half * f.aspect;
    camera.right = f.half * f.aspect;
    camera.top = f.half;
    camera.bottom = -f.half;
    camera.updateProjectionMatrix();
  }
  function reset() {
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damping;
    const f = framing(width, height);
    camera.zoom = 1;
    camera.position.copy(f.position);
    controls.target.copy(f.target);
    camera.lookAt(f.target);
    projection(f);
    controls.update();
    initialized = true;
  }
  return {
    resize(w, h) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      if (!initialized) reset();
      else projection(framing(width, height));
    },
    reset
  };
}
function collectGardenFramePoints(root) {
  root.updateMatrixWorld(true);
  const points = [], instance = new T.Matrix4(), world = new T.Matrix4(), p = new T.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || /fine-flow-ribbon|water-impact-ripple/.test(o.name)) return;
    for (let a = o; a && a !== root; a = a.parent) if (!a.visible) return;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    if (materials.every((m) => m.transparent && m.opacity < 0.25)) return;
    const position = o.geometry?.getAttribute("position");
    if (!position) return;
    const stride = o.isInstancedMesh ? 1 : Math.max(1, Math.floor(position.count / 360));
    const add = (matrix) => {
      for (let i = 0; i < position.count; i += stride) {
        p.fromBufferAttribute(position, i).applyMatrix4(matrix);
        if (p.y < -0.15 || !Number.isFinite(p.x + p.y + p.z)) continue;
        points.push(p.clone());
      }
    };
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, instance);
        if (Math.abs(instance.determinant()) < 1e-11) continue;
        world.multiplyMatrices(o.matrixWorld, instance);
        add(world);
      }
    } else add(o.matrixWorld);
  });
  return points;
}
export {
  collectGardenFramePoints,
  createPortraitFraming
};
