"use strict";
/* Gigio, die Katze der Wetterseite. Wird nur gestartet, wenn der Katzenmodus eingeschaltet ist. */
const Gigio = (() => {
  // Posen: Originalgroesse in px, Fusspunkt (ax) und Kopfpunkt (hx, hy) als Anteil, Blickrichtung im Bild
  const SPR = {
    sitzen:    { w: 344, h: 380, ax: .55, hx: .74, hy: .06, face: 1 },
    sitzen_zu: { w: 404, h: 380, ax: .58, hx: .62, hy: .1,  face: 1 },
    schlaf:    { w: 348, h: 240, ax: .52, hx: .26, hy: .2,  face: -1 },
    sprung:    { w: 551, h: 467, ax: .55, hx: .8,  hy: .05, face: 1 },
    spiel:     { w: 441, h: 296, ax: .5,  hx: .24, hy: .12, face: -1 },
  };
  const K = .205;                                    // px am Bildschirm je Originalpixel
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const main = document.querySelector("main"), layer = document.createElement("div"); layer.id = "gigio-layer"; main.appendChild(layer);
  let weather = "regen";
  let lastFed = 0; try { lastFed = +localStorage.getItem("gigio-fed") || 0; } catch (e) {}

  for (const n in SPR) { const i = new Image(); i.src = `sprites/${n}.png`; }   // vorladen

  const root = document.createElement("div"); root.id = "gigio";
  root.innerHTML = `<div class="squash"><div class="box" role="button" tabindex="0" aria-label="Gigio, antippen">
    <img alt="" draggable="false">
    <svg class="lids" viewBox="0 0 344 380" aria-hidden="true">
      <ellipse cx="228" cy="108" rx="24" ry="25" fill="#1b1b1d"/><path d="M206,111 Q228,124 250,111" fill="none" stroke="#ececec" stroke-width="3.4" stroke-linecap="round"/>
      <ellipse cx="283.5" cy="95.5" rx="18" ry="22" fill="#1b1b1d"/><path d="M267,99 Q284,109 300,99" fill="none" stroke="#ececec" stroke-width="3.2" stroke-linecap="round"/>
    </svg></div></div>`;
  layer.appendChild(root);
  layer.hidden = true;
  const squash = root.querySelector(".squash"), box = root.querySelector(".box"), img = root.querySelector("img"), lids = root.querySelector(".lids");

  const cat = { x: 0, y: 0, dir: 1, plat: 0, pose: "", act: "", t: 0, dur: 3, queue: [], hop: null, blinkT: 3, zzT: 0, heartT: 0,
                pop: 0, offscreen: 0, bubble: null, bowl: null, talkT: 0 };
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  const lerp = (a, b, k) => a + (b - a) * k;

  /* ---------- Welt ---------- */
  let plats = [];
  function platforms() {
    const m = main.getBoundingClientRect(), list = [];
    const t = document.getElementById("temp"); if (!t) return list; const tr = t.getBoundingClientRect();
    list.push({ kind: "temp", x1: tr.left - m.left + 30, x2: tr.right - m.left - 10, y: tr.top - m.top + tr.height * .14 });
    document.querySelectorAll("main .card").forEach(c => { const r = c.getBoundingClientRect(); list.push({ kind: "card", x1: r.left - m.left + 34, x2: r.right - m.left - 34, y: r.top - m.top + 1 }); });
    return list;
  }
  const visible = p => { const yy = p.y + main.getBoundingClientRect().top; return yy > 80 && yy < innerHeight - 20; };

  /* ---------- Darstellung ---------- */
  function setPose(n) {
    if (cat.pose === n) return;
    cat.pose = n; const s = SPR[n];
    img.src = `sprites/${n}.png`;
    box.style.width = s.w * K + "px"; box.style.height = s.h * K + "px";
    box.style.left = -s.ax * s.w * K + "px"; box.style.top = -s.h * K + "px";
    cat.pop = 1;                                      // kleiner Federeffekt beim Wechsel
  }
  function headPoint() {
    const s = SPR[cat.pose], flip = cat.dir * s.face;
    return [cat.x + flip * (s.hx - s.ax) * s.w * K, cat.y - (1 - s.hy) * s.h * K - (cat.hop ? cat.hopY : 0)];
  }

  /* ---------- Sprechblasen und Effekte ---------- */
  const SAGT = {
    allg: ["Miau.", "Mrrr?", "Was ist?", "Mir ist langweilig.", "Ich war das nicht.", "Streichelst du mich?", "Mrau."],
    regen: ["Regen. Igitt.", "Heute bleibe ich drinnen.", "Nasse Pfoten? Nein danke."],
    sonne: ["Sonne! Endlich.", "Perfekt zum Liegen.", "Schön warm."],
    nacht: ["Psst.", "Zeit zum Schlafen.", "Ich bin noch wach. Glaube ich."],
    wind: ["Viel zu windig.", "Mein Fell!", "Huiii."],
    tipp: ["Miau!", "He!", "Was willst du?", "Mrrp.", "Nicht stupsen.", "Na gut, ein bisschen."],
    ups: ["Ups.", "Das war ich nicht.", "Der ist von selbst gefallen."],
    fuatta: ["Wo ist mein Futter?", "Futter. Jetzt.", "Frühstück?"],
    essen: ["Mmmh!", "Nom nom.", "Lecker!"],
    danke: ["Danke!", "Das war gut.", "Mrrr. Satt."],
    spiel: ["Wolle!", "Meins!", "Hab dich!"],
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
  const zz = () => fx("zz", "z", 6 * cat.dir * SPR[cat.pose].face);
  const herz = () => fx("heart", `<svg viewBox="0 0 12 11" aria-hidden="true"><path d="M6 10.4 1.4 5.9A2.9 2.9 0 0 1 6 2.2a2.9 2.9 0 0 1 4.6 3.7z" fill="#ff7a93"/></svg>`, rnd(-8, 8));
  function schuessel(pi, x) {
    if (cat.bowl) cat.bowl.el.remove();
    const d = document.createElement("div"); d.className = "bowl";
    d.innerHTML = `<svg viewBox="0 0 38 16" aria-hidden="true"><ellipse cx="19" cy="4.2" rx="15" ry="3" fill="#7a4a2a"/><circle cx="13" cy="3.4" r="2" fill="#9a5f36"/><circle cx="18" cy="2.6" r="2.1" fill="#a8693c"/><circle cx="23.4" cy="3.4" r="2" fill="#8d5531"/><circle cx="15.6" cy="4.6" r="1.8" fill="#b37443"/><circle cx="21" cy="4.8" r="1.8" fill="#9a5f36"/><path d="M3.6 4.4h30.8l-2.6 9.4a2.4 2.4 0 0 1-2.3 1.7H8.5a2.4 2.4 0 0 1-2.3-1.7z" fill="#e4574a" stroke="#fff" stroke-width=".8"/><path d="M8 8.2h22" stroke="#fff" stroke-opacity=".45" stroke-width="1.2" stroke-linecap="round"/></svg>`;
    layer.appendChild(d); cat.bowl = { el: d, plat: pi, x };
  }
  function schuesselWeg() { const b = cat.bowl; if (!b) return; cat.bowl = null; b.el.classList.add("weg"); setTimeout(() => b.el.remove(), 550); }

  /* ---------- Verhalten ---------- */
  const GEWICHT = {
    regen: { sit: 4, doze: 2.5, sleep: 1.2, play: .8, bound: 2, jump: 1.6, talk: 1.4, knock: .5, turn: 1.2 },
    sonne: { sit: 3, doze: 1.6, sleep: 1.4, play: 2.2, bound: 2.6, jump: 2.2, talk: 1.2, knock: .6, turn: 1.2 },
    nacht: { sit: 1.2, doze: 2.5, sleep: 6, play: .3, bound: .6, jump: .5, talk: .5, knock: .2, turn: .6 },
    wind:  { sit: 4, doze: 2, sleep: 1.2, play: .6, bound: 1.2, jump: .8, talk: 1.6, knock: .5, turn: 1.6 },
  };
  function waehle() {
    const w = { ...GEWICHT[weather] };
    if (still) for (const k of ["bound", "jump", "knock", "play"]) w[k] = 0;
    let sum = 0; for (const k in w) sum += w[k];
    let r = Math.random() * sum; for (const k in w) { r -= w[k]; if (r <= 0) return k; }
    return "sit";
  }
  // Sprung von (x0,y0) nach (x1, Plattform to), Hoehe h
  function springe(to, x1, h, dur) {
    const q = plats[to], p = plats[cat.plat];
    x1 = Math.max(q.x1, Math.min(q.x2, x1));
    cat.hop = { x0: cat.x, y0: p.y, x1, to, h, dur, t: 0 };
    cat.dir = x1 >= cat.x ? 1 : -1; setPose("sprung");
  }
  function start(name, opts = {}) {
    const p = plats[cat.plat];
    if (cat.bowl && !["feed", "eat", "bound", "jump"].includes(name)) schuesselWeg();   // Napf weg, wenn er etwas anderes macht
    cat.act = name; cat.t = 0;
    switch (name) {
      case "sit": setPose("sitzen"); cat.dur = rnd(4, 8); break;
      case "turn": setPose("sitzen"); cat.dir *= -1; cat.pop = 1; cat.dur = rnd(2, 4); break;
      case "doze": setPose("sitzen_zu"); cat.dur = rnd(5, 10); cat.zzT = 1.5; break;
      case "sleep": setPose("schlaf"); cat.dur = rnd(10, 20); cat.zzT = 1; break;
      case "play": setPose("spiel"); cat.dur = rnd(3, 5); if (Math.random() < .5) sag(pick(SAGT.spiel), 1600); break;
      case "talk": setPose("sitzen"); cat.dur = 3.2; sag(pick(Math.random() < .6 ? SAGT[weather] : SAGT.allg)); break;
      case "fuatta": setPose("sitzen"); cat.dur = 4.5; sag(pick(SAGT.fuatta), 3800); break;
      case "bound": {   // ein paar kleine Kaetzchenspruenge auf derselben Flaeche
        cat.boundTo = opts.x ?? rnd(p.x1, p.x2); cat.dur = 99; nextBound(); break;
      }
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
        const t = plats.findIndex(q => q.kind === "temp"), d = document.getElementById("deg").getBoundingClientRect(), m = main.getBoundingClientRect();
        const dx = d.left - m.left + d.width * .2;
        cat.queue = ["ups"];
        springe(t, dx - 4, 46, .7); cat.dur = 99; break;
      }
      case "ups": {
        const deg = document.getElementById("deg");
        deg.classList.remove("back"); deg.classList.add("fall");
        setTimeout(() => { deg.classList.remove("fall"); deg.classList.add("back"); }, 5200);
        setPose("sitzen"); cat.dir = -1; cat.dur = 3; setTimeout(() => sag(pick(SAGT.ups)), 450); break;
      }
      case "feed": {
        const bettelt = cat.act === "fuatta";
        const t = plats.findIndex(q => q.kind === "temp"), pi = visible(p) ? cat.plat : t, q = plats[pi];
        let bx = pi === cat.plat ? cat.x + (cat.x < (q.x1 + q.x2) / 2 ? 70 : -70) : (q.x1 + q.x2) / 2 + 20;
        bx = Math.max(q.x1 + 14, Math.min(q.x2 - 14, bx));
        schuessel(pi, bx);
        if (Date.now() - lastFed < 30 * 60 * 1000) {
          setTimeout(schuesselWeg, 3200); setPose("sitzen"); cat.dir = bx >= cat.x ? 1 : -1; cat.dur = 3;
          sag(pick(["Ich bin noch satt.", "Später vielleicht.", "Nein, danke."])); return;
        }
        sag(bettelt ? "Endlich!" : pick(["Futter?!", "Oh!", "Mrrp!"]), 1600);
        cat.queue = ["eat"];
        const side = bx >= cat.x ? 1 : -1;
        if (pi !== cat.plat) { springe(pi, bx - 34, 46, .7); cat.dur = 99; return; }
        cat.act = "bound"; cat.boundTo = bx - 34 * side; cat.dur = 99; nextBound(); break;
      }
      case "eat":
        if (!cat.bowl) return start("sit");
        cat.dir = cat.bowl.x >= cat.x ? 1 : -1; setPose("sitzen_zu"); cat.dur = 5.5; cat.heartT = .6;
        sag(pick(SAGT.essen), 1800); break;
      default: setPose("sitzen"); cat.dur = 3;
    }
  }
  function nextBound() {
    const d = cat.boundTo - cat.x;
    if (Math.abs(d) < 6) { cat.hop = null; fertig(); return; }
    const step = Math.sign(d) * Math.min(Math.abs(d), rnd(34, 58));
    springe(cat.plat, cat.x + step, rnd(10, 16), .42);
  }
  function fertig() {
    if (cat.act === "eat") {
      schuesselWeg(); lastFed = Date.now(); try { localStorage.setItem("gigio-fed", String(lastFed)); } catch (e) {}
      cat.queue = ["sit", "doze"]; setTimeout(() => sag(pick(SAGT.danke)), 300);
    }
    const n = cat.queue.length ? cat.queue.shift() : waehle();
    start(n);
  }

  /* ---------- Antippen ---------- */
  function antippen(e) {
    e.stopPropagation();
    if (cat.act === "sleep" || cat.act === "doze") { cat.queue = ["sit"]; start("doze"); cat.dur = 1.6; setTimeout(() => sag(pick(["Mrrr...", "Was ist?", "Ich habe geschlafen!"])), 300); return; }
    if (cat.hop) return;
    cat.tapHop = .45; cat.pop = 1;
    sag(pick(SAGT.tipp));
    if (Math.random() < .25 && !still) { cat.queue = []; setTimeout(() => start("play"), 900); }
  }
  box.addEventListener("click", antippen);
  box.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); antippen(e); } });
  document.addEventListener("click", e => {
    if (!an || e.target.closest(".box, .feedbtn, .catmode") || !plats.length || cat.hop || ["sleep", "eat"].includes(cat.act)) return;
    const m = main.getBoundingClientRect(), x = e.clientX - m.left, y = e.clientY - m.top, p = plats[cat.plat];
    const neu = x >= cat.x ? 1 : -1; if (neu !== cat.dir) { cat.dir = neu; cat.pop = 1; }
    if (still) return;
    if (Math.abs(y - p.y) < 50 && Math.random() < .7) { cat.queue = []; start("bound", { x }); }
    else if (Math.random() < .4) {
      const i = plats.findIndex(q => Math.abs(q.y - y) < 60 && x > q.x1 - 20 && x < q.x2 + 20);
      if (i >= 0 && i !== cat.plat) { cat.queue = []; start("jump", { to: i, x }); }
    } else if (Math.random() < .3) sag("Hm?", 1400);
  });

  /* ---------- Bild fuer Bild ---------- */
  let last = performance.now();
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
      cat.x = lerp(h.x0, h.x1, k);
      cat.hopY = Math.sin(k * Math.PI) * h.h;
      cat.y = lerp(h.y0, q.y, k) - cat.hopY;
      rot = (k < .5 ? -10 : 8) * cat.dir;
      if (k >= 1) {
        cat.plat = h.to; cat.y = q.y; cat.hop = null; cat.hopY = 0; cat.pop = 1;
        if (cat.act === "bound") { setPose("sitzen"); if (Math.abs(cat.boundTo - cat.x) > 6) setTimeout(() => cat.act === "bound" && !cat.hop && nextBound(), 120); else fertig(); }
        else fertig();
      }
    } else {
      cat.y = p.y; cat.x = Math.max(p.x1 - 6, Math.min(p.x2 + 6, cat.x));
      if (cat.t >= cat.dur) fertig();
    }

    // ausserhalb des Bildes: nach einer Weile in einer sichtbaren Flaeche auftauchen
    if (!visible(p) && !cat.hop) {
      cat.offscreen += dt;
      if (cat.offscreen > 5) {
        const vis = plats.map((q, i) => i).filter(i => visible(plats[i]));
        if (vis.length) { cat.plat = pick(vis); const q = plats[cat.plat]; cat.x = rnd(q.x1, q.x2); cat.y = q.y; cat.queue = []; start("sit"); cat.pop = 1; }
        cat.offscreen = 0;
      }
    } else cat.offscreen = 0;

    // Atmen, Federn, Huepfer beim Antippen, Spielen, Fressen
    const breath = still ? 0 : Math.sin(now / (cat.pose === "schlaf" ? 900 : 1300)) * (cat.pose === "schlaf" ? .025 : .012);
    sy += breath; sx -= breath * .4;
    if (cat.pop > 0) { cat.pop = Math.max(0, cat.pop - dt * 4); const w = Math.sin(cat.pop * Math.PI) * .09; sx += w; sy -= w; }
    let tapY = 0;
    if (cat.tapHop > 0) { cat.tapHop -= dt; tapY = Math.sin((1 - cat.tapHop / .45) * Math.PI) * 10; }
    if (cat.act === "play" && !still) rot += Math.sin(now / 160) * 6;
    if (cat.act === "eat" && !still) { rot += Math.sin(now / 150) * 4 * cat.dir; cat.heartT -= dt; if (cat.heartT < 0) { herz(); cat.heartT = 1.1; } }

    // Blinzeln (nur in der Sitzpose mit offenen Augen)
    cat.blinkT -= dt; let zu = false;
    if (cat.pose === "sitzen" && !cat.hop) { if (cat.blinkT < 0) { zu = true; if (cat.blinkT < -.15) cat.blinkT = rnd(2.5, 6); } }
    lids.style.opacity = zu ? 1 : 0;

    if ((cat.act === "sleep" || cat.act === "doze") && !still) { cat.zzT -= dt; if (cat.zzT < 0) { zz(); cat.zzT = cat.act === "sleep" ? 2.2 : 3.2; } }

    const flip = cat.dir * SPR[cat.pose].face;
    root.style.transform = `translate(${cat.x.toFixed(1)}px,${(cat.y - tapY).toFixed(1)}px) scaleX(${flip})`;
    squash.style.transform = `rotate(${(rot * flip).toFixed(2)}deg) scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
    if (cat.bubble) { const hp = headPoint(); cat.bubble.style.left = hp[0].toFixed(1) + "px"; cat.bubble.style.top = (hp[1] - tapY - 4).toFixed(1) + "px"; }
    if (cat.bowl) { const q = plats[cat.bowl.plat]; cat.bowl.el.style.transform = `translate(${(cat.bowl.x - 19).toFixed(1)}px,${(q.y - 15.5).toFixed(1)}px)`; }
    raf = requestAnimationFrame(frame);
  }

  let raf = 0, an = false;
  function init() {
    plats = platforms(); const p = plats[0];
    cat.plat = 0; cat.x = (p.x1 + p.x2) / 2 - 18; cat.y = p.y;
    const h = new Date().getHours();
    if (h >= 6 && h < 9 && Math.random() < .6) start("fuatta"); else start(weather === "nacht" ? "sleep" : "sit");
    raf = requestAnimationFrame(t => { last = t; frame(t); });
  }
  function an_() { if (an) return; an = true; layer.hidden = false; init(); }
  function aus() {
    an = false; cancelAnimationFrame(raf); layer.hidden = true; cat.hop = null; cat.queue = [];
    if (cat.bubble) { cat.bubble.remove(); cat.bubble = null; } if (cat.bowl) { cat.bowl.el.remove(); cat.bowl = null; }
    layer.querySelectorAll(".zz, .heart").forEach(e => e.remove());
    const deg = document.getElementById("deg"); if (deg) deg.classList.remove("fall", "back");
  }
  return { an: an_, aus, setWeather(w) { weather = w; }, do(n) { if (!an || cat.hop) return; if (n !== "feed") cat.queue = []; start(n); }, state: cat };
})();

