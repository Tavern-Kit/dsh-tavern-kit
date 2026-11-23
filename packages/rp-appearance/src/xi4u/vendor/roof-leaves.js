/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 AC.
 * Source: https://github.com/annac777/xi4u @ 336d2a38ed8c170a4599493f1bc20c6c1ef7962c, app/roof-leaves.ts
 * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.
 */
import * as T from "three";
function createRoofLeaves({ root, roof, material }) {
  const group = new T.Group();
  group.name = "autumn-roof-leaves";
  group.visible = false;
  group.userData.inkOutline = false;
  root.add(group);
  root.updateMatrixWorld(true);
  const rootInverse = root.matrixWorld.clone().invert(), tiles = [], bounds = new T.Box3();
  roof.traverse((o) => {
    const p2 = o.geometry?.parameters;
    if (!o.isMesh || o.geometry.type !== "CylinderGeometry" || !p2?.openEnded || p2.radialSegments !== 10 || Math.abs(p2.height - 0.45) > 0.015) return;
    o.geometry.computeBoundingBox();
    const box = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    tiles.push({ o, box });
    bounds.union(box);
  });
  const hash = (i, s = 0) => {
    const n = Math.sin(i * 127.1 + s * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  };
  const ray = new T.Raycaster(), down = new T.Vector3(0, -1, 0), normalMatrix = new T.Matrix3();
  let fineRays = 0;
  function surfaceAt(x, z) {
    ray.set(new T.Vector3(x, bounds.max.y + 1, z), down);
    ray.far = bounds.max.y - bounds.min.y + 2;
    let first = null;
    for (const tile of tiles) {
      if (x < tile.box.min.x || x > tile.box.max.x || z < tile.box.min.z || z > tile.box.max.z) continue;
      fineRays++;
      const hit = ray.intersectObject(tile.o, false)[0];
      if (hit && (!first || hit.distance < first.distance)) first = hit;
    }
    if (!first) return null;
    const normal = first.face.normal.clone().applyMatrix3(normalMatrix.getNormalMatrix(first.object.matrixWorld)).normalize();
    return { point: first.point, normal, object: first.object };
  }
  function leafGeometry(kind) {
    const borders = [
      [[0, -0.5], [-0.28, -0.3], [-0.44, -0.04], [-0.43, 0.23], [-0.2, 0.43], [0, 0.53], [0.25, 0.34], [0.46, 0.12], [0.4, -0.13], [0.22, -0.36]],
      [[0, -0.49], [-0.21, -0.25], [-0.48, -0.23], [-0.35, 0.01], [-0.55, 0.17], [-0.27, 0.21], [-0.19, 0.46], [-0.06, 0.3], [0.03, 0.56], [0.17, 0.3], [0.38, 0.35], [0.28, 0.1], [0.53, 0.02], [0.26, -0.13], [0.3, -0.36], [0.11, -0.28]],
      [[0, -0.52], [-0.22, -0.3], [-0.36, -0.03], [-0.28, 0.29], [-0.06, 0.55], [0.2, 0.37], [0.39, 0.11], [0.31, -0.22], [0.12, -0.4]]
    ];
    const border = borders[kind], p2 = [0, 14e-4, 0.015], colors = [1, 0.91, 0.73], ids = [];
    border.forEach(([x, z], i) => {
      p2.push(x, 15e-5 + Math.max(0, z - 0.22) * 2e-3, z);
      const shade = 0.9 + 0.06 * Math.sin(i * 1.9 + kind);
      colors.push(shade, shade * 0.91, shade * 0.76);
    });
    for (let i = 1; i <= border.length; i++) ids.push(0, i, i === border.length ? 1 : i + 1);
    const stem = p2.length / 3;
    p2.push(-0.017, 3e-4, -0.45, 0.017, 3e-4, -0.45, 0.012, 3e-4, -0.66, -0.012, 3e-4, -0.66);
    for (let i = 0; i < 4; i++) colors.push(0.59, 0.47, 0.34);
    ids.push(stem, stem + 1, stem + 2, stem, stem + 2, stem + 3);
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(p2, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    g.setIndex(ids);
    g.computeVertexNormals();
    return g;
  }
  const geometries = [0, 1, 2].map(leafGeometry), records = [], q = new T.Quaternion(), yaw = new T.Quaternion(), up = new T.Vector3(0, 1, 0), worldMatrix = new T.Matrix4(), p = new T.Vector3(), scale = new T.Vector3(), origin = new T.Vector3();
  const checks = geometries.map((g) => {
    const list = [], a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) list.push(new T.Vector3().fromBufferAttribute(pos, i));
    for (let i = 0; i < g.index.count; i += 3) {
      a.fromBufferAttribute(pos, g.index.getX(i));
      b.fromBufferAttribute(pos, g.index.getX(i + 1));
      c.fromBufferAttribute(pos, g.index.getX(i + 2));
      list.push(a.clone().add(b).add(c).multiplyScalar(1 / 3));
    }
    return list;
  });
  const tint = ["#ce8653", "#b76448", "#d6a451", "#b87946", "#d7ae68"];
  let attempts = 0;
  for (let attempt = 0; attempt < 1600 && records.length < 84; attempt++) {
    attempts = attempt + 1;
    const kind = records.length % 3, r = Math.sqrt(hash(attempt, 1)), angle = hash(attempt, 2) * Math.PI * 2, cluster = attempt % 10;
    const cx = cluster < 6 ? -2.82 : cluster < 9 ? -1.15 : -2.1, cz = cluster < 6 ? -2.12 : cluster < 9 ? -1.47 : -2.14;
    const x = cx + Math.cos(angle) * r * (cluster < 6 ? 1.02 : cluster < 9 ? 1.13 : 1.68), z = cz + Math.sin(angle) * r * (cluster < 6 ? 1.18 : cluster < 9 ? 0.77 : 1.28);
    if (x < -3.93 || x > 0.32 || z < -3.54 || z > -0.72) continue;
    const hit = surfaceAt(x, z);
    if (!hit || hit.normal.y < 0.82) continue;
    const length = 0.122 + hash(attempt, 4) * 0.055, width = 0.067 + hash(attempt, 5) * 0.03;
    scale.set(width, 1, length);
    q.setFromUnitVectors(up, hit.normal);
    yaw.setFromAxisAngle(up, (hash(attempt, 6) - 0.5) * 1.9 + (attempt % 2 ? Math.PI : 0));
    q.multiply(yaw);
    origin.copy(hit.point).addScaledVector(hit.normal, 3e-3);
    worldMatrix.compose(origin, q, scale);
    let min = Infinity, max = -Infinity, valid = true;
    for (const sample of checks[kind]) {
      p.copy(sample).applyMatrix4(worldMatrix);
      const support = surfaceAt(p.x, p.z);
      if (!support) {
        valid = false;
        break;
      }
      const gap = p.y - support.point.y;
      min = Math.min(min, gap);
      max = Math.max(max, gap);
      if (gap < 15e-4 || gap > 0.019) {
        valid = false;
        break;
      }
    }
    if (!valid) continue;
    if (records.some((r2) => Math.hypot(r2.origin.x - origin.x, r2.origin.z - origin.z) < 0.126)) continue;
    const color = new T.Color(tint[Math.floor(hash(attempt, 7) * tint.length)]);
    color.offsetHSL(0, 0, (hash(attempt, 8) - 0.5) * 0.045);
    records.push({ kind, origin: origin.clone(), normal: hit.normal.clone(), matrix: rootInverse.clone().multiply(worldMatrix), worldMatrix: worldMatrix.clone(), color, minGap: min, maxGap: max, size: [width, length] });
  }
  const leafMat = material ? material("#ffffff", { vertexColors: true, side: T.DoubleSide, roughness: 0.98, flatShading: true }) : new T.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, side: T.DoubleSide, roughness: 0.98, flatShading: true });
  const meshes = [];
  for (let kind = 0; kind < 3; kind++) {
    const list = records.filter((r) => r.kind === kind), mesh = new T.InstancedMesh(geometries[kind], leafMat, list.length);
    mesh.name = `roof-resting-autumn-leaves-${kind}`;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.inkOutline = false;
    list.forEach((r, i) => {
      mesh.setMatrixAt(i, r.matrix);
      mesh.setColorAt(i, r.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    group.add(mesh);
    meshes.push(mesh);
  }
  const stats = { count: records.length, meshes: 3, tileMeshes: tiles.length, attempts, fineRays, minGap: Math.min(...records.map((r) => r.minGap)), maxGap: Math.max(...records.map((r) => r.maxGap)), triangles: meshes.reduce((n, m) => n + m.geometry.index.count / 3 * m.count, 0) };
  return { group, meshes, records, stats, setSeason: (season) => {
    group.visible = season === "autumn";
  } };
}
export {
  createRoofLeaves
};
