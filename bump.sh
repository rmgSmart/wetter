#!/bin/sh
# Vor jedem Hochladen ausfuehren: neue Versionsnummer, damit iPhones die neue Fassung laden
cd "$(dirname "$0")"
V=$(date +%Y%m%d%H%M)
echo "{\"v\":\"$V\"}" > version.json
sed -i "s/const VERSION = \"[0-9]*\";/const VERSION = \"$V\";/; s/daten.js?v=[0-9]*/daten.js?v=$V/; s/gigio.js?v=[0-9]*/gigio.js?v=$V/" index.html
