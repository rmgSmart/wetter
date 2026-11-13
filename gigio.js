"use strict";
/* Gigio, die Katze der Wetterseite. Wird nur gestartet, wenn der Gigio Mode eingeschaltet ist.
   Posen sind freigestellte Fotos in foto/. Je Pose: Groesse, Fusspunkt (ax, ay), Kopfpunkt (hx, hy) als Anteil, Blickrichtung (face). */
const Gigio = (() => {
  const SPR = {
    sitzen:    { w: 222, h: 256, ax: .5,  ay: 1,   hx: .45, hy: .06, face: 1, k: 0.74 },
    streng:    { w: 221, h: 252, ax: .5,  ay: 1,   hx: .45, hy: .06, face: 1, k: 0.74 },
    angelehnt: { w: 292, h: 208, ax: .45, ay: 1,   hx: .4,  hy: .04, face: 1, k: 0.74 },
    ruecken:   { w: 404, h: 140, ax: .5,  ay: 1,   hx: .12, hy: .3,  face: -1, k: 0.62 },
    seite:     { w: 526, h: 121, ax: .5,  ay: 1,   hx: .92, hy: .15, face: 1, k: 0.62 },
    sphinx:    { w: 423, h: 184, ax: .5,  ay: 1,   hx: .74, hy: .04, face: 1, k: 0.6 },
    kante:     { w: 293, h: 228, ax: .45, ay: .55, hx: .16, hy: .04, face: -1, k: 0.7 },
    gaehnen:   { w: 325, h: 216, ax: .45, ay: 1,   hx: .12, hy: .04, face: -1, k: 0.7 },
    putzen:    { w: 228, h: 245, ax: .5,  ay: 1,   hx: .32, hy: .06, face: -1, k: 0.74 },
    rollen:    { w: 355, h: 199, ax: .5,  ay: 1,   hx: .12, hy: .5,  face: -1, k: 0.62 },
    hoch:      { w: 196, h: 220, ax: .5,  ay: 1,   hx: .5,  hy: .04, face: 1, k: 0.8 },
    fressen:   { w: 342, h: 172, ax: .55, ay: 1,   hx: .14, hy: .35, face: -1, k: .68 },
    g1:        { w: 212, h: 171, ax: .505, ay: 1, hx: .915, hy: .3, face: 1 },
    g2:        { w: 189, h: 161, ax: .444, ay: 1, hx: .905, hy: .3, face: 1 },
    g3:        { w: 197, h: 166, ax: .467, ay: 1, hx: .909, hy: .3, face: 1 },
    g4:        { w: 190, h: 169, ax: .447, ay: 1, hx: .905, hy: .3, face: 1 },
    g5:        { w: 202, h: 158, ax: .48,  ay: 1, hx: .911, hy: .3, face: 1 },
    g6:        { w: 217, h: 160, ax: .516, ay: 1, hx: .917, hy: .3, face: 1 },
    g7:        { w: 230, h: 157, ax: .543, ay: 1, hx: .922, hy: .3, face: 1 },
    renn1:     { w: 172, h: 145, ax: .39,  ay: 1, hx: .895, hy: .3, face: 1 },
    renn2:     { w: 190, h: 147, ax: .447, ay: 1, hx: .905, hy: .3, face: 1 },
    renn3:     { w: 155, h: 162, ax: .323, ay: 1, hx: .884, hy: .3, face: 1 },
    hs1: { w: 127, h: 95, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    hs2: { w: 114, h: 103, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.7 },
    hs3: { w: 119, h: 103, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.7 },
    hs4: { w: 118, h: 104, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.7 },
    hs5: { w: 116, h: 105, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.7 },
    hs6: { w: 118, h: 106, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.7 },
    hs7: { w: 104, h: 107, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.7 },
    hs8: { w: 90, h: 106, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.7 },
    hl1: { w: 125, h: 82, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    hl2: { w: 124, h: 76, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    hl3: { w: 137, h: 71, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    hl4: { w: 143, h: 65, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    hl5: { w: 158, h: 62, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    hl6: { w: 152, h: 60, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    hl7: { w: 172, h: 55, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    hl8: { w: 168, h: 55, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    au1: { w: 154, h: 61, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    au2: { w: 129, h: 77, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    au3: { w: 135, h: 80, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    au4: { w: 134, h: 84, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    au5: { w: 137, h: 86, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    au6: { w: 125, h: 90, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    au7: { w: 126, h: 95, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    au8: { w: 125, h: 96, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    ro1: { w: 154, h: 52, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    ro2: { w: 139, h: 55, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    ro3: { w: 152, h: 56, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    ro4: { w: 156, h: 52, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    ro5: { w: 156, h: 52, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    ro6: { w: 143, h: 48, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    ro7: { w: 125, h: 46, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    ro8: { w: 148, h: 40, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    st1: { w: 145, h: 68, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    st2: { w: 148, h: 81, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    st3: { w: 135, h: 85, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    st4: { w: 129, h: 87, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    st5: { w: 139, h: 79, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    st6: { w: 127, h: 74, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    st7: { w: 129, h: 73, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    st8: { w: 131, h: 72, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    sp1: { w: 91, h: 68, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.7 },
    sp2: { w: 93, h: 75, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.7 },
    sp3: { w: 110, h: 83, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    sp4: { w: 111, h: 83, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    sp5: { w: 116, h: 78, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    sp6: { w: 113, h: 70, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    sp7: { w: 132, h: 65, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    sp8: { w: 138, h: 62, ax: .5, ay: 1, hx: .85, hy: .1, face: 1, k: 1.38 },
    lauf1: { w: 229, h: 166, ax: 0.491, ay: 1, hx: 0.913, hy: .3, face: 1, k: 0.9 },
    lauf2: { w: 229, h: 166, ax: 0.491, ay: 1, hx: 0.913, hy: .3, face: 1, k: 0.9 },
    lauf3: { w: 236, h: 163, ax: 0.506, ay: 1, hx: 0.915, hy: .3, face: 1, k: 0.9 },
    lauf4: { w: 234, h: 165, ax: 0.501, ay: 1, hx: 0.915, hy: .3, face: 1, k: 0.9 },
    lauf5: { w: 222, h: 155, ax: 0.474, ay: 1, hx: 0.910, hy: .3, face: 1, k: 0.9 },
    lauf6: { w: 216, h: 180, ax: 0.460, ay: 1, hx: 0.907, hy: .3, face: 1, k: 0.9 },
    seitsitz:  { w: 208, h: 207, ax: .5, ay: 1, hx: .8,  hy: .03, face: 1, k: .8 },
    sitz_a:    { w: 156, h: 189, ax: .5, ay: 1, hx: .55, hy: .05, face: 1 },
    sitz_b:    { w: 193, h: 190, ax: .5, ay: 1, hx: .72, hy: .03, face: 1 },
    ducken:    { w: 196, h: 143, ax: .5, ay: 1, hx: .82, hy: .12, face: 1 },
    liegen_vorne: { w: 221, h: 134, ax: .5, ay: 1, hx: .63, hy: .06, face: 1 },
    liegen_lang:  { w: 336, h: 86,  ax: .5, ay: 1, hx: .9,  hy: .25, face: 1, k: .9 },
    hinten_l:  { w: 165, h: 245, ax: .5, ay: 1, hx: .55, hy: .03, face: 1 },
    hinten_m:  { w: 111, h: 269, ax: .5, ay: 1, hx: .5,  hy: .03, face: 1 },
    hinten_r:  { w: 154, h: 242, ax: .5, ay: 1, hx: .25, hy: .03, face: 1 },
    kopf_l:    { w: 131, h: 211, ax: .5, ay: 1, hx: .5,  hy: .03, face: 1 },
    kopf_m:    { w: 104, h: 213, ax: .5, ay: 1, hx: .5,  hy: .03, face: 1 },
    kopf_r:    { w: 103, h: 212, ax: .5, ay: 1, hx: .55, hy: .03, face: 1 },
  };
  const GEHEN = ["g1", "g2", "g3", "g4", "g5", "g6", "g7"], RENNEN = ["lauf1", "lauf2", "lauf3", "lauf4", "lauf5", "lauf6"];
  const GANG = /^(g\d|renn|lauf|ducken|st8|sp8)/, LIEGT = new Set(["sphinx", "seite", "ruecken", "kante", "liegen_vorne", "liegen_lang", "rollen", "ro8", "hl8"]);
  const reihe = (p, von, bis, t) => { const l = []; for (let i = von; von <= bis ? i <= bis : i >= bis; i += von <= bis ? 1 : -1) l.push([p + i, t]); return l; };
  const K = .27;                                   // px am Bildschirm je Bildpixel
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const main = document.querySelector("main"), layer = document.createElement("div"); layer.id = "gigio-layer"; main.appendChild(layer);
  let weather = "regen";
  let lastFed = 0; try { lastFed = +localStorage.getItem("gigio-fed") || 0; } catch (e) {}
  for (const n in SPR) { const i = new Image(); i.src = `foto/${n}.png`; }   // vorladen

  const root = document.createElement("div"); root.id = "gigio";
  root.innerHTML = `<div class="squash"><div class="box" role="button" tabindex="0" aria-label="Gigio, antippen"><img alt="" draggable="false"></div></div>`;
  layer.appendChild(root); layer.hidden = true;
  const squash = root.querySelector(".squash"), box = root.querySelector(".box"), img = root.querySelector("img");

  const cat = { x: 0, y: 0, dir: 1, plat: 0, pose: "", act: "", t: 0, dur: 3, queue: [], hop: null, walk: null, step: 0,
                blinkT: 3, seq: null, land: 0, zzT: 0, heartT: 0, pop: 0, offscreen: 0, bubble: null, bowl: null, tapHop: 0, hopY: 0 };
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  const lerp = (a, b, k) => a + (b - a) * k;

  /* ---------- Welt ---------- */
  let plats = [];
  function platforms() {
    const m = main.getBoundingClientRect(), list = [];
    const t = document.getElementById("temp"); if (!t) return list; const tr = t.getBoundingClientRect();
    list.push({ kind: "temp", x1: tr.left - m.left + 30, x2: tr.right - m.left - 10, y: tr.top - m.top + tr.height * .14 });
    document.querySelectorAll("main .card").forEach(c => { const r = c.getBoundingClientRect(); list.push({ kind: "card", x1: r.left - m.left + 40, x2: r.right - m.left - 40, y: r.top - m.top + 1 }); });
    return list;
  }
  const visible = p => { const yy = p.y + main.getBoundingClientRect().top; return yy > 80 && yy < innerHeight - 20; };

  /* ---------- Darstellung ---------- */
  // Weicher Uebergang: das alte Bild blendet aus, waehrend das neue einblendet
  function setPose(n, federn = true) {
    if (cat.pose === n) return;
    if (cat.pose && !still) {
      const alt = box.cloneNode(true); alt.classList.add("ghost"); alt.removeAttribute("tabindex"); alt.removeAttribute("role");
      squash.appendChild(alt); const ms = federn ? 260 : 110;
      alt.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: "ease-out" }).onfinish = () => alt.remove();
      img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: "ease-in" });
    }
    cat.pose = n; const s = SPR[n];
    img.src = `foto/${n}.png`;
    const k = K * (s.k || 1);
    box.style.width = s.w * k + "px"; box.style.height = s.h * k + "px";
    box.style.left = -s.ax * s.w * k + "px"; box.style.top = -s.ay * s.h * k + "px";
    if (federn) cat.pop = 1;
  }
  function headPoint() {
    const s = SPR[cat.pose], flip = cat.dir * s.face, k = K * (s.k || 1);
    return [cat.x + flip * (s.hx - s.ax) * s.w * k, cat.y - (s.ay - s.hy) * s.h * k - cat.hopY];
  }

  // Bewegungsablauf: Zwischenposen abspielen (aufstehen, hinsetzen, hinlegen), dann die Zielpose
  const gangPose = () => cat.walk && cat.walk.v > 85 ? RENNEN[cat.step % 6] : GEHEN[cat.step % 7];
  function folge(list, end) {
    if (!list.length || still) { if (end) setPose(end); return 0; }
    cat.seq = { list, i: 0, t: 0, end }; setPose(list[0][0]);
    return list.reduce((a, b) => a + b[1], 0);
  }
  function zeige(n, art, extra = []) {
    const v = cat.pose; let l = [];
    if (art === "sitz") { if (GANG.test(v)) l = reihe("hs", 1, 8, .075); else if (LIEGT.has(v)) l = [["liegen_vorne", .28], ["sitz_a", .24]]; }
    if (art === "steh" && LIEGT.has(v)) l = reihe("au", 1, 8, .075);
    if (art === "lieg") {
      if (GANG.test(v)) l = reihe("hl", 1, 8, .08);
      else if (!LIEGT.has(v)) l = [["sitz_b", .2]].concat(reihe("hl", 2, 8, .08));
      else if (v !== "liegen_vorne" && n !== "liegen_vorne") l = [["liegen_vorne", .3]];
    }
    cat.t -= folge(l.concat(extra), n);
  }
  function seqSchritt(dt) {
    const q = cat.seq; q.t += dt; if (q.t < q.list[q.i][1]) return;
    q.t = 0; q.i++;
    if (q.i < q.list.length) { setPose(q.list[q.i][0]); return; }
    cat.seq = null;
    if (q.end) setPose(q.end); else if (cat.walk) setPose(gangPose(), false);
  }

  /* ---------- Sprechblasen und Effekte ---------- */
  const SAGT = {
    allg: ["Miau.", "Mrrr?", "Was ist?", "Mir ist langweilig.", "Ich war das nicht.", "Streichelst du mich?", "Mrau."],
    regen: ["Regen. Igitt.", "Heute bleibe ich drinnen.", "Nasse Pfoten? Nein danke."],
    sonne: ["Sonne! Endlich.", "Perfekt zum Liegen.", "Schön warm."],
    nacht: ["Psst.", "Zeit zum Schlafen.", "Ich bin noch wach. Glaube ich."],
    wind: ["Viel zu windig.", "Mein Fell!", "Huiii."],
    tipp: ["Miau!", "He!", "Was willst du?", "Mrrp.", "Nicht stupsen.", "Na gut, ein bisschen."],
    streng: ["Hm.", "Ich beobachte dich.", "Interessant."],
    ups: ["Ups.", "Das war ich nicht.", "Der ist von selbst gefallen."],
    fuatta: ["Wo ist mein Futter?", "Futter. Jetzt.", "Frühstück?"],
    essen: ["Mmmh!", "Nom nom.", "Lecker!"],
    danke: ["Danke!", "Das war gut.", "Mrrr. Satt."],
    spiel: ["Bauch kraulen? Vielleicht.", "Mrrr!", "Fang mich doch!"],
    fang: { regen: ["Tropfen!", "Was war das?"], sonne: ["Fliege!", "Sonnenstrahl!"], nacht: ["Motte!", "Was war das?"], wind: ["Blatt!", "Hab es fast!"], umschauen: 1.6, beleidigt: .5, seitsitz: .8, doesen: .8, umschauen: 1.4, beleidigt: .4, seitsitz: .9, doesen: 1.2, umschauen: .6, beleidigt: .3, seitsitz: .5, doesen: 2.4, umschauen: 1.8, beleidigt: .6, seitsitz: .8, doesen: .6 },
  };
  function sag(text, dauer = 2600) {
    if (cat.bubble) cat.bubble.remove();
    const b = document.createElement("div"); b.className = "bubble"; b.textContent = text; layer.appendChild(b); cat.bubble = b;
    setTimeout(() => { b.classList.add("out"); setTimeout(() => { b.remove(); if (cat.bubble === b) cat.bubble = null; }, 450); }, dauer);
  }
  function fx(cls, html, dx = 0) {
    const e = document.createElement("div"); e.className = cls; e.innerHTML = html;
    const hp = headPoint(); e.style.left = hp[0] + dx + "px"; e.style.top = hp[1] - 6 + "px";
    layer.appendChild(e); setTimeout(() => e.remove(), 2700);
  }
  const zz = () => fx("zz", "z", 4 * cat.dir * SPR[cat.pose].face);
  const herz = () => fx("heart", `<svg viewBox="0 0 12 11" aria-hidden="true"><path d="M6 10.4 1.4 5.9A2.9 2.9 0 0 1 6 2.2a2.9 2.9 0 0 1 4.6 3.7z" fill="#ff7a93"/></svg>`, rnd(-8, 8));
  function schuessel(pi, x) {
    if (cat.bowl) cat.bowl.el.remove();
    const d = document.createElement("div"); d.className = "bowl";
    d.innerHTML = `<svg viewBox="0 0 38 16" aria-hidden="true"><ellipse cx="19" cy="4.2" rx="15" ry="3" fill="#6b4a2e"/><circle cx="13" cy="3.4" r="2" fill="#8a5c36"/><circle cx="18" cy="2.6" r="2.1" fill="#9a6a3e"/><circle cx="23.4" cy="3.4" r="2" fill="#7d5231"/><path d="M3.6 4.4h30.8l-2.6 9.4a2.4 2.4 0 0 1-2.3 1.7H8.5a2.4 2.4 0 0 1-2.3-1.7z" fill="#c9ccd1" stroke="#8a8f96" stroke-width=".8"/><path d="M8 8.2h22" stroke="#fff" stroke-opacity=".6" stroke-width="1.2" stroke-linecap="round"/></svg>`;
    layer.appendChild(d); cat.bowl = { el: d, plat: pi, x };
  }
  function schuesselWeg() { const b = cat.bowl; if (!b) return; cat.bowl = null; b.el.classList.add("weg"); setTimeout(() => b.el.remove(), 550); }

  /* ---------- Verhalten ---------- */
  const GEWICHT = {
    regen: { sit: 1.4, streng: 1, walk: 4.5, spazier: 2.2, jump: 2, talk: 1.2, angelehnt: .8, sphinx: 1, seite: .5, ruecken: .5, kante: .8, gaehnen: .6, putzen: 1.2, rollen: 1.4, hoch: 1.6, jagd: 1.6, zoomies: .9, ausreissen: .6, starren: .6, betteln: .5, knock: .6, turn: 1, strecken: 1.2 },
    sonne: { sit: 1.2, streng: .8, walk: 4.5, spazier: 2.4, jump: 2.4, talk: 1, angelehnt: 1, sphinx: 1.2, seite: 1, ruecken: 1.2, kante: 1, gaehnen: .6, putzen: .9, rollen: 2.2, hoch: 1.6, jagd: 2.2, zoomies: 1.2, ausreissen: .8, starren: .6, betteln: .5, knock: .7, turn: 1, strecken: 1.2 },
    nacht: { sit: .8, streng: .6, walk: 1.6, spazier: .8, jump: .6, talk: .4, angelehnt: 1.6, sphinx: 1.2, seite: 2.6, ruecken: 2.8, kante: 2, gaehnen: 1.2, putzen: .6, rollen: .5, hoch: .6, jagd: .6, zoomies: .5, ausreissen: .3, starren: .8, betteln: .3, knock: .2, turn: .4, strecken: 1.2 },
    wind:  { sit: 1.8, streng: 1.2, walk: 3.5, spazier: 1.6, jump: 1.2, talk: 1.4, angelehnt: .8, sphinx: 1.2, seite: .5, ruecken: .4, kante: .6, gaehnen: .5, putzen: 1, rollen: .9, hoch: 2, jagd: 1.8, zoomies: .7, ausreissen: .5, starren: .6, betteln: .4, knock: .6, turn: 1.4, strecken: 1.2 },
  };
  function waehle() {
    const w = { ...GEWICHT[weather] };
    if (still) for (const k of ["walk", "spazier", "jump", "knock", "rollen", "hoch", "jagd", "zoomies", "ausreissen", "strecken"]) w[k] = 0;
    if (cat.act && w[cat.act]) w[cat.act] *= .25;
    let sum = 0; for (const k in w) sum += w[k];
    let r = Math.random() * sum; for (const k in w) { r -= w[k]; if (r <= 0) return k; }
    return "sit";
  }
  function geheZu(x, tempo = rnd(34, 46), frei = false) {
    const p = plats[cat.plat]; if (!frei) x = Math.max(p.x1, Math.min(p.x2, x));
    if (Math.abs(x - cat.x) < 8) return false;
    cat.walk = { to: x, v: tempo }; cat.dir = x >= cat.x ? 1 : -1;
    if (LIEGT.has(cat.pose)) folge(reihe("au", 1, 8, .07), null);
    else if (cat.pose && !GANG.test(cat.pose)) folge([["ducken", .14]], null);
    else setPose(gangPose(), false);
    return true;
  }
  function springe(to, x1, h, dur) {
    const q = plats[to], p = plats[cat.plat]; x1 = Math.max(q.x1, Math.min(q.x2, x1));
    cat.walk = null; cat.seq = null; cat.hop = { x0: cat.x, y0: p.y, x1, to, h, dur, t: still ? 0 : -.24 }; cat.dir = x1 >= cat.x ? 1 : -1; setPose("sp2");
  }
  const lang = (min, max) => rnd(min, max);
  function start(name, opts = {}) {
    const p = plats[cat.plat];
    if (cat.bowl && !["feed", "eat", "walk", "jump"].includes(name)) schuesselWeg();
    cat.act = name; cat.t = 0; cat.seq = null;
    switch (name) {
      case "sit": zeige("sitzen", "sitz"); cat.dur = lang(2, 4); break;
      case "streng": zeige("streng", "sitz"); cat.dur = lang(2.5, 5); if (Math.random() < .3) sag(pick(SAGT.streng), 1600); break;
      case "turn": zeige("sitzen", "sitz"); cat.dir *= -1; cat.pop = 1; cat.dur = lang(1.2, 2.5); break;
      case "talk": zeige("sitzen", "sitz"); cat.dur = 3.2; sag(pick(Math.random() < .6 ? SAGT[weather] : SAGT.allg)); break;
      case "angelehnt": zeige("angelehnt", "sitz"); cat.dur = weather === "nacht" ? lang(8, 14) : lang(4, 8); cat.zzT = 2; break;
      case "sphinx": zeige("sphinx", "lieg"); cat.dur = lang(3, 6); break;
      case "seite": zeige("seite", "lieg"); cat.dur = weather === "nacht" ? lang(10, 18) : lang(5, 9); cat.zzT = 1; break;
      case "ruecken": zeige("ruecken", "lieg"); cat.dur = weather === "nacht" ? lang(10, 18) : lang(4, 8); cat.zzT = 1; break;
      case "kante": zeige("kante", "lieg"); cat.dur = weather === "nacht" ? lang(8, 14) : lang(4, 8); cat.zzT = 2.5; break;
      case "gaehnen": zeige("gaehnen", "sitz"); cat.dur = 1.8; if (Math.random() < .4) sag("Gähn.", 1200); break;
      case "putzen": zeige("putzen", "sitz"); cat.dur = lang(3, 5.5); break;
      case "rollen": zeige("ro8", "lieg", reihe("ro", 1, 7, .12).concat(reihe("ro", 6, 3, .12), reihe("ro", 4, 7, .12))); cat.dur = lang(2.5, 4); if (Math.random() < .5) sag(pick(SAGT.spiel), 1800); break;
      case "hoch": zeige("hoch", "sitz"); cat.dur = lang(2, 3.5); if (Math.random() < .6) setTimeout(() => cat.act === "hoch" && sag(pick(SAGT.fang[weather]), 1500), 500); break;
      case "fuatta": zeige("sitzen", "sitz"); cat.dur = 4.5; sag(pick(SAGT.fuatta), 3800); break;
      case "spazier": {   // kleiner Rundgang: hin und her, vielleicht auf eine andere Karte und wieder zurueck
        const q = [];
        for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) q.push(Math.random() < .3 ? "jump" : "walk");
        if (Math.random() < .5) q.push(pick(["putzen", "streng", "sphinx", "hoch"]));
        cat.queue = q; return start(q.shift());
      }
      case "jagd": {      // etwas Unsichtbares jagen: ducken, Po wackeln, lossprinten, hochschauen
        cat.queue = ["jagdlauf", "hoch", Math.random() < .6 ? "rollen" : "walk"];
        return start("lauern");
      }
      case "lauern": zeige("ducken", "steh"); cat.dur = lang(1, 1.9); if (Math.random() < .4) sag("Psst.", 1100); break;
      case "jagdlauf": {
        cat.act = "walk"; cat.dur = 99;
        const ziel = cat.x < (p.x1 + p.x2) / 2 ? rnd((p.x1 + p.x2) / 2, p.x2) : rnd(p.x1, (p.x1 + p.x2) / 2);
        if (!geheZu(ziel, 150)) return fertig();
        if (Math.random() < .5) sag(pick(SAGT.fang[weather]), 1300);
        break;
      }
      case "umschauen": zeige("sitzen", "sitz", [["kopf_m", .5], ["kopf_l", 1.1], ["kopf_m", .35], ["kopf_r", 1.1], ["kopf_m", .5]]); cat.dur = .6; break;
      case "beleidigt":
        zeige("hinten_m", "sitz", [["hinten_m", .9], ["hinten_l", .45], ["hinten_m", .35], ["hinten_r", .55], ["hinten_m", .35], ["hinten_l", .45], ["hinten_m", .6]]);
        cat.dur = .3; if (Math.random() < .5) setTimeout(() => cat.act === "beleidigt" && sag(pick(["Hmpf.", "Ich rede nicht mit dir.", "Pff."]), 1600), 600); break;
      case "strecken": zeige("st8", "steh", [["st1", .12], ["st2", .12], ["st3", .5], ["st4", .7], ["st5", .14], ["st6", .12], ["st7", .12]]); cat.dur = .5; break;
      case "seitsitz": zeige("seitsitz", "sitz"); cat.dur = lang(3, 5); break;
      case "doesen": zeige("liegen_lang", "lieg"); cat.dur = weather === "nacht" ? lang(10, 18) : lang(5, 9); cat.zzT = 2; break;
      case "zoomies": {   // Rennanfall: dreimal schnell hin und her, dann umfallen
        cat.queue = []; const n = 2 + Math.floor(Math.random() * 3);
        for (let k = 0; k < n; k++) cat.queue.push("renne");
        cat.queue.push(Math.random() < .5 ? "ruecken" : "rollen");
        sag(pick(["Wuuusch!", "Huiii!", "Platz da!"]), 1400); return start(cat.queue.shift());
      }
      case "renne": cat.act = "walk"; cat.dur = 99; if (!geheZu(cat.x < (p.x1 + p.x2) / 2 ? p.x2 - rnd(0, 20) : p.x1 + rnd(0, 20), 150)) fertig(); break;
      case "ausreissen": {  // rennt aus dem Bild und kommt woanders von der anderen Seite zurueck
        const rechts = Math.random() < .5, W = layer.clientWidth;
        cat.act = "walk"; cat.dur = 99; cat.ausreissen = rechts ? 1 : -1;
        geheZu(rechts ? W + 70 : -70, 130, true);
        if (Math.random() < .6) sag(pick(["Tschüss!", "Ich muss weg!", "Bin gleich wieder da."]), 1300);
        break;
      }
      case "starren": zeige("streng", "sitz"); cat.dur = lang(4, 7); setTimeout(() => cat.act === "starren" && sag(pick(["...", "Ich sehe dich.", "Hast du was gesagt?"]), 2200), 900); break;
      case "betteln": {     // geht zum Futterknopf und schaut ihn an
        const t = plats.findIndex(q => q.kind === "temp");
        if (cat.plat !== t) { cat.queue = ["betteln"]; return start("jump", { to: t }); }
        cat.queue = ["hoch", "streng"]; cat.act = "walk"; cat.dur = 99;
        geheZu(plats[t].x2, 60); setTimeout(() => sag(pick(["Der Napf ist leer.", "Nur so ein Hinweis.", "Futter wäre nett."]), 2200), 1800);
        break;
      }
      case "walk":
        cat.dur = 99;
        if (!geheZu(opts.x ?? rnd(p.x1, p.x2), opts.tempo)) return start("sit");
        break;
      case "jump": {
        const ziele = plats.map((q, i) => i).filter(i => i !== cat.plat && Math.abs(plats[i].y - p.y) < 430);
        const sicht = ziele.filter(i => visible(plats[i]));
        const i = opts.to ?? (sicht.length ? pick(sicht) : ziele.length ? pick(ziele) : null);
        if (i == null) return start("sit");
        const q = plats[i];
        springe(i, opts.x ?? rnd(q.x1, q.x2), Math.max(36, (p.y - q.y) * .5 + 40), .6 + Math.min(.45, Math.abs(q.y - p.y) / 900));
        cat.dur = 99; break;
      }
      case "knock": {
        const t = plats.findIndex(q => q.kind === "temp"), d = document.getElementById("deg");
        if (!d || t < 0) return start("sit");
        const r = d.getBoundingClientRect(), m = main.getBoundingClientRect(), dx = r.left - m.left - 14;
        cat.queue = ["ups"];
        if (cat.plat !== t) { springe(t, dx, 46, .7); cat.dur = 99; break; }
        cat.act = "walk"; cat.dur = 99; if (!geheZu(dx, 60)) { cat.queue = []; return start("ups"); }
        break;
      }
      case "ups": {
        const deg = document.getElementById("deg");
        if (deg) { deg.classList.remove("back"); deg.classList.add("fall"); setTimeout(() => { deg.classList.remove("fall"); deg.classList.add("back"); }, 5200); }
        zeige("sitzen", "sitz"); cat.dir = -1; cat.dur = 3; setTimeout(() => sag(pick(SAGT.ups)), 450); break;
      }
      case "feed": {
        const bettelt = cat.act === "fuatta";
        const t = plats.findIndex(q => q.kind === "temp"), pi = visible(p) ? cat.plat : t, q = plats[pi];
        let bx = pi === cat.plat ? cat.x + (cat.x < (q.x1 + q.x2) / 2 ? 80 : -80) : (q.x1 + q.x2) / 2 + 20;
        bx = Math.max(q.x1 + 14, Math.min(q.x2 - 14, bx));
        schuessel(pi, bx);
        if (Date.now() - lastFed < 30 * 60 * 1000) {
          setTimeout(schuesselWeg, 3200); setPose("streng"); cat.dir = bx >= cat.x ? 1 : -1; cat.dur = 3;
          sag(pick(["Ich bin noch satt.", "Später vielleicht.", "Nein, danke."])); return;
        }
        sag(bettelt ? "Endlich!" : pick(["Futter?!", "Oh!", "Mrrp!"]), 1600);
        cat.queue = ["eat"];
        const side = bx >= cat.x ? 1 : -1, ziel = bx - 36 * side;
        if (pi !== cat.plat) { springe(pi, ziel, 46, .7); cat.dur = 99; return; }
        cat.act = "walk"; cat.dur = 99; if (!geheZu(ziel, 70)) { cat.queue = []; start("eat"); }
        break;
      }
      case "eat":
        if (!cat.bowl) return start("sit");
        cat.dir = cat.bowl.x >= cat.x ? 1 : -1;
        cat.x = cat.bowl.x - cat.dir * 8; cat.bowl.el.classList.add("weg");      // das Foto bringt seinen eigenen Napf mit
        setPose("fressen"); cat.dur = 5.5; cat.heartT = .6; sag(pick(SAGT.essen), 1800); break;
      default: setPose("sitzen"); cat.dur = 3;
    }
  }
  function fertig() {
    if (cat.act === "eat") {
      schuesselWeg(); lastFed = Date.now(); try { localStorage.setItem("gigio-fed", String(lastFed)); } catch (e) {}
      cat.queue = ["putzen", "sphinx"]; setTimeout(() => sag(pick(SAGT.danke)), 300);
    }
    if (cat.act === "walk" && !cat.queue.length && Math.random() < .35) cat.queue.push(pick(["sit", "streng", "sphinx", "putzen", "hoch"]));
    start(cat.queue.length ? cat.queue.shift() : waehle());
  }

  /* ---------- Antippen ---------- */
  function antippen(e) {
    e.stopPropagation();
    if (["seite", "ruecken", "angelehnt", "kante", "doesen"].includes(cat.act)) { cat.queue = ["sit"]; start("gaehnen"); setTimeout(() => sag(pick(["Mrrr...", "Was ist?", "Ich habe geschlafen!"])), 300); return; }
    if (cat.hop) return;
    cat.tapHop = .45; cat.pop = 1; sag(pick(SAGT.tipp));
    if (Math.random() < .25 && !still) { cat.queue = []; setTimeout(() => start("rollen"), 900); }
  }
  box.addEventListener("click", antippen);
  box.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); antippen(e); } });
  document.addEventListener("click", e => {
    if (!an || e.target.closest(".box, .feedbtn, .catmode") || !plats.length || cat.hop || ["eat", "seite", "ruecken"].includes(cat.act)) return;
    const m = main.getBoundingClientRect(), x = e.clientX - m.left, y = e.clientY - m.top, p = plats[cat.plat];
    const neu = x >= cat.x ? 1 : -1; if (neu !== cat.dir && !cat.walk) { cat.dir = neu; cat.pop = 1; }
    if (still) return;
    if (Math.abs(y - p.y) < 60 && Math.random() < .7) { cat.queue = []; start("walk", { x }); }
    else if (Math.random() < .4) {
      const i = plats.findIndex(q => Math.abs(q.y - y) < 60 && x > q.x1 - 20 && x < q.x2 + 20);
      if (i >= 0 && i !== cat.plat) { cat.queue = []; start("jump", { to: i, x }); }
    } else if (Math.random() < .3) sag("Hm?", 1400);
  });

  /* ---------- Bild fuer Bild ---------- */
  let last = performance.now(), raf = 0, an = false;
  function frame(now) {
    if (!an) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    plats = platforms();
    if (!plats.length) { raf = requestAnimationFrame(frame); return; }
    if (!plats[cat.plat]) cat.plat = 0;
    const p = plats[cat.plat];
    cat.t += dt;
    let rot = 0, sx = 1, sy = 1;
    cat.hopY = 0;

    if (cat.hop) {
      const h = cat.hop, q = plats[h.to];
      if (!q) { cat.hop = null; cat.plat = 0; raf = requestAnimationFrame(frame); return; }
      h.t += dt;
      if (h.t < 0) { cat.x = h.x0; cat.y = h.y0; sy = .94 + h.t * .2; sx = 1.04; }        // Anlauf: kurz ducken
      else {
        const k = Math.min(1, h.t / h.dur);
        cat.x = lerp(h.x0, h.x1, k); cat.hopY = Math.sin(k * Math.PI) * h.h; cat.y = lerp(h.y0, q.y, k) - cat.hopY;
        setPose(k < .18 ? "sp3" : k < .42 ? "sp4" : k < .66 ? "sp5" : k < .88 ? "sp6" : "sp7", false);
        rot = k > .55 ? (k - .55) / .45 * 16 : 0;
        if (k >= 1) { cat.plat = h.to; cat.y = q.y; cat.hop = null; cat.hopY = 0; cat.land = still ? .01 : .16; setPose("sp8", false); }
      }
    } else {
      cat.y = p.y;
      if (cat.seq) seqSchritt(dt);
      if (cat.land > 0) { cat.land -= dt; sy -= .03; if (cat.land <= 0) { cat.land = 0; cat.pop = 1; fertig(); } }
      else if (cat.walk && cat.seq) { /* erst aufstehen */ }
      else if (cat.walk) {           // echter Schrittzyklus mit vier Fotos
        const d = cat.walk.to - cat.x, s = Math.min(Math.abs(d), cat.walk.v * dt);
        cat.x += Math.sign(d) * s; cat.dir = Math.sign(d) || cat.dir; cat.stepDist = (cat.stepDist || 0) + s;
        const renn = cat.walk.v > 85, schritt = renn ? 11 : 6.5;
        if (cat.stepDist > schritt) { cat.stepDist = 0; cat.step++; setPose(gangPose(), false); }
        sy += Math.abs(Math.sin((cat.step + cat.stepDist / schritt) * Math.PI / (renn ? 3 : 3.5))) * (renn ? .03 : .01);
        if (cat.ausreissen && (cat.x > layer.clientWidth + 60 || cat.x < -60)) {
          const vis = plats.map((q, i) => i).filter(i => visible(plats[i]) && i !== cat.plat), von = -cat.ausreissen;
          cat.plat = vis.length ? pick(vis) : cat.plat; const q = plats[cat.plat]; cat.y = q.y;
          cat.x = von < 0 ? -50 : layer.clientWidth + 50; cat.ausreissen = 0;
          cat.walk = { to: rnd(q.x1, q.x2), v: 90 }; cat.dir = cat.walk.to >= cat.x ? 1 : -1; cat.queue = [pick(["streng", "putzen", "sit"])];
        } else if (Math.abs(d) < 1) { cat.walk = null; fertig(); }
      } else {
        cat.x = Math.max(p.x1 - 6, Math.min(p.x2 + 6, cat.x));
        if (cat.t >= cat.dur) fertig();
      }
    }

    if (!visible(p) && !cat.hop) {
      cat.offscreen += dt;
      if (cat.offscreen > 5) {
        const vis = plats.map((q, i) => i).filter(i => visible(plats[i]));
        if (vis.length) { cat.plat = pick(vis); const q = plats[cat.plat]; cat.x = Math.random() < .5 ? q.x1 : q.x2; cat.y = q.y; cat.queue = []; cat.walk = null; start("walk", { x: (q.x1 + q.x2) / 2 }); }
        cat.offscreen = 0;
      }
    } else cat.offscreen = 0;

    // Atmen, Federn, Antippen, Gesten
    const schlaf = ["seite", "ruecken", "angelehnt", "kante", "doesen"].includes(cat.act);
    if (!still && !cat.walk && !cat.hop) { const b = Math.sin(now / (schlaf ? 1100 : 1500)) * (schlaf ? .02 : .01); sy += b; sx -= b * .4; }
    if (cat.pop > 0) { cat.pop = Math.max(0, cat.pop - dt * 4); const w = Math.sin(cat.pop * Math.PI) * .06; sx += w; sy -= w; }
    let tapY = 0;
    if (cat.tapHop > 0) { cat.tapHop -= dt; tapY = Math.sin((1 - cat.tapHop / .45) * Math.PI) * 10; }
    if (!still) {
            if (cat.act === "putzen") rot += Math.sin(now / 140) * 1.5;
      if (cat.act === "lauern" && !cat.seq) rot += Math.sin(now / 55) * 1.6;
      if (cat.act === "hoch") sy += Math.abs(Math.sin(now / 260)) * .02;
      if (cat.act === "eat") { rot += Math.sin(now / 150) * 1.5 * cat.dir; cat.heartT -= dt; if (cat.heartT < 0) { herz(); cat.heartT = 1.1; } }
    }
    // Blinzeln: kurz die Pose mit halb geschlossenen Augen
    if (cat.act === "sit" && !cat.seq) { cat.blinkT -= dt; if (cat.blinkT < 0) { setPose("streng", false); if (cat.blinkT < -.18) { setPose("sitzen", false); cat.blinkT = rnd(2.5, 6); } } }
    if (schlaf && !still) { cat.zzT -= dt; if (cat.zzT < 0) { zz(); cat.zzT = cat.act === "angelehnt" || cat.act === "kante" ? 3.2 : 2.2; } }

    const flip = cat.dir * SPR[cat.pose].face;
    root.style.transform = `translate(${cat.x.toFixed(1)}px,${(cat.y - tapY).toFixed(1)}px) scaleX(${flip})`;
    squash.style.transform = `rotate(${(rot * flip).toFixed(2)}deg) scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
    if (cat.bubble) {
      const hp = headPoint(), bw = cat.bubble.offsetWidth, W = layer.clientWidth;
      const x = Math.max(bw / 2 + 6, Math.min(W - bw / 2 - 6, hp[0])), y = Math.max(cat.bubble.offsetHeight + 4, hp[1] - tapY - 4);
      cat.bubble.style.left = x.toFixed(1) + "px"; cat.bubble.style.top = y.toFixed(1) + "px";
      cat.bubble.style.setProperty("--tail", Math.max(-bw / 2 + 14, Math.min(bw / 2 - 14, hp[0] - x)).toFixed(1) + "px");
    }
    if (cat.bowl) { const q = plats[cat.bowl.plat]; if (q) cat.bowl.el.style.transform = `translate(${(cat.bowl.x - 19).toFixed(1)}px,${(q.y - 15.5).toFixed(1)}px)`; }
    raf = requestAnimationFrame(frame);
  }

  function init() {
    plats = platforms(); if (!plats.length) return;
    const p = plats[0]; cat.plat = 0; cat.x = (p.x1 + p.x2) / 2 - 18; cat.y = p.y;
    const h = new Date().getHours();
    if (h >= 6 && h < 9 && Math.random() < .6) start("fuatta"); else start(weather === "nacht" ? pick(["ruecken", "seite", "kante"]) : "sit");
    raf = requestAnimationFrame(t => { last = t; frame(t); });
  }
  function anschalten() { if (an) return; an = true; layer.hidden = false; init(); }
  function aus() {
    an = false; cancelAnimationFrame(raf); layer.hidden = true; cat.hop = null; cat.walk = null; cat.seq = null; cat.land = 0; cat.queue = [];
    if (cat.bubble) { cat.bubble.remove(); cat.bubble = null; } if (cat.bowl) { cat.bowl.el.remove(); cat.bowl = null; }
    layer.querySelectorAll(".zz, .heart").forEach(e => e.remove());
    const deg = document.getElementById("deg"); if (deg) deg.classList.remove("fall", "back");
  }
  return { an: anschalten, aus, setWeather(w) { weather = w; }, do(n) { if (!an || cat.hop) return; if (n !== "feed") cat.queue = []; cat.walk = null; start(n); }, state: cat };
})();
