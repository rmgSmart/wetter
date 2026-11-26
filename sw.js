// GigioWetter: haelt die App im Zwischenspeicher, damit sie sofort und auch ohne Netz startet.
// Die Seite kommt sofort aus dem Speicher und wird im Hintergrund aufgefrischt. Ob es eine neue Version gibt,
// prueft die Seite selbst ueber version.json und laedt dann mit ?v= neu: diese Anfrage geht immer zuerst ins Netz.
// Skripte mit ?v= aendern sich nie, sie kommen direkt aus dem Speicher. Katzenbilder ebenso.
const C = "gigiowetter-3";
const BASIS = new URL("./", self.location).href;
self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(c => c.addAll(["./", "manifest.webmanifest", "icon-180.png"]).catch(() => {})));
});
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== C).map(n => caches.delete(n)))).then(() => self.clients.claim())));

const merke = (c, key, r) => { if (r && r.ok) c.put(key, r.clone()); return r; };
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.endsWith("version.json") || u.pathname.endsWith("sw.js")) return;
  const seite = e.request.mode === "navigate" || u.href.split("?")[0] === BASIS || u.pathname.endsWith("/index.html");
  let fertig; e.waitUntil(new Promise(r => { fertig = r; }));               // Auffrischen im Hintergrund darf zu Ende laufen
  if (seite) {
    e.respondWith(caches.open(C).then(async c => {
      const alt = await c.match(BASIS);
      const netz = fetch(u.href, { cache: "no-cache", credentials: "same-origin" }).then(r => merke(c, BASIS, r));   // Navigationsanfragen lassen sich nicht mit Optionen weitergeben
      fertig(netz.catch(() => {}));
      if (u.searchParams.has("v") || !alt) return netz.catch(() => alt);     // neue Version angefordert: frisch aus dem Netz
      return alt;                                                             // sonst sofort aus dem Speicher, im Hintergrund auffrischen
    }).catch(() => { fertig(); return fetch(e.request); }));
    return;
  }
  if (u.pathname.includes("/foto/") || u.searchParams.has("v")) {           // unveraenderlich: einmal laden, dann nur noch aus dem Speicher
    fertig();
    e.respondWith(caches.open(C).then(async c => {
      const alt = await c.match(e.request); if (alt) return alt;
      const r = await fetch(e.request);
      if (r.ok && u.searchParams.has("v")) {                                 // aeltere Fassungen derselben Datei entfernen
        for (const k of await c.keys()) { const ku = new URL(k.url); if (ku.pathname === u.pathname && ku.search !== u.search) c.delete(k); }
      }
      return merke(c, e.request, r);
    }).catch(() => { fertig(); return fetch(e.request); }));
    return;
  }
  e.respondWith(caches.open(C).then(async c => {                            // Rest (Symbol, Fell, Manifest): Speicher zuerst, im Hintergrund auffrischen
    const key = u.origin + u.pathname, alt = await c.match(key);
    const netz = fetch(e.request).then(r => merke(c, key, r));
    fertig(netz.catch(() => {}));
    return alt || netz;
  }).catch(() => { fertig(); return fetch(e.request); }));
});
