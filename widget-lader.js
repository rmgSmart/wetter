// GigioWetter Widget (Lader, Version 2)
// Dieses Skript einmal in Scriptable einfuegen. Es holt die aktuelle Widget-Version von GitHub,
// dadurch kommen Verbesserungen automatisch an. Neu geladen wird nur, wenn es eine neue Version gibt.
// Ohne Netz wird die zuletzt geladene Version verwendet.
// Widget-Parameter (lange auf das Widget druecken, "Widget bearbeiten"): modern (Vorgabe), klassisch oder gigio.
const BASIS = "https://rmgsmart.github.io/wetter/";
const fm = FileManager.local(), pfad = fm.joinPath(fm.documentsDirectory(), "gigiowetter-widget.js"), vpfad = fm.joinPath(fm.documentsDirectory(), "gigiowetter-widget-version.txt");
let code = null, v = null;
try { const r = new Request(BASIS + "version.json?t=" + Date.now()); r.timeoutInterval = 6; v = (await r.loadJSON()).v; } catch (e) {}
if (v && fm.fileExists(pfad) && fm.fileExists(vpfad) && fm.readString(vpfad) === v) code = fm.readString(pfad);
if (!code) {
  try {
    const r = new Request(BASIS + "widget.js?v=" + (v || Date.now())); r.timeoutInterval = 15;
    const neu = await r.loadString();
    if (r.response.statusCode === 200 && neu.includes("GIGIOWETTER")) { code = neu; fm.writeString(pfad, neu); if (v) fm.writeString(vpfad, v); }
  } catch (e) {}
}
if (!code && fm.fileExists(pfad)) code = fm.readString(pfad);
if (!code) throw new Error("GigioWetter Widget konnte nicht geladen werden. Bitte mit Internet erneut starten.");
globalThis.GIGIO_VERSION = v;          // damit das Widget die Version nicht noch einmal abfragen muss
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
await new AsyncFunction(code)();
