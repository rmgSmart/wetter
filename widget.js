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
  const s = SFSymbol.named(sf); s.applyFont(Font.systemFont(13));
  const i = z.addImage(s.image); i.imageSize = new Size(15, 15); i.tintColor = farbeSym || SOFT;
  z.addSpacer(5);
  text(z, wert, Font.mediumSystemFont(13.5), WEISS, { zeilen: 1, skala: .7 });
}
function tempBox(stack, t) {
  const b = stack.addStack(); b.size = new Size(52, 23); b.cornerRadius = 7; b.backgroundColor = tempFarbe(t); b.centerAlignContent();
  b.addSpacer(); text(b, grad(t), Font.semiboldRoundedSystemFont(17), farbe("#10202a")); b.addSpacer();
}


/* ---------- 24-Stunden-Grafik ---------- */
function verlauf(st, W) {
  const H = 66, X0 = 14, X1 = W - 14, schritt = (X1 - X0) / (st.length - 1);
  const yT0 = 16, yT1 = 35, basis = 51, regenH = 12;
  const dc = new DrawContext(); dc.size = new Size(W, H); dc.opaque = false; dc.respectScreenScale = true;
  const x = i => X0 + i * schritt;
  // Hintergrund und Nacht
  const bg = new Path(); bg.addRoundedRect(new Rect(0, 0, W, basis + 2), 12, 12); dc.addPath(bg); dc.setFillColor(farbe("#ffffff", .09)); dc.fillPath();
  st.forEach((s, i) => { if (s.nacht) { dc.setFillColor(farbe("#000000", .14)); dc.fillRect(new Rect(Math.max(0, x(i) - schritt / 2), 0, Math.min(schritt, W - x(i) + schritt / 2), basis + 2)); } });
  // Regen
  st.forEach((s, i) => {
    if (s.regen < .05) return;
    const h = Math.max(2, Math.min(1, s.regen / 3) * regenH);
    const p = new Path(); p.addRoundedRect(new Rect(x(i) - schritt * .35, basis - h, schritt * .7, h), 1.5, 1.5);
    dc.addPath(p); dc.setFillColor(farbe("#6cc4ff", .95)); dc.fillPath();
  });
  // Temperatur
  const t = st.map(s => s.temp), lo = Math.min(...t), hi = Math.max(...t), sp = Math.max(hi - lo, 2);
  const y = v => yT1 - (v - lo) / sp * (yT1 - yT0);
  for (let i = 0; i < st.length - 1; i++) {
    const p = new Path(); p.move(new Point(x(i), y(t[i]))); p.addLine(new Point(x(i + 1), y(t[i + 1])));
    dc.addPath(p); dc.setStrokeColor(tempFarbe((t[i] + t[i + 1]) / 2)); dc.setLineWidth(2.6); dc.strokePath();
  }
  // Beschriftung: jetzt, hoechster und tiefster Wert
  dc.setFont(Font.semiboldRoundedSystemFont(12));
  const marken = [[0, -1]], iMax = t.indexOf(hi), iMin = t.indexOf(lo);
  if (iMax > 2) marken.push([iMax, -1]);
  if (iMin > 2 && Math.abs(iMin - iMax) > 3) marken.push([iMin, 1]);
  marken.forEach(([i, lage]) => {
    const p = new Path(); p.addEllipse(new Rect(x(i) - 3, y(t[i]) - 3, 6, 6)); dc.addPath(p); dc.setFillColor(WEISS); dc.fillPath();
    const ty = lage < 0 ? y(t[i]) - 17 : y(t[i]) + 4, tx = Math.min(W - 34, Math.max(0, x(i) - 17));
    if (lage > 0) { const hg = new Path(); hg.addRoundedRect(new Rect(tx + 5, ty, 24, 15), 6, 6); dc.addPath(hg); dc.setFillColor(farbe("#0b1622", .55)); dc.fillPath(); }
    dc.setTextColor(WEISS); dc.setTextAlignedCenter();
    dc.drawTextInRect(grad(t[i]), new Rect(tx, ty, 34, 15));
  });
  // Uhrzeiten
  dc.setFont(Font.semiboldSystemFont(11)); dc.setTextColor(SOFT); dc.setTextAlignedCenter();
  st.forEach((s, i) => {
    const h = +s.zeit.slice(11, 13);
    if (i === 0 || (h % 3 === 0 && i * schritt >= 40 && i < st.length - 1)) dc.drawTextInRect(i === 0 ? "Jetzt" : String(h), new Rect(Math.max(0, x(i) - 18), basis + 3, 36, 14));
  });
  return dc.getImage();
}

/* ---------- Widget ---------- */
const w = new ListWidget();
w.url = BASIS;
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
w.setPadding(14, 16, 10, 16);

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
  info(rechts, "clock", alter < 1 ? "gerade" : alter < 60 ? `vor ${alter} min` : `Stand ${d.stand.slice(11, 16)}`, veraltet || alter > 45 ? farbe("#ffb340") : WEISS);

  w.addSpacer(3);
  // Den Satz zur Temperatur weglassen, die steht ohnehin in den Kaestchen. So passt der Rest in zwei Zeilen.
  const satz = (h.satz || "").split(/(?<=\.)\s+/).filter(x => !/^(Höchstwert|Die Temperatur|Bis Mitternacht)/i.test(x)).join(" ");
  text(w, satz, Font.systemFont(13), SOFT, { zeilen: 2, skala: .75 });
  w.addSpacer(7);

  // Die naechsten 24 Stunden als Grafik: Temperaturkurve, Regenbalken, Nacht dunkler
  const ab = Date.now() - 30 * 60000, st = (d.stunden || []).filter(x => new Date(x.zeit).getTime() >= ab).slice(0, 25);
  if (st.length > 3) {
    // Breite des grossen Widgets je nach iPhone, abzueglich Rand. Feste Groesse, damit iOS die Grafik nicht verkleinert.
    // Rahmen nimmt die ganze Breite, das Bild fuellt ihn aus (minimal breiter gezeichnet, damit kein Rand bleibt)
    let breit = 316; try { breit = Device.screenSize().width >= 428 ? 342 : 316; } catch (e) {}
    const gs = w.addStack(); gs.size = new Size(0, 66);
    gs.backgroundImage = verlauf(st, breit); gs.addSpacer();             // als Hintergrund, so wird die Grafik nicht verkleinert
    w.addSpacer(4);
  }

  // Heute, Morgen, Uebermorgen
  const TAGNAME = ["Heute", "Morgen"];
  d.woche.slice(0, 3).forEach((t, i) => {
    const strich = w.addStack(); strich.size = new Size(0, .7); strich.backgroundColor = LINIE; strich.addSpacer();
    w.addSpacer(4);
    const z = w.addStack(); z.layoutHorizontally(); z.centerAlignContent(); z.size = new Size(0, 48);
    const a = z.addStack(); a.layoutVertically(); a.size = new Size(86, 0);
    text(a, TAGNAME[i] || t.tag, Font.boldSystemFont(19), WEISS, { zeilen: 1, skala: .7 });
    text(a, `${t.datum.slice(8, 10)}.${t.datum.slice(5, 7)}.`, Font.mediumSystemFont(14), SOFT);
    const b = z.addStack(); b.layoutVertically(); b.size = new Size(54, 0); b.centerAlignContent();
    const bs = b.addStack(); bs.addSpacer(); symbol(bs, t.symbol, false, 27); bs.addSpacer();
    if (t.regen_prozent != null && t.regen_prozent >= 10) { const bp = b.addStack(); bp.addSpacer(); text(bp, t.regen_prozent + " %", Font.semiboldSystemFont(13), BLAU); bp.addSpacer(); }
    z.addSpacer(8);
    const c = z.addStack(); c.layoutVertically(); c.spacing = 2;
    tempBox(c, t.max); tempBox(c, t.min);
    z.addSpacer();
    const e = z.addStack(); e.layoutVertically(); e.spacing = 0;
    info(e, "wind", `Böen ${t.boe} km/h`, t.boe >= 60 ? farbe("#ff9f43") : t.boe >= 40 ? farbe("#ffd24d") : SOFT);
    info(e, "drop.fill", t.regen >= .1 ? `${de(t.regen)} mm` : "trocken", t.regen >= .1 ? BLAU : SOFT);
    info(e, "sun.max.fill", `${de(t.sonne_h)} h Sonne`, t.sonne_h >= 1 ? farbe("#ffd866") : SOFT);
    w.addSpacer(4);
  });
  w.addSpacer();
}

if (config.runsInWidget) Script.setWidget(w);
else await w.presentLarge();
Script.complete();
