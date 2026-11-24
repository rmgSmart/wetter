/* Wetterdaten fuer den aktuellen Standort holen und aufbereiten.
   Quellen: GeoSphere Austria (CC BY 4.0), Open-Meteo (CC BY 4.0), Ortsname von OpenStreetMap (ODbL).
   Liefert dasselbe Datenformat wie frueher fetch_wetter.py. */
"use strict";
const Wetter = (() => {
  const FALLBACK = { lat: 48.2085, lon: 16.3721, ort: "1010 Wien" };
  const GEO = "https://dataset.api.hub.geosphere.at/v1/timeseries/forecast";
  const GEO_BOX = { s: 43.1, n: 51.4, w: 5.2, e: 22.4 };         // Gebiet des 1 km Modells
  const TAGE = 7;

  const SY = {
    1: ["klar", "Wolkenlos"], 2: ["heiter", "Heiter"], 3: ["wolkig", "Wolkig"], 4: ["wolkig", "Stark bewölkt"], 5: ["bedeckt", "Bedeckt"],
    6: ["nebel", "Bodennebel"], 7: ["nebel", "Hochnebel"], 8: ["regen_leicht", "Leichter Regen"], 9: ["regen", "Regen"], 10: ["regen_stark", "Starker Regen"],
    11: ["schneeregen", "Schneeregen"], 12: ["schneeregen", "Schneeregen"], 13: ["schneeregen", "Starker Schneeregen"],
    14: ["schnee", "Leichter Schneefall"], 15: ["schnee", "Schneefall"], 16: ["schnee", "Starker Schneefall"],
    17: ["regen_leicht", "Leichte Regenschauer"], 18: ["regen", "Regenschauer"], 19: ["regen_stark", "Starke Regenschauer"],
    20: ["schneeregen", "Schneeregenschauer"], 21: ["schneeregen", "Schneeregenschauer"], 22: ["schneeregen", "Starke Schneeregenschauer"],
    23: ["schnee", "Leichte Schneeschauer"], 24: ["schnee", "Schneeschauer"], 25: ["schnee", "Starke Schneeschauer"],
    26: ["gewitter", "Gewitter"], 27: ["gewitter", "Gewitter"], 28: ["gewitter", "Starkes Gewitter"], 29: ["gewitter", "Gewitter mit Schneeregen"],
    30: ["gewitter", "Starkes Gewitter"], 31: ["gewitter", "Gewitter mit Schnee"], 32: ["gewitter", "Starkes Gewitter"],
  };
  const PT = { 1: "Regen", 2: "Gewitter", 3: "Gefrierender Regen", 4: "Eisregen", 5: "Schnee", 6: "Nasser Schnee", 7: "Schneeregen",
               8: "Eiskörner", 9: "Graupel", 10: "Hagel", 11: "Nieselregen", 12: "Gefrierender Niesel" };
  function wmo(c) {
    if (c === 0) return ["klar", "Wolkenlos"]; if (c === 1) return ["heiter", "Heiter"]; if (c === 2) return ["wolkig", "Wolkig"];
    if (c === 3) return ["bedeckt", "Bedeckt"]; if (c === 45 || c === 48) return ["nebel", "Nebel"];
    if ([51, 53, 55, 61, 80].includes(c)) return ["regen_leicht", "Leichter Regen"];
    if ([63, 81].includes(c)) return ["regen", "Regen"]; if ([65, 82].includes(c)) return ["regen_stark", "Starker Regen"];
    if ([56, 57, 66, 67].includes(c)) return ["schneeregen", "Gefrierender Regen"];
    if ([71, 73, 75, 77, 85, 86].includes(c)) return ["schnee", "Schneefall"];
    if ([95, 96, 99].includes(c)) return ["gewitter", "Gewitter"];
    return ["wolkig", "Wechselhaft"];
  }
  const WMO_ART = c => [51, 53, 55].includes(c) ? "Nieselregen" : [56, 57, 66, 67].includes(c) ? "Gefrierender Regen"
    : [71, 73, 75, 77, 85, 86].includes(c) ? "Schnee" : [95, 96, 99].includes(c) ? "Gewitter" : "Regen";
  const NASS = new Set(["regen_leicht", "regen", "regen_stark", "schneeregen", "schnee", "gewitter"]);
  const RANG = ["klar", "heiter", "wolkig", "bedeckt", "nebel", "regen_leicht", "regen", "schneeregen", "schnee", "regen_stark", "gewitter"];
  const WOCHENTAG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

  /* ---------- Hilfen ---------- */
  const r1 = x => x == null ? null : Math.round(x * 10) / 10;
  const p2 = n => String(n).padStart(2, "0");
  function iso(d) {           // lokale Zeit mit Versatz, z. B. 2026-11-12T15:00+01:00
    const o = -d.getTimezoneOffset(), s = o >= 0 ? "+" : "-", a = Math.abs(o);
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}${s}${p2(a / 60 | 0)}:${p2(a % 60)}`;
  }
  const tag = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const uhr = d => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
  const gefuehlt = (t, rf, w) => t + .33 * (rf / 100 * 6.105 * Math.exp(17.27 * t / (237.7 + t))) - .7 * w - 4;
  function taupunkt(t, rf) { const g = Math.log(Math.max(rf, 1) / 100) + 17.62 * t / (243.12 + t); return 243.12 * g / (17.62 - g); }
  function sonne(d, lat, lon) {     // NOAA Naeherung
    const start = new Date(d.getFullYear(), 0, 0), n = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 864e5);
    const g = 2 * Math.PI / 365 * (n - 1 + .5);
    const eqt = 229.18 * (.000075 + .001868 * Math.cos(g) - .032077 * Math.sin(g) - .014615 * Math.cos(2 * g) - .040849 * Math.sin(2 * g));
    const dek = .006918 - .399912 * Math.cos(g) + .070257 * Math.sin(g) - .006758 * Math.cos(2 * g) + .000907 * Math.sin(2 * g) - .002697 * Math.cos(3 * g) + .00148 * Math.sin(3 * g);
    const la = lat * Math.PI / 180, c = Math.cos(90.833 * Math.PI / 180) / (Math.cos(la) * Math.cos(dek)) - Math.tan(la) * Math.tan(dek);
    const ha = Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI;
    const basis = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return [new Date(basis + (720 - 4 * (lon + ha) - eqt) * 6e4), new Date(basis + (720 - 4 * (lon - ha) - eqt) * 6e4)];
  }
  function risiko(p10, p50, p90) {
    if (p90 == null) return [null, null];
    if (p10 >= .1) return ["sicher", 90]; if (p50 >= .1) return ["wahrscheinlich", 65]; if (p90 >= .2) return ["möglich", 30];
    return ["trocken", 5];
  }
  // GeoSphere antwortet zeitweise mit 502, 503 oder 504. Dann bis zu zweimal neu versuchen.
  async function hole(url, ms = 25000, versuch = 0, max = 2) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
    let r;
    try { r = await fetch(url, { signal: c.signal }); if (r.ok) return await r.json(); }
    finally { clearTimeout(t); }
    if ([429, 500, 502, 503, 504].includes(r.status) && versuch < max) {
      await new Promise(ok => setTimeout(ok, 1200 * (versuch + 1)));
      return hole(url, ms, versuch + 1, max);
    }
    throw new Error(r.status);
  }
  function reihe(gj) {
    const par = gj.features[0].properties.parameters;
    return gj.timestamps.map((ts, i) => ({ t: new Date(ts), v: Object.fromEntries(Object.entries(par).map(([k, p]) => [k, p.data[i]])) }));
  }

  // Vorhersage in zwei Teilen holen: GeoSphere lehnt die grosse Abfrage zeitweise ab (503).
  // Der Kern reicht zur Not allein, die Zusatzwerte fehlen dann nur in den Details.
  // geduldig: lange warten und wiederholen; eilig (es gibt eine frische gespeicherte Vorhersage): kurz und ohne Wiederholung
  async function nwpHolen(ll, eilig = false) {
    const ms = eilig ? 8000 : 30000, max = eilig ? 0 : 1;
    const kernP = hole(`${GEO}/nwp-v2-1h-1km?${ll}&parameters=2t,tp,tcc,sy,10fg,10u,10v,2r`, ms, 0, max).catch(() => null);
    const extraP = hole(`${GEO}/nwp-v2-1h-1km?${ll}&parameters=sund,sf,pt,snowlmt,msl,ssrd,cape`, ms, 0, max).catch(() => null);
    const kern = await kernP;
    // Auf die Zusatzwerte hoechstens 2 Sekunden laenger warten, sie sind nur fuer die Details
    const extra = kern ? await Promise.race([extraP, new Promise(r => setTimeout(() => r(null), 2000))]) : null;
    if (!kern) return null;
    if (extra && extra.timestamps?.length === kern.timestamps.length) Object.assign(kern.features[0].properties.parameters, extra.features[0].properties.parameters);
    else { const par = kern.features[0].properties.parameters, n = kern.timestamps.length;
      ["sund", "sf", "pt", "snowlmt", "msl", "ssrd", "cape"].forEach(k => { par[k] = { data: Array(n).fill(null) }; }); }
    return kern;
  }

  // Letzte erfolgreiche GeoSphere-Antwort je Ort aufheben. Eine Vorhersage reicht 60 Stunden weit,
  // eine bis zu 6 Stunden alte ist also weiter brauchbar und besser als ein anderes Modell.
  const GEO_MAX = 6 * 36e5;
  function geoMerke(art, lat, lon, daten) {
    const key = `geo:${art}:${lat.toFixed(2)},${lon.toFixed(2)}`;
    try {
      localStorage.setItem(key, JSON.stringify({ t: Date.now(), daten }));
      const liste = (JSON.parse(localStorage.getItem("geo:liste") || "[]")).filter(k => k !== key); liste.push(key);
      while (liste.length > 8) localStorage.removeItem(liste.shift());
      localStorage.setItem("geo:liste", JSON.stringify(liste));
    } catch (e) {}
  }
  function geoAlt(art, lat, lon) {
    try { const c = JSON.parse(localStorage.getItem(`geo:${art}:${lat.toFixed(2)},${lon.toFixed(2)}`)); if (c && Date.now() - c.t < GEO_MAX) return c; } catch (e) {}
    return null;
  }

  // Vorab geladene GeoSphere-Vorhersage fuer 1010 Wien: eine GitHub Action legt sie alle 15 Minuten in den Zweig "daten".
  // Fuer ganz Wien wird sie sofort gezeigt, die Vorhersage fuer den genauen Standort kommt im Hintergrund nach.
  const VORRAT = "https://raw.githubusercontent.com/rmgSmart/wetter/daten/wien.json";
  const WIEN = { s: 48.11, n: 48.33, w: 16.18, e: 16.58 };
  const inWien = (lat, lon) => lat > WIEN.s && lat < WIEN.n && lon > WIEN.w && lon < WIEN.e;
  async function vorratHolen() {
    const v = await hole(`${VORRAT}?t=${Math.floor(Date.now() / 3e5)}`, 5000, 0, 0);
    const teil = (k, max) => { const x = v?.teile?.[k]; return x && Date.now() - x.t < max ? x.daten : null; };
    const r = { t: v.t, nwp: teil("nwp", GEO_MAX), ens: teil("ens", 12 * 36e5), nc: teil("nc", 45 * 6e4), om: teil("om", GEO_MAX) };
    return r.nwp && r.om ? r : null;
  }

  /* ---------- Standort ---------- */
  // Fehlercodes: 0 nicht unterstuetzt, 1 abgelehnt, 2 nicht verfuegbar, 3 Zeitueberschreitung
  // iOS ruft bei Apps am Home-Bildschirm die Standortabfrage manchmal nie zurueck.
  // Deshalb eine eigene harte Zeitgrenze, danach gilt der zuletzt bekannte Standort.
  function standort() {
    const letzte = () => { try { const p = JSON.parse(localStorage.getItem("pos")); if (p && p.lat != null) return { lat: p.lat, lon: p.lon, alt: true }; } catch (e) {} return null; };
    return new Promise(res => {
      let fertig = false; const ende = r => { if (!fertig) { fertig = true; clearTimeout(t); res(r); } };
      const t = setTimeout(() => ende({ ...(letzte() || {}), fehler: 3 }), 10000);
      if (!navigator.geolocation || !window.isSecureContext) return ende(letzte() || { fehler: 0 });
      navigator.geolocation.getCurrentPosition(p => {
        const r = { lat: p.coords.latitude, lon: p.coords.longitude };
        try { localStorage.setItem("pos", JSON.stringify(r)); } catch (e) {}
        ende(r);
      }, e => { const l = letzte(); ende(l ? { ...l, fehler: e.code } : { fehler: e.code }); },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 });
    });
  }
  async function ortsname(lat, lon) {
    const key = `ort2:${lat.toFixed(3)},${lon.toFixed(3)}`;
    try { const c = localStorage.getItem(key); if (c) return c; } catch (e) {}
    try {
      const j = await hole(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=18&accept-language=de`, 8000);
      const a = j.address || {}, stadt = a.city || a.town || a.village || a.municipality || a.county || "";
      const name = [a.postcode, stadt].filter(Boolean).join(" ") || "Unbekannter Ort";
      try { localStorage.setItem(key, name); } catch (e) {}
      return name;
    } catch (e) { return `${lat.toFixed(2)}, ${lon.toFixed(2)}`; }
  }

  /* ---------- Messwerte der naechsten Station (TAWES, alle 10 Minuten) ---------- */
  const STATION = "https://dataset.api.hub.geosphere.at/v1/station/current/tawes-v1-10min";
  const km = (a, b, c, d) => { const R = Math.PI / 180, x = (d - b) * R * Math.cos((a + c) / 2 * R), y = (c - a) * R; return Math.hypot(x, y) * 6371; };
  async function naechsteStation(lat, lon) {
    const key = `station2:${lat.toFixed(2)},${lon.toFixed(2)}`;     // neuer Schluessel, alte Auswahl mit 20 km verwerfen
    try { const c = JSON.parse(localStorage.getItem(key)); if (c && Date.now() - c.t < 30 * 864e5) return c.s; } catch (e) {}
    const meta = await hole(STATION + "/metadata", 20000);
    const alle = (meta.stations || []).filter(x => x.is_active !== false && x.lat != null && x.lon != null)
      .map(x => ({ id: String(x.id), name: x.name, km: km(lat, lon, +x.lat, +x.lon) })).sort((a, b) => a.km - b.km);
    const s = alle[0] && alle[0].km <= 1.5 ? alle[0] : null;      // nur wenn die Station wirklich in der Naehe ist
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), s })); } catch (e) {}
    return s;
  }
  const schoen = n => String(n || "").toLowerCase().replace(/(^|[\s\/\-])([a-zäöü])/g, (m, a, b) => a + b.toUpperCase()).replace(/\//g, " ");
  async function messung(lat, lon) {
    const st = await naechsteStation(lat, lon); if (!st) return null;
    const j = await hole(`${STATION}?parameters=TL,RF,FF,FFX,DD,RR,PRED,SO,TP&station_ids=${st.id}&output_format=geojson`, 15000);
    const p = j.features?.[0]?.properties?.parameters, t = j.timestamps?.[j.timestamps.length - 1]; if (!p || !t) return null;
    const v = k => { const d = p[k]?.data; const x = d ? d[d.length - 1] : null; return x == null || isNaN(x) ? null : +x; };
    if (v("TL") == null) return null;
    const zeit = new Date(t); if (Date.now() - zeit.getTime() > 45 * 60000) return null;       // zu alt
    return { station: schoen(st.name), km: r1(st.km), zeit: iso(zeit), temp: r1(v("TL")), feuchte: v("RF") != null ? Math.round(v("RF")) : null,
      wind: v("FF") != null ? Math.round(v("FF") * 3.6) : null, boe: v("FFX") != null ? Math.round(v("FFX") * 3.6) : null, richtung: v("DD"),
      regen10: v("RR"), druck: v("PRED") != null ? r1(v("PRED")) : null, sonne10: v("SO") != null ? Math.round(v("SO") / 60) : null, taupunkt: v("TP") != null ? r1(v("TP")) : null };
  }

  /* ---------- UV und Pollen (Open-Meteo, Copernicus) ---------- */
  const POLLEN = { alder_pollen: ["Erle", 10, 70], birch_pollen: ["Birke", 10, 70], grass_pollen: ["Gräser", 5, 30], mugwort_pollen: ["Beifuß", 5, 30], olive_pollen: ["Olive", 10, 70], ragweed_pollen: ["Ragweed", 5, 20] };
  const luftText = a => a == null ? null : a <= 20 ? "sehr gut" : a <= 40 ? "gut" : a <= 60 ? "mäßig" : a <= 80 ? "schlecht" : a <= 100 ? "sehr schlecht" : "extrem schlecht";
  async function luft(lat, lon) {
    const j = await hole(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&timezone=auto&forecast_days=5&hourly=european_aqi,${Object.keys(POLLEN).join(",")}`, 12000);
    const h = j.hourly || {}, zeit = h.time || [], heute = zeit[0] ? zeit[0].slice(0, 10) : "", pollen = [], tage = {};
    for (const k in POLLEN) {
      const w = (h[k] || []).filter((x, i) => x != null && zeit[i].slice(0, 10) === heute); if (!w.length) continue;
      const m = Math.max(...w), [name, mittel, hoch] = POLLEN[k];
      if (m >= mittel) pollen.push({ name, wert: Math.round(m), stufe: m >= hoch ? "hoch" : "mäßig" });
    }
    (h.european_aqi || []).forEach((x, i) => { if (x != null) { const t = zeit[i].slice(0, 10); tage[t] = Math.max(tage[t] ?? 0, x); } });
    const jetztI = zeit.findIndex(t => new Date(t).getTime() > Date.now() - 36e5), jetzt = h.european_aqi?.[Math.max(0, jetztI)];
    return { pollen, tage, jetzt: jetzt != null ? Math.round(jetzt) : null };
  }
  const uvText = u => u == null ? null : u < 3 ? "niedrig" : u < 6 ? "mäßig" : u < 8 ? "hoch" : u < 11 ? "sehr hoch" : "extrem";

  /* ---------- Ortssuche ---------- */
  async function suche(text) {
    const j = await hole(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=jsonv2&addressdetails=1&limit=6&accept-language=de`, 10000);
    const seen = new Set();
    return (j || []).map(x => {
      const a = x.address || {}, stadt = a.city || a.town || a.village || a.municipality || a.hamlet || a.county || (x.display_name || "").split(",")[0];
      const name = [a.postcode, stadt].filter(Boolean).join(" "), land = a.country_code && a.country_code !== "at" ? a.country : (a.state || "");
      return { name, zusatz: [a.suburb || a.city_district, land].filter(Boolean).join(", "), lat: +x.lat, lon: +x.lon };
    }).filter(o => o.name && !seen.has(o.name + o.zusatz) && seen.add(o.name + o.zusatz));
  }

  /* ---------- Stunden ---------- */
  function stundenGeo(nwp, ens, lat, lon) {
    const e = new Map(ens ? reihe(ens).map(x => [x.t.getTime(), x.v]) : []);
    return reihe(nwp).filter(x => x.v["2t"] != null).map(({ t, v }) => {
      const [auf, unter] = sonne(t, lat, lon), u = v["10u"] || 0, w = v["10v"] || 0, wind = Math.hypot(u, w), ev = e.get(t.getTime()) || {};
      const [stufe, proz] = risiko(ev.tp_p10, ev.tp_p50, ev.tp_p90), [gr, tx] = SY[Math.round(v.sy || 0)] || ["wolkig", "Unbekannt"];
      return {
        zeit: iso(t), temp: r1(v["2t"]), gefuehlt: r1(gefuehlt(v["2t"], v["2r"] ?? 70, wind)), regen: r1(v.tp || 0), schnee: r1(v.sf || 0),
        regen_p50: r1(ev.tp_p50), regen_p90: r1(ev.tp_p90), risiko: stufe, risiko_prozent: proz, temp_p10: r1(ev["2t_p10"]), temp_p90: r1(ev["2t_p90"]),
        wolken: Math.round(v.tcc || 0), feuchte: Math.round(v["2r"] || 0), wind: Math.round(wind * 3.6), boe: Math.round((v["10fg"] || 0) * 3.6),
        richtung: Math.round((Math.atan2(u, w) * 180 / Math.PI + 180) % 360), sonne_min: Math.round((v.sund || 0) / 60),
        taupunkt: r1(taupunkt(v["2t"], v["2r"] ?? 70)), druck: v.msl ? r1(v.msl / 100) : null, strahlung: v.ssrd != null ? Math.round(v.ssrd) : null,
        cape: v.cape != null ? Math.round(v.cape) : null, schneefallgrenze: v.snowlmt != null ? Math.round(v.snowlmt / 50) * 50 : null,
        art: (v.tp || 0) >= .1 ? PT[Math.round(v.pt || 0)] || null : null, boe_p90: ev["10fg_p90"] != null ? Math.round(ev["10fg_p90"] * 3.6) : null,
        symbol: gr, text: tx, nacht: !(auf <= t && t <= unter),
      };
    });
  }
  function stundenOM(om, lat, lon) {
    const h = om.hourly; if (!h) return [];
    return h.time.map((ts, i) => {
      const t = new Date(Date.parse(ts + ":00Z") - (om.utc_offset_seconds || 0) * 1000), [auf, unter] = sonne(t, lat, lon), temp = h.temperature_2m[i], rf = h.relative_humidity_2m[i] ?? 70;
      const wind = (h.wind_speed_10m[i] || 0) / 3.6, [gr, tx] = wmo(h.weather_code[i]), pp = h.precipitation_probability[i];
      const regen = h.precipitation[i] || 0;
      return {
        zeit: iso(t), temp: r1(temp), gefuehlt: r1(gefuehlt(temp, rf, wind)), regen: r1(regen), schnee: r1((h.snowfall[i] || 0) * 7),
        regen_p50: null, regen_p90: null, risiko: pp == null ? null : pp >= 80 ? "sicher" : pp >= 50 ? "wahrscheinlich" : pp >= 20 ? "möglich" : "trocken",
        risiko_prozent: pp, temp_p10: null, temp_p90: null, wolken: Math.round(h.cloud_cover[i] || 0), feuchte: Math.round(rf),
        wind: Math.round(h.wind_speed_10m[i] || 0), boe: Math.round(h.wind_gusts_10m[i] || 0), richtung: Math.round(h.wind_direction_10m[i] || 0),
        sonne_min: Math.round((h.sunshine_duration[i] || 0) / 60), taupunkt: r1(taupunkt(temp, rf)), druck: r1(h.pressure_msl[i]),
        strahlung: h.shortwave_radiation[i] != null ? Math.round(h.shortwave_radiation[i]) : null, cape: h.cape[i] != null ? Math.round(h.cape[i]) : null,
        schneefallgrenze: h.freezing_level_height[i] != null ? Math.max(0, Math.round((h.freezing_level_height[i] - 300) / 50) * 50) : null,
        art: regen >= .1 ? WMO_ART(h.weather_code[i]) : null, boe_p90: null, symbol: gr, text: tx, nacht: !(auf <= t && t <= unter),
      };
    }).filter(s => s.temp != null);
  }

  /* ---------- Auswertung ---------- */
  function regenfenster(st) {
    const out = []; let akt = null, luecke = 0;
    for (const s of st) {
      const ende = new Date(s.zeit);
      if (s.regen >= .1) { if (!akt) akt = { von: new Date(ende - 36e5), bis: ende, menge: 0, max: 0 }; akt.bis = ende; akt.menge += s.regen; akt.max = Math.max(akt.max, s.regen); luecke = 0; }
      else if (akt && ++luecke > 1) { out.push(akt); akt = null; }
    }
    if (akt) out.push(akt);
    return out.map(f => ({ von: iso(f.von), bis: iso(f.bis), menge: r1(f.menge), max_pro_stunde: r1(f.max) }));
  }
  function tagessymbol(st) {
    const hell = st.filter(s => { const h = new Date(s.zeit).getHours(); return h >= 6 && h <= 22; }); const b = hell.length ? hell : st;
    const nass = b.filter(s => NASS.has(s.symbol));
    if (nass.length >= 2) { const s = nass.reduce((a, c) => RANG.indexOf(c.symbol) > RANG.indexOf(a.symbol) ? c : a); return [s.symbol, s.text]; }
    const tr = b.filter(s => !NASS.has(s.symbol)), z = {}; (tr.length ? tr : b).forEach(s => z[s.symbol] = (z[s.symbol] || 0) + 1);
    const g = Object.keys(z).reduce((a, c) => z[c] > z[a] ? c : a); return [g, (tr.length ? tr : b).find(s => s.symbol === g).text];
  }
  function charakter(rest, tmax) {
    const regen = rest.reduce((a, s) => a + s.regen, 0), schnee = rest.reduce((a, s) => a + s.schnee, 0), nasse = rest.filter(s => s.regen >= .1).length;
    const boe = Math.max(0, ...rest.map(s => s.boe)), wolken = rest.reduce((a, s) => a + s.wolken, 0) / Math.max(rest.length, 1), nebel = rest.filter(s => s.symbol === "nebel").length;
    if (rest.some(s => s.symbol === "gewitter")) return "gewitter"; if (boe >= 65) return "sturm";
    if (schnee >= .5 || rest.filter(s => s.symbol === "schnee").length >= 2) return "schnee";
    if (regen >= 1 || nasse >= 3) return "regen"; if (nebel >= Math.max(2, rest.length / 2)) return "nebel";
    if (tmax != null && tmax >= 30) return "hitze"; if (tmax != null && tmax < 0) return "frost";
    return wolken < 30 ? "sonnig" : wolken < 75 ? "heiter" : "bewoelkt";
  }
  const arten = st => [...new Set(st.map(s => s.art).filter(Boolean))];
  function satz(jetzt, rest, fenster, tmax, boe, t24 = []) {
    const teile = [], heute = tag(jetzt), stunde = d => `${d.getHours()} Uhr`;
    const fh = fenster.filter(f => f.von.slice(0, 10) <= heute && new Date(f.bis) > jetzt);
    if (fh.length) {
      const f = fh[0], von = new Date(f.von), bis = new Date(f.bis);
      const art = f.max_pro_stunde >= 4 ? "Starker Regen" : f.menge >= 1 ? "Regen" : "Etwas Regen";
      if (von <= jetzt) { teile.push(`${art} bis etwa ${stunde(bis)}`); if (fh[1]) teile.push(`ab ${stunde(new Date(fh[1].von))} wieder Regen`); }
      else if (tag(bis) > heute) teile.push(`${art} ab ${stunde(von)}, in der Nacht bis etwa ${stunde(bis)}`);
      else teile.push(`${art} von ${von.getHours()} bis ${stunde(bis)}`);
    } else {
      const w = rest.reduce((a, s) => a + s.wolken, 0) / Math.max(rest.length, 1);
      teile.push(rest.some(s => s.symbol === "nebel") ? "Trocken, zeitweise Nebel" : w >= 85 ? "Trocken und durchgehend bedeckt"
        : w >= 50 ? "Trocken bei vielen Wolken" : w >= 20 ? "Trocken und zeitweise sonnig" : "Trocken und klar");
    }
    if (boe >= 40) {                                   // wann und wie stark: Zeitfenster rund um die Spitze
      const grenze = Math.max(40, boe * .8), stark = rest.filter(x => x.boe >= grenze);
      const h0 = +stark[0].zeit.slice(11, 13), h1 = +stark[stark.length - 1].zeit.slice(11, 13);
      teile.push(stark.length >= rest.length - 1 ? `Böen bis ${boe} km/h` : h0 === h1 ? `Böen bis ${boe} km/h um ${h0} Uhr` : `Böen bis ${boe} km/h zwischen ${h0} und ${h1} Uhr`);
    }
    // Sturmboeen nach Mitternacht, aber innerhalb der naechsten 24 Stunden, auch erwaehnen
    const spaeter = t24.filter(x => tag(new Date(x.zeit)) !== tag(jetzt)), sp = spaeter.reduce((a, x) => x.boe > (a ? a.boe : -1) ? x : a, null);
    if (sp && sp.boe >= 60 && sp.boe > boe) {
      const h = +sp.zeit.slice(11, 13), wann = h < 5 ? "In der Nacht" : h < 11 ? "Morgen früh" : h < 14 ? "Morgen Mittag" : h < 18 ? "Morgen Nachmittag" : "Morgen Abend";
      teile.push(`${wann} um ${h} Uhr ${sp.boe >= 75 ? "Sturmböen" : "kräftige Böen"} bis ${sp.boe} km/h`);
    }
    if (rest.length) {
      const tief = Math.min(...rest.map(s => s.temp));
      if (jetzt.getHours() < 14) teile.push(`Höchstwert ${Math.round(tmax)} Grad`);
      else if (tief <= rest[0].temp - 1.5) teile.push(`bis Mitternacht kühlt es auf ${Math.round(tief)} Grad ab`);
      else teile.push(`die Temperatur bleibt bei rund ${Math.round(tief)} Grad`);
    }
    return teile.map(t => t[0].toUpperCase() + t.slice(1)).join(". ") + ".";
  }
  // Schnee oder Regen aus der Feuchttemperatur (Drittel-Regel): Schnee faellt oft noch bei 2 Grad, wenn die Luft trocken ist
  function phase(t, td) {
    if (t == null) return "regen";
    const tw = td == null ? t : t - (t - td) / 3;
    return tw <= 1.2 ? "schnee" : tw <= 2 ? "schneeregen" : "regen";
  }
  const ART_WORT = { regen: "Regen", schnee: "Schnee", schneeregen: "Schneeregen" };
  function nowcast(gj, jetzt, aktuell) {
    const st = reihe(gj).filter(x => x.t > jetzt && x.v.rr != null).slice(0, 12)
      .map(x => ({ zeit: iso(x.t), regen: Math.round(x.v.rr * 100) / 100, d: x.t, art: phase(x.v.t2m, x.v.td), pt: x.v.pt ?? null }));
    if (!st.length) return null;
    const nass = st.map((s, i) => s.regen >= .05 ? i : -1).filter(i => i >= 0);
    const arten = nass.map(i => st[i].art), art = arten.includes("schnee") ? (arten.every(a => a === "schnee") ? "schnee" : "schneeregen")
      : arten.includes("schneeregen") ? "schneeregen" : nass.length ? "regen" : null;
    const W = ART_WORT[art] || "Regen";
    const ende = i => uhr(st[i].d), beginn = i => uhr(new Date(st[i].d - 9e5));
    let text, b = null, e = null;
    if (!nass.length) text = "Kein Niederschlag bis " + ende(st.length - 1);
    else if (nass[0] > 0) { b = beginn(nass[0]); text = aktuell.regen >= .1 && art === "regen" ? `Leichtes Nieseln, kräftiger ab etwa ${b}` : `${W} ab etwa ${b}`; }
    else { const i = st.findIndex((s, k) => !nass.includes(k)); if (i > 0) { e = ende(i - 1); text = `${W} bis etwa ${e}`; } else text = `${W} hält bis mindestens ${ende(st.length - 1)} an`; }
    // Faellt gerade etwas? Erste halbe Stunde des Nowcasts (INCA: Radar und Stationen)
    const jetztNass = st.slice(0, 2).some(s => s.regen >= .05), jetztArt = jetztNass ? st.slice(0, 2).find(s => s.regen >= .05).art : null;
    return { modelllauf: gj.reference_time, text, regnet: nass.length > 0, art, jetztNass, jetztArt, jetztMenge: r1(st.slice(0, 4).reduce((a, s) => a + s.regen, 0)), beginn: b, ende: e,
             summe: Math.round(st.reduce((a, s) => a + s.regen, 0) * 10) / 10, schritte: st.map(({ zeit, regen, art, pt }) => ({ zeit, regen, art, pt })) };
  }

  /* ---------- Zusammenbauen ---------- */
  function baue(stunden, omDaily, jetzt, ort, lat, lon, quellen, lauf, ncRoh) {
    const heute = tag(jetzt);
    // vergangene Stunden von heute merken, damit Minimum und Maximum fuer den ganzen Tag stimmen
    let verlauf = {};
    try { const v = JSON.parse(localStorage.getItem("verlauf") || "{}"); if (v.datum === heute && v.ort === ort) verlauf = v.stunden; } catch (e) {}
    stunden.filter(s => s.zeit.slice(0, 10) === heute).forEach(s => verlauf[s.zeit] = s);
    try { localStorage.setItem("verlauf", JSON.stringify({ datum: heute, ort, stunden: verlauf })); } catch (e) {}
    const heuteAlle = Object.keys(verlauf).sort().map(k => verlauf[k]);

    const kommend = stunden.filter(s => new Date(s.zeit) > new Date(jetzt - 18e5));
    const aktuell = kommend[0] || stunden[stunden.length - 1];
    let rest = kommend.filter(s => s.zeit.slice(0, 10) === heute); if (rest.length < 3) rest = kommend.slice(0, 6);

    const om = {}; if (omDaily) omDaily.time.forEach((t, i) => om[t] = Object.fromEntries(Object.keys(omDaily).filter(k => k !== "time").map(k => [k, omDaily[k][i]])));
    const woche = [];
    for (let i = 0; i < TAGE; i++) {
      const d = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + i), ds = tag(d);
      const st = i === 0 ? heuteAlle : stunden.filter(s => s.zeit.slice(0, 10) === ds), o = om[ds], [auf, unter] = sonne(d, lat, lon);
      const e = { datum: ds, tag: i === 0 ? "Heute" : WOCHENTAG[d.getDay()], sonnenaufgang: uhr(auf), sonnenuntergang: uhr(unter) };
      if (st.length >= 20 || (i === 0 && st.length)) {
        const [g, t] = tagessymbol(st); let tmin = Math.min(...st.map(s => s.temp)), tmax = Math.max(...st.map(s => s.temp));
        if (st.length < 20 && o) { tmin = Math.min(tmin, o.temperature_2m_min); tmax = Math.max(tmax, o.temperature_2m_max); }
        const pr = st.map(s => s.risiko_prozent).filter(x => x != null), gr = st.map(s => s.schneefallgrenze).filter(x => x != null);
        Object.assign(e, { min: r1(tmin), max: r1(tmax), regen: r1(st.reduce((a, s) => a + s.regen, 0)), regen_prozent: pr.length ? Math.max(...pr) : o?.precipitation_probability_max ?? null,
          boe: Math.max(...st.map(s => s.boe)), sonne_h: r1(st.reduce((a, s) => a + s.sonne_min, 0) / 60), symbol: g, text: t, quelle: quellen[0],
          wolken: Math.round(st.reduce((a, s) => a + s.wolken, 0) / st.length), schneefallgrenze_min: gr.length ? Math.min(...gr) : null, arten: arten(st) });
      } else if (o) {
        let [g, t] = wmo(o.weather_code);
        const sonneH = o.sunshine_duration / 3600;
        if (NASS.has(g) && g !== "schnee" && g !== "gewitter" && o.precipitation_sum < .3)      // Regensymbol ohne nennenswerten Regen
          [g, t] = sonneH >= 6 ? ["heiter", "Heiter"] : sonneH >= 2 ? ["wolkig", "Wolkig"] : ["bedeckt", "Bedeckt"];
        else if (g === "bedeckt" && sonneH >= 5) [g, t] = ["wolkig", "Wolkig"];
        Object.assign(e, { min: r1(o.temperature_2m_min), max: r1(o.temperature_2m_max), regen: r1(o.precipitation_sum), regen_prozent: o.precipitation_probability_max,
          boe: Math.round(o.wind_gusts_10m_max), sonne_h: r1(o.sunshine_duration / 3600), symbol: g, text: t, quelle: "Open-Meteo" });
      } else continue;
      woche.push(e);
    }
    const fenster = regenfenster(kommend.slice(0, 30)), t0 = woche[0], boeRest = Math.max(0, ...rest.map(s => s.boe));
    const ord = ["trocken", "möglich", "wahrscheinlich", "sicher"], stufen = rest.map(s => s.risiko).filter(Boolean);
    const [auf, unter] = sonne(jetzt, lat, lon);
    const d0 = aktuell.druck, d3 = kommend[3]?.druck;
    const trend = d0 != null && d3 != null ? (d3 - d0 > 1 ? "steigend" : d3 - d0 < -1 ? "fallend" : "gleichbleibend") : null;
    const t24 = kommend.slice(0, 24), gr = t24.map(s => s.schneefallgrenze).filter(x => x != null);
    let nc = null; try { if (ncRoh) nc = nowcast(ncRoh, jetzt, aktuell); } catch (e) {}
    let ch = charakter(rest, t0.max);
    if (nc && nc.jetztNass) {             // das Modell kann danebenliegen, der Nowcast sieht den Niederschlag am Radar
      const m = nc.jetztMenge, a = nc.jetztArt;
      const [sym, txt] = a === "schnee" ? ["schnee", m >= .5 ? "Schneefall" : "Leichter Schneefall"] : a === "schneeregen" ? ["schneeregen", "Schneeregen"]
        : [m >= .5 ? "regen" : "regen_leicht", m >= .5 ? "Regen" : "Leichter Regen"];
      if (!NASS.has(aktuell.symbol) || a !== "regen") Object.assign(aktuell, { symbol: sym, text: txt });
      aktuell.regen = Math.max(aktuell.regen || 0, m);
      if (ch !== "gewitter" && ch !== "sturm") ch = a === "regen" ? (ch === "schnee" ? ch : "regen") : "schnee";
    }
    return {
      ort, koordinaten: [lat, lon], stand: iso(jetzt), modelllauf: lauf, charakter: ch, nacht: !(auf <= jetzt && jetzt <= unter), jetzt: aktuell,
      heute: { min: t0.min, max: t0.max, regen_rest: r1(rest.reduce((a, s) => a + s.regen, 0)), regenrisiko: stufen.length ? stufen.reduce((a, c) => ord.indexOf(c) > ord.indexOf(a) ? c : a) : null,
               regenfenster: fenster, boe_max: boeRest, sonne_h: t0.sonne_h, sonnenaufgang: uhr(auf), sonnenuntergang: uhr(unter), satz: satz(jetzt, rest, fenster, t0.max, boeRest, kommend.slice(0, 24)),
               drucktrend: trend, arten_24h: arten(t24), schneefallgrenze_24h: gr.length ? [Math.min(...gr), Math.max(...gr)] : null },
      nowcast: nc, stunden: kommend, woche, quellen: [...new Set([...quellen, ...(omDaily ? ["Open-Meteo (CC BY 4.0)"] : [])])],
    };
  }

  /* ---------- Ablauf ---------- */
  const OM_STD = "&hourly=temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,snowfall,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,sunshine_duration,shortwave_radiation,cape,freezing_level_height";
  async function laden(wahl, opt = {}) {
    let pos = wahl ? { lat: wahl.lat, lon: wahl.lon } : null;
    if (!pos && opt.schnell !== false) { try { const g = JSON.parse(localStorage.getItem("pos")); if (g && g.lat != null) pos = { lat: g.lat, lon: g.lon }; } catch (e) {} }
    else if (!pos) { const s = await standort(); opt = { ...opt, st: s }; if (s.lat != null) pos = s; }
    const v = pos && inWien(pos.lat, pos.lon) ? await vorratHolen().catch(() => null) : null;
    if (!v) return ladenDirekt(wahl, opt);
    // Standort gleich jetzt pruefen, die genaue Vorhersage wird dann fuer den aktuellen Standort geholt
    const stP = wahl || opt.st ? Promise.resolve(opt.st || null) : standort();
    const d = await ladenDirekt(wahl, { ...opt, roh: v, st: opt.st || pos });
    d.stand = iso(new Date(v.t));
    // Genaue Vorhersage im Hintergrund; niemand wartet darauf, also geduldig abfragen.
    // null, wenn GeoSphere dafuer nicht erreichbar war (dann bleibt die fuer 1010 Wien), ausser man ist inzwischen woanders.
    let woanders = false;
    const genau = Promise.race([stP.then(s => {
        const st = wahl ? null : s && s.lat != null ? s : pos;
        if (st && km(st.lat, st.lon, pos.lat, pos.lon) > 1) woanders = true;
        return ladenDirekt(wahl, { ...opt, geduldig: true, ...(st ? { st } : {}) });
      }), new Promise(r => setTimeout(r, 70000, null))])
      .then(g => g && (!g.ersatz || woanders) ? g : null).catch(() => null);
    genau.then(g => { if (!g) d.vorlaeufig = false; });
    Object.defineProperty(d, "vorlaeufig", { value: true, writable: true, enumerable: false });
    Object.defineProperty(d, "genau", { value: genau, enumerable: false });
    return d;
  }
  async function ladenDirekt(wahl, opt = {}) {
    const roh = opt.roh || null;
    // Standort: sofort den zuletzt bekannten nehmen und im Hintergrund pruefen, ob er noch stimmt.
    // Nur beim allerersten Start (oder im Widget) wird auf die Standortabfrage gewartet.
    let gespeichert = null; try { gespeichert = JSON.parse(localStorage.getItem("pos")); } catch (e) {}
    let st, standortNeu = null;
    if (wahl) st = { lat: wahl.lat, lon: wahl.lon };
    else if (opt.st) st = opt.st;
    else if (opt.schnell !== false && gespeichert && gespeichert.lat != null) {
      st = { lat: gespeichert.lat, lon: gespeichert.lon };
      standortNeu = standort().then(p => p.lat != null && !p.alt && km(p.lat, p.lon, st.lat, st.lon) > 1).catch(() => false);
    } else st = await standort();
    const pos = st.lat != null ? st : null;
    const lat = pos ? pos.lat : FALLBACK.lat, lon = pos ? pos.lon : FALLBACK.lon;
    const ortP = wahl ? Promise.resolve(wahl.name) : pos ? ortsname(lat, lon) : Promise.resolve(FALLBACK.ort);
    const imGebiet = lat > GEO_BOX.s && lat < GEO_BOX.n && lon > GEO_BOX.w && lon < GEO_BOX.e;
    const ll = `lat_lon=${lat.toFixed(4)},${lon.toFixed(4)}`;
    const omBasis = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&timezone=auto&forecast_days=8`
      + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max,sunshine_duration,uv_index_max&current=uv_index";
    const omStd = omBasis + OM_STD;
    const omUrl = omStd;                                  // stuendlich auch in Oesterreich: fuellt den Tag auf, an dem die GeoSphere-Vorhersage endet
    const messP = roh ? Promise.resolve(null) : imGebiet ? messung(lat, lon).catch(() => null) : Promise.resolve(null), luftP = roh ? Promise.resolve(null) : luft(lat, lon).catch(() => null);
    // Ensemble (Regenwahrscheinlichkeit) und Nowcast sind oft langsam: nicht darauf warten, sondern nachreichen
    const ensP = roh ? Promise.resolve(roh.ens) : imGebiet ? hole(`${GEO}/ensemble-v2-1h-1km?${ll}&parameters=tp_p10,tp_p50,tp_p90,2t_p10,2t_p90,10fg_p90`).catch(() => null) : Promise.resolve(null);
    const ncP = roh ? Promise.resolve(roh.nc) : imGebiet ? hole(`${GEO}/nowcast-v1-15min-1km?${ll}&parameters=rr,pt,t2m,td`, 20000).catch(() => null) : Promise.resolve(null);
    let ens = null, nc = null, ensDa = false, ncDa = false;
    const ensP2 = ensP.then(x => { if (roh) return x; if (x) geoMerke("ens", lat, lon, x); else { const c = imGebiet ? geoAlt("ens", lat, lon) : null; if (c) return c.daten; } return x; });
    ensP2.then(x => { ens = x; ensDa = true; }); ncP.then(x => { nc = x; ncDa = true; });
    const vorrat = imGebiet && !roh ? geoAlt("nwp", lat, lon) : null, eilig = !opt.geduldig && !!(vorrat && Date.now() - vorrat.t < 3 * 36e5);
    let [nwp, om] = roh ? [roh.nwp, roh.om] : await Promise.all([imGebiet ? nwpHolen(ll, eilig) : null, hole(omUrl, 15000).catch(() => null)]);
    let geoStand = null;                                  // gesetzt, wenn eine aufgehobene GeoSphere-Vorhersage verwendet wird
    if (roh) {}
    else if (imGebiet && nwp) geoMerke("nwp", lat, lon, nwp);
    else if (imGebiet) { const c = geoAlt("nwp", lat, lon); if (c) { nwp = c.daten; geoStand = new Date(c.t); } }
    await Promise.race([Promise.all([ensP2, ncP]), new Promise(r => setTimeout(r, 1200))]);   // kurz warten, falls sie gleich da sind
    let omH = null;
    if (!nwp) omH = om?.hourly ? om : await hole(omStd).catch(() => null);
    const ort = await ortP;
    const jetzt = new Date();

    function bauen(ensX, ncX) {
      let stunden = nwp ? stundenGeo(nwp, ensX, lat, lon) : [], quellen = ["GeoSphere Austria (CC BY 4.0)"], lauf = nwp?.reference_time || null;
      if (!stunden.length) {     // ausserhalb Oesterreichs oder GeoSphere nicht erreichbar
        stunden = omH ? stundenOM(omH, lat, lon).filter(s => new Date(s.zeit) > Date.now() - 36e5).slice(0, 60) : []; quellen = ["Open-Meteo (CC BY 4.0)"]; lauf = null;
      }
      if (!stunden.length) throw new Error("Keine Wetterdaten erreichbar");
      // GeoSphere rechnet rund 60 Stunden voraus und hoert mitten im Tag auf: den Rest dieses Tages mit Open-Meteo auffuellen
      if (nwp && om?.hourly) {
        const ende = stunden[stunden.length - 1].zeit, tagEnde = ende.slice(0, 10);
        const rest = stundenOM(om, lat, lon).filter(s => s.zeit > ende && s.zeit.slice(0, 10) === tagEnde).map(s => ({ ...s, quelle: "Open-Meteo" }));
        if (rest.length) { stunden = stunden.concat(rest); quellen = [...quellen, "Open-Meteo (CC BY 4.0)"]; }
      }
      const d = baue(stunden, om?.daily || null, jetzt, ort, lat, lon, quellen, lauf, ncX);
      d.standortFrei = !!pos && !st.alt; d.standortAlt = !!st.alt; d.standortFehler = d.standortFrei ? null : st.fehler; d.gewaehlt = !!wahl;
      const uvTage = {}; (om?.daily?.time || []).forEach((t, i) => { const u = om.daily.uv_index_max?.[i]; if (u != null) uvTage[t] = Math.round(u); });
      d.woche.forEach(w => { w.uv = uvTage[w.datum] ?? null; w.uv_text = uvText(w.uv); w.luft = null; });
      const uvJ = om?.current?.uv_index, uvM = om?.daily?.uv_index_max?.[0];
      d.uv = uvM != null || uvJ != null ? { jetzt: uvJ != null ? Math.round(uvJ) : null, max: uvM != null ? Math.round(uvM) : null, text: uvText(uvM ?? uvJ) } : null;
      d.messung = null; d.pollen = null; d.luft = null;
      return d;
    }
    const d = bauen(ensDa ? ens : null, ncDa ? nc : null);
    d.ersatz = !imGebiet ? null : geoStand ? "alt" : !nwp ? "openmeteo" : null;
    d.geoStand = geoStand ? iso(geoStand) : null;
    d.vollstaendig = ensDa && ncDa;
    // Nachreichen: Regenwahrscheinlichkeit, Nowcast, Messwerte, Luftqualitaet
    const extras = Promise.all([messP, luftP, ensP2, ncP]).then(([m, lu, e, n]) => {
      if (!d.vollstaendig) { try { Object.assign(d, bauen(e, n)); } catch (x) {} d.vollstaendig = true; }
      d.messung = m; d.pollen = lu ? lu.pollen : null;
      d.woche.forEach(w => { const a = lu?.tage?.[w.datum]; w.luft = a != null ? Math.round(a) : null; w.luft_text = luftText(a); });
      d.luft = lu && (lu.jetzt != null || d.woche[0]?.luft != null) ? { jetzt: lu.jetzt, max: d.woche[0]?.luft ?? null, text: luftText(lu.jetzt ?? d.woche[0]?.luft) } : null;
      if (m) d.quellen = [...new Set(["GeoSphere Austria (CC BY 4.0)", ...d.quellen])];
      return d;
    });
    await Promise.race([extras, new Promise(r => setTimeout(r, 300))]);
    Object.defineProperty(d, "spaeter", { value: extras, enumerable: false });
    if (standortNeu) Object.defineProperty(d, "standortNeu", { value: standortNeu, enumerable: false });
    return d;
  }
  return { laden, suche, _test: { baue, stundenGeo, nowcast } };
})();
