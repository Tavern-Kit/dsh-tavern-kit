/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 AC.
 * Source: https://github.com/annac777/xi4u @ 336d2a38ed8c170a4599493f1bc20c6c1ef7962c, app/day-night-life.ts
 * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.
 */
import * as T from "three";
function createDayNightLife({
  root,
  material,
  mesh,
  box,
  ellipsoid,
  line,
  lathe,
  wood,
  woodDark,
  woodEdge,
  seasonalLife,
  seasonalTea,
  verandaTeaBase,
  summerProps,
  sleeper,
  brazier,
  openInteriorScreen
}) {
  const DECK = 0.945, TATAMI = 1.0175, SPRING_TEA_SHIFT = 3.32;
  const dayNightRoot = new T.Group();
  dayNightRoot.name = "day-night-interior";
  root.add(dayNightRoot);
  const group = (name) => {
    const g = new T.Group();
    g.name = name;
    g.visible = false;
    dayNightRoot.add(g);
    return g;
  };
  const cotton = material("#dedac4", { roughness: 1 }), cottonEdge = material("#b9b6a0", { roughness: 1 });
  const sage = material("#859a90", { roughness: 1 }), sageLight = material("#b2c0ab", { roughness: 1 });
  const quiltColor = material("#a97759", { roughness: 1 }), quiltEdge = material("#d0ab84", { roughness: 1 });
  function cloth(name, w2, d, h2, m, position, parent, loft = 0.022) {
    const nx = 16, nz = 24, verts = [], indices = [];
    function top(x, z) {
      const u = x / w2 + 0.5, v = z / d + 0.5;
      const pillow = Math.pow(Math.max(0, Math.sin(Math.PI * u) * Math.sin(Math.PI * v)), 0.48);
      const fold = (Math.sin(u * 23 + v * 3) + 0.45 * Math.sin(v * 31 - u * 5)) * loft;
      return 0.018 + (h2 - 0.018) * pillow + fold * pillow * 0.28;
    }
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = (i / nx - 0.5) * w2, z = (j / nz - 0.5) * d;
      verts.push(x, top(x, z), z);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, e = c + 1;
      indices.push(a, c, b, b, c, e);
    }
    const rim = [];
    for (let i = 0; i <= nx; i++) rim.push(i);
    for (let j = 1; j <= nz; j++) rim.push(j * (nx + 1) + nx);
    for (let i = nx - 1; i >= 0; i--) rim.push(nz * (nx + 1) + i);
    for (let j = nz - 1; j > 0; j--) rim.push(j * (nx + 1));
    const bottomStart = verts.length / 3;
    rim.forEach((i) => verts.push(verts[i * 3], 0, verts[i * 3 + 2]));
    const center = verts.length / 3;
    verts.push(0, 0, 0);
    for (let k = 0; k < rim.length; k++) {
      const next = (k + 1) % rim.length, a = rim[k], b = rim[next], c = bottomStart + k, e = bottomStart + next;
      indices.push(a, b, c, b, e, c, center, c, e);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const o = mesh(geo, m, position, parent);
    o.name = name;
    return { o, top };
  }
  const springBed = group("spring-night-futon");
  springBed.position.set(-0.3, TATAMI, -2.56);
  const mattress = box(0.98, 0.068, 1.66, cotton, [0, 0.034, 0], springBed, 0.025);
  mattress.name = "spring-futon-contact-mattress";
  for (const x of [-0.48, 0.48]) line([[x, 0.035, -0.78], [x, 0.034, -0.34], [x, 0.036, 0.33], [x, 0.035, 0.78]], cottonEdge, 4e-3, springBed);
  const cover = cloth("spring-futon-sage-quilt", 0.946, 1.16, 0.117, sage, [0, 0.068, 0.195], springBed, 0.014);
  cloth("spring-futon-turned-cuff", 0.944, 0.155, 0.044, cotton, [0, 0.106, -0.356], springBed, 3e-3);
  for (const x of [-0.31, 0, 0.31]) {
    const points = [];
    for (let j = 0; j < 15; j++) {
      const z = -0.5 + j / 14 * 1;
      points.push([x, 0.071 + cover.top(x, z), z + 0.195]);
    }
    line(points, sageLight, 2e-3, springBed);
  }
  cloth("spring-futon-pillow", 0.52, 0.315, 0.086, cotton, [0.015, 0.068, -0.588], springBed, 4e-3);
  for (const x of [-0.22, 0.25]) line([[x, 0.083, -0.713], [x, 0.089, -0.59], [x, 0.083, -0.46]], cottonEdge, 25e-4, springBed);
  const soup = group("winter-day-soup-bowl");
  soup.position.set(0.22, DECK, -0.7);
  const glaze = material("#9faaa0", { roughness: 0.4 }), rimColor = material("#ddd4bc", { roughness: 0.4 });
  const broth = material("#b88951", { roughness: 0.22 });
  lathe([
    [0.052, 0],
    [0.06, 8e-3],
    [0.071, 0.018],
    [0.104, 0.041],
    [0.135, 0.086],
    [0.147, 0.137],
    [0.145, 0.15],
    [0.134, 0.15],
    [0.13, 0.136],
    [0.12, 0.094],
    [0.093, 0.054],
    [0.055, 0.028]
  ], glaze, [0, 0, 0], soup).name = "winter-soup-bowl-body";
  const lip = mesh(new T.TorusGeometry(0.1395, 6e-3, 6, 40), rimColor, [0, 0.15, 0], soup);
  lip.rotation.x = Math.PI / 2;
  const surface = mesh(new T.CircleGeometry(0.126, 40), broth, [0, 0.121, 0], soup);
  surface.rotation.x = -Math.PI / 2;
  surface.castShadow = false;
  const tofu = material("#eee2ba"), scallion = material("#70865a");
  for (const [x, z, a] of [[-0.051, 9e-3, -0.25], [0.033, -0.036, 0.34]]) {
    const bit = box(0.038, 8e-3, 0.031, tofu, [x, 0.125, z], soup, 4e-3);
    bit.rotation.y = a;
  }
  for (const [x, z, a] of [[0.013, 0.044, 0.2], [-0.028, -0.045, -0.4], [0.065, 0.012, 0.8]]) {
    const ring = mesh(new T.TorusGeometry(0.012, 33e-4, 5, 12), scallion, [x, 0.127, z], soup);
    ring.rotation.set(Math.PI / 2, 0, a);
  }
  const folded = group("winter-night-folded-quilt");
  folded.position.set(1.59, DECK, -0.87);
  box(0.61, 0.026, 0.56, cottonEdge, [0, 0.013, 0], folded, 0.012).name = "winter-folded-quilt-contact";
  for (let layer = 0; layer < 3; layer++) {
    const w2 = 0.616 - layer * 0.016, d = 0.552 - layer * 0.012, y = 0.026 + layer * 0.042;
    cloth(`winter-folded-quilt-layer-${layer + 1}`, w2, d, 0.054, layer === 1 ? quiltEdge : quiltColor, [0, y, 0], folded, 3e-3);
    line([[-w2 * 0.44, y + 0.016, d / 2 + 1e-3], [0, y + 0.014, d / 2 + 2e-3], [w2 * 0.44, y + 0.018, d / 2 + 1e-3]], cotton, 35e-4, folded);
  }
  for (const x of [-0.19, 0.19]) line([[x, 0.131, -0.22], [x, 0.157, -0.05], [x, 0.154, 0.14], [x, 0.129, 0.22]], quiltEdge, 5e-3, folded);
  const closedScreens = group("summer-night-closed-shoji");
  const paperNight = material("#d8d1b6", { roughness: 1, emissive: "#d3a15e", emissiveIntensity: 0, side: T.DoubleSide });
  const left = -3.92, right = 2.29, span = right - left, count = 4, w = span / count, h = 2.232;
  box(span + 0.04, TATAMI - DECK, 0.126, woodDark, [(left + right) / 2, (TATAMI + DECK) / 2, -1.55], closedScreens).name = "night-shoji-supported-threshold";
  box(span + 0.045, 0.078, 0.132, woodDark, [(left + right) / 2, TATAMI + h + 0.02, -1.55], closedScreens);
  const paperBacking = material("#67685b", { roughness: 1, side: T.DoubleSide });
  box(span + 0.025, h + 0.018, 0.022, paperBacking, [(left + right) / 2, TATAMI + h / 2, -1.611], closedScreens).name = "closed-shoji-continuous-paper-backing";
  for (let i = 0; i < count; i++) {
    const panel = new T.Group();
    panel.name = `closed-shoji-panel-${i + 1}`;
    panel.position.set(left + (i + 0.5) * w, TATAMI, -1.55 + (i % 2 ? -0.021 : 0.021));
    closedScreens.add(panel);
    box(w, h, 0.032, paperNight, [0, h / 2, 9e-3], panel).name = `closed-shoji-paper-${i + 1}`;
    for (const x of [-w / 2 + 0.021, w / 2 - 0.021]) box(0.047, h, 0.07, woodDark, [x, h / 2, 0.017], panel);
    for (const y of [0.024, h - 0.024]) box(w, 0.048, 0.073, woodDark, [0, y, 0.017], panel);
    box(w - 0.055, 0.226, 0.053, wood, [0, 0.139, 0.023], panel);
    for (let k = 1; k < 6; k++) box(0.018, h - 0.1, 0.027, woodEdge, [-w / 2 + k * w / 6, h / 2, 0.032], panel);
    for (let k = 1; k < 7; k++) box(w - 0.052, 0.02, 0.027, woodEdge, [0, 0.26 + k * 0.279, 0.032], panel);
    const hx = (i % 2 ? -1 : 1) * (w / 2 - 0.087);
    ellipsoid(hx, 0.985, 0.056, 0.019, 0.047, 8e-3, woodDark, panel, 12);
  }
  brazier.name = "winter-veranda-brazier";
  brazier.position.z = -0.64;
  let lastKey = "";
  function setState(season, night) {
    const key = season + ":" + Boolean(night);
    if (key === lastKey) return false;
    lastKey = key;
    const day = !night;
    seasonalTea.position.set(season === "spring" ? SPRING_TEA_SHIFT : season === "autumn" ? 2.7 : 0, season === "autumn" ? -0.036 : 0, 0);
    seasonalTea.visible = day && (season === "spring" || season === "autumn");
    verandaTeaBase.visible = season === "spring";
    summerProps.visible = day && season === "summer";
    sleeper.group.visible = day && season === "summer";
    brazier.visible = season === "winter";
    soup.visible = day && season === "winter";
    springBed.visible = night && season === "spring";
    folded.visible = night && season === "winter";
    closedScreens.visible = night && season === "summer";
    openInteriorScreen.visible = !closedScreens.visible;
    seasonalLife.setNight(Boolean(night));
    return true;
  }
  return { setState, group: dayNightRoot, refs: { springBed, soup, folded, closedScreens } };
}
export {
  createDayNightLife
};
