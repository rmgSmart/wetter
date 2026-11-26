// GIGIOWETTER Widget fuer Scriptable: gross, mittel, klein und fuer den Sperrbildschirm
// Wird vom kleinen Lader-Skript in Scriptable geholt. Die Wetterdaten kommen aus derselben daten.js wie die Web-App,
// dadurch zeigt das Widget immer dieselben Werte wie GigioWetter.
// Widget-Parameter (lange auf das Widget druecken, "Widget bearbeiten"): modern (Vorgabe), klassisch oder dark.

const START = Date.now(), FRIST = START + 12000;   // Zeitbudget: iOS bricht zu lange Laeufe ab, dann bliebe das alte Bild stehen
const BASIS = "https://rmgsmart.github.io/wetter/";
const fm = FileManager.local(), dir = fm.documentsDirectory();
const datei = n => fm.joinPath(dir, "gigiowetter-" + n);
const FAMILIE = config.widgetFamily || "large";
const PARAM = String(args.widgetParameter || "").toLowerCase();
const LOOK = /klass/.test(PARAM) ? "klassisch" : /dark|dunkel|gigio|fell/.test(PARAM) ? "dark" : "modern";   // frueher "gigio" (Fell) ist jetzt Dark
const SPERR = FAMILIE.startsWith("accessory");

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
// Abbrechen muss wirklich wirken, sonst haelt eine haengende Anfrage das ganze Widget auf
class AbortController {
  constructor() { const s = { aborted: false, f: [] }; s.addEventListener = (n, f) => s.f.push(f); this.signal = s; }
  abort() { if (this.signal.aborted) return; this.signal.aborted = true; this.signal.f.forEach(f => { try { f(); } catch (e) {} }); }
}
const warte = ms => new Promise(r => setTimeout(r, ms));
const warteBis = t => warte(Math.max(1, t - Date.now())).then(() => null);
const PROTOKOLL = [];                 // fuer die Diagnose beim Start in der Scriptable-App
async function fetch(url, opt = {}) {
  const host = url.split("/")[2] + (url.includes("nwp-v2") ? (url.includes("sund") ? " nwp Zusatz" : " nwp Kern") : url.includes("ensemble") ? " ensemble" : url.includes("nowcast") ? " nowcast" : "");
  const t0 = Date.now();
  try {
    const a = await fetch0(url, opt);
    PROTOKOLL.push(`${host}: ${a.status}, ${Date.now() - t0} ms`); return a;
  }
  catch (e) { PROTOKOLL.push(`${host}: FEHLER ${e}, ${Date.now() - t0} ms`); throw e; }
}
async function fetch0(url, opt) {
  const r = new Request(url);
  r.timeoutInterval = Math.max(3, Math.min(20, (FRIST + 2000 - Date.now()) / 1000));
  // GeoSphere lehnt Anfragen mit eigener Kennung ab (503), deshalb dort wie Safari auftreten.
  // Nominatim verlangt dagegen eine eindeutige Kennung.
  r.headers = url.includes("nominatim")
    ? { "User-Agent": "GigioWetter-Widget (Scriptable)", "Accept": "application/json" }
    : { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "Accept": "application/json, text/plain, */*", "Accept-Language": "de-AT,de;q=0.9" };
  const ab = opt.signal ? new Promise((_, nein) => opt.signal.addEventListener("abort", () => nein(new Error("abgebrochen")))) : null;
  const text = await (ab ? Promise.race([r.loadString(), ab]) : r.loadString());
  const status = r.response && r.response.statusCode ? r.response.statusCode : 200;
  return { ok: status >= 200 && status < 300, status, json: async () => JSON.parse(text), text: async () => text };
}
const navigator = { geolocation: { getCurrentPosition(ok, fehler) {
  try { Location.setAccuracyToKilometer(); } catch (e) {}          // das Modell rechnet mit 1 km, genauer muss es nicht sein (schneller, schont den Akku)
  Location.current().then(p => { PROTOKOLL.push(`Standort: ${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`); ok({ coords: { latitude: p.latitude, longitude: p.longitude } }); }, e => { PROTOKOLL.push(`Standort: FEHLER ${e}`); fehler && fehler({ code: 2 }); });
} } };
const window = { isSecureContext: true };

/* ---------- Daten holen ---------- */
// daten.js nur neu laden, wenn es eine neue Version gibt (kleine version.json), sonst die gespeicherte nehmen
async function holeDaten() {
  const pfad = datei("daten.js"), vpfad = datei("daten-version.txt");
  let v = globalThis.GIGIO_VERSION || null;
  if (!v) { try { const r = new Request(BASIS + "version.json?t=" + Date.now()); r.timeoutInterval = 6; v = (await r.loadJSON()).v; } catch (e) {} }
  if (v && fm.fileExists(pfad) && fm.fileExists(vpfad) && fm.readString(vpfad) === v) return fm.readString(pfad);
  try {
    const r = new Request(BASIS + "daten.js?v=" + (v || Date.now())); r.timeoutInterval = 12;
    const code = await r.loadString();
    if (r.response.statusCode === 200 && code.includes("const Wetter")) { fm.writeString(pfad, code); if (v) fm.writeString(vpfad, v); return code; }
  } catch (e) {}
  return fm.fileExists(pfad) ? fm.readString(pfad) : null;
}

// Laufen mehrere Widgets kurz hintereinander (Home-Bildschirm und Sperrbildschirm), teilen sie sich die Daten der letzten 10 Minuten
const LETZTE = datei("letzte.json");
let d = null, veraltet = false, gespeichert = null;
try { if (fm.fileExists(LETZTE)) gespeichert = JSON.parse(fm.readString(LETZTE)); } catch (e) {}
if (gespeichert && gespeichert._geholt && Date.now() - gespeichert._geholt < 10 * 60000 && config.runsInWidget) d = gespeichert;
else {
  try {
    const code = await holeDaten();
    if (code) {
      const Wetter = new Function("fetch", "localStorage", "navigator", "window", "setTimeout", "clearTimeout", "AbortController", code + "\nreturn Wetter;")
        (fetch, localStorage, navigator, window, setTimeout, clearTimeout, AbortController);
      d = await Promise.race([Wetter.laden(null, { schnell: false, widget: true, frist: FRIST }), warteBis(FRIST + 3000)]);   // im Widget auf den echten Standort warten
      // Wien: genaue Vorhersage bis zur Frist abwarten, sonst bleibt die fuer 1010 Wien (oder die zuletzt geladene genaue)
      if (d && d.genau) { const g = await Promise.race([d.genau, warteBis(FRIST + 1000)]); if (g) d = g; else d.ersatz = d.ersatz || "wien"; }
      if (d && d.spaeter) await Promise.race([d.spaeter, warteBis(Math.min(FRIST + 2000, Date.now() + 2500))]);   // Messwerte, falls schnell genug
      if (d) { d._geholt = Date.now(); fm.writeString(LETZTE, JSON.stringify(d)); }
    }
  } catch (e) { console.log("Laden fehlgeschlagen: " + e); }
  if (!d && gespeichert) { d = gespeichert; veraltet = true; }
}
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
// Himmel je Wetter wie in der App: Klassisch (Verlauf) und Modern (Verlauf mit Farbwolken)
function skyFor(ch, nacht) {
  if (!nacht) return ch;
  if (["sonnig", "heiter", "hitze", "frost"].includes(ch)) return "nacht-klar";
  if (["regen", "gewitter", "sturm"].includes(ch)) return "nacht-regen";
  if (ch === "schnee") return "nacht-schnee";
  return "nacht-trueb";
}
const KLASSISCH = { sonnig: ["#0a3a8c", "#2a6cc0"], heiter: ["#143c74", "#3a6aa4"], bewoelkt: ["#27323f", "#4a5866"], regen: ["#18222d", "#33424f"],
  gewitter: ["#15122a", "#352f50"], sturm: ["#172632", "#37505d"], hitze: ["#6e2010", "#ad541c"], schnee: ["#2c3c52", "#5f7390"], nebel: ["#30363c", "#5a6168"],
  frost: ["#123a5c", "#3d6d94"], "nacht-klar": ["#050a1c", "#1a2550"], "nacht-trueb": ["#10151c", "#2a323d"], "nacht-regen": ["#0b1119", "#212c39"], "nacht-schnee": ["#131d30", "#3c4b63"] };
// Modern als Plakat wie in der App: Flaeche, Kreis, Linie (Farben je Wetter: Flaeche, Kreis, Muster, Akzent, Musterart)
const PLAKAT = { sonnig: ["#1d3fd1", "#ffc400", "#ff4a2a", "#ffc400", "voll"], heiter: ["#2b5fd9", "#ffd84d", "#f2efe6", "#ffd84d", "voll"],
  bewoelkt: ["#3b4250", "#c9ccd2", "#e9e4d8", "#e9e4d8", "voll"], regen: ["#12305e", "#5fa8ff", "#8fd0ff", "#8fd0ff", "streifen"],
  gewitter: ["#22123f", "#ffd400", "#ff3d7f", "#ffd400", "streifen"], sturm: ["#0f3b3d", "#e9e4d8", "#2fd1b0", "#2fd1b0", "schraeg"],
  hitze: ["#b8260f", "#ffd400", "#ff8a00", "#ffd400", "voll"], schnee: ["#2d4466", "#f4f1ea", "#ffffff", "#f4f1ea", "punkte"],
  nebel: ["#4a4f57", "#9aa0a8", "#c5c9cf", "#d9dce0", "baender"], frost: ["#0e4a7a", "#bfeeff", "#ffffff", "#bfeeff", "punkte"],
  "nacht-klar": ["#0b1030", "#f4efe0", "#3a4bd6", "#f4efe0", "voll"], "nacht-trueb": ["#15181f", "#5d6472", "#2b313c", "#c9ccd2", "baender"],
  "nacht-regen": ["#08162e", "#2f6fd0", "#5fa8ff", "#8fd0ff", "streifen"], "nacht-schnee": ["#141f38", "#e9eef7", "#ffffff", "#e9eef7", "punkte"] };
// Dark: fast schwarz, unten ein Hauch Wetterfarbe
const DARK = { sonnig: "#16140f", heiter: "#16140f", hitze: "#19100d", regen: "#0d1319", "nacht-regen": "#0d1319", gewitter: "#120f18", sturm: "#0d1414",
  schnee: "#10141a", "nacht-schnee": "#10141a", frost: "#10141a", "nacht-klar": "#0c0d16" };
const hex2 = n => Math.round(n).toString(16).padStart(2, "0");
const mischHex = (a, b, k) => "#" + [1, 3, 5].map(i => hex2(parseInt(a.substr(i, 2), 16) * (1 - k) + parseInt(b.substr(i, 2), 16) * k)).join("");
function plakatBild(sky, bw, bh) {
  const [f0, f1, , f3] = PLAKAT[sky] || PLAKAT.bewoelkt;
  const dc = new DrawContext(); dc.size = new Size(bw, bh); dc.opaque = true; dc.respectScreenScale = true;
  dc.setFillColor(farbe(f0)); dc.fillRect(new Rect(0, 0, bw, bh));
  const d0 = Math.max(bw, bh) * .78; dc.setFillColor(new Color(f1, .38)); dc.fillEllipse(new Rect(bw - d0 * .62, -d0 * .28, d0, d0));      // Kreis oben rechts
  // den Musterblock der App laesst das Widget weg: dahinter steht ueberall Schrift
  dc.setFillColor(new Color(f3, .45)); dc.fillRect(new Rect(0, bh * .58, bw, 3));                                                              // Linie quer
  dc.setFillColor(new Color("#08090c", .5)); dc.fillRect(new Rect(0, 0, bw, bh));                                                  // etwas abdunkeln, damit die Schrift lesbar bleibt
  return dc.getImage();
}
// Groesse der Widgets in Punkten je iPhone-Breite (fuer das Hintergrundbild und die Grafik)
function masse() {
  let b = 393; try { b = Device.screenSize().width; } catch (e) {}
  const breit = b >= 440 ? 372 : b >= 428 ? 364 : b >= 414 ? 360 : b >= 402 ? 344 : b >= 390 ? 338 : 329;
  const klein = b >= 440 ? 174 : b >= 428 ? 170 : b >= 414 ? 169 : b >= 402 ? 162 : b >= 390 ? 158 : 155;
  return { breit, hoch: Math.round(breit * 1.05), klein };
}
async function hintergrund(w) {
  const sky = skyFor(d.charakter, d.nacht), m = masse();
  const [bw, bh] = FAMILIE === "small" ? [m.klein, m.klein] : FAMILIE === "medium" ? [m.breit, m.klein] : [m.breit, m.hoch];
  if (LOOK === "modern") { w.backgroundImage = plakatBild(sky, bw, bh); return; }
  const [a, b] = LOOK === "dark" ? ["#0a0b0d", DARK[sky] || "#111316"] : KLASSISCH[sky] || KLASSISCH.bewoelkt;
  const g = new LinearGradient(); g.colors = [farbe(a), farbe(b)]; g.locations = [0, 1]; g.startPoint = new Point(0, 0); g.endPoint = new Point(0, 1); w.backgroundGradient = g;
}
// Farbton eines Tages wie in der App: Regen blau, Sonne gelb, Wolken grau
function tagesTon(t) {
  if (t.symbol === "gewitter") return ["#a078ff", .5];
  if (t.symbol === "schnee" && t.regen >= .3) return ["#5c7ab0", .46];
  const p = t.regen_prozent != null ? t.regen_prozent / 100 : 1, erwartet = t.regen * p;
  if (p >= .4 && erwartet >= .5) return ["#4092ff", .2 + .35 * Math.min(1, erwartet / 6)];
  const mi = x => +x.slice(0, 2) * 60 + +x.slice(3, 5), licht = Math.max(1, (mi(t.sonnenuntergang) - mi(t.sonnenaufgang)) / 60), anteil = Math.min(1, (t.sonne_h || 0) / licht);
  if (anteil >= .25) return ["#ffc43c", .12 + .36 * anteil];
  return t.symbol === "nebel" ? ["#b0b6bc", .3] : ["#788492", .3 - .2 * anteil / .25];
}
// Niederschlagsrisiko in Worten, wie in der App
const risikoWort = p => p == null ? "" : p >= 80 ? "sehr hoch" : p >= 50 ? "hoch" : p >= 20 ? "mittel" : "gering";
// Kurztext: kommt in den naechsten 3 Stunden etwas, minutengenau aus dem Nowcast, sonst der erste Satz der Zusammenfassung
function kurzText() {
  const n = d.nowcast;
  if (n && n.regnet && n.text) return n.text + (n.summe >= .1 ? `, ${de(n.summe)} mm in 3 Stunden` : "");
  return ((d.heute && d.heute.satz) || "").split(/(?<=\.)\s+/)[0].replace(/\.$/, "");
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
  const s = SFSymbol.named(sf); s.applyFont(Font.systemFont(13));
  const i = z.addImage(s.image); i.imageSize = new Size(15, 15); i.tintColor = farbeSym || SOFT;
  z.addSpacer(5);
  text(z, wert, Font.mediumRoundedSystemFont(13.5), WEISS, { zeilen: 1, skala: .7 });
}
function tempBox(stack, t) {
  const b = stack.addStack(); b.size = new Size(52, 22); b.cornerRadius = 7; b.backgroundColor = tempFarbe(t); b.centerAlignContent();
  b.addSpacer(); text(b, grad(t), Font.semiboldRoundedSystemFont(17), farbe("#10202a")); b.addSpacer();
}


/* ---------- 24-Stunden-Grafik wie in der App ---------- */
// Breite des grossen Widgets je nach iPhone (Punkte), davon geht der Rand ab
function inhaltBreite() {
  let b = 393; try { b = Device.screenSize().width; } catch (e) {}
  const widget = b >= 440 ? 372 : b >= 428 ? 364 : b >= 414 ? 360 : b >= 402 ? 344 : b >= 390 ? 338 : 329;
  return widget - 32;
}
const BOEFARBE = b => b >= 80 ? "#ff5e57" : b >= 60 ? "#ff9f43" : b >= 40 ? "#ffd24d" : null;
function kreis(dc, x, y, r, c) { const p = new Path(); p.addEllipse(new Rect(x - r, y - r, 2 * r, 2 * r)); dc.addPath(p); dc.setFillColor(c); dc.fillPath(); }
function linie(dc, x1, y1, x2, y2, c, bw) { const p = new Path(); p.move(new Point(x1, y1)); p.addLine(new Point(x2, y2)); dc.addPath(p); dc.setStrokeColor(c); dc.setLineWidth(bw); dc.strokePath(); }
function wolke(dc, x, y, s, c) {      // Wolke mit Mittelpunkt x, y und Breite etwa 2 s
  kreis(dc, x - .48 * s, y + .12 * s, .42 * s, c); kreis(dc, x + .05 * s, y - .18 * s, .55 * s, c); kreis(dc, x + .55 * s, y + .14 * s, .38 * s, c);
  const p = new Path(); p.addRoundedRect(new Rect(x - .9 * s, y + .05 * s, 1.83 * s, .48 * s), .24 * s, .24 * s); dc.addPath(p); dc.setFillColor(c); dc.fillPath();
}
function sonne(dc, x, y, r) {
  const c = farbe("#ffc933");
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; linie(dc, x + Math.cos(a) * (r + 2), y + Math.sin(a) * (r + 2), x + Math.cos(a) * (r + 4.2), y + Math.sin(a) * (r + 4.2), c, 1.5); }
  kreis(dc, x, y, r, c);
}
function mond(dc, x, y, r) {
  const p = new Path(); p.move(new Point(x + .2 * r, y - r));
  p.addCurve(new Point(x + .2 * r, y + r), new Point(x - 1.25 * r, y - r), new Point(x - 1.25 * r, y + r));
  p.addCurve(new Point(x + .2 * r, y - r), new Point(x - .45 * r, y + .7 * r), new Point(x - .45 * r, y - .7 * r));
  dc.addPath(p); dc.setFillColor(farbe("#ffe38a")); dc.fillPath();
}
function flocke(dc, x, y, r) {                // Schneeflocke mit sechs Armen
  [90, 30, 150].forEach(g => { const a = g * Math.PI / 180, dx = Math.cos(a) * r, dy = Math.sin(a) * r; linie(dc, x - dx, y - dy, x + dx, y + dy, WEISS, 1.3); });
}
// Symbol einmal in eigenes Bild zeichnen, dann beliebig gross einsetzen
const SYMBILD = {};
function symbolBild(sym, nacht) {
  const key = sym + (nacht ? "n" : "t");
  if (!SYMBILD[key]) { const d2 = new DrawContext(); d2.size = new Size(32, 32); d2.opaque = false; d2.respectScreenScale = true; zeichneSymbol(d2, sym, nacht, 16, 16); SYMBILD[key] = d2.getImage(); }
  return SYMBILD[key];
}
function zeichneSymbol(dc, sym, nacht, x, y) {      // Symbol etwa 26 Punkte breit, Mitte x, y
  const W1 = farbe("#f3f6fb"), W2 = farbe("#c6d0dc");
  const himmel = (dx, dy, r) => nacht ? mond(dc, x + dx, y + dy, r) : sonne(dc, x + dx, y + dy, r);
  const nass = sym.startsWith("regen") || sym === "schneeregen" || sym === "schnee" || sym === "gewitter" || sym === "nebel";
  if (sym === "klar") return himmel(0, 0, nacht ? 7.5 : 5.5);
  if (sym === "heiter") { himmel(4, -3, nacht ? 5.5 : 4); return wolke(dc, x - 2, y + 2.5, 7, W1); }
  if (sym === "wolkig") { himmel(5, -4, nacht ? 4.5 : 3.5); wolke(dc, x - 1, y + 2, 8, W1); return; }
  const dy = nass ? -3 : 0;
  wolke(dc, x + 3.5, y - 3.5 + dy, 6, W2);
  wolke(dc, x - 1, y + 1 + dy, 8, sym === "gewitter" ? farbe("#a99fd6") : W1);
  if (sym.startsWith("regen") || sym === "schneeregen") {
    const n = sym === "regen_leicht" ? 1 : sym === "regen_stark" ? 3 : 2, xs = [[0], [-3, 3], [-5, 0, 5]][n - 1];
    xs.forEach(o => linie(dc, x + o + 1, y + 6.5, x + o - .5, y + 10.5, farbe("#49b6ff"), 1.8));
    if (sym === "schneeregen") flocke(dc, x + 5, y + 9.5, 2.6);
  }
  if (sym === "schnee") { flocke(dc, x - 4, y + 9.5, 2.8); flocke(dc, x + 4, y + 9.5, 2.8); }
  if (sym === "nebel") { linie(dc, x - 7, y + 8, x + 7, y + 8, W2, 1.6); linie(dc, x - 5, y + 11, x + 5, y + 11, W2, 1.6); }
  if (sym === "gewitter") {
    const p = new Path(); [[1, 5], [-2.5, 9.5], [0, 9.5], [-1.5, 13.5], [3.5, 8], [1, 8], [2.5, 5]].forEach(([a, b], k) => k ? p.addLine(new Point(x + a, y + b)) : p.move(new Point(x + a, y + b)));
    p.closeSubpath(); dc.addPath(p); dc.setFillColor(farbe("#ffd60a")); dc.fillPath();
  }
}
function pfeil(dc, x, y, grad, c) {          // Pfeil in Windrichtung (wohin der Wind weht)
  const a = (grad + 180 - 90) * Math.PI / 180, l = 4.5, dx = Math.cos(a), dy = Math.sin(a);
  linie(dc, x - dx * l, y - dy * l, x + dx * l, y + dy * l, c, 1.5);
  linie(dc, x + dx * l, y + dy * l, x + dx * l - Math.cos(a - .6) * 3.5, y + dy * l - Math.sin(a - .6) * 3.5, c, 1.5);
  linie(dc, x + dx * l, y + dy * l, x + dx * l - Math.cos(a + .6) * 3.5, y + dy * l - Math.sin(a + .6) * 3.5, c, 1.5);
}
function verlauf(alle, W, H) {
  let st = alle;
  // Gleich breite Spalten alle 3 Stunden, symmetrisch ueber die ganze Breite; die Kurve nutzt dieselbe Einteilung
  const SP = 3, n = Math.min(8, Math.floor((st.length - 1) / SP) + 1), zelle = W / n, x = i => zelle * (i / SP + .5), schritt = zelle / SP;
  const yZeit = 1, ySym = 34, yTxt = 44, yT0 = 63, yT1 = 72, yBoe = H - 15;
  const dc = new DrawContext(); dc.size = new Size(W, H); dc.opaque = false; dc.respectScreenScale = true;
  // Glasflaeche mit Lichtkante oben, wie die Karten in der App
  dc.setFillColor(farbe("#ffffff", .08)); dc.fillRect(new Rect(0, 0, W, H));
  const rand = new Path(); rand.addRoundedRect(new Rect(.5, .5, W - 1, H - 1), 14, 14); dc.addPath(rand); dc.setStrokeColor(farbe("#ffffff", .16)); dc.setLineWidth(1); dc.strokePath();
  linie(dc, 18, .9, W - 18, .9, farbe("#ffffff", .38), 1.2);
  // Beschriftete Spalten: jetzt und dann alle 3 Stunden
  const zeig = []; for (let k = 0; k < n; k++) zeig.push(k * SP);
  st = st.slice(0, (n - 1) * SP + 1);
  // Regen ganz dezent unter der Kurve
  st.forEach((s, i) => { if (s.regen < .05) return; const h = Math.max(1.5, Math.min(1, s.regen / 3) * 9); dc.setFillColor(farbe("#6cc4ff", .5)); dc.fillRect(new Rect(x(i) - schritt * .35, yT1 + 4 - h, schritt * .7, h)); });
  // Temperaturkurve, weich
  const t = st.map(s => s.temp), lo = Math.min(...t), hi = Math.max(...t), sp = Math.max(hi - lo, 3), mitte = (lo + hi) / 2;
  const y = v => (yT0 + yT1) / 2 - (v - mitte) / sp * (yT1 - yT0);
  const P = st.map((s, i) => [x(i), y(t[i])]);
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const p = new Path(); p.move(new Point(p1[0], p1[1]));
    p.addCurve(new Point(p2[0], p2[1]), new Point(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6), new Point(p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6));
    dc.addPath(p); dc.setStrokeColor(tempFarbe((t[i] + t[i + 1]) / 2)); dc.setLineWidth(2.2); dc.strokePath();
  }
  // Spalten: Uhrzeit, Symbol, Temperatur, Boeen
  zeig.forEach(i => {
    const s = st[i], h = +s.zeit.slice(11, 13), cx = x(i);
    dc.setTextAlignedCenter();
    dc.setFont(Font.semiboldSystemFont(12.5)); dc.setTextColor(SOFT); dc.drawTextInRect(i === 0 ? "Jetzt" : String(h), new Rect(cx - 20, yZeit, 40, 16));
    const k = 1.15; dc.drawImageInRect(symbolBild(s.symbol, s.nacht), new Rect(cx - 16 * k, ySym - 4 - 16 * k, 32 * k, 32 * k));
    dc.setFont(Font.semiboldRoundedSystemFont(16)); dc.setTextColor(WEISS); dc.drawTextInRect(grad(s.temp), new Rect(cx - 20, yTxt, 40, 19));
    kreis(dc, cx, P[i][1], 2.2, tempFarbe(s.temp));
    const bf = BOEFARBE(s.boe), c = bf ? farbe(bf) : farbe("#ffffff", .62);
    pfeil(dc, cx - 8, yBoe + 7, s.richtung || 0, c);
    dc.setFont(bf ? Font.boldSystemFont(12.5) : Font.mediumSystemFont(12.5)); dc.setTextColor(c); dc.setTextAlignedLeft();
    dc.drawTextInRect(String(s.boe), new Rect(cx - 1, yBoe - 1, 26, 15));
  });
  return dc.getImage();
}

/* ---------- Widget ---------- */
const w = new ListWidget();
w.url = BASIS;
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
w.spacing = 0;

function ortZeile(stack, groesse) {
  const z = stack.addStack(); z.layoutHorizontally(); z.centerAlignContent();
  const pin = SFSymbol.named("location.fill"); pin.applyFont(Font.systemFont(groesse - 5));
  const pi = z.addImage(pin.image); pi.imageSize = new Size(groesse - 5, groesse - 5); pi.tintColor = SOFT; z.addSpacer(4);
  text(z, d.ort, Font.semiboldRoundedSystemFont(groesse), WEISS, { zeilen: 1, skala: .7 });
}
function standZeile(stack, groesse = 13.5) {
  const alter = Math.round((Date.now() - new Date(d.stand).getTime()) / 60000);
  if (d.ersatz) info(stack, "exclamationmark.triangle.fill", d.ersatz === "alt" ? `GeoSphere ${d.geoStand.slice(11, 16)}` : d.ersatz === "wien" ? "1010 Wien" : "Open-Meteo", farbe("#ffb340"));
  else info(stack, "clock", alter < 1 ? "gerade" : alter < 60 ? `vor ${alter} min` : `Stand ${d.stand.slice(11, 16)}`, veraltet || alter > 45 ? farbe("#ffb340") : WEISS);
}
const jetztTemp = () => { const m = d.messung && Date.now() - new Date(d.messung.zeit).getTime() < 60 * 60000 ? d.messung : null; return m ? m.temp : d.jetzt.temp; };
function grafik(stack) {
  const ab = Date.now() - 30 * 60000, st = (d.stunden || []).filter(x => new Date(x.zeit).getTime() >= ab).slice(0, 25);
  if (st.length <= 3) return false;
  const gs = stack.addStack(); gs.size = new Size(0, 92); gs.cornerRadius = 14;    // volle Breite, das Bild fuellt den Rahmen
  gs.backgroundImage = verlauf(st, inhaltBreite() + 8, 92); gs.addSpacer();
  return true;
}

function gross() {
  const j = d.jetzt, h = d.heute;
  w.setPadding(12, 16, 8, 16);
  // Kopf: Ort, Temperatur, Symbol, Sonne
  const kopf = w.addStack(); kopf.layoutHorizontally(); kopf.topAlignContent();
  const links = kopf.addStack(); links.layoutVertically();
  ortZeile(links, 16);
  const tempZ = links.addStack(); tempZ.layoutHorizontally(); tempZ.centerAlignContent();
  text(tempZ, grad(jetztTemp()), Font.lightRoundedSystemFont(46));
  tempZ.addSpacer(8);
  const symS = tempZ.addStack(); symS.layoutVertically();
  symbol(symS, j.symbol, d.nacht, 26);
  text(symS, j.text, Font.mediumSystemFont(13), SOFT, { zeilen: 1, skala: .7 });
  kopf.addSpacer();
  const rechts = kopf.addStack(); rechts.layoutVertically(); rechts.spacing = 3;
  rechts.addSpacer(2);
  info(rechts, "sunrise.fill", h.sonnenaufgang, farbe("#ffd866"));
  info(rechts, "sunset.fill", h.sonnenuntergang, farbe("#ffb070"));
  standZeile(rechts);

  w.addSpacer(3);
  // Zusammenfassung wie in der App (der Nowcast steckt schon drin), ohne den Satz zur Temperatur (steht in den Kaestchen)
  const teile = (h.satz || "").split(/(?<=\.)\s+/);
  const satz = teile.filter(x => !/^(Höchstwert|Die Temperatur|Bis Mitternacht kühlt|In der Nacht kühlt)/i.test(x)).join(" ");
  const satzS = w.addStack(); satzS.size = new Size(0, 34); satzS.layoutVertically();      // feste Hoehe: zwei Zeilen sind immer sicher
  text(satzS, satz, Font.systemFont(13.5), SOFT, { zeilen: 2, skala: .8 });
  w.addSpacer(5);

  if (grafik(w)) w.addSpacer(5);

  // Heute, Morgen, Uebermorgen als eigene Kapseln, getoent wie die Tage in der App; der Name kommt aus dem Datum, falls die Daten von gestern sind
  const ds = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`, jt = new Date();
  const TAGNAME = { [ds(jt)]: "Heute", [ds(new Date(jt.getFullYear(), jt.getMonth(), jt.getDate() + 1))]: "Morgen" };
  const WTAG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  d.woche.slice(0, 3).forEach((t, i) => {
    if (i) w.addSpacer(4);
    const [ton, ta] = tagesTon(t), g = new LinearGradient();
    g.colors = [farbe(ton, Math.min(.6, ta * .95)), farbe(ton, .06)]; g.locations = [0, 1]; g.startPoint = new Point(0, .5); g.endPoint = new Point(1, .5);
    const z = w.addStack(); z.layoutHorizontally(); z.centerAlignContent(); z.size = new Size(0, 47); z.cornerRadius = 14; z.backgroundGradient = g; z.setPadding(0, 10, 0, 8);
    const a = z.addStack(); a.layoutVertically(); a.size = new Size(78, 0);
    text(a, TAGNAME[t.datum] || WTAG[new Date(t.datum + "T12:00").getDay()], Font.boldRoundedSystemFont(18), WEISS, { zeilen: 1, skala: .7 });
    text(a, `${t.datum.slice(8, 10)}.${t.datum.slice(5, 7)}.`, Font.mediumSystemFont(13), SOFT);
    const b = z.addStack(); b.layoutVertically(); b.size = new Size(58, 0); b.centerAlignContent();
    const bs = b.addStack(); bs.addSpacer(); symbol(bs, t.symbol, false, 27); bs.addSpacer();
    if (t.regen >= .1 && t.regen_prozent != null) { const bp = b.addStack(); bp.addSpacer(); text(bp, risikoWort(t.regen_prozent), Font.semiboldSystemFont(12), BLAU, { zeilen: 1, skala: .7 }); bp.addSpacer(); }
    z.addSpacer(6);
    const c = z.addStack(); c.layoutVertically(); c.spacing = 2;
    tempBox(c, t.max); tempBox(c, t.min);
    z.addSpacer();
    const e = z.addStack(); e.layoutVertically(); e.spacing = 0;
    info(e, "wind", `Böen ${t.boe} km/h`, t.boe >= 60 ? farbe("#ff9f43") : t.boe >= 40 ? farbe("#ffd24d") : SOFT);
    info(e, "drop.fill", t.regen >= .1 ? `${de(t.regen)} mm` : "trocken", t.regen >= .1 ? BLAU : SOFT);
    info(e, "sun.max.fill", `${de(t.sonne_h)} h Sonne`, t.sonne_h >= 1 ? farbe("#ffd866") : SOFT);
  });
}

function mittel() {
  const j = d.jetzt, h = d.heute;
  w.setPadding(10, 14, 8, 14);
  // eine Kopfzeile: Temperatur, Symbol, Ort und Wetterlage, rechts Hoechst- und Tiefstwert
  const kopf = w.addStack(); kopf.layoutHorizontally(); kopf.centerAlignContent();
  text(kopf, grad(jetztTemp()), Font.lightRoundedSystemFont(34));
  kopf.addSpacer(6); symbol(kopf, j.symbol, d.nacht, 22); kopf.addSpacer(8);
  const mitte = kopf.addStack(); mitte.layoutVertically(); mitte.size = new Size(masse().breit - 212, 0);   // feste Breite, damit rechts Platz bleibt
  ortZeile(mitte, 13);
  text(mitte, kurzText() || j.text, Font.mediumSystemFont(12), SOFT, { zeilen: 1, skala: .75 });
  kopf.addSpacer(6);
  const rechts = kopf.addStack(); rechts.layoutVertically(); rechts.size = new Size(78, 0);
  const ht = rechts.addStack(); ht.addSpacer(); text(ht, `H ${grad(h.max)}  T ${grad(h.min)}`, Font.semiboldRoundedSystemFont(13), WEISS, { zeilen: 1 });
  const zs = rechts.addStack(); zs.addSpacer();
  const alter = Math.round((Date.now() - new Date(d.stand).getTime()) / 60000);
  text(zs, d.ersatz ? "Ersatzdaten" : alter < 1 ? "gerade" : alter < 60 ? `vor ${alter} min` : `Stand ${d.stand.slice(11, 16)}`, Font.mediumSystemFont(11.5), d.ersatz || veraltet || alter > 45 ? farbe("#ffb340") : SOFT, { zeilen: 1 });
  w.addSpacer(5);
  grafik(w);
}

function klein() {
  const j = d.jetzt, h = d.heute;
  w.setPadding(12, 14, 12, 12);
  ortZeile(w, 13);
  w.addSpacer(2);
  const tz = w.addStack(); tz.layoutHorizontally(); tz.centerAlignContent();
  text(tz, grad(jetztTemp()), Font.lightRoundedSystemFont(42)); tz.addSpacer(); symbol(tz, j.symbol, d.nacht, 26);
  text(w, j.text, Font.mediumSystemFont(13), SOFT, { zeilen: 1, skala: .7 });
  text(w, `H ${grad(h.max)}  T ${grad(h.min)}`, Font.semiboldRoundedSystemFont(13.5), WEISS, { zeilen: 1 });
  w.addSpacer();
  text(w, kurzText(), Font.mediumSystemFont(11.5), d.nowcast && d.nowcast.regnet ? BLAU : SOFT, { zeilen: 2, skala: .8 });
}

// Sperrbildschirm: iOS faerbt die Inhalte selbst ein
function sperrRund() {
  w.addAccessoryWidgetBackground = true;
  w.addSpacer();
  const s = w.addStack(); s.addSpacer(); const sf = SFSymbol.named((SYM[d.jetzt.symbol] || SYM.wolkig)[d.nacht && SYM[d.jetzt.symbol]?.[2] ? 2 : 0]) || SFSymbol.named("cloud.fill");
  sf.applyFont(Font.systemFont(15)); const im = s.addImage(sf.image); im.imageSize = new Size(17, 17); s.addSpacer();
  const t = w.addStack(); t.addSpacer(); text(t, grad(jetztTemp()), Font.semiboldRoundedSystemFont(18), WEISS); t.addSpacer();
  w.addSpacer();
}
function sperrRechteck() {
  const z = w.addStack(); z.layoutHorizontally(); z.centerAlignContent();
  const sf = SFSymbol.named((SYM[d.jetzt.symbol] || SYM.wolkig)[0]) || SFSymbol.named("cloud.fill");
  sf.applyFont(Font.systemFont(13)); const im = z.addImage(sf.image); im.imageSize = new Size(15, 15); z.addSpacer(4);
  text(z, grad(jetztTemp()), Font.semiboldRoundedSystemFont(15), WEISS); z.addSpacer(6);
  text(z, `H ${grad(d.heute.max)} T ${grad(d.heute.min)}`, Font.mediumSystemFont(12), WEISS, { zeilen: 1, skala: .8 });
  text(w, kurzText(), Font.mediumSystemFont(12.5), WEISS, { zeilen: 2, skala: .8 });
}
function sperrZeile() { text(w, `${grad(jetztTemp())} ${kurzText() || d.jetzt.text}`, Font.mediumSystemFont(12), WEISS, { zeilen: 1 }); }

if (!d) {
  if (SPERR) text(w, "GigioWetter: keine Daten", Font.mediumSystemFont(12), WEISS, { zeilen: 2 });
  else {
    w.backgroundColor = farbe("#16263a"); w.setPadding(14, 16, 14, 16);
    text(w, "GigioWetter", Font.boldRoundedSystemFont(18));
    w.addSpacer(6);
    text(w, "Keine Wetterdaten erreichbar. Das Widget versucht es in 15 Minuten wieder.", Font.systemFont(14), SOFT);
  }
} else if (FAMILIE === "accessoryCircular") sperrRund();
else if (FAMILIE === "accessoryRectangular") sperrRechteck();
else if (FAMILIE === "accessoryInline") sperrZeile();
else {
  await hintergrund(w);
  if (FAMILIE === "small") klein(); else if (FAMILIE === "medium") mittel(); else gross();
}

if (config.runsInWidget) Script.setWidget(w);
else {
  console.log(PROTOKOLL.join("\n") + `\nLauf ${((Date.now() - START) / 1000).toFixed(1)} s`);          // Diagnose steht im Scriptable-Protokoll
  await w.presentLarge();
}
Script.complete();
