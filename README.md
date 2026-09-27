# 🌿 Plant Monitor – Raspberry Pi 4 + Enviro+

Web-Dashboard für einen Pflanzenschrank auf Basis eines **Raspberry Pi 4** und **Pimoroni Enviro+**.

Das Projekt erfasst Klima- und Lichtdaten, speichert Messwerte in SQLite und stellt aktuelle Werte sowie Zeitreihen über ein responsives Web-Dashboard dar.

## Funktionen

- 🌡️ Temperaturmessung
- 💧 Luftfeuchtigkeit
- 🍃 VPD-Berechnung
- ☀️ Lux-Messung
- 💡 Lichtstatus „An/Aus“
- 🌱 geschätzter PPFD am Sensor
- 🌱 geschätzter PPFD in der Pflanzenmitte
- 📈 DLI-Berechnung pro Tag
- ⏱️ tägliche Beleuchtungsdauer
- 📊 Historie für 24 Stunden, 7 Tage, 30 Tage und 1 Jahr
- 💾 SQLite-Datenbank
- ⚡ FastAPI-Backend
- 🌐 Nginx Reverse Proxy
- 📉 Chart.js lokal eingebunden
- 🔄 automatischer Start über systemd
- 📷 vorbereitet für spätere Kamera-/Timelapse-Funktionen

---

# Architektur

```text
Enviro+
   │
   ▼
sensor.py
   │
   ├── Temperatur
   ├── Luftfeuchtigkeit
   ├── Lux
   └── CPU-Temperatur
   │
   ▼
FastAPI / app.py
   │
   ├── aktuelle Werte
   ├── VPD
   ├── PPFD
   ├── DLI
   └── History API
   │
   ▼
SQLite / data/plant.db
   │
   ▼
Uvicorn
127.0.0.1:8000
   │
   ▼
Nginx
Port 80
   │
   ▼
Browser
```

---

# Hardware

Aktuelles Setup:

- Raspberry Pi 4
- Pimoroni Enviro+
- BME280 für Temperatur / Luftfeuchtigkeit / Luftdruck
- LTR-559 für Helligkeit
- Pflanzenlampe
- Kamera geplant

Die aktuelle Installation verwendet das Enviro+ direkt auf dem Raspberry Pi. Dadurch wird der Temperatursensor durch die Abwärme des Raspberry Pi beeinflusst.

---

# Betriebssystem

Getestet mit:

```text
Raspberry Pi OS / Raspbian GNU/Linux 12 (Bookworm)
```

Das System wurde ursprünglich von Bullseye auf Bookworm aktualisiert.

---

# Projektstruktur

```text
~/plant-monitor/
├── app.py
├── sensor.py
├── database.py
├── templates/
│   └── index.html
├── static/
│   ├── style.css
│   ├── app.js
│   └── chart.umd.min.js
├── photos/
└── data/
    └── plant.db
```

---

# Python-Umgebung

Das Projekt verwendet die Pimoroni-Python-Umgebung:

```text
/home/pi/.virtualenvs/pimoroni
```

FastAPI und Uvicorn werden ebenfalls aus dieser Umgebung gestartet.

Benötigte Python-Pakete:

```bash
source ~/.virtualenvs/pimoroni/bin/activate
pip install fastapi uvicorn jinja2
```

`uvicorn[standard]` ist nicht notwendig.

---

# Sensoren

## Temperatur

Der BME280 befindet sich direkt auf dem Enviro+ und damit sehr nah am Raspberry Pi.

Dadurch ist die rohe Temperatur deutlich zu hoch.

Beispiel:

```text
BME280 Rohwert:     ~40 °C
CPU:                ~58 °C
korrigierter Wert:  ~32 °C
```

Aktuell wird eine heuristische Temperaturkorrektur verwendet:

```python
TEMP_FACTOR = 2.25

corrected_temperature = (
    raw_temperature
    - ((cpu_temperature - raw_temperature) / TEMP_FACTOR)
)
```

> Wichtig: Diese Korrektur ist eine Näherung und sollte mit einem unabhängigen Thermometer/Hygrometer kalibriert werden.

---

# Luftfeuchtigkeit

Die relative Luftfeuchtigkeit wird ebenfalls korrigiert.

Da relative Luftfeuchtigkeit temperaturabhängig ist, wird zuerst aus Roh-Temperatur und Roh-Feuchte der Dampfdruck berechnet und anschließend auf die korrigierte Temperatur umgerechnet.

Sättigungsdampfdruck:

```text
es(T) = 0.6108 × exp((17.27 × T) / (T + 237.3))
```

---

# VPD

VPD steht für:

```text
Vapor Pressure Deficit
```

bzw. Dampfdruckdefizit.

Der Wert beschreibt vereinfacht, wie stark die Luft Wasser aus den Blättern aufnehmen kann.

Berechnung:

```text
VPD = es(T) × (1 - RH / 100)
```

mit:

- `T` = Temperatur in °C
- `RH` = relative Luftfeuchtigkeit in %
- Ergebnis = kPa

VPD wird vom Enviro+ nicht direkt gemessen, sondern im Projekt aus Temperatur und Luftfeuchtigkeit berechnet.

---

# Lichtmessung

Der LTR-559 des Enviro+ liefert Lux-Werte.

Beobachtete Werte des aktuellen Setups:

```text
Schrank / Lampe aus:          ca. 4 Lux
Lampe mittlere Helligkeit:    ca. 1.800 Lux
Enviro+ bei voller Lampe:     ca. 13.352 Lux
Direkt unter Lampenmitte:     ca. 22.600 Lux
```

Die Werte sind stark abhängig von:

- Position
- Winkel
- Abstand zur Lampe
- Reflektionen
- Lampenspektrum

Lux ist deshalb vor allem als **relativer Messwert für dieses konkrete Setup** geeignet.

---

# Licht An / Aus

Die Lampe wird als eingeschaltet betrachtet, wenn:

```text
Lux >= 100
```

Konfiguration:

```python
LIGHT_ON_LUX = 100.0
```

Der große Abstand zwischen wenigen Lux im dunklen Schrank und mehreren Tausend Lux bei eingeschalteter Lampe macht diese Erkennung sehr robust.

---

# Lux → PPFD

Für diese Lampe wurde ein projektspezifischer Arbeitsfaktor ermittelt:

```text
52,5 Lux ≈ 1 µmol/m²/s PPFD
```

Berechnung:

```text
PPFD Sensor ≈ Lux / 52,5
```

Beispiele:

```text
22.600 Lux / 52,5 ≈ 430 µmol/m²/s
13.000 Lux / 52,5 ≈ 248 µmol/m²/s
13.352 Lux / 52,5 ≈ 254 µmol/m²/s
```

Konfiguration:

```python
LUX_PER_PPFD = 52.5
```

> PPFD ist hier eine Schätzung. Erwartete Unsicherheit: ungefähr ±15–20 %.

Für exakte Pflanzenlichtmessungen wäre ein echter PAR-/Quantum-Sensor erforderlich.

---

# PPFD Pflanzenmitte

Der Enviro+ sitzt nicht direkt unter der Mitte der Lampe.

Vergleichsmessungen:

```text
Pflanzen-/Lampenmitte:  ~430 µmol/m²/s
Sensorposition:          ~250 µmol/m²/s
```

Daraus ergibt sich:

```text
430 / 250 ≈ 1,72
```

Aktuell wird deshalb zusätzlich geschätzt:

```text
PPFD Pflanzenmitte = PPFD Sensor × 1,72
```

Konfiguration:

```python
CENTER_FACTOR = 1.72
```

Diese Schätzung gilt nur, solange sich Lampen-, Sensor- und Pflanzenposition nicht wesentlich verändern.

---

# DLI

DLI steht für:

```text
Daily Light Integral
```

und beschreibt die gesamte tägliche Lichtmenge in:

```text
mol/m²/Tag
```

Berechnung:

```text
DLI =
Summe(PPFD × Messintervall in Sekunden)
/
1.000.000
```

Da ungefähr alle 60 Sekunden ein Messwert gespeichert wird, kann das Dashboard die tatsächlich aufgezeichnete Lichtmenge über den Tag integrieren.

Das berücksichtigt auch:

- Ein-/Ausschaltzeiten
- Dimmen
- schwankende Lichtleistung

Das Dashboard zeigt aktuell den geschätzten DLI für die Pflanzenmitte.

---

# Schutz vor Datenlücken

Bei einem Neustart oder Ausfall soll eine Datenlücke nicht fälschlicherweise als lange Beleuchtungszeit gezählt werden.

Deshalb ist das maximale Intervall pro Messpunkt begrenzt:

```python
MAX_SAMPLE_GAP_SECONDS = 120
```

---

# SQLite-Datenbank

Datenbank:

```text
~/plant-monitor/data/plant.db
```

Tabelle:

```sql
measurements
```

Gespeicherte Felder:

```text
timestamp
temperature
humidity
vpd
lux
raw_temperature
raw_humidity
cpu_temperature
```

PPFD und DLI werden derzeit aus den gespeicherten Lux-Werten berechnet und müssen daher nicht separat gespeichert werden.

---

# Messintervall

Das Backend speichert ungefähr alle:

```text
60 Sekunden
```

eine Messung.

Beim Start findet zunächst ein Sensor-Warmup statt.

---

# History-Aggregation

Für lange Zeiträume werden Messwerte serverseitig zusammengefasst.

Aktuelle Buckets:

```text
24h   → 1 Minute
7d    → 10 Minuten
30d   → 1 Stunde
1 Jahr → 1 Tag
```

Konfiguration in `database.py`:

```python
RANGES = {
    "24h": (24 * 60 * 60, 60),
    "7d":  (7 * 24 * 60 * 60, 10 * 60),
    "30d": (30 * 24 * 60 * 60, 60 * 60),
    "1y":  (365 * 24 * 60 * 60, 24 * 60 * 60),
}
```

---

# API

## Status

```http
GET /api/status
```

Beispiel:

```json
{
  "status": "online",
  "message": "Pflanzenschrank läuft"
}
```

---

## Aktuelle Sensorwerte

```http
GET /api/current
```

Beispiel:

```json
{
  "raw_temperature": 40.1,
  "cpu_temperature": 57.4,
  "temperature": 32.5,
  "raw_humidity": 20.5,
  "humidity": 31.2,
  "vpd": 3.35,
  "lux": 13352.0,
  "ppfd_sensor": 254.3,
  "ppfd_center": 437.4,
  "light_on": true
}
```

---

## History

```http
GET /api/history?range=24h
GET /api/history?range=7d
GET /api/history?range=30d
GET /api/history?range=1y
```

Beispiel:

```json
{
  "range": "24h",
  "points": [
    {
      "timestamp": 1790532360,
      "temperature": 31.7,
      "humidity": 31.8,
      "vpd": 3.19,
      "lux": 0.0
    }
  ]
}
```

---

## Lichtdaten des aktuellen Tages

```http
GET /api/light/today
```

Beispiel:

```json
{
  "light_on_seconds": 18360,
  "dli_sensor": 4.8,
  "dli_center": 8.26,
  "max_lux": 13352.0,
  "max_ppfd_sensor": 254.3,
  "max_ppfd_center": 437.4,
  "samples": 310,
  "light_on_threshold_lux": 100.0,
  "lux_per_ppfd": 52.5,
  "center_factor": 1.72,
  "uncertainty_percent": 20
}
```

---

# Dashboard

Das Dashboard zeigt aktuell:

## Live

- Temperatur
- Luftfeuchtigkeit
- VPD
- Lux
- CPU-Temperatur
- rohe Temperatur
- rohe Luftfeuchtigkeit

## Licht

- Licht An/Aus
- Lux
- PPFD am Sensor
- geschätzter PPFD Pflanzenmitte
- tägliche Beleuchtungsdauer
- DLI heute
- Tagesmaximum Lux
- maximales geschätztes PPFD

## History

Diagramme für:

- Temperatur
- Luftfeuchtigkeit
- VPD
- Licht

Zeiträume:

- 24 Stunden
- 7 Tage
- 30 Tage
- 1 Jahr

---

# Chart.js

Chart.js wird lokal ausgeliefert:

```text
static/chart.umd.min.js
```

Damit benötigt das Dashboard keine externe CDN-Verbindung.

Einbindung:

```html
<script src="/static/chart.umd.min.js"></script>
<script src="/static/app.js"></script>
```

Chart.js muss vor `app.js` geladen werden.

---

# FastAPI / Uvicorn

Uvicorn läuft nur lokal:

```text
127.0.0.1:8000
```

Der Zugriff von außen erfolgt über Nginx.

Zum manuellen Test:

```bash
cd ~/plant-monitor

/home/pi/.virtualenvs/pimoroni/bin/uvicorn \
    app:app \
    --host 127.0.0.1 \
    --port 8000
```

Normalerweise wird Uvicorn jedoch über systemd gestartet.

---

# systemd Service

Datei:

```text
/etc/systemd/system/plant-monitor.service
```

Konfiguration:

```ini
[Unit]
Description=Pflanzenschrank Web Monitor
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/plant-monitor
ExecStart=/home/pi/.virtualenvs/pimoroni/bin/uvicorn app:app --host 127.0.0.1 --port 8000 --proxy-headers --forwarded-allow-ips=127.0.0.1
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Nach Änderungen:

```bash
sudo systemctl daemon-reload
sudo systemctl restart plant-monitor
```

Autostart aktivieren:

```bash
sudo systemctl enable plant-monitor
```

Status:

```bash
sudo systemctl status plant-monitor
```

Logs:

```bash
journalctl -u plant-monitor -f
```

---

# Nginx

Nginx arbeitet als Reverse Proxy.

Beispiel:

```text
/etc/nginx/sites-available/plant-monitor
```

Konfiguration:

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name _;

    location / {
        proxy_pass http://127.0.0.1:8000;

        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktivieren:

```bash
sudo ln -s \
    /etc/nginx/sites-available/plant-monitor \
    /etc/nginx/sites-enabled/plant-monitor
```

Falls der Standardhost noch vorhanden ist:

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

Konfiguration prüfen:

```bash
sudo nginx -t
```

Neu laden:

```bash
sudo systemctl reload nginx
```

Dashboard:

```text
http://raspberrypi.local/
```

---

# Tests

Backend:

```bash
curl http://127.0.0.1:8000/api/status
```

```bash
curl http://127.0.0.1:8000/api/current
```

```bash
curl http://127.0.0.1:8000/api/history?range=24h
```

```bash
curl http://127.0.0.1:8000/api/light/today
```

Über Nginx:

```bash
curl http://raspberrypi.local/api/current
```

---

# Service neu starten

Nach Änderungen an:

```text
app.py
sensor.py
database.py
```

muss der Dienst neu gestartet werden:

```bash
sudo systemctl restart plant-monitor
```

Bei Änderungen an:

```text
index.html
style.css
app.js
```

ist normalerweise kein Backend-Neustart notwendig.

Gegebenenfalls Browsercache umgehen:

```text
Ctrl + Shift + R
```

Im HTML können Versionsparameter verwendet werden:

```html
<link rel="stylesheet" href="/static/style.css?v=8">
<script src="/static/app.js?v=8"></script>
```

---

# Raspberry-Pi-Temperatur prüfen

```bash
vcgencmd measure_temp
```

Beispiel:

```text
temp=58.4'C
```

---

# Git

Empfohlene `.gitignore`:

```gitignore
# Python
__pycache__/
*.pyc

# Virtuelle Umgebungen
.venv/
venv/

# Messdaten
data/*.db
data/*.db-*

# Fotos
photos/*
!photos/.gitkeep

# Sonstiges
.DS_Store
*.log
```

Dadurch werden Messdaten und zukünftige Kamerabilder nicht versehentlich in das Repository eingecheckt.

Vor einem Push prüfen:

```bash
git status
git ls-files
```

Erster Commit:

```bash
git add .
git commit -m "Initial plant monitor dashboard"
```

Push:

```bash
git branch -M main
git remote add origin git@github.com:Deflection1/plant-monitor.git
git push -u origin main
```

Falls `origin` bereits existiert:

```bash
git remote -v
```

---

# Sicherheit / Datenschutz

Folgende Daten sollten nicht in ein öffentliches Repository:

- `data/plant.db`
- Kamerabilder
- Zugangsdaten
- SSH-Schlüssel
- API-Schlüssel
- private Konfigurationsdateien

Die `.gitignore` sollte deshalb vor dem ersten Push kontrolliert werden.

---

# Kamera

Die Weboberfläche ist bereits für eine Kamera vorbereitet.

Für Raspberry Pi OS Bookworm sollte später vorzugsweise **Picamera2** verwendet werden.

Geplante Funktionen:

- aktuelles Pflanzenfoto
- „Foto aufnehmen“-Button
- Galerie
- Vollbild
- automatische Fotos
- Timelapse
- optional tägliche Vergleichsbilder

---

# Mögliche Erweiterungen

Geplant bzw. sinnvoll:

- Kamera via Picamera2
- automatische Pflanzenfotos
- Timelapse
- Min / Max / Durchschnitt je Zeitraum
- frei konfigurierbare Zielbereiche
- visuelle Warnungen für Temperatur / RH / VPD
- Licht-An/Aus-Zeitlinie
- DLI-History
- PPFD-History
- Export als CSV
- Backup der SQLite-Datenbank
- Benachrichtigungen bei Grenzwertüberschreitungen
- Kalibrierungsseite für Temperatur, RH und Licht

---

# Hinweise zur Messgenauigkeit

Dieses Projekt ist ein Monitoring-System und kein kalibriertes Laborinstrument.

Insbesondere:

### Temperatur / Feuchte

Der Enviro+ ist direkt mit dem Raspberry Pi verbunden und wird durch dessen Abwärme beeinflusst.

Die aktuelle Korrektur ist heuristisch.

### PPFD / DLI

Die Umrechnung von Lux zu PPFD hängt vom Spektrum der Lampe ab.

Die aktuelle Kalibrierung:

```text
52,5 Lux pro µmol/m²/s
```

ist ein Arbeitswert für die verwendete Lampe.

Die geschätzte Unsicherheit beträgt ungefähr:

```text
±15–20 %
```

Für genaue PPFD-/DLI-Werte sollte ein PAR-/Quantum-Sensor verwendet werden.

---

# Lizenz

Noch nicht festgelegt.

Für ein öffentliches Open-Source-Repository kann später z. B. eine MIT-Lizenz ergänzt werden.

---

# Status

Aktuell funktionsfähig:

```text
✅ Enviro+ Sensoren
✅ FastAPI
✅ SQLite
✅ Nginx
✅ systemd
✅ Live-Dashboard
✅ History
✅ Chart.js
✅ VPD
✅ Lux
✅ PPFD-Schätzung
✅ DLI
✅ tägliche Beleuchtungsdauer
⬜ Kamera
⬜ Timelapse
⬜ Alarmierung
```
