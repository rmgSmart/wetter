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
const warte = ms => new Promise(r => setTimeout(r, ms));
const PROTOKOLL = [];                 // fuer die Diagnose beim Start in der Scriptable-App
async function fetch(url) {
  const host = url.split("/")[2] + (url.includes("nwp-v2") ? (url.includes("sund") ? " nwp Zusatz" : " nwp Kern") : url.includes("ensemble") ? " ensemble" : url.includes("nowcast") ? " nowcast" : "");
  const t0 = Date.now();
  try {
    const a = await fetch0(url);
    PROTOKOLL.push(`${host}: ${a.status}, ${Date.now() - t0} ms`); return a;
  }
  catch (e) { PROTOKOLL.push(`${host}: FEHLER ${e}, ${Date.now() - t0} ms`); throw e; }
}
async function fetch0(url) {
  const r = new Request(url);
  r.timeoutInterval = 20;
  // GeoSphere lehnt Anfragen mit eigener Kennung ab (503), deshalb dort wie Safari auftreten.
  // Nominatim verlangt dagegen eine eindeutige Kennung.
  r.headers = url.includes("nominatim")
    ? { "User-Agent": "GigioWetter-Widget (Scriptable)", "Accept": "application/json" }
    : { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "Accept": "application/json, text/plain, */*", "Accept-Language": "de-AT,de;q=0.9" };
  const text = await r.loadString();
  const status = r.response && r.response.statusCode ? r.response.statusCode : 200;
  return { ok: status >= 200 && status < 300, status, json: async () => JSON.parse(text), text: async () => text };
}
const navigator = { geolocation: { getCurrentPosition(ok, fehler) {
  try { Location.setAccuracyToHundredMeters(); } catch (e) {}
  Location.current().then(p => { PROTOKOLL.push(`Standort: ${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`); ok({ coords: { latitude: p.latitude, longitude: p.longitude } }); }, e => { PROTOKOLL.push(`Standort: FEHLER ${e}`); fehler && fehler({ code: 2 }); });
} } };
const window = { isSecureContext: true };

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

let d = null, veraltet = false;
try {
  const code = await holeCode("daten.js");
  if (code) {
    const Wetter = new Function("fetch", "localStorage", "navigator", "window", "setTimeout", "clearTimeout", "AbortController", code + "\nreturn Wetter;")
      (fetch, localStorage, navigator, window, setTimeout, clearTimeout, AbortController);
    d = await Promise.race([Wetter.laden(null, { schnell: false }), warte(45000).then(() => null)]);   // im Widget auf den echten Standort warten
    if (d && d.genau) { const g = await Promise.race([d.genau, warte(20000).then(() => null)]); if (g) d = g; else d.ersatz = "wien"; }   // Wien: genaue Vorhersage abwarten
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
// Farben wie das Aussehen "Klassisch" der App. Der untere Ton ist etwas dunkler als in der App,
// damit die weisse Schrift im Widget ueberall gut lesbar bleibt.
function himmel(sym, nacht) {
  const nass = /regen|gewitter/.test(sym);
  let p;
  if (nacht) p = sym === "schnee" ? ["#18243a", "#4d5d76"] : nass ? ["#0e151f", "#283545"] : /klar|heiter/.test(sym) ? ["#070d24", "#24315f"] : ["#161c25", "#353e4a"];
  else if (sym === "gewitter") p = ["#231f3a", "#4a4763"];
  else if (nass) p = ["#2f3d4c", "#586b7c"];
  else if (/schnee/.test(sym)) p = ["#4d5d76", "#7a8899"];
  else if (sym === "klar") p = ["#1f6fc9", "#79b8ee"];
  else if (sym === "heiter") p = ["#3878bd", "#8db6dc"];
  else p = ["#55636f", "#8a959e"];
  const mix = (a, b, k) => "#" + [1, 3, 5].map(i => Math.round(parseInt(a.substr(i, 2), 16) * (1 - k) + parseInt(b.substr(i, 2), 16) * k).toString(16).padStart(2, "0")).join("");
  return [p[0], mix(p[0], p[1], .5)];
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
  text(z, wert, Font.mediumSystemFont(13.5), WEISS, { zeilen: 1, skala: .7 });
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
    if (sym === "schneeregen") kreis(dc, x + 5, y + 9, 1.3, WEISS);
  }
  if (sym === "schnee") [-4, 0, 4].forEach((o, k) => kreis(dc, x + o, y + (k % 2 ? 10 : 8), 1.4, WEISS));
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
function stundenTon(s) {
  if (s.symbol === "gewitter") return ["150,110,255", .3];
  if (s.symbol === "schnee" && s.regen >= .1) return ["230,240,255", .3];
  if (s.regen >= .1) { const k = Math.min(1, s.regen / 3); return ["64,146,255", .18 + .37 * k]; }
  if (s.nacht) return s.wolken < 50 ? ["40,60,140", .35] : ["120,132,146", .22];
  if (s.symbol === "nebel") return ["200,205,210", .25];
  const sonne = s.sonne_min != null ? s.sonne_min / 60 : 1 - s.wolken / 100;
  if (sonne >= .25 || s.wolken < 40) return ["255,196,60", .14 + .3 * Math.max(sonne, 1 - s.wolken / 100)];
  return ["120,132,146", .14 + .16 * s.wolken / 100];
}
function verlauf(alle, W, H) {
  let st = alle;
  // Gleich breite Spalten alle 3 Stunden, symmetrisch ueber die ganze Breite; die Kurve nutzt dieselbe Einteilung
  const SP = 3, n = Math.min(8, Math.floor((st.length - 1) / SP) + 1), zelle = W / n, x = i => zelle * (i / SP + .5), schritt = zelle / SP;
  const yZeit = 1, ySym = 34, yTxt = 44, yT0 = 63, yT1 = 72, yBoe = H - 15;
  const dc = new DrawContext(); dc.size = new Size(W, H); dc.opaque = false; dc.respectScreenScale = true;
  // ruhiger Hintergrund
  dc.setFillColor(farbe("#ffffff", .1)); dc.fillRect(new Rect(0, 0, W, H));
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
w.setPadding(12, 16, 8, 16);
w.spacing = 0;

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
  text(ortZ, d.ort, Font.semiboldSystemFont(16), WEISS, { zeilen: 1, skala: .7 });
  const tempZ = links.addStack(); tempZ.layoutHorizontally(); tempZ.centerAlignContent();
  const mess = d.messung && Date.now() - new Date(d.messung.zeit).getTime() < 60 * 60000 ? d.messung : null;
  text(tempZ, grad(mess ? mess.temp : j.temp), Font.lightRoundedSystemFont(46));
  tempZ.addSpacer(8);
  const symS = tempZ.addStack(); symS.layoutVertically();
  symbol(symS, j.symbol, d.nacht, 26);
  text(symS, j.text, Font.mediumSystemFont(13), SOFT, { zeilen: 1, skala: .7 });
  kopf.addSpacer();
  const rechts = kopf.addStack(); rechts.layoutVertically(); rechts.spacing = 3;
  rechts.addSpacer(2);
  info(rechts, "sunrise.fill", h.sonnenaufgang, farbe("#ffd866"));
  info(rechts, "sunset.fill", h.sonnenuntergang, farbe("#ffb070"));
  const alter = Math.round((Date.now() - new Date(d.stand).getTime()) / 60000);
  if (d.ersatz) info(rechts, "exclamationmark.triangle.fill", d.ersatz === "alt" ? `GeoSphere ${d.geoStand.slice(11, 16)}` : d.ersatz === "wien" ? "1010 Wien" : "Open-Meteo", farbe("#ffb340"));
  else info(rechts, "clock", alter < 1 ? "gerade" : alter < 60 ? `vor ${alter} min` : `Stand ${d.stand.slice(11, 16)}`, veraltet || alter > 45 ? farbe("#ffb340") : WEISS);

  w.addSpacer(3);
  // Den Satz zur Temperatur weglassen, die steht ohnehin in den Kaestchen. So passt der Rest in zwei Zeilen.
  const satz = (h.satz || "").split(/(?<=\.)\s+/).filter(x => !/^(Höchstwert|Die Temperatur|Bis Mitternacht)/i.test(x)).join(" ");
  const satzS = w.addStack(); satzS.size = new Size(0, 34); satzS.layoutVertically();      // feste Hoehe: zwei Zeilen sind immer sicher
  text(satzS, satz, Font.systemFont(13.5), SOFT, { zeilen: 2, skala: .8 });
  w.addSpacer(5);

  // Die naechsten 24 Stunden als Grafik wie in der App
  const ab = Date.now() - 30 * 60000, st = (d.stunden || []).filter(x => new Date(x.zeit).getTime() >= ab).slice(0, 25);
  if (st.length > 3) {
    const breit = inhaltBreite() + 8, hoch = 92;
    const gs = w.addStack(); gs.size = new Size(0, hoch); gs.cornerRadius = 14;    // volle Breite, das Bild fuellt den Rahmen
    gs.backgroundImage = verlauf(st, breit, hoch); gs.addSpacer();
    w.addSpacer(3);
  }

  // Heute, Morgen, Uebermorgen
  const TAGNAME = ["Heute", "Morgen"];
  d.woche.slice(0, 3).forEach((t, i) => {
    const strich = w.addStack(); strich.size = new Size(0, .7); strich.backgroundColor = LINIE; strich.addSpacer();
    w.addSpacer(3);
    const z = w.addStack(); z.layoutHorizontally(); z.centerAlignContent(); z.size = new Size(0, 47);
    const a = z.addStack(); a.layoutVertically(); a.size = new Size(86, 0);
    text(a, TAGNAME[i] || t.tag, Font.boldSystemFont(19), WEISS, { zeilen: 1, skala: .7 });
    text(a, `${t.datum.slice(8, 10)}.${t.datum.slice(5, 7)}.`, Font.mediumSystemFont(14), SOFT);
    const b = z.addStack(); b.layoutVertically(); b.size = new Size(54, 0); b.centerAlignContent();
    const bs = b.addStack(); bs.addSpacer(); symbol(bs, t.symbol, false, 29); bs.addSpacer();
    if (t.regen_prozent != null && t.regen_prozent >= 10) { const bp = b.addStack(); bp.addSpacer(); text(bp, t.regen_prozent + " %", Font.semiboldSystemFont(13), BLAU); bp.addSpacer(); }
    z.addSpacer(8);
    const c = z.addStack(); c.layoutVertically(); c.spacing = 2;
    tempBox(c, t.max); tempBox(c, t.min);
    z.addSpacer();
    const e = z.addStack(); e.layoutVertically(); e.spacing = 0;
    info(e, "wind", `Böen ${t.boe} km/h`, t.boe >= 60 ? farbe("#ff9f43") : t.boe >= 40 ? farbe("#ffd24d") : SOFT);
    info(e, "drop.fill", t.regen >= .1 ? `${de(t.regen)} mm` : "trocken", t.regen >= .1 ? BLAU : SOFT);
    info(e, "sun.max.fill", `${de(t.sonne_h)} h Sonne`, t.sonne_h >= 1 ? farbe("#ffd866") : SOFT);
    w.addSpacer(3);
  });
}

if (config.runsInWidget) Script.setWidget(w);
else {
  console.log(PROTOKOLL.join("\n"));          // Diagnose steht im Scriptable-Protokoll
  await w.presentLarge();
}
Script.complete();
