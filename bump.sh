#!/bin/sh
# Vor jedem Hochladen ausfuehren: neue Versionsnummer, damit iPhones die neue Fassung laden.
# NUMMER ist die sichtbare Version ganz unten in der App (1.<Anzahl der Commits>).
cd "$(dirname "$0")"
V=$(date +%Y%m%d%H%M)
N="1.$(( $(git rev-list --count HEAD) + 1 ))"
echo "{\"v\":\"$V\",\"nummer\":\"$N\"}" > version.json
sed -i "s/const VERSION = \"[0-9]*\";/const VERSION = \"$V\";/; s/const NUMMER = \"[0-9.]*\";/const NUMMER = \"$N\";/; s/daten.js?v=[0-9]*/daten.js?v=$V/; s/gigio.js?v=[0-9]*/gigio.js?v=$V/" index.html
