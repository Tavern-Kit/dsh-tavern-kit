/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 AC.
 * Source: https://github.com/annac777/xi4u @ 336d2a38ed8c170a4599493f1bc20c6c1ef7962c, app/seasonal-life.ts
 * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.
 */
import * as T from "three";
function createSeasonalLife({ root, material, mesh, box, ellipsoid, line, beam, lathe, cup, teapot, wood, woodDark, paper, brass, rr }) {
  const groups = Object.fromEntries(["spring", "summer", "autumn", "winter"].map((s) => {
    const g = new T.Group();
    g.name = `\u5BA4\u5185_${s}`;
    root.add(g);
    return [s, g];
  }));
  const jade = material("#4eaaa0"), ivory = material("#f7e2ae"), coral = material("#d98053"), clay = material("#51767c");
  const twig = material("#795749"), leaf = material("#81bd6b"), petal = material("#f4c7b7"), pink = material("#e89f9c");
  function plate(x, y, z, r, parent) {
    mesh(new T.CylinderGeometry(r, r * 0.88, 0.027, 16), ivory, [x, y, z], parent);
    mesh(new T.TorusGeometry(r * 0.87, 9e-3, 4, 16), coral, [x, y + 0.017, z], parent).rotation.x = Math.PI / 2;
  }
  function vase(x, y, z, parent, m = clay) {
    lathe([[0.065, 0], [0.13, 0.08], [0.12, 0.27], [0.065, 0.34], [0.057, 0.38], [0.045, 0.38]], m, [x, y, z], parent);
  }
  function citrus(x, y, z, parent, r = 0.09) {
    ellipsoid(x, y, z, r, r * 0.86, r, coral, parent, 8);
    box(0.035, 0.018, 0.035, woodDark, [x, y + r * 0.9, z], parent);
    let l = box(0.066, 9e-3, 0.023, leaf, [x + 0.03, y + r * 0.9, z], parent);
    l.rotation.y = 0.5;
  }
  function bloom(x, y, z, parent, r = 0.035) {
    for (let k = 0; k < 5; k++) {
      let a = k * Math.PI * 2 / 5;
      let o = box(r * 1.15, r * 0.75, r * 0.35, k % 2 ? pink : petal, [x + Math.cos(a) * r, y + Math.sin(a) * r, z], parent);
      o.rotation.z = a;
    }
    box(0.022, 0.022, 0.018, ivory, [x, y, z + 0.01], parent);
  }
  const spring = groups.spring;
  vase(-2.37, 1.39, -2.52, spring);
  const branch = new T.Group();
  branch.position.set(-2.37, 1.71, -2.52);
  spring.add(branch);
  line([[0, 0, 0], [0.03, 0.22, 0], [-0.04, 0.51, -0.02], [0.03, 0.78, 0.01]], twig, 0.013, branch);
  for (let i = 0; i < 5; i++) {
    let sign = i % 2 ? 1 : -1, x = sign * (0.16 + i % 2 * 0.08), y = 0.2 + i * 0.1;
    line([[0, y - 0.09, 0], [x * 0.65, y, 0.015], [x, y + 0.11, 0.01]], twig, 8e-3, branch);
    for (let k = 0; k < 3; k++) bloom(x + rr(-0.035, 0.035), y + 0.06 + k * 0.055, 0.015, branch, 0.032);
  }
  const sweets = new T.Group();
  sweets.name = "spring-veranda-sweets";
  sweets.position.x = 3.32;
  spring.add(sweets);
  plate(-2.43, 0.9935, -0.69, 0.175, sweets);
  for (let row = 0; row < 2; row++) {
    beam([-2.57, 1.035, -0.65 - row * 0.082], [-2.29, 1.035, -0.65 - row * 0.082], 5e-3, 5e-3, woodDark, sweets);
    ["#f0b2b5", "#f6e8c8", "#99b68d"].forEach((c, i) => ellipsoid(-2.5 + i * 0.068, 1.038, -0.65 - row * 0.082, 0.033, 0.031, 0.031, material(c), sweets, 12));
  }
  const springDrift = [];
  for (let i = 0; i < 7; i++) {
    let o = box(0.032, 0.013, 0.027, petal, [0, 0, 0], spring);
    springDrift.push(o);
  }
  const summer = groups.summer;
  const fan = new T.Group();
  fan.name = "summer-tatami-fan";
  fan.position.set(0.38, 1.015, -2.14);
  fan.rotation.y = -0.18;
  summer.add(fan);
  box(0.44, 0.055, 0.32, jade, [0, 0.03, 0], fan, 0.025);
  box(0.23, 0.02, 0.06, ivory, [0, 0.064, 0.105], fan);
  for (let i = 0; i < 3; i++) box(0.035, 0.015, 0.03, i === 0 ? coral : clay, [-0.055 + i * 0.055, 0.08, 0.105], fan);
  beam([0, 0.04, -0.04], [0, 0.32, -0.04], 0.045, 0.035, jade, fan);
  const fanHead = new T.Group();
  fanHead.name = "summer-fan-aim";
  fanHead.position.set(0, 0.48, -0.02);
  fanHead.rotation.x = 0.28;
  fan.add(fanHead);
  let motor = mesh(new T.CylinderGeometry(0.075, 0.075, 0.15, 12), jade, [0, 0, -0.085], fanHead);
  motor.rotation.x = Math.PI / 2;
  const blades = new T.Group();
  fanHead.add(blades);
  for (let i = 0; i < 3; i++) {
    let a = i * Math.PI * 2 / 3;
    let o = ellipsoid(Math.sin(a) * 0.13, Math.cos(a) * 0.13, 0, 0.087, 0.16, 0.015, ivory, blades, 8);
    o.rotation.z = -a - 0.38;
  }
  for (let r of [0.13, 0.25, 0.285]) mesh(new T.TorusGeometry(r, 8e-3, 4, 32), jade, [0, 0, 0.045], fanHead);
  for (let i = 0; i < 12; i++) {
    let a = i * Math.PI / 6;
    line([[Math.cos(a) * 0.045, Math.sin(a) * 0.045, 0.075], [Math.cos(a) * 0.18, Math.sin(a) * 0.18, 0.07], [Math.cos(a) * 0.28, Math.sin(a) * 0.28, 0.043]], clay, 55e-4, fanHead);
  }
  ellipsoid(0, 0, 0.08, 0.047, 0.047, 0.016, jade, fanHead, 12);
  plate(-2.82, 0.978, -0.52, 0.2, summer);
  const spiral = [];
  for (let i = 0; i < 100; i++) {
    let a = i * 0.17, r = 0.012 + i * 13e-4;
    spiral.push([-2.82 + Math.cos(a) * r, 1.005, -0.52 + Math.sin(a) * r]);
  }
  line(spiral, material("#476b67"), 0.012, summer);
  const coilTip = box(0.02, 0.014, 0.02, material("#cb764a", { emissive: "#ea9c46", emissiveIntensity: 0.4 }), spiral.at(-1), summer);
  const coilSmoke = [];
  for (let i = 0; i < 9; i++) {
    let o = box(0.023, 0.048, 0.013, material("#d3dfcf", { transparent: true, opacity: 0.18, depthWrite: false }), [0, 0, 0], summer);
    o.castShadow = false;
    coilSmoke.push(o);
  }
  const autumn = groups.autumn;
  const book = new T.Group();
  book.name = "autumn-small-veranda-book";
  book.position.set(-0.44, 0.953334, -0.72);
  book.rotation.y = -0.18;
  book.scale.setScalar(2 / 3);
  autumn.add(book);
  box(0.74, 0.025, 0.43, clay, [0, 0, 0], book);
  for (let side of [-1, 1]) {
    box(0.347, 0.04, 0.4, ivory, [side * 0.18, 0.028, 0], book);
    for (let z = -0.15; z < 0.18; z += 0.034) box(0.25, 3e-3, 7e-3, material("#8ca192"), [side * 0.19, 0.051, z], book);
  }
  box(0.018, 8e-3, 0.4, woodDark, [0, 0.052, 0], book);
  const turningPage = new T.Group();
  turningPage.position.y = 0.057;
  book.add(turningPage);
  box(0.35, 5e-3, 0.4, paper, [0.18, 0, 0], turningPage);
  for (let z = -0.15; z < 0.18; z += 0.034) box(0.25, 2e-3, 6e-3, clay, [0.19, 4e-3, z], turningPage);
  const autumnStill = new T.Group();
  autumnStill.name = "autumn-right-still-life";
  autumnStill.position.x = 2.88;
  autumn.add(autumnStill);
  plate(-2.75, 0.9585, -0.68, 0.27, autumnStill);
  for (const [x, z] of [[-2.85392305, -0.74], [-2.64607695, -0.74], [-2.75, -0.56]]) citrus(x, 1.05542, z, autumnStill, 0.097);
  const tableVase = new T.Group();
  tableVase.name = "autumn-table-vase";
  tableVase.position.set(-2.07, 1.38, -2.33);
  autumn.add(tableVase);
  vase(0, 0, 0, tableVase, coral);
  const pampas = new T.Group();
  pampas.position.set(0, 0.32, 0);
  pampas.scale.setScalar(0.55);
  tableVase.add(pampas);
  for (let i = 0; i < 6; i++) {
    let x = (i - 2.5) * 0.072, h = 0.48 + rr(0, 0.25);
    line([[0, 0, 0], [x * 0.5, h * 0.6, 0], [x, h, 0.035]], twig, 6e-3, pampas);
    for (let j = 0; j < 6; j++) {
      let y = h - 0.15 + j * 0.035;
      beam([x, y, 0.035], [x + 0.045, y + 0.065, 0.045], 0.012, 3e-3, ivory, pampas);
      beam([x, y, 0.035], [x - 0.04, y + 0.06, 0.025], 0.012, 3e-3, ivory, pampas);
    }
  }
  const winter = groups.winter;
  const quilt = material("#cd916d");
  box(1.35, 0.07, 0.91, quilt, [-2.02, 1.402, -2.33], winter, 0.035);
  for (let z of [-2.77, -1.89]) {
    box(1.34, 0.3, 0.055, quilt, [-2.02, 1.24, z], winter, 0.02);
    for (let i = 0; i < 7; i++) box(0.08, 0.29, 9e-3, i % 2 ? ivory : jade, [-2.61 + i * 0.195, 1.245, z + (z < -2 ? 0.032 : 0.033)], winter);
  }
  for (let x of [-2.67, -1.37]) box(0.055, 0.3, 0.9, quilt, [x, 1.24, -2.33], winter, 0.02);
  for (let i = 0; i < 7; i++) box(0.085, 5e-3, 0.89, i % 2 ? ivory : jade, [-2.6 + i * 0.193, 1.44, -2.33], winter);
  box(0.97, 0.048, 0.61, wood, [-2.02, 1.47, -2.33], winter, 0.025);
  const winterFood = new T.Group();
  winterFood.name = "winter-day-kotatsu-food";
  winter.add(winterFood);
  plate(-2.19, 1.505, -2.33, 0.22, winterFood);
  citrus(-2.25, 1.585, -2.35, winterFood, 0.078);
  citrus(-2.08, 1.585, -2.34, winterFood, 0.078);
  citrus(-2.17, 1.705, -2.35, winterFood, 0.073);
  cup(-1.71, 1.505, -2.2, winterFood);
  mesh(new T.CylinderGeometry(0.075, 0.08, 0.018, 12), clay, [-2.34, 1.512, -2.57], winter);
  box(0.07, 0.13, 0.07, ivory, [-2.34, 1.58, -2.57], winter);
  const candleFlame = mesh(new T.ConeGeometry(0.022, 0.073, 5), material("#ffd58a", { emissive: "#ffad45", emissiveIntensity: 1.2 }), [-2.34, 1.68, -2.57], winter);
  let season = "summer", isNight = false;
  return {
    setSeason(s) {
      season = s;
      for (const [key, g] of Object.entries(groups)) g.visible = key === s;
    },
    setNight(night) {
      isNight = night;
      sweets.visible = !night;
      fan.visible = !night;
      autumnStill.visible = !night;
      winterFood.visible = !night;
    },
    update(time, night) {
      const t = Math.floor(time * 14) / 14;
      if (season === "spring") {
        branch.rotation.z = Math.sin(t * 0.75) * 0.016;
        springDrift.forEach((o, i) => {
          let f = (t * 0.075 + i / 7) % 1;
          o.position.set(-2.37 + Math.sin(f * 5 + i) * 0.19, 2.46 - f * 1.055, -2.42 + f * 0.43);
          o.rotation.set(f * 4, i + f * 5, f * 3);
        });
      }
      if (season === "summer") {
        if (!isNight) {
          fanHead.rotation.y = Math.sin(t * 0.43) * 0.24;
          blades.rotation.z = -t * 14;
        }
        coilSmoke.forEach((o, i) => {
          let f = (t * 0.22 + i / 9) % 1;
          o.position.set(coilTip.position.x + Math.sin(f * 7 + t) * 0.04, 1.03 + f * 0.45, coilTip.position.z + Math.cos(f * 5) * 0.025);
          o.scale.setScalar(0.65 + f);
          o.material.opacity = 0.17 * (1 - f);
        });
      }
      if (season === "autumn") {
        let phase = t % 15 / 15;
        turningPage.rotation.z = phase < 0.65 ? 0 : Math.sin((phase - 0.65) / 0.35 * Math.PI) * 2.75;
        pampas.rotation.z = Math.sin(t * 0.68) * 0.025;
      }
      if (season === "winter") {
        candleFlame.visible = night > 0.12;
        candleFlame.scale.y = 0.85 + Math.sin(t * 6) * 0.16 + Math.sin(t * 11) * 0.08;
        candleFlame.rotation.z = Math.sin(t * 3) * 0.08;
      }
    },
    describe() {
      return Object.fromEntries(Object.entries(groups).map(([k, g]) => [k, { visible: g.visible, objects: g.children.length }]));
    }
  };
}
export {
  createSeasonalLife
};
