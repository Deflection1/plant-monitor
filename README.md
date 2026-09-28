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
- Pimoroni Enviro+ direkt als HAT auf dem 40-Pin-Header
- BME280 für Temperatur / Luftfeuchtigkeit / Luftdruck
- LTR-559 für Helligkeit
- Raspberry Pi Camera Module v2.1 / IMX219 in Vorbereitung
- dimmbare Pflanzenlampe mit Mean Well XLG-150-H-AB
- zwei Noctua 4-Pin-PWM-Lüfter
  - Zuluft unten
  - Abluft oben
- Noctua NA-FC1 als aktuelle manuelle PWM-Lüftersteuerung

Der Raspberry Pi mit Enviro+ soll an der linken Schrankwand montiert werden. Das Enviro+ bleibt dabei direkt auf dem Raspberry Pi, da es als Pi-HAT ausgeführt ist.

Die direkte Montage des Enviro+ auf dem Raspberry Pi beeinflusst insbesondere die BME280-Temperaturmessung durch die Abwärme des Pi. Die aktuelle Temperaturkorrektur ist deshalb nur eine Näherung und soll später mit einem externen Referenzsensor kalibriert werden.

Geplante zusätzliche Hardware:

- ADS1115 als externer 4-Kanal-ADC
- 2× DFRobot SEN0308 wasserdichter kapazitiver Bodenfeuchtesensor
- Tank-Füllstandssensor / Schwimmerschalter
- 2× 12-V-Peristaltikpumpe, je eine pro Topf
- 2-Kanal-MOSFET-Treiber für die Pumpen
- separates 12-V-Netzteil für Pumpen
- DFRobot GP8600 bzw. kompatibler I²C-zu-0–10-V-DAC für die Lampendimmung
- später direkte PWM-Steuerung der beiden Noctua-Lüfter über den Raspberry Pi

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


# Geplante Automatisierung

Die nächsten Ausbaustufen sollen Monitoring und Steuerung in einem gemeinsamen Dashboard zusammenführen.

## Bodenfeuchtigkeit

Für die zwei Töpfe sind zwei getrennte Sensoren vorgesehen:

```text
Topf 1 SEN0308 ──> ADS1115 A0
Topf 2 SEN0308 ──> ADS1115 A1
```

Der ADS1115 wird parallel zu den bestehenden Enviro+-Geräten am I²C-Bus betrieben.

Geplante Anzeige:

```text
Topf 1 Feuchtigkeit:  xx %
Topf 2 Feuchtigkeit:  xx %
```

Jeder Sensor soll separat kalibriert werden, da Rohwerte zwischen Sensoren und Substraten abweichen können.

## Wassertank

Zusätzlich ist ein Tank-Sensor vorgesehen.

Minimalziel:

```text
Tank: OK / LEER
```

Der Tankstatus soll später als Sicherheitsbedingung für die automatische Bewässerung dienen. Bei leerem Tank werden Pumpenbefehle blockiert.

## Bewässerung

Die Bewässerung soll vollständig außerhalb des Pflanzenschranks aufgebaut werden. Im Schrank befinden sich nur die Sensoren und die Steuerleitungen zum Raspberry Pi.

Geplanter Aufbau:

```text
Wassertank
   ├── Pumpe 1 ──> Topf 1
   └── Pumpe 2 ──> Topf 2

12-V-Netzteil
   └── 2-Kanal-MOSFET-Treiber
        ├── Kanal 1 ──> Pumpe 1
        └── Kanal 2 ──> Pumpe 2

Raspberry Pi
   ├── GPIO ──> Pumpenkanal 1
   ├── GPIO ──> Pumpenkanal 2
   └── GND / Steuerschnittstelle
```

Vorgesehene Pumpen:

- 2× Kamoer / BerryBase 12-V-Peristaltikpumpe PPFL-1 oder vergleichbar
- eine Pumpe pro Topf
- passende Silikonschläuche
- optional Rückschlagventile und Tropfer / Bewässerungsringe

Die Pumpen werden niemals direkt vom Raspberry Pi versorgt. Der Pi liefert nur das Steuersignal; die Pumpen erhalten ihre Leistung aus einem separaten 12-V-Netzteil.

Geplante Sicherheitslogik:

- maximale Pumpdauer pro Vorgang
- Mindestpause zwischen zwei Bewässerungen
- Tank-leer-Sperre
- manueller Not-Aus / Override
- getrennte Steuerung pro Topf
- Protokollierung jeder Bewässerung
- spätere Kalibrierung von ml/s pro Pumpe

## Lampensteuerung

Das vorhandene Netzteil ist ein:

```text
Mean Well XLG-150-H-AB
```

Die Lampe soll nicht über die 230-V-Seite geschaltet oder gedimmt werden, sondern über den vorgesehenen Dimm-Eingang:

```text
DIM+ / DIM-
```

Der vorhandene manuelle Dimmer soll später durch einen Raspberry-Pi-gesteuerten 0–10-V-DAC ersetzt werden.

Geplanter Aufbau:

```text
Raspberry Pi
   │
   └── I²C
        │
        ▼
GP8600 / 0–10-V-DAC
        │
        ├── OUT+ ──> Mean Well DIM+
        └── OUT- ──> Mean Well DIM-
```

Die vorhandene Dimmleitung im Schrank kann dafür weiterverwendet werden.

### Lichtprofile

Im Dashboard sollen zwei speicherbare Lichtprofile vorhanden sein:

```text
Wachstumsphase
- Licht an
- Licht aus
- Leistung in %

Blütephase
- Licht an
- Licht aus
- Leistung in %
```

Zusätzlich:

- Umschalter Wachstum / Blüte
- Anzeige des aktiven Profils
- aktueller Sollwert in %
- nächste geplante Umschaltung
- manueller Override
- manueller AUS-Schalter
- Zeitpläne über Mitternacht
- Wiederherstellung des zuletzt aktiven Profils nach einem Neustart

Geplante API-Struktur:

```text
GET  /api/light/config
POST /api/light/config
POST /api/light/mode
POST /api/light/override
GET  /api/light/status
```

## Lüftersteuerung

Aktuell sind zwei Noctua 4-Pin-PWM-Lüfter vorhanden:

```text
Zuluft unten
Abluft oben
```

Beide werden derzeit über einen Noctua NA-FC1 geregelt.

Langfristig soll der NA-FC1 durch den Raspberry Pi ersetzt werden. Die Lüfter bleiben separat mit 12 V versorgt; der Pi erzeugt nur die PWM-Steuersignale.

Für 4-Pin-PC-Lüfter ist ein geeigneter Open-Collector-/Open-Drain-Treiber vorgesehen, statt den PWM-Pin direkt mit einem GPIO zu treiben.

Geplant:

```text
Raspberry Pi
├── PWM Kanal 1 ──> Zuluft
└── PWM Kanal 2 ──> Abluft
```

Dashboard:

```text
Zuluft
AUS | AUTO | MANUELL
Leistung: xx %

Abluft
AUS | AUTO | MANUELL
Leistung: xx %
```

Mögliche Automatiksignale:

- Temperatur
- relative Luftfeuchtigkeit
- VPD
- Lichtstatus
- Tag-/Nachtmodus
- Mindestdrehzahl

Optional kann später statt oder zusätzlich zur Noctua-Abluft ein 230-V-Rohrlüfter verwendet werden. Dieser würde zunächst nur über ein dafür geeignetes, galvanisch getrenntes Relais bzw. Schütz geschaltet. Eine Drehzahlregelung hängt vom konkreten Motortyp ab.

## Gemeinsamer I²C-Bus

Die geplanten I²C-Erweiterungen können parallel betrieben werden, sofern ihre Adressen kollisionsfrei gewählt werden:

```text
Raspberry Pi / Enviro+
   │
   ├── bestehende Enviro+-Sensoren
   ├── Enviro+-ADC
   ├── ADS1115
   │    ├── A0 ──> Feuchte Topf 1
   │    └── A1 ──> Feuchte Topf 2
   └── GP8600
        └── 0–10 V ──> Lampendimmung
```

Die am Enviro+ herausgeführten Pads für 3V3, GND, SDA und SCL können für die externen I²C-Module genutzt werden.

## Geplanter Dashboard-Ausbau

Langfristig soll das Dashboard zusätzlich anzeigen bzw. steuern:

- Feuchtigkeit Topf 1
- Feuchtigkeit Topf 2
- Tankstatus
- letzte Bewässerung je Topf
- manuelle Bewässerung je Topf
- Pumpenstatus
- Lampenleistung 0–100 %
- aktives Lichtprofil
- Wachstums-/Blüte-Timer
- Zuluftleistung
- Abluftleistung
- Automatik-/Manuell-Modi
- Kamera-Livebild / aktuelles Foto
- Timelapse

---

# Komponenten und Bezugsquellen

Stand: 28.09.2026. Preise und Verfügbarkeit können sich ändern.

## Bereits vorhanden

- Raspberry Pi 4
- Pimoroni Enviro+ HAT
- Raspberry Pi Camera Module v2.1 / IMX219
- Mean Well XLG-150-H-AB LED-Netzteil
- 2× Noctua 4-Pin-PWM-Lüfter
- Noctua NA-FC1 als aktuelle manuelle Lüftersteuerung
- LED-Pflanzenlampe

## Noch zu beschaffen

| Bereich | Komponente | Menge | Bevorzugter Anbieter | Alternative Anbieter | Hinweis |
|---|---|---:|---|---|---|
| Bodenfeuchte | DFRobot SEN0308, wasserdichter kapazitiver Bodenfeuchtesensor | 2 | Bastelgarage Schweiz | Farnell Schweiz, DFRobot direkt | 3,3–5,5 V, analog 0–ca. 3 V, 1,5-m-Kabel |
| Analogmessung | ADS1115, 16 Bit, 4 Kanäle, I²C | 1 | BerryBase Schweiz | Farnell, weitere Elektronikhändler | A0 = Topf 1, A1 = Topf 2 |
| Lampendimmung | DFRobot DFR0971 / GP8403, 2-Kanal-I²C-DAC, 0–10 V | 1 | BerryBase Schweiz | DFRobot direkt | ersetzt den manuellen Dimmer am Mean-Well-DIM-Eingang |
| Bewässerung | Kamoer PPFL-1 Peristaltikpumpe, 12 V | 2 | BerryBase Schweiz | andere Kamoer-Händler | eine Pumpe pro Topf |
| Pumpenversorgung | Mean Well 12 V / 3 A Netzteil, z. B. GST36E12-P1J | 1 | BerryBase Schweiz | Digitec/Galaxus, Distrelec/Farnell | nur für Pumpen / 12-V-Verbraucher |
| Pumpentreiber | 2-Kanal-MOSFET-Treiber für 3,3-V-GPIO | 1 | BerryBase / Bastelgarage, sofern passend verfügbar | Elektronikfachhandel | muss 3,3-V-Logik sicher erkennen und Pumpenanlaufstrom vertragen |
| Tankstatus | Schwimmerschalter oder kontaktloser Füllstandssensor | 1 | Bastelgarage / BerryBase | Farnell / Distrelec | zunächst nur Tank OK / LEER |
| Bewässerung | Silikonschlauch passend zur Pumpe | ca. 3–4 m | BerryBase Schweiz | Bastelgarage | Schlauchmaß an Pumpenkopf prüfen |
| Bewässerung | Rückschlagventile | 2 | Bastelgarage / Aquaristikhandel | BerryBase, falls passend | eines pro Bewässerungsleitung |
| Bewässerung | Tropfer oder Bewässerungsring | 2 | Bastelgarage / Gartenhandel | Aquaristik-/Bewässerungshandel | je Topf ein Ausgang |
| Verkabelung | JST-XH / geeignete Steckverbinder | nach Bedarf | BerryBase Schweiz | Bastelgarage, Farnell | für lösbare Sensor- und Steuerleitungen |
| Verkabelung | Aderendhülsen, Klemmen, Schrumpfschlauch | nach Bedarf | BerryBase / Bastelgarage | Baumarkt / Elektronikhandel | für saubere feste Installation |
| Verkabelung | Kabelkanal, Kabelverschraubungen, Zugentlastung | nach Bedarf | Baumarkt / Elektrohandel | BerryBase / Bastelgarage | Elektronik und Wasser sauber trennen |
| Lüfter | Open-Collector-/Open-Drain-PWM-Treiber | 2 Kanäle | noch festzulegen | BerryBase / Bastelgarage / Farnell | für direkte Pi-Steuerung der Noctua-Lüfter |

## Verifizierte Bezugsquellen

### BerryBase Schweiz

- Kamoer PPFL-1 12-V-Peristaltikpumpe
- ADS1115-Breakout; alternativ Soldered ADS1115
- DFRobot DFR0971 / GP8403 0–10-V-DAC
- Mean Well GST36E12-P1J 12 V / 3 A
- Silikonschlauch, Steckverbinder und diverses Installationsmaterial

Shop:
`https://www.berrybase.ch/`

### Bastelgarage Schweiz

- DFRobot SEN0308 wasserdichter kapazitiver Bodenfeuchtesensor
- alternative Bodenfeuchtesensoren
- Bewässerungs-/Pumpen-/Ventil-Zubehör
- Kabel, Module und allgemeines Elektronikzubehör

Shop:
`https://www.bastelgarage.ch/`

### Farnell Schweiz

- DFRobot SEN0308
- ADS1115- und andere professionelle Elektronikmodule
- Steckverbinder, Relais, MOSFETs und Installationskomponenten

Shop:
`https://ch.farnell.com/`

### DFRobot direkt

- SEN0308
- DFR0971 / GP8403
- technische Dokumentation und Ersatzbeschaffung

Shop:
`https://www.dfrobot.com/`

## Empfohlene Einkaufsreihenfolge

1. 2× SEN0308 + 1× ADS1115
2. DFR0971 / GP8403 für die Lampendimmung
3. 2× PPFL-1 + 12-V-Netzteil + Schlauch
4. passender 2-Kanal-MOSFET-Treiber
5. Tank-Sensor + Rückschlagventile + Tropfer
6. Stecker, Klemmen, Kabelkanal und Beschriftungsmaterial
7. später 2-Kanal-PWM-Treiber für Zuluft und Abluft

---

# Arbeitsplan / Roadmap

Die Umsetzung soll schrittweise erfolgen, damit jede Hardware-Erweiterung einzeln getestet werden kann.

## Phase 1 – Kamera fertigstellen

- [ ] neuen Raspberry-Pi-Kernel booten und prüfen
- [ ] IMX219 mit `rpicam-hello --list-cameras` testen
- [ ] Picamera2-Erkennung prüfen
- [ ] Testfoto speichern
- [ ] Kamera-Endpunkte in FastAPI ergänzen
- [ ] aktuelles Kamerabild im Dashboard anzeigen
- [ ] Foto-Button ergänzen
- [ ] später Galerie und Timelapse ergänzen

## Phase 2 – Bodenfeuchtigkeit

- [ ] ADS1115 anschließen
- [ ] I²C-Adresse prüfen
- [ ] SEN0308 für Topf 1 an A0 anschließen
- [ ] SEN0308 für Topf 2 an A1 anschließen
- [ ] Rohwerte beider Sensoren testen
- [ ] beide Sensoren separat kalibrieren
- [ ] Prozentwerte aus den Rohwerten berechnen
- [ ] Datenbank um Bodenfeuchte erweitern
- [ ] API um Feuchtewerte erweitern
- [ ] Dashboard um Topf 1 / Topf 2 erweitern
- [ ] History für Bodenfeuchte ergänzen

## Phase 3 – Lampensteuerung

- [ ] GP8600 bzw. 0–10-V-DAC anschließen
- [ ] I²C-Adresse prüfen
- [ ] 0–10-V-Ausgang ohne angeschlossene Lampe testen
- [ ] vorhandenen manuellen Dimmer dokumentieren und abklemmen
- [ ] vorhandene DIM+ / DIM−-Leitung weiterverwenden
- [ ] Mean Well XLG-150-H-AB mit dem DAC verbinden
- [ ] manuelle Leistungssteuerung 0–100 % testen
- [ ] Lichtstatus und Sollwert im Dashboard anzeigen
- [ ] Wachstum-Profil speichern
- [ ] Blüte-Profil speichern
- [ ] Umschalter Wachstum / Blüte ergänzen
- [ ] Ein-/Ausschaltzeiten pro Profil ergänzen
- [ ] manuellen Override und AUS-Schalter ergänzen
- [ ] aktive Konfiguration nach Neustart wiederherstellen
- [ ] tatsächliche Lux-/PPFD-Reaktion auf Dimmwerte kalibrieren

## Phase 4 – Bewässerung

- [ ] zwei 12-V-Peristaltikpumpen außerhalb des Schranks montieren
- [ ] separates 12-V-Netzteil für die Pumpen installieren
- [ ] 2-Kanal-MOSFET-Treiber anschließen
- [ ] Steuerleitungen vom Raspberry Pi nach außen führen
- [ ] Pumpe 1 und Pumpe 2 einzeln manuell testen
- [ ] Schlauch zu Topf 1 verlegen
- [ ] Schlauch zu Topf 2 verlegen
- [ ] Rückschlagventile / Tropfer bzw. Bewässerungsringe montieren
- [ ] Tank-Sensor installieren
- [ ] Tankstatus in FastAPI und Dashboard integrieren
- [ ] Pumpenlaufzeit gegen reale Wassermenge kalibrieren
- [ ] manuellen Bewässerungs-Button pro Topf ergänzen
- [ ] maximale Pumpdauer pro Vorgang festlegen
- [ ] Mindestpause zwischen Bewässerungen festlegen
- [ ] Tank-leer-Sperre einbauen
- [ ] Bewässerungsereignisse protokollieren
- [ ] automatische Bewässerung erst nach erfolgreicher Kalibrierung aktivieren

## Phase 5 – Lüftersteuerung

- [ ] aktuelle Noctua-Verkabelung dokumentieren
- [ ] Zuluft unten eindeutig kennzeichnen
- [ ] Abluft oben eindeutig kennzeichnen
- [ ] zwei geeignete Open-Collector-/Open-Drain-PWM-Treiber aufbauen
- [ ] 12-V-Versorgung der Lüfter beibehalten
- [ ] PWM-Kanal für Zuluft testen
- [ ] PWM-Kanal für Abluft testen
- [ ] NA-FC1 nach erfolgreichem Test ersetzen
- [ ] manuelle Lüfterleistung im Dashboard ergänzen
- [ ] Modi AUS / AUTO / MANUELL ergänzen
- [ ] Mindestdrehzahl festlegen
- [ ] Automatik auf Temperatur / RH / VPD abstimmen
- [ ] Tag-/Nachtverhalten definieren
- [ ] optionalen 230-V-Abluftlüfter separat bewerten
- [ ] falls verwendet: 230-V-Abluft nur über geeignetes Relais / Schütz schalten

---

# Mögliche Erweiterungen

Geplant bzw. sinnvoll:

- Kamera via Picamera2
- automatische Pflanzenfotos
- Timelapse
- 2× Bodenfeuchtigkeit über ADS1115
- Tank-Füllstand
- 2× getrennte automatische Bewässerung
- Bewässerungs-History
- Lampendimmung über 0–10 V
- konfigurierbare Lichtprofile Wachstum / Blüte
- manueller Licht-Override
- getrennte PWM-Steuerung für Zuluft und Abluft
- optionaler 230-V-Abluftlüfter über Relais / Schütz
- Min / Max / Durchschnitt je Zeitraum
- frei konfigurierbare Zielbereiche
- visuelle Warnungen für Temperatur / RH / VPD
- Licht-An/Aus-Zeitlinie
- DLI-History
- PPFD-History
- Export als CSV
- Backup der SQLite-Datenbank
- Benachrichtigungen bei Grenzwertüberschreitungen
- Kalibrierungsseite für Temperatur, RH, Licht und Bodenfeuchte

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
🟨 Kamera-Hardware / Picamera2 in Einrichtung
⬜ aktuelles Kamerabild im Dashboard
⬜ Timelapse
⬜ 2× Bodenfeuchtesensor
⬜ Tank-Sensor
⬜ 2× automatische Bewässerung
⬜ 0–10-V-Lampendimmung
⬜ Lichtprofile Wachstum / Blüte
⬜ Pi-PWM-Steuerung Zuluft / Abluft
⬜ Alarmierung
```
