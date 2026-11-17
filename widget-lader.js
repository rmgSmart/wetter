// GigioWetter Widget (Lader)
// Dieses Skript einmal in Scriptable einfuegen. Es holt die aktuelle Widget-Version von GitHub,
// dadurch kommen Verbesserungen automatisch an. Ohne Netz wird die zuletzt geladene Version verwendet.
const QUELLE = "https://rmgsmart.github.io/wetter/widget.js";
const fm = FileManager.local(), pfad = fm.joinPath(fm.documentsDirectory(), "gigiowetter-widget.js");
let code = null;
try {
  const r = new Request(QUELLE + "?t=" + Date.now()); r.timeoutInterval = 15;
  const neu = await r.loadString();
  if (r.response.statusCode === 200 && neu.includes("GIGIOWETTER")) { code = neu; fm.writeString(pfad, neu); }
} catch (e) {}
if (!code && fm.fileExists(pfad)) code = fm.readString(pfad);
if (!code) throw new Error("GigioWetter Widget konnte nicht geladen werden. Bitte mit Internet erneut starten.");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
await new AsyncFunction(code)();
