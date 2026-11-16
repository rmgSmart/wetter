// GigioWetter: haelt die App selbst im Zwischenspeicher, damit sie auch ohne Netz startet.
// Seiten und Skripte kommen immer zuerst aus dem Netz, der Speicher ist nur der Notnagel.
const C = "gigiowetter-1";
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(["./", "daten.js", "gigio.js", "manifest.webmanifest", "icon-180.png"]).catch(() => {}))); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== C).map(n => caches.delete(n)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.endsWith("version.json")) return;
  const key = u.origin + u.pathname;                                    // ohne ?v=, damit nichts doppelt liegt
  if (u.pathname.includes("/foto/")) {                                  // Bilder: sofort aus dem Speicher, im Hintergrund auffrischen
    e.respondWith(caches.open(C).then(async c => {
      const alt = await c.match(key), netz = fetch(e.request).then(r => { if (r.ok) c.put(key, r.clone()); return r; }).catch(() => alt);
      return alt || netz;
    }));
    return;
  }
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const k = r.clone(); caches.open(C).then(c => c.put(key, k)); } return r; })
    .catch(() => caches.match(key).then(r => r || caches.match(u.origin + u.pathname.replace(/[^/]*$/, "")))));
});
