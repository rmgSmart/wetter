// GIGIOWETTER Widget fuer Scriptable (grosses Widget)
// Wird vom kleinen Lader-Skript in Scriptable geholt. Die Wetterdaten kommen aus derselben daten.js wie die Web-App,
// dadurch zeigt das Widget immer dieselben Werte wie GigioWetter.

const BASIS = "https://rmgsmart.github.io/wetter/";
const fm = FileManager.local(), dir = fm.documentsDirectory();
const datei = n => fm.joinPath(dir, "gigiowetter-" + n);

/* ---------- Browser-Ersatz, damit daten.js in Scriptable laeuft ---------- */
const SPEICHER = datei("speicher.json");
let speicher = {};
try { if (fm.fileExists(SPEICHER)) speicher = JSON.parse(fm.readString(SPEICHER)); } catch (e) {}
const localStorage = {
  getItem: k => Object.prototype.hasOwnProperty.call(speicher, k) ? speicher[k] : null,
  setItem: (k, v) => { speicher[k] = String(v); },
  removeItem: k => { delete speicher[k]; },
};
const sichern = () => { try { fm.writeString(SPEICHER, JSON.stringify(speicher)); } catch (e) {} };
const setTimeout = (f, ms) => Timer.schedule(Math.max(1, ms || 0), false, f);
const clearTimeout = t => { try { if (t && t.invalidate) t.invalidate(); } catch (e) {} };
class AbortController { constructor() { this.signal = { aborted: false }; } abort() { this.signal.aborted = true; } }
async function fetch(url) {
  const r = new Request(url);
  r.timeoutInterval = 20;
  r.headers = { "User-Agent": "GigioWetter-Widget (Scriptable)", "Accept": "application/json" };
  const text = await r.loadString();
  const status = r.response && r.response.statusCode ? r.response.statusCode : 200;
  return { ok: status >= 200 && status < 300, status, json: async () => JSON.parse(text), text: async () => text };
}
const navigator = { geolocation: { getCurrentPosition(ok, fehler) {
  try { Location.setAccuracyToThreeKilometers(); } catch (e) {}
  Location.current().then(p => ok({ coords: { latitude: p.latitude, longitude: p.longitude } }), () => fehler && fehler({ code: 2 }));
} } };
const window = { isSecureContext: true };
const warte = ms => new Promise(r => setTimeout(r, ms));

/* ---------- Daten holen ---------- */
async function holeCode(name) {
  const pfad = datei(name);
  try {
    const r = new Request(BASIS + name + "?t=" + Date.now()); r.timeoutInterval = 15;
    const code = await r.loadString();
    if (r.response.statusCode === 200 && code.includes("const Wetter")) { fm.writeString(pfad, code); return code; }
  } catch (e) {}
  return fm.fileExists(pfad) ? fm.readString(pfad) : null;
}

const nurUpdate = !config.runsInWidget && args.queryParameters && args.queryParameters.update === "1";
let d = null, veraltet = false;
try {
  const code = await holeCode("daten.js");
  if (code) {
    const Wetter = new Function("fetch", "localStorage", "navigator", "window", "setTimeout", "clearTimeout", "AbortController", code + "\nreturn Wetter;")
      (fetch, localStorage, navigator, window, setTimeout, clearTimeout, AbortController);
    d = await Promise.race([Wetter.laden(null), warte(45000).then(() => null)]);
    if (d && d.spaeter) await Promise.race([d.spaeter, warte(6000)]);       // Messwerte, falls schnell genug
    if (d) fm.writeString(datei("letzte.json"), JSON.stringify(d));
  }
} catch (e) { console.log("Laden fehlgeschlagen: " + e); }
if (!d) { try { d = JSON.parse(fm.readString(datei("letzte.json"))); veraltet = true; } catch (e) {} }
sichern();

/* ---------- Farben und Symbole ---------- */
const farbe = (hex, a = 1) => new Color(hex, a);
const WEISS = farbe("#ffffff"), SOFT = farbe("#ffffff", .72), LINIE = farbe("#ffffff", .18), BLAU = farbe("#8fd6ff");
const TFARBE = [[-10, [90, 130, 255]], [0, [80, 190, 255]], [8, [70, 215, 190]], [15, [120, 220, 110]], [21, [250, 215, 70]], [27, [255, 160, 60]], [34, [255, 90, 80]]];
function tempFarbe(t) {
  let c = TFARBE[TFARBE.length - 1][1];
  if (t <= TFARBE[0][0]) c = TFARBE[0][1];
  else for (let i = 1; i < TFARBE.length; i++) if (t <= TFARBE[i][0]) {
    const [t0, c0] = TFARBE[i - 1], [t1, c1] = TFARBE[i], k = (t - t0) / (t1 - t0);
    c = c0.map((x, j) => Math.round(x + (c1[j] - x) * k)); break;
  }
  return farbe("#" + c.map(x => x.toString(16).padStart(2, "0")).join(""));
}
const SYM = {
  klar: ["sun.max.fill", "#ffcc33", "moon.stars.fill", "#ffe38a"], heiter: ["cloud.sun.fill", "#ffd866", "cloud.moon.fill", "#ffe9a8"],
  wolkig: ["cloud.sun.fill", "#ffffff", "cloud.moon.fill", "#ffffff"], bedeckt: ["cloud.fill", "#e6ecf2"], nebel: ["cloud.fog.fill", "#d0d8e0"],
  regen_leicht: ["cloud.drizzle.fill", "#8fd6ff"], regen: ["cloud.rain.fill", "#7ccbff"], regen_stark: ["cloud.heavyrain.fill", "#6cc4ff"],
  schneeregen: ["cloud.sleet.fill", "#bfe3ff"], schnee: ["cloud.snow.fill", "#ffffff"], gewitter: ["cloud.bolt.rain.fill", "#ffd60a"],
};
function symbol(stack, name, nacht, groesse) {
  const s = SYM[name] || SYM.wolkig, n = nacht && s[2];
  const sf = SFSymbol.named(n ? s[2] : s[0]) || SFSymbol.named("cloud.fill");
  sf.applyFont(Font.systemFont(groesse));
  const img = stack.addImage(sf.image);
  img.imageSize = new Size(groesse * 1.2, groesse * 1.2);
  img.tintColor = farbe(n ? s[3] : s[1]);
  return img;
}
function himmel(sym, nacht) {
  const nass = /regen|gewitter/.test(sym);
  if (nacht) return nass ? ["#031a2b", "#145a6c"] : /klar|heiter/.test(sym) ? ["#050a2c", "#40307c"] : ["#0c1228", "#434a74"];
  if (sym === "gewitter") return ["#190f42", "#7a3f96"];
  if (nass) return ["#08384c", "#1f8590"];
  if (/schnee/.test(sym)) return ["#3f6c9c", "#8fb6dc"];
  if (sym === "klar" || sym === "heiter") return ["#0a66f0", "#58aef6"];
  if (sym === "wolkig") return ["#35548a", "#8098c2"];
  return ["#3d4c60", "#76879c"];
}
const de = x => String(x).replace(".", ",");
const grad = x => Math.round(x) + "°";

/* ---------- Bausteine ---------- */
function text(stack, s, font, color = WEISS, opt = {}) {
  const t = stack.addText(String(s));
  t.font = font; t.textColor = color;
  if (opt.zeilen) t.lineLimit = opt.zeilen;
  if (opt.skala) t.minimumScaleFactor = opt.skala;
  if (opt.rechts) t.rightAlignText();
  if (opt.mitte) t.centerAlignText();
  return t;
}
function info(stack, sf, wert, farbeSym) {
  const z = stack.addStack(); z.layoutHorizontally(); z.centerAlignContent();
  const s = SFSymbol.named(sf); s.applyFont(Font.systemFont(11));
  const i = z.addImage(s.image); i.imageSize = new Size(13, 13); i.tintColor = farbeSym || SOFT;
  z.addSpacer(5);
  text(z, wert, Font.mediumSystemFont(12.5), WEISS, { zeilen: 1, skala: .7 });
}
function tempBox(stack, t) {
  const b = stack.addStack(); b.size = new Size(50, 21); b.cornerRadius = 7; b.backgroundColor = tempFarbe(t); b.centerAlignContent();
  b.addSpacer(); text(b, grad(t), Font.semiboldRoundedSystemFont(15), farbe("#10202a")); b.addSpacer();
}

/* ---------- Widget ---------- */
const w = new ListWidget();
w.url = BASIS;
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
w.setPadding(14, 16, 12, 16);

if (!d) {
  w.backgroundColor = farbe("#16263a");
  text(w, "GigioWetter", Font.boldRoundedSystemFont(18));
  w.addSpacer(6);
  text(w, "Keine Wetterdaten erreichbar. Das Widget versucht es in 15 Minuten wieder.", Font.systemFont(14), SOFT);
} else {
  const j = d.jetzt, h = d.heute;
  const [oben, unten] = himmel(j.symbol, d.nacht);
  const g = new LinearGradient(); g.colors = [farbe(oben), farbe(unten)]; g.locations = [0, 1];
  g.startPoint = new Point(0, 0); g.endPoint = new Point(0, 1); w.backgroundGradient = g;

  // Kopf: Ort, Temperatur, Symbol, Sonne
  const kopf = w.addStack(); kopf.layoutHorizontally(); kopf.topAlignContent();
  const links = kopf.addStack(); links.layoutVertically();
  const ortZ = links.addStack(); ortZ.layoutHorizontally(); ortZ.centerAlignContent();
  const pin = SFSymbol.named("location.fill"); pin.applyFont(Font.systemFont(10));
  const pi = ortZ.addImage(pin.image); pi.imageSize = new Size(11, 11); pi.tintColor = SOFT; ortZ.addSpacer(4);
  text(ortZ, d.ort, Font.semiboldSystemFont(15), WEISS, { zeilen: 1, skala: .7 });
  const tempZ = links.addStack(); tempZ.layoutHorizontally(); tempZ.centerAlignContent();
  const mess = d.messung && Date.now() - new Date(d.messung.zeit).getTime() < 60 * 60000 ? d.messung : null;
  text(tempZ, grad(mess ? mess.temp : j.temp), Font.lightRoundedSystemFont(40));
  tempZ.addSpacer(8);
  const symS = tempZ.addStack(); symS.layoutVertically();
  symbol(symS, j.symbol, d.nacht, 24);
  text(symS, j.text, Font.mediumSystemFont(12), SOFT, { zeilen: 1, skala: .7 });
  kopf.addSpacer();
  const rechts = kopf.addStack(); rechts.layoutVertically(); rechts.spacing = 3;
  rechts.addSpacer(2);
  info(rechts, "sunrise.fill", h.sonnenaufgang, farbe("#ffd866"));
  info(rechts, "sunset.fill", h.sonnenuntergang, farbe("#ffb070"));
  const alter = Math.round((Date.now() - new Date(d.stand).getTime()) / 60000);
  const knopf = rechts.addStack(); knopf.layoutHorizontally(); knopf.centerAlignContent();
  knopf.backgroundColor = farbe("#ffffff", .16); knopf.cornerRadius = 9; knopf.setPadding(3, 7, 3, 8);
  knopf.url = `scriptable:///run/${encodeURIComponent(Script.name())}?update=1`;
  info(knopf, "arrow.clockwise", alter < 1 ? "gerade" : alter < 60 ? `vor ${alter} min` : `Stand ${d.stand.slice(11, 16)}`, veraltet || alter > 45 ? farbe("#ffb340") : WEISS);

  w.addSpacer(3);
  text(w, h.satz || "", Font.systemFont(12), SOFT, { zeilen: 2, skala: .8 });
  w.addSpacer(7);

  // Die naechsten 12 Stunden in 2-Stunden-Schritten
  const ab = Date.now() - 30 * 60000, st = (d.stunden || []).filter(x => new Date(x.zeit).getTime() >= ab).filter((x, i) => i % 2 === 0).slice(0, 6);
  if (st.length) {
    const leiste = w.addStack(); leiste.layoutHorizontally(); leiste.backgroundColor = farbe("#ffffff", .1); leiste.cornerRadius = 12; leiste.setPadding(4, 4, 4, 4);
    st.forEach((x, i) => {
      if (i) leiste.addSpacer();
      const sp = leiste.addStack(); sp.layoutVertically(); sp.size = new Size(44, 0); sp.centerAlignContent();
      const zeile = (f) => { const r = sp.addStack(); r.addSpacer(); f(r); r.addSpacer(); };
      zeile(r => text(r, i === 0 ? "Jetzt" : x.zeit.slice(11, 13) + " Uhr", Font.mediumSystemFont(11), SOFT, { zeilen: 1, skala: .8 }));
      zeile(r => symbol(r, x.symbol, x.nacht, 14));
      zeile(r => text(r, grad(x.temp), Font.semiboldRoundedSystemFont(14), tempFarbe(x.temp)));
    });
    w.addSpacer(5);
  }

  // Heute, Morgen, Uebermorgen
  const TAGNAME = ["Heute", "Morgen"];
  d.woche.slice(0, 3).forEach((t, i) => {
    const strich = w.addStack(); strich.size = new Size(0, .7); strich.backgroundColor = LINIE; strich.addSpacer();
    w.addSpacer(4);
    const z = w.addStack(); z.layoutHorizontally(); z.centerAlignContent(); z.size = new Size(0, 46);
    const a = z.addStack(); a.layoutVertically(); a.size = new Size(84, 0);
    text(a, TAGNAME[i] || t.tag, Font.boldSystemFont(17), WEISS, { zeilen: 1, skala: .75 });
    text(a, `${t.datum.slice(8, 10)}.${t.datum.slice(5, 7)}.`, Font.mediumSystemFont(13), SOFT);
    const b = z.addStack(); b.layoutVertically(); b.size = new Size(52, 0); b.centerAlignContent();
    const bs = b.addStack(); bs.addSpacer(); symbol(bs, t.symbol, false, 24); bs.addSpacer();
    if (t.regen_prozent != null && t.regen_prozent >= 10) { const bp = b.addStack(); bp.addSpacer(); text(bp, t.regen_prozent + " %", Font.semiboldSystemFont(12), BLAU); bp.addSpacer(); }
    z.addSpacer(8);
    const c = z.addStack(); c.layoutVertically(); c.spacing = 2;
    tempBox(c, t.max); tempBox(c, t.min);
    z.addSpacer();
    const e = z.addStack(); e.layoutVertically(); e.spacing = 1; e.size = new Size(104, 0);
    info(e, "wind", `Böen ${t.boe} km/h`, t.boe >= 60 ? farbe("#ff9f43") : t.boe >= 40 ? farbe("#ffd24d") : SOFT);
    info(e, "drop.fill", t.regen >= .1 ? `${de(t.regen)} mm` : "trocken", t.regen >= .1 ? BLAU : SOFT);
    info(e, "sun.max.fill", `${de(t.sonne_h)} h Sonne`, t.sonne_h >= 1 ? farbe("#ffd866") : SOFT);
    w.addSpacer(4);
  });
  w.addSpacer();
}

if (config.runsInWidget) Script.setWidget(w);
else if (nurUpdate) { Script.setWidget(w); App.close(); }
else await w.presentLarge();
Script.complete();
