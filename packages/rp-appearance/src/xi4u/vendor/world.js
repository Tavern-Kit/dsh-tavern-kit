/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 AC.
 * Source: https://github.com/annac777/xi4u @ 336d2a38ed8c170a4599493f1bc20c6c1ef7962c, app/world.ts
 * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.
 */
import * as T from "three";
import { disposeGardenResources } from "../resources.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createPixelRenderer } from "./pixel-renderer.js";
import { createPortraitFraming, collectGardenFramePoints } from "./portrait-framing.js";
import { createCanopyFall } from "./canopy-fall.js";
import { gardenWind, springStorm, createNightButterflies } from "./garden-atmosphere.js";
import { createSeasonalLife } from "./seasonal-life.js";
import { createDayNightLife } from "./day-night-life.js";
import { createSnowAccumulation } from "./snow-accumulation.js";
import { createRoofLeaves } from "./roof-leaves.js";
import { createWinterCreekIce } from "./winter-creek-ice.js";
import { gardenTheme } from "./garden-theme.js";
import { createGardenClock, GARDEN_SEASONS } from "./garden-clock.js";
import { createCelestialBodies } from "./celestial-bodies.js";
import { PIXEL_SIZE_CSS } from "./render-style.js";
import { createRainStreaks } from "./rain-streaks.js";
import { createAncientTree } from "./ancient-tree.js";
import { treeHeight } from "./tree-profile.js";
import { branchSnowSurface, rockCoating } from "./snow-surface.js";
import { createCreekMaterial } from "./water-surface.js";
import { createWaterCurrent } from "./water-current.js";
import { createOrganicTerrain, withinGarden, withinCreek, streamExtent } from "./terrain-footprint.js";
import { createVerandaPlant } from "./veranda-plant.js";
import { createSeasonalFauna } from "./seasonal-fauna.js";
import { createSummerSleeper } from "./summer-sleeper.js";
import { createGardenLife } from "./garden-life.js";
import { createCurvedGrassGeometry, paintCurvedGrass, bendCurvedGrass } from "./curved-grass.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
function createWorld(host, options = {}) {
  const resources = /* @__PURE__ */ new Set(), releases = [];
  let disposed = false;
  const own = (release) => releases.push(release);
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const release of releases.reverse()) {
      try {
        release();
      } catch {
      }
    }
    releases.length = 0;
  }
  try {
    let mesh = function(g, m, p = [0, 0, 0], parent = root) {
      resources.add(g);
      const o = new T.Mesh(g, m);
      o.position.set(...p);
      o.castShadow = true;
      o.receiveShadow = true;
      parent.add(o);
      return o;
    }, box = function(w, h, d, m, p, parent = root, r = 0) {
      return mesh(r ? new RoundedBoxGeometry(w, h, d, 2, r) : new T.BoxGeometry(w, h, d), m, p, parent);
    }, ellipsoid = function(x, y, z, rx, ry, rz, m, parent = root, segments = 16) {
      let o = mesh(new T.SphereGeometry(1, segments, 12), m, [x, y, z], parent);
      o.scale.set(rx, ry, rz);
      return o;
    }, line = function(points, m, r = 0.025, parent = root) {
      const curve = new T.CatmullRomCurve3(points.map((p) => Array.isArray(p) ? v(...p) : p));
      return mesh(new T.TubeGeometry(curve, Math.max(8, points.length * 6), r, 6, false), m, [0, 0, 0], parent);
    }, beam = function(a, b, r1, r2, m, parent = root) {
      a = Array.isArray(a) ? v(...a) : a;
      b = Array.isArray(b) ? v(...b) : b;
      let d = b.clone().sub(a);
      let o = mesh(new T.CylinderGeometry(r2, r1, d.length(), 8), m, a.clone().add(b).multiplyScalar(0.5).toArray(), parent);
      o.quaternion.setFromUnitVectors(v(0, 1, 0), d.normalize());
      return o;
    }, rim = function(o) {
      const l = new T.LineSegments(new T.EdgesGeometry(o.geometry, 35), new T.LineBasicMaterial({ color: "#384538", transparent: true, opacity: 0.23 }));
      o.add(l);
      return o;
    }, texture = function(kind, random = rand) {
      const rand2 = random, rr2 = (a, b) => a + (b - a) * rand2();
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      const colors = kind === "wood" ? ["#cc915b", "#e9ad70", "#f3c786", "#b67950", "#a66d48"] : kind === "tatami" ? ["#cad291", "#b6c786", "#dfe1a2", "#98b181"] : kind === "spring-ground" ? ["#d4b9b9", "#e4c8c8", "#b4c3a5", "#efd7d2"] : ["#a9c585", "#bccf91", "#7eac84", "#d5d89a"];
      ctx.fillStyle = colors[0];
      ctx.fillRect(0, 0, 128, 128);
      if (kind === "wood") {
        for (let i = 0; i < 160; i++) {
          ctx.fillStyle = colors[1 + Math.floor(rand2() * 4)];
          ctx.fillRect(Math.floor(rr2(0, 120)), Math.floor(rr2(0, 128)), Math.floor(rr2(4, 44)), rand2() > 0.8 ? 2 : 1);
        }
        for (let i = 0; i < 5; i++) {
          let x = Math.floor(rr2(10, 110)), y = Math.floor(rr2(2, 124));
          ctx.fillStyle = colors[4];
          ctx.fillRect(x, y, 9, 1);
          ctx.fillRect(x + 2, y - 1, 5, 3);
          ctx.fillStyle = colors[0];
          ctx.fillRect(x + 3, y, 3, 1);
        }
      } else if (kind === "tatami") {
        for (let y = 0; y < 128; y += 2) {
          ctx.fillStyle = colors[y / 2 % 3];
          ctx.fillRect(0, y, 128, 1);
        }
        for (let x = 0; x < 128; x += 8) {
          ctx.fillStyle = colors[3];
          for (let y = 0; y < 128; y += 4) ctx.fillRect(x, y, 1, 2);
        }
      } else {
        for (let i = 0; i < 320; i++) {
          ctx.fillStyle = colors[Math.floor(rand2() * colors.length)];
          ctx.fillRect(Math.floor(rr2(0, 128)), Math.floor(rr2(0, 128)), Math.floor(rr2(2, 8)), Math.floor(rr2(1, 4)));
        }
      }
      const tx = new T.CanvasTexture(c);
      tx.colorSpace = T.SRGBColorSpace;
      tx.wrapS = tx.wrapT = T.RepeatWrapping;
      tx.magFilter = tx.minFilter = T.NearestFilter;
      tx.generateMipmaps = false;
      tx.userData.gardenPixelTexture = true;
      resources.add(tx);
      return tx;
    }, rock = function(x, z, s = 0.4, y = 0.17) {
      let g = new T.IcosahedronGeometry(1, 1);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let f = rr(0.87, 1.12);
        p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
      }
      g.computeVertexNormals();
      let m = stone.clone();
      m.color.setHSL(rr(0.12, 0.18), rr(0.03, 0.1), rr(0.4, 0.62));
      let o = mesh(g, m, [x, y, z]);
      o.name = "shore-rock";
      o.scale.set(s * rr(0.9, 1.35), s * rr(0.6, 0.85), s * rr(0.8, 1.12));
      o.rotation.y = rr(0, 6.28);
      if (x > -2.15 && x < -0.95 && z > -0.35 && z < 1.4) {
        o.position.y = 0.083;
        o.scale.y = 0.05;
        o.userData.lowDrinkingShore = true;
      }
      const cap = mesh(rockCoating(g, 6e-3), moss, [0, 0, 0], o);
      rockMoss.push(cap);
      const sn = mesh(rockCoating(g, 0.018), snowMat, [0, 0, 0], o);
      sn.name = "rock-snow-coating";
      sn.visible = false;
      snowCaps.push(sn);
      if (!withinGarden(x, z, -0.12)) o.visible = false;
      return o;
    }, shoji = function(x, z, w, h, side = false) {
      const g = new T.Group();
      g.position.set(x, 1.02, z);
      if (side) g.rotation.y = Math.PI / 2;
      house.add(g);
      box(w, h, 0.045, paper, [0, h / 2, 0], g);
      for (let xx of [-w / 2, w / 2]) box(0.065, h + 0.05, 0.075, woodDark, [xx, h / 2, 0.025], g);
      for (let yy of [0, h]) box(w, 0.07, 0.075, woodDark, [0, yy, 0.025], g);
      for (let xx = -w / 2 + 0.26; xx < w / 2; xx += 0.26) box(0.023, h, 0.035, woodEdge, [xx, h / 2, 0.04], g);
      for (let yy = 0.3; yy < h; yy += 0.33) box(w, 0.026, 0.035, woodEdge, [0, yy, 0.04], g);
      box(w, 0.27, 0.065, wood, [0, 0.135, 0.055], g);
      return g;
    }, lathe = function(points, m, p, parent = root) {
      return mesh(new T.LatheGeometry(points.map((a) => new T.Vector2(...a)), 24), m, p, parent);
    }, cup = function(x, y, z, parent = root) {
      const g = new T.Group();
      g.position.set(x, y, z);
      parent.add(g);
      lathe([[0.035, 0], [0.07, 0.015], [0.086, 0.09], [0.082, 0.105], [0.067, 0.105], [0.062, 0.035]], ceramic, [0, 0, 0], g);
      mesh(new T.CircleGeometry(0.067, 24), tea, [0, 0.085, 0], g).rotation.x = -Math.PI / 2;
      return g;
    }, teapot = function(x, y, z, parent = root) {
      const g = new T.Group();
      g.name = "ceramic-teapot";
      g.position.set(x, y, z);
      parent.add(g);
      lathe([[0.06, 0], [0.14, 0.04], [0.155, 0.13], [0.11, 0.23], [0.065, 0.24]], ceramic, [0, 0, 0], g);
      ellipsoid(0, 0.245, 0, 0.12, 0.03, 0.12, ceramic, g);
      ellipsoid(0, 0.285, 0, 0.03, 0.028, 0.03, woodDark, g);
      line([[0.09, 0.04, 0], [0.23, 0.11, 0], [0.27, 0.24, 0]], ceramic, 0.037, g);
      line([[-0.11, 0.19, 0], [-0.25, 0.24, 0], [-0.25, 0.06, 0], [-0.1, 0.045, 0]], woodDark, 0.021, g);
      return g;
    }, addLeaves = function(center, count, spread, scale = 1, treeId = -1, clusterSeed = null) {
      let leafSeed = clusterSeed;
      const leafRand = clusterSeed === null ? rand : () => {
        leafSeed = leafSeed * 1664525 + 1013904223 >>> 0;
        return leafSeed / 4294967296;
      };
      const leafRange = (a, b) => a + (b - a) * leafRand();
      for (let i = 0; i < count; i++) {
        const a = leafRange(0, Math.PI * 2), u = leafRange(-1, 1), r = Math.pow(leafRand(), 0.5) * spread;
        leafRecords.push({ p: [center.x + Math.cos(a) * r * Math.sqrt(1 - u * u), center.y + u * r * 0.53, center.z + Math.sin(a) * r * Math.sqrt(1 - u * u)], r: [leafRange(-1.1, 1.1), leafRange(0, 6.28), leafRange(-0.8, 0.8)], s: leafRange(0.22, 0.4) * scale, c: leafRand(), keep: leafRand(), treeId });
      }
    }, snowOnBranch = function(a, b, r0 = 0.06, r1 = 0.017, offset = null, pointMap = null) {
      const curve = b ? new T.LineCurve3(a, b) : a, g = branchSnowSurface(curve, r0, r1);
      if (pointMap) {
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const v2 = pointMap(new T.Vector3().fromBufferAttribute(p, i));
          p.setXYZ(i, v2.x, v2.y, v2.z);
        }
        g.computeVertexNormals();
      }
      if (offset) g.translate(offset.x, offset.y, offset.z);
      const cap = mesh(g, snowMat, [0, 0, 0], branchSnow);
      cap.material.side = T.DoubleSide;
      cap.name = "branch-snow-ribbon";
      return cap;
    }, tree = function(x, z, height, spread) {
      let treeId = treeRoots.length, group = new T.Group();
      group.position.set(x, 0.25, z);
      root.add(group);
      treeRoots.push(group);
      let top = [rr(-0.2, 0.2), height, rr(-0.2, 0.2)];
      beam([0, 0, 0], [0.09, height * 0.55, 0.1], 0.17, 0.085, woodDark, group);
      beam([0.09, height * 0.55, 0.1], top, 0.085, 0.025, woodDark, group);
      for (let i = 0; i < 10; i++) {
        let a = i * 2.399, by = height * 0.4 + rand() * height * 0.36, ex = Math.cos(a) * spread * 0.78, ez = Math.sin(a) * spread * 0.78, ey = by + rr(0.4, 0.9);
        beam([0.07, by, 0.05], [ex, ey, ez], 0.06, 0.017, woodDark, group);
        snowOnBranch(v(x + 0.07, by + 0.25, z + 0.05), v(x + ex, ey + 0.25, z + ez));
        for (let k of [-1, 1]) {
          const end = [ex * 1.21 + Math.sin(a) * k * 0.23, ey + 0.3 + rand() * 0.22, ez * 1.15 + Math.cos(a) * k * 0.23];
          beam([ex * 0.61, by + (ey - by) * 0.61, ez * 0.61], end, 0.027, 7e-3, woodDark, group);
          snowOnBranch(v(x + ex * 0.61, by + (ey - by) * 0.61 + 0.25, z + ez * 0.61), v(x + end[0], end[1] + 0.25, z + end[2]), 0.027, 7e-3);
          beam(end, [end[0] + Math.cos(a + k) * 0.24, end[1] + 0.2, end[2] + Math.sin(a + k) * 0.24], 9e-3, 28e-4, woodDark, group);
        }
        addLeaves(v(x + ex, ey + 0.3, z + ez), 72, spread * 0.56, 1, treeId);
      }
      addLeaves(v(x + top[0], height + 0.3, z), 150, spread * 0.78, 1, treeId);
      for (let a = 0; a < 6.2; a += 1.2) beam([0, 0.08, 0], [Math.cos(a) * 0.5, -0.01, Math.sin(a) * 0.5], 0.12, 0.025, woodDark, group);
    }, colorLeaves = function(season) {
      const pal = { summer: ["#246f70", "#329b79", "#79bf65", "#cbdf69"], spring: ["#bf6e91", "#df9cb5", "#efbfd0", "#fbe1e8"], autumn: ["#a45c45", "#d27544", "#eba651", "#f2cc76"], winter: ["#285e66", "#3d8180", "#6e9990", "#a6c3ae"] }[season];
      leafRecords.forEach((a, i) => {
        let scale = 1.13;
        if (season === "spring") scale = a.treeId === 1 ? a.keep < 0.24 ? 0.6 : 0 : a.keep < 0.76 ? 0.97 : 0;
        if (season === "autumn") scale = a.keep < (a.treeId < 0 ? 0.65 : 0.48) ? 0.94 : 0;
        if (season === "winter") scale = a.treeId < 0 && a.keep < 0.27 ? 0.64 : 0;
        dummy.position.set(...a.p);
        dummy.rotation.set(...a.r);
        const size = a.s * scale;
        dummy.scale.set(size, size, size * 1.2);
        dummy.updateMatrix();
        foliage.setMatrixAt(i, dummy.matrix);
        foliage.setColorAt(i, new T.Color((season === "spring" && a.treeId < 0 ? ["#84a68d", "#a8ba98", "#c6bea8", "#d9b9bb"] : pal)[Math.min(3, Math.floor(a.c * 4))]));
      });
      foliage.instanceMatrix.needsUpdate = true;
      foliage.instanceColor.needsUpdate = true;
      blossoms.visible = blossomCenters.visible = season === "spring";
      branchSnow.visible = season === "winter";
      groundLeaves.visible = season === "spring" || season === "autumn";
      groundLeafRecords.forEach((a, i) => {
        const spring = season === "spring";
        dummy.position.set(a.x, 0.305, a.z);
        dummy.rotation.set(0, a.r, 0);
        dummy.scale.setScalar(a.s * (spring ? i % 7 === 0 ? 0.4 : 0 : 1.3));
        dummy.updateMatrix();
        groundLeaves.setMatrixAt(i, dummy.matrix);
        groundLeaves.setColorAt(i, new T.Color(spring ? ["#f5cede", "#e8adc6", "#fde3e9"][Math.floor(a.c * 3)] : pal[Math.floor(a.c * 4)]));
      });
      groundLeaves.instanceMatrix.needsUpdate = true;
      groundLeaves.instanceColor.needsUpdate = true;
    }, watermelon = function(x, z, angle) {
      const g = new T.Group();
      g.name = "watermelon-slice";
      g.position.set(x, 1.017259074, z);
      g.scale.setScalar(0.56);
      g.rotation.y = angle;
      summerProps.add(g);
      const shp = new T.Shape();
      shp.moveTo(-0.23, 0);
      shp.lineTo(0, 0.32);
      shp.lineTo(0.23, 0);
      shp.quadraticCurveTo(0, -0.11, -0.23, 0);
      let geo = new T.ExtrudeGeometry(shp, { depth: 0.13, bevelEnabled: true, bevelSegments: 2, bevelSize: 8e-3, bevelThickness: 8e-3, steps: 1 });
      mesh(geo, material("#ce6154"), [0, 0, 0], g);
      line([[-0.23, 0, 0.065], [0, -0.055, 0.065], [0.23, 0, 0.065]], material("#50704b"), 0.036, g);
      line([[-0.22, 0.018, 0.065], [0, -0.025, 0.065], [0.22, 0.018, 0.065]], material("#d9ce94"), 0.016, g);
      for (let i = 0; i < 5; i++) {
        let a = rr(-0.12, 0.12), b = rr(0.035, 0.2);
        ellipsoid(a, b, 0.144, 9e-3, 0.014, 4e-3, woodDark, g, 8);
      }
    }, lantern = function(x, y, z, scale = 1) {
      const g = new T.Group();
      g.position.set(x, y, z);
      g.scale.setScalar(scale);
      root.add(g);
      box(0.5, 0.08, 0.5, stone, [0, 0, 0], g, 0.03);
      box(0.18, 0.5, 0.18, stone, [0, 0.25, 0], g);
      box(0.44, 0.09, 0.44, stone, [0, 0.52, 0], g);
      const lm = material("#eadca3", { emissive: "#ffce84", emissiveIntensity: 0 });
      box(0.23, 0.3, 0.23, lm, [0, 0.71, 0], g);
      lanterns.push(lm);
      for (let dx of [-0.18, 0.18]) for (let dz of [-0.18, 0.18]) box(0.05, 0.35, 0.05, stone, [dx, 0.72, dz], g);
      let cap = mesh(new T.ConeGeometry(0.4, 0.18, 4), stone, [0, 0.96, 0], g);
      cap.rotation.y = Math.PI / 4;
      ellipsoid(0, 1.1, 0, 0.07, 0.1, 0.07, stone, g);
      let sn = mesh(new T.ConeGeometry(0.4, 0.16, 4), snowMat, [0, 1, 0], g);
      sn.rotation.y = Math.PI / 4;
      sn.visible = false;
      snowCaps.push(sn);
      return g;
    }, smallLantern = function(name, x, y, z, hanging = false) {
      const g = new T.Group();
      g.name = name;
      g.position.set(x, y, z);
      root.add(g);
      const shade = material("#e0cfad", { emissive: "#ffd193", emissiveIntensity: 0 });
      lanterns.push(shade);
      if (hanging) line([[0, 0.26, 0], [0, 0.62, 0]], woodDark, 8e-3, g);
      lathe([[0.075, 0], [0.115, 0.035], [0.13, 0.14], [0.115, 0.245], [0.075, 0.275]], shade, [0, 0, 0], g);
      for (let y2 = 0.02; y2 < 0.27; y2 += 0.045) mesh(new T.TorusGeometry(0.082 + Math.sin(y2 / 0.275 * Math.PI) * 0.044, 5e-3, 4, 20), woodDark, [0, y2, 0], g).rotation.x = Math.PI / 2;
      for (let y2 of [0, 0.28]) mesh(new T.CylinderGeometry(0.081, 0.081, 0.023, 16), woodDark, [0, y2, 0], g);
      if (!hanging) box(0.29, 0.035, 0.26, woodDark, [0, -0.018, 0], g, 0.02);
      const light = new T.PointLight("#ffd49a", 0, hanging ? 2.4 : 2.1, 2);
      light.position.y = 0.14;
      light.name = name + "-light";
      g.add(light);
      smallLamps.push(light);
      return g;
    }, ripple = function(x, z, strength = 1) {
      if (!inWater(x, z) || creekIce?.contains(x, z)) return;
      let m = new T.MeshBasicMaterial({ color: "#bcd6de", transparent: true, opacity: 0.3, depthWrite: false, side: T.DoubleSide });
      let o = mesh(new T.RingGeometry(0.967, 1, 40), m, [x, 0.081, z]);
      o.name = "water-impact-ripple";
      o.rotation.x = -Math.PI / 2;
      o.renderOrder = 4;
      o.castShadow = false;
      o.scale.setScalar(0.03);
      ripples.push({ o, age: 0, strength });
    }, glowTexture = function() {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      let ctx = c.getContext("2d"), gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "#ffffffff");
      gr.addColorStop(0.15, "#ffffffcc");
      gr.addColorStop(0.5, "#ffffff38");
      gr.addColorStop(1, "#ffffff00");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, 64, 64);
      return new T.CanvasTexture(c);
    }, particleTexture = function(kind) {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const ctx = c.getContext("2d"), g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, "#ffffffff");
      g.addColorStop(kind === "snow" ? 0.48 : 0.23, "#ffffffff");
      g.addColorStop(kind === "snow" ? 0.72 : 0.48, kind === "snow" ? "#ffffffb8" : "#ffffff68");
      g.addColorStop(1, "#ffffff00");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      const tx = new T.CanvasTexture(c);
      resources.add(tx);
      return tx;
    }, applyRenderStyle = function(style) {
      const pixelated = style === "pixel";
      pixelRenderer.setStyle(style);
      pointPixelSizes.forEach((size, m) => {
        m.size = pixelated ? m.sizeAttenuation === false ? Math.max(1, size * renderDpr / PIXEL_SIZE_CSS) / renderDpr : size / PIXEL_SIZE_CSS : size * renderDpr;
      });
      resources.forEach((r) => {
        if (r.isTexture && r.userData.gardenPixelTexture) {
          r.minFilter = r.magFilter = pixelated ? T.NearestFilter : T.LinearFilter;
          r.needsUpdate = true;
        }
      });
      renderer.domElement.style.imageRendering = pixelated ? "pixelated" : "auto";
    }, applySeason = function() {
      const s = state.season, winter = s === "winter";
      colorLeaves(s);
      roofLeaves.setSeason(s);
      ancient.setSeason(s);
      seasonalLife.setSeason(s);
      gardenLife.setSeason(s);
      fauna.setSeason(s);
      sleeper.setSeason(s);
      rockMoss.forEach((o) => o.visible = !winter);
      snowCaps.forEach((o) => o.visible = winter);
      dayNightLife.setState(s, state.night);
      petalMat.color.set(s === "autumn" ? "#c9833e" : "#efbdc3");
      gustMat.color.set(s === "autumn" ? "#c58e47" : s === "spring" ? "#e9afc6" : "#98b663");
      groundMat.color.set(winter ? "#e8eee6" : s === "autumn" ? "#d2b987" : s === "spring" ? "#fff4f0" : "#d5e7ac");
      groundMat.map = winter ? null : s === "spring" ? springGroundTex : groundTex;
      groundMat.needsUpdate = true;
      grassMat.color.set(winter ? "#a6bdba" : s === "autumn" ? "#aeae64" : "#73a964");
      shoreFlowers.visible = s === "spring" || s === "summer";
      grass.visible = !winter;
      paintCurvedGrass(grassGeo, s);
      currentSeason = s;
      renderer.shadowMap.needsUpdate = true;
    }, resize = function(w, h) {
      if (disposed || w <= 0 || h <= 0) return;
      renderer.setSize(w, h);
      pixelRenderer.resize(w, h);
      rainEffect.resize(w, h);
      framing.resize(w, h);
      camera.clearViewOffset();
    }, render = function(deltaSeconds = 0) {
      if (disposed) return;
      const dt = Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(deltaSeconds, 0.045)) : 0;
      const d = state.paused ? 0 : dt;
      time += d;
      controls.update();
      clockSnapshot = gardenClock.getSnapshot();
      if (state.season !== currentSeason) applySeason();
      root.userData.gardenTime = clockSnapshot;
      const wind = gardenWind(time), storm = springStorm(time, state.season, state.night, state.weather);
      root.userData.atmosphere = { time, gust: wind.gust, storm: storm.flash, weather: state.weather };
      nightMix = clockSnapshot.nightMix;
      creekIce.update(state.season, nightMix);
      pixelRenderer.updateNight(nightMix);
      waterUniform.time.value = time;
      waterUniform.night.value = nightMix;
      waterUniform.rain.value = state.season === "winter" ? 0 : precipitationMix;
      waterCurrent.update(time, nightMix, waterUniform.rain.value);
      lightDirection.fromArray(clockSnapshot.sunDirection);
      sun.position.copy(lightDirection).multiplyScalar(18);
      moonDirection.fromArray(clockSnapshot.moonDirection).multiplyScalar(18);
      moon.position.copy(moonDirection);
      waterUniform.moonPosition.value.copy(moonDirection);
      if (Math.abs(nightMix - clockSnapshot.nightMix) > 1e-3) renderer.shadowMap.needsUpdate = true;
      waterUniform.cloud.value = cloudMix;
      camera.getWorldDirection(waterUniform.eyeDirection.value).negate();
      if (d && Math.floor(time * 15) !== Math.floor((time - d) * 15)) renderer.shadowMap.needsUpdate = true;
      const closedSummer = state.season === "summer" && state.night;
      summerClosedMix = closedSummer ? 1 : 0;
      const cloudy = state.weather !== "clear";
      const palette = themeColors[state.season];
      cloudMix = cloudy ? 1 : 0;
      targetBg.copy(state.night ? palette.night : palette.day);
      host.style.setProperty("--xi4u-background", targetBg.getStyle());
      shadowMat.opacity = T.MathUtils.lerp(0.14, 0, T.MathUtils.smoothstep(nightMix, 0.18, 0.9));
      hemi.intensity = T.MathUtils.lerp(T.MathUtils.lerp(2.25, 1.6, cloudMix), 0.5, nightMix);
      hemi.color.copy(dayHemi).lerp(nightHemi, nightMix);
      const elevation = Math.max(0, lightDirection.y), moonElevation = Math.max(0, clockSnapshot.moonDirection[1]);
      sun.intensity = T.MathUtils.lerp(4.1, 1.65, cloudMix) * Math.pow(elevation, 0.42) * T.MathUtils.smoothstep(elevation, 0, 0.16);
      sun.color.copy(lowLight).lerp(noonLight, T.MathUtils.smoothstep(elevation, 0, 0.65));
      moon.intensity = 0.4 * Math.pow(moonElevation, 0.42) * T.MathUtils.smoothstep(moonElevation, 0, 0.18) * (1 - cloudMix * 0.45);
      moon.color.copy(moonLight);
      fill.intensity = 0.5 + nightMix * 0.25;
      warm.intensity = nightMix * 5.5 * (1 - summerClosedMix);
      glow.intensity = nightMix * 0.72;
      smallLamps.forEach((l, i) => l.intensity = nightMix * (i ? 0.48 : 0.65));
      hemi.intensity += storm.flash;
      sun.intensity += storm.flash * 0.7;
      lanterns.forEach((m) => m.emissiveIntensity = nightMix * 0.9);
      lampMat.emissiveIntensity = nightMix * 0.9 * (1 - summerClosedMix);
      hemi.intensity *= 1 - summerClosedMix * 0.16;
      fill.intensity *= 1 - summerClosedMix * 0.32;
      moon.intensity *= 1 - summerClosedMix * 0.2;
      renderer.toneMappingExposure = T.MathUtils.lerp(1.12, 0.92, nightMix);
      stars.material.opacity = nightMix * T.MathUtils.lerp(0.7, 0.2, cloudMix);
      celestial.update({ ...clockSnapshot, nightMix, cloudy: cloudMix }, { width: host.clientWidth, height: host.clientHeight });
      seasonalLife.update(time, nightMix);
      if (dayNightLife.setState(state.season, state.night)) renderer.shadowMap.needsUpdate = true;
      emberMat.emissiveIntensity = 0.72 + Math.sin(time * 3.7) * 0.16 + Math.sin(time * 7.1) * 0.08;
      kettleLid.position.y = 0.54 + Math.max(0, Math.sin(time * 5)) * 3e-3;
      emberLight.intensity = 1.3 + Math.sin(time * 3.7) * 0.2;
      chime.rotation.z = Math.sin(time * 1.4) * (0.012 + wind.gust * 0.075);
      chime.rotation.x = Math.sin(time * 1.7) * (8e-3 + wind.gust * 0.045);
      chimePaper.rotation.x = Math.sin(time * 2.1) * (0.04 + wind.gust * 0.25);
      foliage.rotation.z = state.season === "winter" ? 0 : wind.z;
      foliage.rotation.x = state.season === "winter" ? 0 : wind.x;
      blossoms.rotation.copy(foliage.rotation);
      blossomCenters.rotation.copy(foliage.rotation);
      if (grass.visible) bendCurvedGrass(grassGeo, time, wind.gust);
      gardenLife.update(time);
      fauna.update(time, state.night);
      sleeper.update(time);
      butterflies.update(time, state.season, state.night);
      fish.forEach((f, i) => {
        let s = state.season === "winter" ? 0.3 : 1;
        let p = time * f.speed * s + f.phase, z = Math.sin(p) * 3.8, x = cx(z) + Math.cos(p * 0.87 + i) * width(z) * 0.46;
        f.g.position.set(x, -0.015 + Math.sin(p * 3) * 0.012, z);
        let zn = Math.sin(p + 0.01) * 3.8, xn = cx(zn) + Math.cos((p + 0.01) * 0.87 + i) * width(zn) * 0.46;
        f.g.rotation.y = Math.atan2(xn - x, zn - z);
        f.tail.rotation.y = Math.sin(time * 4 * s + i) * 0.4;
      });
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.age += d;
        let scale = 0.04 + r.age * 0.38 * r.strength;
        r.o.scale.setScalar(scale);
        r.o.material.opacity = Math.max(0, 0.36 - r.age * 0.22);
        if (r.age > 1.65) {
          root.remove(r.o);
          resources.delete(r.o.geometry);
          r.o.geometry.dispose();
          r.o.material.dispose();
          ripples.splice(i, 1);
        }
      }
      canopyFall.update(time, state.season);
      snowAccumulation.update(time, state.season, state.weather);
      precipitationMix = T.MathUtils.damp(precipitationMix, cloudy ? 1 : 0, 0.85, dt);
      snow.visible = state.season === "winter" && precipitationMix > 0.01;
      snow.material.opacity = T.MathUtils.lerp(0.94, 0.84, nightMix) * precipitationMix;
      snow.material.color.set("#f5f8f7").lerp(new T.Color("#d3e1ed"), nightMix);
      rain.visible = state.season !== "winter" && precipitationMix > 0.01;
      if (rain.visible) {
        rainEffect.update(nightMix, pixelRenderer.getScenePixelSize(), storm.flash, precipitationMix);
        if (d > 0) {
          for (let i = 0; i < 450; i++) {
            const n = i * 6, length = 0.26 + i % 5 * 0.03;
            rainPos[n + 1] -= d * 7;
            const roofTop = snowAccumulation.getRoofTop(rainPos[n], rainPos[n + 2]), inStream = inWater(rainPos[n], rainPos[n + 2]);
            if (rainPos[n + 1] < (roofTop ?? (inStream ? 0.09 : 0.315))) {
              if (precipitationMix > 0.15 && roofTop == null && inStream && i % 15 === 0) ripple(rainPos[n], rainPos[n + 2], 0.28);
              rainPos[n + 1] = 13.5;
            }
            rainPos[n + 3] = rainPos[n] - 0.02 - wind.gust * 0.025;
            rainPos[n + 4] = rainPos[n + 1] + length;
          }
          rainEffect.commitPositions();
        }
      }
      if (snow.visible) {
        for (let i = 0; i < 450; i++) {
          let n = i * 3;
          snowPos[n + 1] -= d * 0.46;
          snowPos[n] += (Math.sin(time * 0.6 + i) * 0.1 + wind.gust * 0.18) * d;
          snowPos[n + 2] += Math.cos(time * 0.45 + i) * d * 0.045;
          if (snowPos[n] > 5.4) snowPos[n] = -5.3;
          const roofTop = snowAccumulation.getRoofTop(snowPos[n], snowPos[n + 2]);
          if (snowPos[n + 1] < (roofTop ?? (inWater(snowPos[n], snowPos[n + 2]) ? 0.09 : 0.315))) snowPos[n + 1] = 13.5;
        }
        snowGeo.attributes.position.needsUpdate = true;
      }
      verandaTeapot.getWorldPosition(steamOrigin);
      for (let i = 0; i < 28; i++) {
        const zone = i % 3, phase = time * 0.19 + i * 2.4;
        let z = (zone === 0 ? 1.25 : zone === 1 ? 1.3 : 0.85) + Math.sin(phase * 0.83) * 0.8, x = (zone === 0 ? -3.15 : zone === 1 ? 0.65 : 3.85) + Math.cos(phase) * 0.44;
        fireflyPos.set([x, 0.46 + Math.sin(time * 0.4 + i) * 0.15 + i % 4 * 0.17, z], i * 3);
        const pulse = 0.26 + 0.74 * Math.pow(Math.max(0, Math.sin(time * (0.7 + i % 5 * 0.035) + i * 1.72)), 2);
        fireflyColors.set([pulse, pulse, pulse * 0.8], i * 3);
        let f = (time * 0.27 + i / 28) % 1;
        steamPos.set([(state.season === "winter" ? brazier.position.x : steamOrigin.x) + Math.sin(f * 9 + i) * 0.06, (state.season === "winter" ? brazier.position.y + 0.57 : steamOrigin.y + 0.23) + f * 0.7, (state.season === "winter" ? brazier.position.z : steamOrigin.z) + Math.cos(f * 8 + i) * 0.06], i * 3);
      }
      fireflyGeo.attributes.position.needsUpdate = true;
      fireflyGeo.attributes.color.needsUpdate = true;
      fireflies.visible = state.season === "summer" && state.night;
      fireflies.material.opacity = nightMix * (0.78 + Math.sin(time * 0.7) * 0.08);
      steamGeo.attributes.position.needsUpdate = true;
      steam.visible = state.season === "winter" || !state.night && (state.season === "spring" || state.season === "autumn");
      if (renderer.shadowMap.needsUpdate) sun.shadow.needsUpdate = sun.intensity > 1e-3;
      pixelRenderer.render();
    };
    const gardenClock = createGardenClock();
    const state = { season: options.season, night: options.scheme === "dark", weather: "clear", paused: false, sound: false, pixelated: false, renderStyle: "clear" };
    gardenClock.setSeason(state.season);
    gardenClock.setHour(state.night ? 22 : 12);
    gardenClock.setRunning(false);
    let clockSnapshot = gardenClock.getSnapshot();
    let seed = 29417;
    const rand = () => {
      seed = seed * 1664525 + 1013904223 >>> 0;
      return seed / 4294967296;
    };
    const rr = (a, b) => a + (b - a) * rand(), v = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
    const scene = new T.Scene();
    scene.background = null;
    own(() => disposeGardenResources(scene, resources));
    const previousBackground = host.style.getPropertyValue("--xi4u-background"), previousPriority = host.style.getPropertyPriority("--xi4u-background");
    own(() => previousBackground ? host.style.setProperty("--xi4u-background", previousBackground, previousPriority) : host.style.removeProperty("--xi4u-background"));
    const renderer = options.createRenderer?.() ?? new T.WebGLRenderer({ antialias: false, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: "default" });
    own(() => {
      try {
        renderer.renderLists?.dispose();
        renderer.dispose();
      } finally {
        try {
          renderer.forceContextLoss();
        } finally {
          renderer.domElement.remove();
        }
      }
    });
    const renderDpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setClearColor(0, 0);
    renderer.setPixelRatio(renderDpr);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.shadowMap.type = T.PCFShadowMap;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    host.appendChild(renderer.domElement);
    const camera = new T.OrthographicCamera(-8, 8, 8, -8, 0.1, 100);
    camera.position.set(11, 13, 17);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(-0.25, 1.55, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minPolarAngle = 0.28;
    controls.maxPolarAngle = 1.38;
    controls.minZoom = 0.65;
    controls.maxZoom = 6;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.maxTargetRadius = Infinity;
    controls.mouseButtons = { LEFT: T.MOUSE.ROTATE, MIDDLE: T.MOUSE.DOLLY, RIGHT: T.MOUSE.PAN };
    controls.touches = { ONE: T.TOUCH.ROTATE, TWO: T.TOUCH.DOLLY_PAN };
    controls.update();
    const controlsRoot = renderer.domElement.getRootNode();
    own(() => {
      controlsRoot.removeEventListener("keyup", controls._interceptControlUp, true);
      controls.dispose();
    });
    const changed = () => options.onInvalidate?.();
    controls.addEventListener("change", changed);
    own(() => controls.removeEventListener("change", changed));
    const pixelRenderer = (options.createPixelRenderer ?? createPixelRenderer)(renderer, scene, camera);
    own(() => pixelRenderer.dispose());
    const root = new T.Group();
    scene.add(root);
    const animations = [];
    const snowCaps = [];
    const rockMoss = [];
    const lanterns = [];
    const seasonal = [];
    const material = (color, extra = {}) => {
      const m = new T.MeshStandardMaterial({ color, roughness: 0.83, ...extra });
      resources.add(m);
      return m;
    };
    const ink = material("#303b32"), woodDark = material("#50473e"), woodEdge = material("#bd7850"), paper = material("#f0e6c8", { roughness: 0.96, side: T.DoubleSide }), stone = material("#858e85", { flatShading: true }), moss = material("#6b8050"), snowMat = material("#eef4ef"), brass = material("#a29557", { metalness: 0.55, roughness: 0.35 });
    const woodTex = texture("wood"), wood = material("#fff5df", { map: woodTex }), tatami = material("#f6f1c7", { map: texture("tatami") }), groundTex = texture("ground"), groundMat = material("#d5e7ac", { map: groundTex });
    let springTextureSeed = 7119;
    const springGroundTex = texture("spring-ground", () => {
      springTextureSeed = springTextureSeed * 1664525 + 1013904223 >>> 0;
      return springTextureSeed / 4294967296;
    });
    const shadowMat = new T.ShadowMaterial({ color: 0, opacity: 0.14, depthWrite: false });
    resources.add(shadowMat);
    const shadowGround = mesh(new T.PlaneGeometry(200, 200), shadowMat, [0, -0.145, 0], scene);
    shadowGround.rotation.x = -Math.PI / 2;
    shadowGround.castShadow = false;
    shadowGround.userData.inkOutline = false;
    const hemi = new T.HemisphereLight("#fff4c7", "#3c9690", 2.4);
    scene.add(hemi);
    const sun = new T.DirectionalLight("#fff0c7", 4.2);
    sun.name = "moving-sky-light";
    sun.position.fromArray(clockSnapshot.sunDirection).multiplyScalar(18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 0.1, far: 50 });
    sun.shadow.bias = -25e-5;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 3;
    scene.add(sun);
    const moon = new T.DirectionalLight("#a6c9f6", 0);
    moon.name = "moving-moon-light";
    moon.castShadow = false;
    scene.add(moon);
    sun.shadow.autoUpdate = false;
    own(() => sun.shadow.dispose());
    const celestial = createCelestialBodies(scene, camera);
    const lightDirection = new T.Vector3(), moonDirection = new T.Vector3();
    const noonLight = new T.Color("#fff0c7"), lowLight = new T.Color("#efad73"), moonLight = new T.Color("#a6c9f6"), dayHemi = new T.Color("#fff0c6"), nightHemi = new T.Color("#8caeca"), twilightColor = new T.Color("#eda78c"), dawnColor = new T.Color("#edc6b2"), overcastColor = new T.Color("#bbc8c6");
    const fill = new T.DirectionalLight("#6dc8ce", 0.6);
    fill.position.set(7, 6, -4);
    scene.add(fill);
    const warm = new T.PointLight("#ffc17a", 0, 8, 2);
    warm.name = "interior-warm-light";
    warm.position.set(-1.3, 2.2, -2.4);
    scene.add(warm);
    const glow = new T.PointLight("#ffc267", 0, 5, 2);
    glow.position.set(2.6, 0.9, 1.7);
    scene.add(glow);
    const bedMat = material("#a1b29b", { map: texture("ground") });
    const cx = (z) => 0.75 + 1.75 * Math.exp(-Math.pow((z + 4) / 1.7, 2)) - 0.25 * Math.sin(z * 0.85);
    const width = (z) => 1.95 + 0.36 * Math.sin(z * 0.5 + 0.8) - 0.79 * Math.exp(-Math.pow((z - 3.22) / 1.4, 2));
    const reserved = (x, z) => Math.abs(z - 3.22) < 0.85 && Math.abs(x - cx(z)) < width(z) + 0.75 || x < cx(z) - width(z) && z > 0.78 || x > 3.53 && z > -0.1 && z < 2.9 || x > 3.9 && z > -1.6 && z < 0.5;
    const inWater = (x, z) => withinCreek(x, z, cx, width, 0.05);
    const terrain = createOrganicTerrain({ root, mesh, material, groundMat, bedMat, cx, width });
    const pebbleGeo = new T.IcosahedronGeometry(1, 0), pebbleMat = material("#a0a68a", { flatShading: true }), pebbles = new T.InstancedMesh(pebbleGeo, pebbleMat, 650), dummy = new T.Object3D();
    let pi = 0;
    while (pi < 650) {
      let z = rr(-4.9, 4.9), x = cx(z) + rr(-width(z), width(z));
      if (!(Math.abs(x - cx(z)) < width(z) - 0.05 && Math.abs(x) < 4.95 && Math.abs(z) < 4.95)) continue;
      dummy.position.set(x, -0.1 + rr(-0.035, 0.03), z);
      dummy.scale.set(rr(0.025, 0.09), rr(0.012, 0.035), rr(0.025, 0.08));
      dummy.rotation.set(rr(0, 3), rr(0, 6), rr(0, 3));
      dummy.updateMatrix();
      pebbles.setMatrixAt(pi, dummy.matrix);
      pebbles.setColorAt(pi, new T.Color().setHSL(rr(0.1, 0.18), rr(0.05, 0.2), rr(0.25, 0.62)));
      pi++;
    }
    for (let i = 0; i < 650; i++) {
      pebbles.getMatrixAt(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
      if (!inWater(dummy.position.x, dummy.position.z)) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        pebbles.setMatrixAt(i, dummy.matrix);
      }
    }
    pebbles.receiveShadow = true;
    pebbles.userData.inkOutline = false;
    root.add(pebbles);
    const { material: waterMat, uniforms: waterUniform } = createCreekMaterial();
    const water = mesh(terrain.waterGeometry, waterMat, [0, 0.055, 0]);
    water.rotation.x = -Math.PI / 2;
    water.castShadow = false;
    water.renderOrder = 2;
    const waterCurrent = createWaterCurrent({ root, mesh, cx, width, streamExtent });
    let creekIce = null;
    for (let side of [-1, 1]) for (let z = -4.7; z < 4.9; z += rr(0.4, 0.8)) {
      let x = cx(z) + side * (width(z) + rr(-0.07, 0.2));
      if (x < 4.8 && x > -4.8 && Math.abs(z - 3.22) > 0.65) rock(x, z, rr(0.24, 0.55));
    }
    [[3.3, -3.6, 0.7], [3.7, -2.6, 0.65], [3.1, -1.6, 0.63], [2.8, -0.65, 0.55], [-3.95, 1.85, 0.42], [4.5, 3.65, 0.36], [-3.8, 1, 0.6]].forEach((a) => rock(...a));
    const house = new T.Group();
    root.add(house);
    for (let x = -3.75; x < 2.25; x += 1.15) for (let z of [-3.5, -0.55]) {
      rock(x, z, 0.24, 0.08);
      box(0.14, 0.74, 0.14, woodDark, [x, 0.43, z], house);
    }
    box(6.4, 0.19, 3.45, woodDark, [-0.8, 0.76, -2], house);
    for (let i = 0; i < 33; i++) {
      let x = -3.96 + i * 0.197;
      const m = wood.clone();
      m.color.setHSL(0.095, 0.47, rr(0.82, 0.95));
      box(0.187, 0.09, 3.47, m, [x, 0.9, -2], house);
    }
    box(6.48, 0.17, 0.16, woodEdge, [-0.8, 0.8, -0.24], house);
    box(0.16, 0.17, 3.56, woodEdge, [-4, 0.8, -2], house);
    for (let x = -3.5; x < 1.8; x += 1.35) {
      box(1.3, 0.055, 1.9, tatami, [x, 0.99, -2.57], house);
      for (let d of [-0.65, 0.65]) box(0.025, 0.065, 1.9, material("#5a684e"), [x + d, 1, -2.57], house);
    }
    for (let x of [-3.93, -1.1, 2.3]) for (let z of [-3.65, -0.52]) {
      box(0.16, 2.75, 0.16, woodEdge, [x, 2.12, z], house);
      box(0.23, 0.11, 0.23, woodDark, [x, 1.05, z], house);
    }
    for (let z of [-3.65, -0.52]) box(6.58, 0.23, 0.2, woodDark, [-0.82, 3.44, z], house);
    for (let x of [-3.93, 2.3]) box(0.21, 0.22, 3.35, woodDark, [x, 3.35, -2.1], house);
    shoji(-2.55, -3.67, 2.6, 2.23);
    shoji(0.1, -3.67, 2.55, 2.23);
    shoji(-3.96, -2.8, 1.55, 2.22, true);
    shoji(2.31, -2.9, 1.4, 2.22, true);
    const openInteriorScreen = shoji(1.55, -1.55, 0.87, 2.23);
    openInteriorScreen.name = "day-open-interior-screen";
    const roof = new T.Group();
    house.add(roof);
    const roofMat = material("#336f7e"), roofLight = material("#6b9d9e");
    let slab = box(7.15, 0.15, 3.35, woodDark, [-0.82, 3.91, -2.27], roof);
    slab.rotation.x = 0.235;
    for (let x = -4.28; x < 2.75; x += 0.255) {
      let rafter = box(0.057, 0.1, 3.51, woodEdge, [x, 3.78, -2.25], roof);
      rafter.rotation.x = 0.235;
    }
    for (let col = 0; col < 26; col++) for (let row = 0; row < 8; row++) {
      let x = -4.2 + col * 0.27, z = -3.7 + row * 0.43, y = 4.38 - (z + 3.7) * 0.24;
      let tile = new T.Group();
      tile.position.set(x, y, z);
      tile.rotation.x = 0.235;
      roof.add(tile);
      let m = roofMat.clone();
      m.color.offsetHSL(0, 0, rr(-0.045, 0.035));
      let t = mesh(new T.CylinderGeometry(0.148, 0.148, 0.45, 10, 1, true, 0, Math.PI), m, [0, 0, 0], tile);
      t.rotation.x = Math.PI / 2;
      if (row === 7) {
        let disc = mesh(new T.CylinderGeometry(0.15, 0.15, 0.036, 12), roofLight, [0, 0, 0.232], tile);
        disc.rotation.x = Math.PI / 2;
        let circle = mesh(new T.TorusGeometry(0.093, 0.012, 4, 12), roofMat, [0, 0, 0.253], tile);
      }
    }
    for (let x = -4.15; x < 2.75; x += 0.38) {
      let t = mesh(new T.CylinderGeometry(0.21, 0.21, 0.38, 12, 1, true, 0, Math.PI), roofLight, [x, 4.56, -3.9], roof);
      t.rotation.z = Math.PI / 2;
      t.rotation.x = Math.PI / 2;
    }
    let snowRoof = box(7.1, 0.1, 3.34, snowMat, [-0.82, 4.1, -2.27], roof, 0.06);
    snowRoof.rotation.x = 0.235;
    snowRoof.visible = false;
    snowCaps.push(snowRoof);
    const roofLeaves = createRoofLeaves({ root, roof, material });
    for (let i = 0; i < 18; i++) {
      let b = mesh(new T.CylinderGeometry(0.013, 0.013, 1.4, 5), material(i % 2 ? "#a69b65" : "#baaa72"), [-3.2, 3.35 - i * 0.029, -0.52], house);
      b.rotation.z = Math.PI / 2;
    }
    for (let x of [-3.72, -2.68]) line([[x, 3.42, -0.55], [x, 2.83, -0.55]], woodDark, 9e-3, house);
    const table = box(1.16, 0.08, 0.72, wood, [-2.02, 1.34, -2.33], house, 0.035);
    for (let dx of [-0.47, 0.47]) for (let dz of [-0.25, 0.25]) box(0.06, 0.32, 0.06, woodDark, [-2.02 + dx, 1.16, -2.33 + dz], house);
    const cushionMat = material("#9b8672");
    box(0.65, 0.09, 0.55, cushionMat, [-2.12, 0.99, -1.305], house, 0.04).name = "veranda-floor-cushion";
    const ceramic = material("#c2c6a0", { roughness: 0.3 }), tea = material("#55542d", { roughness: 0.17 });
    const seasonalLife = createSeasonalLife({ root, material, mesh, box, ellipsoid, line, beam, lathe, cup, teapot, wood, woodDark, paper, brass, rr });
    seasonalLife.setSeason("summer");
    const chime = new T.Group();
    chime.name = "eave-wind-chime";
    chime.position.set(1.65, 3.47, -0.57);
    house.add(chime);
    line([[0, 0, 0], [0, -0.28, 0]], woodDark, 5e-3, chime);
    const glass = new T.MeshPhysicalMaterial({ color: "#c1e2d4", roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.37, side: T.DoubleSide, depthWrite: false });
    lathe([[0.075, -0.15], [0.12, -0.11], [0.125, -0.03], [0.09, 0.025], [0, 0.045]], glass, [0, -0.35, 0], chime);
    mesh(new T.TorusGeometry(0.075, 6e-3, 6, 24), brass, [0, -0.5, 0], chime).rotation.x = Math.PI / 2;
    line([[0, -0.37, 0], [0, -0.61, 0]], woodDark, 4e-3, chime);
    ellipsoid(0, -0.47, 0, 0.025, 0.037, 0.025, brass, chime);
    const chimePaper = new T.Group();
    chimePaper.position.y = -0.58;
    chime.add(chimePaper);
    box(0.075, 0.3, 4e-3, paper, [0, -0.15, 0], chimePaper);
    for (let i = 0; i < 3; i++) box(0.014, 0.024, 6e-3, material("#567c74"), [0, -0.11 - i * 0.038, 5e-3], chimePaper);
    for (let i = 0; i < 5; i++) {
      let a = i * 1.256;
      ellipsoid(Math.cos(a) * 0.09, -0.39, Math.sin(a) * 0.09, 0.024, 0.016, 9e-3, material("#6b9c88"), chime, 8);
    }
    const leafGeometry = (() => {
      const border = [[-0.12, 0], [-0.12, 0.12], [-0.32, 0.12], [-0.32, 0.3], [-0.47, 0.3], [-0.47, 0.54], [-0.32, 0.54], [-0.32, 0.72], [-0.15, 0.72], [-0.15, 0.9], [0.08, 0.9], [0.08, 1.02], [0.22, 1.02], [0.22, 0.76], [0.38, 0.76], [0.38, 0.55], [0.49, 0.55], [0.49, 0.32], [0.29, 0.32], [0.29, 0.15], [0.12, 0.15], [0.12, 0]];
      let points = [], indices = [];
      points.push(0, 0.085, 0.45);
      border.forEach(([x, z]) => points.push(x, 0, z));
      for (let i = 1; i <= border.length; i++) indices.push(0, i, i === border.length ? 1 : i + 1);
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(points, 3));
      g.setIndex(indices);
      g.computeVertexNormals();
      return g;
    })();
    const leafM = material("#ffffff", { side: T.DoubleSide, roughness: 1, flatShading: true });
    const leafRecords = [], treeRoots = [], branchSnow = new T.Group();
    branchSnow.name = "snow-on-branches";
    root.add(branchSnow);
    branchSnow.visible = false;
    const ancient = createAncientTree({ root, material, mesh, ellipsoid, line, addLeaves, snowOnBranch, rr, v });
    treeRoots.push(ancient.group);
    tree(3.6, -2.6, 3.65, 0.68);
    for (let i = 0; i < 52; i++) {
      let x = rr(-4.75, 4.75), z = rr(-4.75, 4.75);
      if (!withinGarden(x, z, 0.35) || inWater(x, z) || reserved(x, z) || x < 2.55 && z < -0.25) continue;
      addLeaves(v(x, rr(0.35, 0.6), z), 20, 0.37, 0.9, -1);
    }
    const foliage = new T.InstancedMesh(leafGeometry, leafM, leafRecords.length);
    foliage.name = "canopy-leaves";
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    root.add(foliage);
    const flowerShape = new T.Shape();
    for (let i = 0; i < 30; i++) {
      const a = i / 30 * Math.PI * 2, r = 0.62 + 0.2 * Math.cos(a * 5);
      if (i === 0) flowerShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else flowerShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    flowerShape.closePath();
    const blossomGeo = new T.ShapeGeometry(flowerShape);
    blossomGeo.rotateX(-Math.PI / 2);
    const blossomMat = material("#ffffff", { side: T.DoubleSide, roughness: 1 });
    const bloomRecords = leafRecords.filter((a) => a.treeId === 1 ? a.keep > 0.2 : a.treeId === 0 && a.keep >= 0.76);
    const blossoms = new T.InstancedMesh(blossomGeo, blossomMat, bloomRecords.length);
    blossoms.name = "cherry-blossoms";
    root.add(blossoms);
    blossoms.castShadow = true;
    blossoms.receiveShadow = true;
    const blossomCenters = new T.InstancedMesh(new T.BoxGeometry(0.075, 0.012, 0.075), material("#ebbdba"), bloomRecords.length);
    root.add(blossomCenters);
    bloomRecords.forEach((a, i) => {
      dummy.position.set(...a.p);
      dummy.rotation.set(a.r[0] * 0.7, a.r[1], a.r[2] * 0.7);
      dummy.scale.setScalar(a.s * 0.72);
      dummy.updateMatrix();
      blossoms.setMatrixAt(i, dummy.matrix);
      blossoms.setColorAt(i, new T.Color(["#fce4eb", "#f5bfce", "#e99dbb", "#f8d1df"][Math.floor(a.c * 4)]));
      dummy.position.y += 9e-3;
      dummy.updateMatrix();
      blossomCenters.setMatrixAt(i, dummy.matrix);
    });
    const groundLeaves = new T.InstancedMesh(leafGeometry, material("#ffffff", { side: T.DoubleSide }), 420);
    root.add(groundLeaves);
    const groundLeafRecords = [];
    for (let i = 0; i < 420; i++) {
      let x, z;
      do {
        x = rr(-4.78, 4.78);
        z = rr(-4.78, 4.78);
      } while (!withinGarden(x, z, 0.13) || inWater(x, z) || x < 2.6 && z < -0.3);
      groundLeafRecords.push({ x, z, r: rr(0, 6.28), s: rr(0.05, 0.14), c: rand() });
    }
    colorLeaves("summer");
    const grassMat = material("#66835b", { side: T.DoubleSide });
    const grassHeights = Array.from({ length: 8 }, () => 0.25 + rand() * 0.2);
    const grassGeo = createCurvedGrassGeometry(grassHeights, { rootRadius: 0.16, reach: 0.088, bladeWidth: 0.044, angleStep: 2.4 });
    const grassBladeMat = material("#ffffff", { side: T.DoubleSide, vertexColors: true });
    const grass = new T.InstancedMesh(grassGeo, grassBladeMat, 160);
    grass.name = "riverbank-curved-grass";
    let gi = 0;
    while (gi < 160) {
      let z = rr(-4.8, 4.8), side = rand() > 0.5 ? 1 : -1, x = cx(z) + side * (width(z) + rr(0.17, 0.55));
      if (!withinGarden(x, z, 0.2) || reserved(x, z)) continue;
      dummy.position.set(x, 0.24, z);
      dummy.rotation.set(0, rr(0, 6.28), 0);
      dummy.scale.setScalar(rr(0.5, 1.15));
      dummy.updateMatrix();
      grass.setMatrixAt(gi++, dummy.matrix);
    }
    grass.castShadow = true;
    root.add(grass);
    const shoreFlowers = new T.Group();
    root.add(shoreFlowers);
    for (let [x, z] of [[-4, 2.1], [3.25, -1.4], [4, -3.8]]) for (let i = 0; i < 7; i++) {
      let px = x + rr(-0.4, 0.4), pz = z + rr(-0.3, 0.3), h = rr(0.35, 0.65);
      if (!withinGarden(px, pz, 0.17)) continue;
      beam([px, 0.24, pz], [px + 0.06, 0.24 + h, pz], 0.012, 7e-3, grassMat, shoreFlowers);
      for (let k = 0; k < 5; k++) {
        let a = k * 1.256;
        ellipsoid(px + 0.06 + Math.cos(a) * 0.06, 0.24 + h, pz + Math.sin(a) * 0.06, 0.06, 0.027, 0.04, paper, shoreFlowers, 8);
      }
      ellipsoid(px + 0.06, 0.26 + h, pz, 0.025, 0.025, 0.025, brass, shoreFlowers);
    }
    const verandaPlants = [[-3.5, -0.65]].map(([x, z]) => createVerandaPlant({ root: house, material, mesh, lathe, line }, x, z, x > 0 ? "right-veranda-planter" : "left-veranda-planter"));
    const gardenLife = createGardenLife({ root, material, mesh, box, ellipsoid, line, beam, lathe, wood, woodDark, woodEdge, stone, moss, snowMat, leafGeometry, rr, cx, width, withinGarden });
    const fauna = createSeasonalFauna({ root, material, mesh, box, ellipsoid, line, beam, rr, cx, width, ripple, birdPerch: ancient.birdPerch, birdPerchYaw: ancient.birdPerchYaw, birdGripSurfaces: ancient.birdGripSurfaces, treeTrunk: ancient.trunk });
    const sleeper = createSummerSleeper({ root, material, mesh, box, ellipsoid, line, beam, rr });
    const summerProps = new T.Group();
    summerProps.name = "summer-refreshments";
    root.add(summerProps);
    let tray = mesh(new T.CylinderGeometry(0.28, 0.25, 0.024, 36), woodDark, [0.95, 0.957, -1.24], summerProps);
    watermelon(0.85, -1.18, -0.1);
    watermelon(1.04, -1.31, 0.4);
    const coldCup = cup(1.38, 0.945, -1.23, summerProps);
    coldCup.name = "summer-cold-tea";
    let fan = new T.Group();
    fan.name = "summer-hand-fan";
    fan.position.set(-0.55, 0.955, -0.39);
    fan.scale.setScalar(0.6);
    fan.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    summerProps.add(fan);
    ellipsoid(0, 0, 0, 0.18, 0.22, 0.015, paper, fan);
    beam([0, -0.3, 0], [0, -0.05, 0], 0.015, 0.015, woodEdge, fan);
    const seasonalTea = new T.Group();
    seasonalTea.name = "veranda-tea-tray";
    root.add(seasonalTea);
    const verandaTeaBase = box(1.02, 0.035, 0.57, woodDark, [-2.15, 0.9625, -0.73], seasonalTea, 0.025);
    verandaTeaBase.name = "veranda-tea-wooden-tray";
    const verandaTeapot = teapot(-1.99, 0.981, -0.84, seasonalTea);
    verandaTeapot.scale.setScalar(0.86);
    cup(-1.87, 0.981, -0.55, seasonalTea);
    const brazier = new T.Group();
    brazier.position.set(0.82, 0.948, -0.95);
    root.add(brazier);
    lathe([[0.13, 0], [0.24, 0.05], [0.27, 0.22], [0.22, 0.27], [0.19, 0.25]], material("#6b6355"), [0, 0, 0], brazier);
    const emberMat = material("#8a3c21", { emissive: "#f46525", emissiveIntensity: 0.8 });
    for (let i = 0; i < 8; i++) ellipsoid(rr(-0.14, 0.14), 0.21, rr(-0.14, 0.14), 0.055, 0.033, 0.035, emberMat, brazier, 8);
    const kettle = lathe([[0.06, 0], [0.16, 0.03], [0.19, 0.15], [0.12, 0.25]], material("#343f3f", { metalness: 0.5, roughness: 0.6 }), [0, 0.28, 0], brazier);
    line([[-0.14, 0.42, 0], [-0.14, 0.67, 0], [0.14, 0.67, 0], [0.14, 0.42, 0]], woodDark, 0.021, brazier);
    const kettleLid = ellipsoid(0, 0.54, 0, 0.11, 0.025, 0.11, woodDark, brazier);
    const emberLight = new T.PointLight("#f6a45e", 1.6, 2.4, 2);
    emberLight.position.set(0, 0.35, 0);
    brazier.add(emberLight);
    brazier.visible = false;
    const dayNightLife = createDayNightLife({ root, material, mesh, box, ellipsoid, line, lathe, wood, woodDark, woodEdge, seasonalLife, seasonalTea, verandaTeaBase, summerProps, sleeper, brazier, openInteriorScreen });
    const gardenLantern = lantern(3.5, 0.3, 3.03, 0.68);
    gardenLantern.name = "garden-stone-lantern";
    glow.position.set(0, 0.71, 0);
    gardenLantern.add(glow);
    glow.distance = 3;
    glow.name = "garden-lantern-light";
    const smallLamps = [];
    const eaveLantern = smallLantern("small-eave-lantern", 2.01, 2.82, -0.6, true);
    const treeLantern = smallLantern("small-tree-root-lantern", -2.7, 0.3355, -0.1);
    const lampMat = material("#f1dfb4", { emissive: "#ffc17b", emissiveIntensity: 0 });
    lanterns.push(lampMat);
    box(0.34, 0.6, 0.34, lampMat, [1.5, 1.31, -3.2], house, 0.04);
    for (let y = 1.05; y < 1.63; y += 0.08) box(0.36, 0.012, 0.36, woodDark, [1.5, y, -3.2], house);
    box(0.43, 0.05, 0.43, woodDark, [1.5, 1, -3.2], house);
    const fish = [];
    for (let i = 0; i < 7; i++) {
      let g = new T.Group();
      g.name = "submerged-koi";
      g.userData.inkOutline = false;
      root.add(g);
      let white = material(i % 3 === 0 ? "#e1c386" : "#e6dec6", { roughness: 0.5 }), red = material(i % 3 === 0 ? "#b88738" : "#c26649");
      ellipsoid(0, 0, 0, 0.073, 0.055, 0.23, white, g);
      ellipsoid(0, 0.045, -0.04, 0.052, 0.016, 0.077, red, g);
      ellipsoid(0.022, 0.04, 0.095, 0.033, 0.02, 0.046, red, g);
      const tail = new T.Group();
      tail.position.z = -0.22;
      g.add(tail);
      let tg = new T.BufferGeometry();
      tg.setAttribute("position", new T.Float32BufferAttribute([0, 0, 0, -0.085, 0.013, -0.15, 0, 0, -0.11, 0, 0, 0, 0, 0, -0.11, 0.085, 0.013, -0.15], 3));
      tg.computeVertexNormals();
      mesh(tg, material("#b39973", { side: T.DoubleSide }), [0, 0, 0], tail);
      for (let side of [-1, 1]) {
        let f = ellipsoid(side * 0.08, -3e-3, 0.035, 0.06, 0.01, 0.07, white, g, 8);
        f.rotation.y = side * 0.4;
        ellipsoid(side * 0.037, 0.032, 0.18, 0.012, 0.011, 0.01, woodDark, g, 8);
      }
      fish.push({ g, tail, phase: i * 0.85, speed: rr(0.07, 0.11), lane: rr(-0.8, 0.8) });
    }
    const ripples = [];
    const drifting = [];
    const petalMat = material("#e7babc", { side: T.DoubleSide });
    for (let i = 0; i < 45; i++) {
      let o = mesh(leafGeometry, petalMat, [rr(-4, 4), rr(0.1, 5), rr(-4, 4)]);
      o.scale.set(0.09, 0.09, 0.13);
      o.castShadow = false;
      drifting.push({ o, seed: rand() * 10, speed: rr(0.08, 0.2) });
    }
    const gustMat = material("#98b663", { side: T.DoubleSide });
    const gustLeaves = [];
    for (let i = 0; i < 48; i++) {
      const o = mesh(leafGeometry, gustMat, [0, 0, 0]);
      o.scale.set(0.1, 0.1, 0.15);
      o.castShadow = false;
      gustLeaves.push({ o, seed: rr(0, 22), x: rr(-3.8, -1.8), y: 0.25 + treeHeight(rr(4.85, 6.25) - 0.25), z: rr(0.45, 1.1) });
    }
    const canopyFall = createCanopyFall({ slots: gustLeaves, leafRecords, foliage, inWater, surfaces: [
      { kind: "roof", object: roof },
      { kind: "deck", object: house },
      ...terrain.banks.map((object) => ({ kind: "ground", object })),
      { kind: "water", object: water },
      { kind: "bridge", object: gardenLife.bridge },
      ...root.children.filter((o) => o.name === "shore-rock").map((object) => ({ kind: "rock", object }))
    ] });
    drifting.forEach((a) => a.o.visible = false);
    const snowAccumulation = createSnowAccumulation({ root, roof, legacyRoofSnow: snowRoof, terrain, bridge: gardenLife.bridge, snowMat, house, water, ripple });
    creekIce = createWinterCreekIce({ root, cx, width, streamExtent, inWater, bridge: gardenLife.bridge, birdRock: root.getObjectByName("bird-drinking-rock"), bird: root.getObjectByName("winter-long-tailed-tit") });
    const rainPos = new Float32Array(450 * 6);
    for (let i = 0; i < 450; i++) {
      const x = rr(-5.2, 5.2), y = rr(0, 13.5), z = rr(-5.2, 5.2);
      rainPos.set([x, y, z, x - 0.035, y + 0.25, z], i * 6);
    }
    const rainEffect = createRainStreaks({ root, positions: rainPos }), rain = rainEffect.rain;
    const snowGeo = new T.BufferGeometry(), snowPos = new Float32Array(450 * 3);
    for (let i = 0; i < snowPos.length; i += 3) snowPos.set([rr(-5.3, 5.3), rr(0, 13.5), rr(-5.3, 5.3)], i);
    snowGeo.setAttribute("position", new T.BufferAttribute(snowPos, 3));
    const glowTex = glowTexture();
    const snowScales = new Float32Array(450);
    for (let i = 0; i < 450; i++) snowScales[i] = 0.65 + i * 37 % 101 / 101 * 0.75;
    snowGeo.setAttribute("flakeScale", new T.BufferAttribute(snowScales, 1));
    const snowMaterial = new T.PointsMaterial({ color: "#ffffff", size: 5.4 / renderDpr, sizeAttenuation: false, map: particleTexture("snow"), transparent: true, opacity: 0.94, depthWrite: false });
    snowMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = "attribute float flakeScale;\n" + shader.vertexShader.replace("gl_PointSize = size;", "gl_PointSize = max(1., size * flakeScale);");
    };
    snowMaterial.customProgramCacheKey = () => "garden-snow-screen-size-v16";
    const snow = new T.Points(snowGeo, snowMaterial);
    snow.frustumCulled = false;
    snow.userData.screenPixelSize = [3.5, 7.6];
    snow.name = "weather-snow";
    root.add(snow);
    snow.visible = false;
    const fireflyGeo = new T.BufferGeometry(), fireflyPos = new Float32Array(28 * 3), fireflyColors = new Float32Array(28 * 3);
    const fireflies = new T.Points(fireflyGeo, new T.PointsMaterial({ color: "#e5e49b", size: 7 / renderDpr, sizeAttenuation: false, map: particleTexture("firefly"), vertexColors: true, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    fireflyGeo.setAttribute("position", new T.BufferAttribute(fireflyPos, 3));
    fireflyGeo.setAttribute("color", new T.BufferAttribute(fireflyColors, 3));
    fireflies.name = "summer-night-fireflies";
    fireflies.frustumCulled = false;
    fireflies.userData.screenPixelSize = 7;
    root.add(fireflies);
    const butterflies = createNightButterflies({ root, material });
    const steamOrigin = new T.Vector3();
    const steamGeo = new T.BufferGeometry(), steamPos = new Float32Array(28 * 3);
    steamGeo.setAttribute("position", new T.BufferAttribute(steamPos, 3));
    const steam = new T.Points(steamGeo, new T.PointsMaterial({ color: "#efe8dc", size: 0.15, map: glowTex, transparent: true, opacity: 0.18, depthWrite: false }));
    root.add(steam);
    const starPos = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i++) starPos.set([rr(-20, 20), rr(8, 20), rr(-15, 10)], i * 3);
    let starG = new T.BufferGeometry();
    starG.setAttribute("position", new T.BufferAttribute(starPos, 3));
    const stars = new T.Points(starG, new T.PointsMaterial({ size: 0.026, color: "#c6d9e2", transparent: true, opacity: 0 }));
    scene.add(stars);
    const pointPixelSizes = /* @__PURE__ */ new Map();
    scene.traverse((o) => {
      if (o.isPoints) pointPixelSizes.set(o.material, o.material.size);
    });
    applyRenderStyle(state.renderStyle);
    let time = 0, nightMix = state.night ? 1 : 0;
    const themeColors = Object.fromEntries(Object.entries(gardenTheme).map(([key, tone]) => [key, { day: new T.Color(tone.day), night: new T.Color(tone.night) }]));
    const targetBg = new T.Color(gardenTheme[state.season].day);
    let cloudMix = 0, summerClosedMix = 0, precipitationMix = 0;
    let currentSeason = "summer";
    applySeason();
    const framing = createPortraitFraming(camera, controls, collectGardenFramePoints(root));
    return {
      scene,
      camera,
      element: renderer.domElement,
      getTime: () => gardenClock.getSnapshot(),
      update(next) {
        if (disposed) return;
        const season = GARDEN_SEASONS.includes(next.season) ? next.season : state.season;
        const night = next.scheme === "dark";
        gardenClock.setSeason(season);
        gardenClock.setHour(night ? 22 : 12);
        gardenClock.setRunning(false);
        clockSnapshot = gardenClock.getSnapshot();
        Object.assign(state, { season, night, weather: "clear", renderStyle: "clear", pixelated: false });
        applySeason();
        renderer.shadowMap.needsUpdate = true;
      },
      resize,
      render,
      setInteractive(enabled) {
        controls.enabled = enabled;
      },
      dispose
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
export {
  createWorld
};
