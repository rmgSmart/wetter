"use strict";
/* Gigio, die Katze der Wetterseite. Wird nur gestartet, wenn der Gigio Mode eingeschaltet ist.
   Posen sind freigestellte Fotos in foto/. Je Pose: Groesse, Fusspunkt (ax, ay), Kopfpunkt (hx, hy) als Anteil, Blickrichtung (face). */
const Gigio = (() => {
  const SPR = {
    sitzen:    { w: 222, h: 256, ax: .5,  ay: 1,   hx: .45, hy: .06, face: 1 },
    streng:    { w: 221, h: 252, ax: .5,  ay: 1,   hx: .45, hy: .06, face: 1 },
    gehen1:    { w: 198, h: 157, ax: .55, ay: 1,   hx: .88, hy: .1,  face: 1 },
    gehen2:    { w: 190, h: 154, ax: .55, ay: 1,   hx: .88, hy: .1,  face: 1 },
    gehen3:    { w: 193, h: 153, ax: .55, ay: 1,   hx: .88, hy: .1,  face: 1 },
    gehen4:    { w: 197, h: 154, ax: .55, ay: 1,   hx: .88, hy: .1,  face: 1 },
    angelehnt: { w: 292, h: 208, ax: .45, ay: 1,   hx: .4,  hy: .04, face: 1 },
    ruecken:   { w: 404, h: 140, ax: .5,  ay: 1,   hx: .12, hy: .3,  face: -1 },
    seite:     { w: 526, h: 121, ax: .5,  ay: 1,   hx: .92, hy: .15, face: 1 },
    sphinx:    { w: 423, h: 184, ax: .5,  ay: 1,   hx: .74, hy: .04, face: 1 },
    kante:     { w: 293, h: 228, ax: .45, ay: .55, hx: .16, hy: .04, face: -1 },
    gaehnen:   { w: 325, h: 216, ax: .45, ay: 1,   hx: .12, hy: .04, face: -1 },
    putzen:    { w: 228, h: 245, ax: .5,  ay: 1,   hx: .32, hy: .06, face: -1 },
    rollen:    { w: 355, h: 199, ax: .5,  ay: 1,   hx: .12, hy: .5,  face: -1 },
    hoch:      { w: 196, h: 220, ax: .5,  ay: 1,   hx: .5,  hy: .04, face: 1 },
    fressen:   { w: 342, h: 172, ax: .55, ay: 1,   hx: .14, hy: .35, face: -1 },
  };
  const GEHEN = ["gehen1", "gehen2", "gehen3", "gehen4"];
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
                blinkT: 3, zzT: 0, heartT: 0, pop: 0, offscreen: 0, bubble: null, bowl: null, tapHop: 0, hopY: 0 };
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
  function setPose(n, federn = true) {
    if (cat.pose === n) return;
    cat.pose = n; const s = SPR[n];
    img.src = `foto/${n}.png`;
    box.style.width = s.w * K + "px"; box.style.height = s.h * K + "px";
    box.style.left = -s.ax * s.w * K + "px"; box.style.top = -s.ay * s.h * K + "px";
    if (federn) cat.pop = 1;
  }
  function headPoint() {
    const s = SPR[cat.pose], flip = cat.dir * s.face;
    return [cat.x + flip * (s.hx - s.ax) * s.w * K, cat.y - (s.ay - s.hy) * s.h * K - cat.hopY];
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
    fang: { regen: ["Tropfen!", "Was war das?"], sonne: ["Fliege!", "Sonnenstrahl!"], nacht: ["Motte!", "Was war das?"], wind: ["Blatt!", "Hab es fast!"] },
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
    regen: { sit: 2.5, streng: 1.4, walk: 3, jump: 1.6, talk: 1.3, angelehnt: 1.2, sphinx: 1.6, seite: .8, ruecken: .8, kante: 1.2, gaehnen: .8, putzen: 1.8, rollen: .7, hoch: 1.4, knock: .5, turn: 1.2 },
    sonne: { sit: 2, streng: 1.2, walk: 3, jump: 2, talk: 1.1, angelehnt: 1.4, sphinx: 1.8, seite: 1.6, ruecken: 1.8, kante: 1.4, gaehnen: .8, putzen: 1.2, rollen: 1.6, hoch: 1.4, knock: .6, turn: 1.2 },
    nacht: { sit: 1, streng: .8, walk: 1.2, jump: .5, talk: .4, angelehnt: 1.8, sphinx: 1.4, seite: 2.8, ruecken: 3, kante: 2.2, gaehnen: 1.4, putzen: .8, rollen: .4, hoch: .5, knock: .2, turn: .5 },
    wind:  { sit: 2.8, streng: 1.6, walk: 2, jump: 1, talk: 1.5, angelehnt: 1, sphinx: 2, seite: .8, ruecken: .6, kante: .8, gaehnen: .6, putzen: 1.4, rollen: .5, hoch: 1.6, knock: .5, turn: 1.6 },
  };
  function waehle() {
    const w = { ...GEWICHT[weather] };
    if (still) for (const k of ["walk", "jump", "knock", "rollen", "hoch"]) w[k] = 0;
    if (cat.act && w[cat.act]) w[cat.act] *= .25;
    let sum = 0; for (const k in w) sum += w[k];
    let r = Math.random() * sum; for (const k in w) { r -= w[k]; if (r <= 0) return k; }
    return "sit";
  }
  function geheZu(x, tempo = rnd(34, 46)) {
    const p = plats[cat.plat]; x = Math.max(p.x1, Math.min(p.x2, x));
    if (Math.abs(x - cat.x) < 8) return false;
    cat.walk = { to: x, v: tempo }; cat.dir = x >= cat.x ? 1 : -1; setPose(GEHEN[cat.step % 4], false); return true;
  }
  function springe(to, x1, h, dur) {
    const q = plats[to], p = plats[cat.plat]; x1 = Math.max(q.x1, Math.min(q.x2, x1));
    cat.walk = null; cat.hop = { x0: cat.x, y0: p.y, x1, to, h, dur, t: 0 }; cat.dir = x1 >= cat.x ? 1 : -1; setPose("gehen2");
  }
  const lang = (min, max) => rnd(min, max);
  function start(name, opts = {}) {
    const p = plats[cat.plat];
    if (cat.bowl && !["feed", "eat", "walk", "jump"].includes(name)) schuesselWeg();
    cat.act = name; cat.t = 0;
    switch (name) {
      case "sit": setPose("sitzen"); cat.dur = lang(3, 6); break;
      case "streng": setPose("streng"); cat.dur = lang(2.5, 5); if (Math.random() < .3) sag(pick(SAGT.streng), 1600); break;
      case "turn": setPose("sitzen"); cat.dir *= -1; cat.pop = 1; cat.dur = lang(1.2, 2.5); break;
      case "talk": setPose("sitzen"); cat.dur = 3.2; sag(pick(Math.random() < .6 ? SAGT[weather] : SAGT.allg)); break;
      case "angelehnt": setPose("angelehnt"); cat.dur = lang(6, 12); cat.zzT = 2; break;
      case "sphinx": setPose("sphinx"); cat.dur = lang(5, 10); break;
      case "seite": setPose("seite"); cat.dur = lang(8, 16); cat.zzT = 1; break;
      case "ruecken": setPose("ruecken"); cat.dur = lang(8, 16); cat.zzT = 1; break;
      case "kante": setPose("kante"); cat.dur = lang(6, 12); cat.zzT = 2.5; break;
      case "gaehnen": setPose("gaehnen"); cat.dur = 1.8; if (Math.random() < .4) sag("Gähn.", 1200); break;
      case "putzen": setPose("putzen"); cat.dur = lang(3, 5.5); break;
      case "rollen": setPose("rollen"); cat.dur = lang(2.5, 4); if (Math.random() < .5) sag(pick(SAGT.spiel), 1800); break;
      case "hoch": setPose("hoch"); cat.dur = lang(2, 3.5); if (Math.random() < .6) setTimeout(() => cat.act === "hoch" && sag(pick(SAGT.fang[weather]), 1500), 500); break;
      case "fuatta": setPose("sitzen"); cat.dur = 4.5; sag(pick(SAGT.fuatta), 3800); break;
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
        setPose("sitzen"); cat.dir = -1; cat.dur = 3; setTimeout(() => sag(pick(SAGT.ups)), 450); break;
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
    if (cat.act === "walk" && !cat.queue.length && Math.random() < .5) cat.queue.push(pick(["sit", "streng", "sphinx", "putzen"]));
    start(cat.queue.length ? cat.queue.shift() : waehle());
  }

  /* ---------- Antippen ---------- */
  function antippen(e) {
    e.stopPropagation();
    if (["seite", "ruecken", "angelehnt", "kante"].includes(cat.act)) { cat.queue = ["sit"]; start("gaehnen"); setTimeout(() => sag(pick(["Mrrr...", "Was ist?", "Ich habe geschlafen!"])), 300); return; }
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
      h.t += dt; const k = Math.min(1, h.t / h.dur);
      cat.x = lerp(h.x0, h.x1, k); cat.hopY = Math.sin(k * Math.PI) * h.h; cat.y = lerp(h.y0, q.y, k) - cat.hopY;
      rot = (k < .5 ? -12 : 10) * cat.dir; sx = 1.06; sy = .96;
      if (k >= 1) { cat.plat = h.to; cat.y = q.y; cat.hop = null; cat.hopY = 0; cat.pop = 1; fertig(); }
    } else {
      cat.y = p.y;
      if (cat.walk) {           // echter Schrittzyklus mit vier Fotos
        const d = cat.walk.to - cat.x, s = Math.min(Math.abs(d), cat.walk.v * dt);
        cat.x += Math.sign(d) * s; cat.dir = Math.sign(d) || cat.dir; cat.stepDist = (cat.stepDist || 0) + s;
        const schritt = 9 * (cat.walk.v > 60 ? 1.4 : 1);
        if (cat.stepDist > schritt) { cat.stepDist = 0; cat.step++; setPose(GEHEN[cat.step % 4], false); }
        sy += Math.abs(Math.sin(cat.step * Math.PI / 2 + cat.stepDist / schritt * Math.PI / 2)) * .012;
        if (Math.abs(d) < 1) { cat.walk = null; fertig(); }
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
    const schlaf = ["seite", "ruecken", "angelehnt", "kante"].includes(cat.act);
    if (!still && !cat.walk && !cat.hop) { const b = Math.sin(now / (schlaf ? 1100 : 1500)) * (schlaf ? .02 : .01); sy += b; sx -= b * .4; }
    if (cat.pop > 0) { cat.pop = Math.max(0, cat.pop - dt * 4); const w = Math.sin(cat.pop * Math.PI) * .06; sx += w; sy -= w; }
    let tapY = 0;
    if (cat.tapHop > 0) { cat.tapHop -= dt; tapY = Math.sin((1 - cat.tapHop / .45) * Math.PI) * 10; }
    if (!still) {
      if (cat.act === "rollen") rot += Math.sin(now / 180) * 7;
      if (cat.act === "putzen") rot += Math.sin(now / 140) * 1.5;
      if (cat.act === "hoch") sy += Math.abs(Math.sin(now / 260)) * .02;
      if (cat.act === "eat") { rot += Math.sin(now / 150) * 1.5 * cat.dir; cat.heartT -= dt; if (cat.heartT < 0) { herz(); cat.heartT = 1.1; } }
    }
    // Blinzeln: kurz die Pose mit halb geschlossenen Augen
    if (cat.act === "sit") { cat.blinkT -= dt; if (cat.blinkT < 0) { setPose("streng", false); if (cat.blinkT < -.18) { setPose("sitzen", false); cat.blinkT = rnd(2.5, 6); } } }
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
    an = false; cancelAnimationFrame(raf); layer.hidden = true; cat.hop = null; cat.walk = null; cat.queue = [];
    if (cat.bubble) { cat.bubble.remove(); cat.bubble = null; } if (cat.bowl) { cat.bowl.el.remove(); cat.bowl = null; }
    layer.querySelectorAll(".zz, .heart").forEach(e => e.remove());
    const deg = document.getElementById("deg"); if (deg) deg.classList.remove("fall", "back");
  }
  return { an: anschalten, aus, setWeather(w) { weather = w; }, do(n) { if (!an || cat.hop) return; if (n !== "feed") cat.queue = []; cat.walk = null; start(n); }, state: cat };
})();
