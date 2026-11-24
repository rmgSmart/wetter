#!/usr/bin/env python3
"""Holt die GeoSphere Vorhersage fuer 1010 Wien vorab, damit die App sie sofort anzeigen kann.
Laeuft als GitHub Action alle 15 Minuten und schreibt wien.json in den Zweig "daten".
Aufruf: vorrat.py <alte wien.json> <neue wien.json>
Teile, die gerade nicht abrufbar sind, werden aus der alten Datei uebernommen (mit ihrer alten Zeit)."""
import json, sys, time, urllib.request

LAT, LON = 48.2085, 16.3721                      # 1010 Wien, wie FALLBACK in daten.js
GEO = "https://dataset.api.hub.geosphere.at/v1/timeseries/forecast"
LL = f"lat_lon={LAT:.4f},{LON:.4f}"
UA = "GigioWetter/1.0 (https://rmgsmart.github.io/wetter/)"
ZUSATZ = ["sund", "sf", "pt", "snowlmt", "msl", "ssrd", "cape"]
OM = (f"https://api.open-meteo.com/v1/forecast?latitude={LAT:.4f}&longitude={LON:.4f}&timezone=auto&forecast_days=8"
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,"
      "wind_gusts_10m_max,sunshine_duration,uv_index_max&current=uv_index"
      "&hourly=temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,snowfall,weather_code,cloud_cover,pressure_msl,"
      "wind_speed_10m,wind_direction_10m,wind_gusts_10m,sunshine_duration,shortwave_radiation,cape,freezing_level_height")


def hole(url, versuche=3):
    for i in range(versuche):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print(f"  Versuch {i + 1}: {e}", file=sys.stderr)
            time.sleep(5 * (i + 1))
    return None


def nwp():
    kern = hole(f"{GEO}/nwp-v2-1h-1km?{LL}&parameters=2t,tp,tcc,sy,10fg,10u,10v,2r")
    if not kern:
        return None
    time.sleep(1)
    extra = hole(f"{GEO}/nwp-v2-1h-1km?{LL}&parameters={','.join(ZUSATZ)}")
    par, n = kern["features"][0]["properties"]["parameters"], len(kern["timestamps"])
    if extra and len(extra.get("timestamps", [])) == n:
        par.update(extra["features"][0]["properties"]["parameters"])
    else:
        for k in ZUSATZ:
            par[k] = {"data": [None] * n}
    return kern


def main():
    try:
        alt = json.load(open(sys.argv[1])).get("teile", {})
    except Exception:
        alt = {}
    jetzt = int(time.time() * 1000)
    abrufe = {
        "nwp": nwp,
        "ens": lambda: hole(f"{GEO}/ensemble-v2-1h-1km?{LL}&parameters=tp_p10,tp_p50,tp_p90,2t_p10,2t_p90,10fg_p90"),
        "nc": lambda: hole(f"{GEO}/nowcast-v1-15min-1km?{LL}&parameters=rr,pt,t2m,td"),
        "om": lambda: hole(OM),
    }
    teile = {}
    for k, f in abrufe.items():
        print(f"{k} ...", file=sys.stderr)
        d = f()
        if d:
            teile[k] = {"t": jetzt, "daten": d}
        elif k in alt:
            teile[k] = alt[k]
            print(f"  {k}: alter Stand behalten", file=sys.stderr)
        time.sleep(1)
    if not teile:
        sys.exit("Nichts erreichbar")
    json.dump({"lat": LAT, "lon": LON, "t": jetzt, "teile": teile}, open(sys.argv[2], "w"), separators=(",", ":"))
    print({k: v["t"] == jetzt for k, v in teile.items()}, file=sys.stderr)


if __name__ == "__main__":
    main()
