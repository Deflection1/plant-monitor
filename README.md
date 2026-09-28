# 🌿 Plant Monitor – Raspberry Pi 4

Web-Dashboard und Automatisierungsprojekt für einen Pflanzenschrank auf Basis eines **Raspberry Pi 4**.

Das System erfasst Klima-, Licht- und später Bodenfeuchtedaten, speichert Messwerte in SQLite und stellt Live-Werte sowie Zeitreihen über ein responsives Web-Dashboard dar. Schrittweise kommen Kamera, Lampendimmung, Bewässerung, Lüftersteuerung und ein externes E-Ink-Statusdisplay hinzu.

---

# Status

## Bereits funktionsfähig

- ✅ Raspberry Pi 4
- ✅ Pimoroni Enviro+ als aktuelle Sensorplattform
- ✅ Temperatur und Luftfeuchtigkeit
- ✅ VPD-Berechnung
- ✅ Lux-Messung
- ✅ Lichtstatus An/Aus
- ✅ PPFD-Schätzung
- ✅ DLI-Berechnung
- ✅ tägliche Beleuchtungsdauer
- ✅ SQLite-Datenbank
- ✅ FastAPI
- ✅ Uvicorn
- ✅ Nginx Reverse Proxy
- ✅ systemd-Autostart
- ✅ Chart.js lokal
- ✅ History für 24 h, 7 d, 30 d und 1 Jahr

## In Arbeit / Hardware bestellt

- 🟨 Raspberry Pi Camera Module v2.1 / IMX219
- 📦 ADS1115 + 2× DFRobot SEN0308 für Bodenfeuchte
- 📦 DFRobot GP8600 für 0–10-V-Lampendimmung
- 📦 2× PPFL-1 Peristaltikpumpe
- 📦 2× MOSFET-Treiber
- 📦 Mean Well 12 V / 3 A Pumpennetzteil
- 📦 Schwimmerschalter für Tankstatus
- 🟨 DFRobot Gravity Umgebungssensor als Enviro+-Ersatz geplant
- 🟨 PWM-Test der Noctua-Lüfter über den vorhandenen NA-FC1 geplant
- 🟨 E-Ink-Statusdisplay außen am Schrank geplant

---

# Zielarchitektur

Das Enviro+ wird aktuell noch verwendet, soll aber später durch einen separaten kombinierten Umgebungssensor ersetzt werden. Dadurch wird der 40-Pin-Header wieder frei und die Sensoren können an einer besseren Messposition montiert werden.

```text
Raspberry Pi 4
│
├── I²C
│   ├── DFRobot Gravity Umgebungssensor
│   │    ├── Temperatur
│   │    ├── Luftfeuchtigkeit
│   │    ├── Luftdruck
│   │    ├── UV
│   │    └── Helligkeit
│   ├── ADS1115
│   │    ├── A0 -> SEN0308 Topf 1
│   │    └── A1 -> SEN0308 Topf 2
│   └── GP8600
│        └── 0–10 V -> Mean Well DIM+ / DIM-
│
├── GPIO -> Pumpe 1
├── GPIO -> Pumpe 2
├── GPIO -> Schwimmerschalter
├── PWM GPIO -> Noctua NA-FC1
├── CSI -> Raspberry Pi Camera v2.1
│
├── FastAPI / SQLite / Dashboard
│
└── später E-Ink-Statusdisplay
```

Die Pumpen bleiben vollständig auf einer separaten 12-V-Leistungsseite. Der Raspberry Pi liefert nur Steuersignale.

---

# Hardware

## Bereits vorhanden

- Raspberry Pi 4
- Pimoroni Enviro+ HAT
- Raspberry Pi Camera Module v2.1 / IMX219
- Mean Well XLG-150-H-AB LED-Netzteil
- LED-Pflanzenlampe
- 2× Noctua 4-Pin-PWM-Lüfter
  - Zuluft unten
  - Abluft oben
- Noctua NA-FC1

## Bestellt am 28.09.2026

### BerryBase Schweiz

| Bereich | Komponente | Menge |
|---|---|---:|
| Analogmessung | Soldered ADS1115 16-Bit, 4 Kanäle, Qwiic/I²C, 3,3 V | 1 |
| Kamera | KKSB Kamerahalter, 2-Achsen-Rotation, Metall | 1 |
| Bewässerung | PPFL-1 Peristaltikpumpe 12 V | 2 |
| Bewässerung | Silikonschlauch 3 mm ID / 5 mm OD, 1 m | 4 |
| Bewässerung | Adafruit Schlauchverbinder für 2–3-mm-Schläuche | 1 Pack |
| Bewässerung | Adafruit T-Connector für 3-mm-ID-Schläuche | 1 Pack |
| Tankstatus | vertikaler Schwimmerschalter WLSW1 | 1 |
| Pumpenversorgung | Mean Well GST36E12-P1J, 12 V / 3 A | 1 |
| Pumpenversorgung | DC-Einbaubuchse 5,5 × 2,1 mm, Metall | 1 |
| Absicherung | PROFFUSE Sicherungshalter 5×20 mm | 2 |
| Absicherung | 160-teiliges Sicherungssortiment 500 mA–10 A | 1 |
| Aufbau | Mini-Breadboard 170 Kontakte | 2 |
| Aufbau | Dupont Male–Female 50 cm | 1 Satz |
| Aufbau | Dupont Male–Male 10 cm | 1 Satz |
| Aufbau | Stiftleiste 1×7, RM 2,54 mm | 1 |
| Verkabelung | Kupferlitze 0,14 mm², 10 Farben × 10 m | 1 Set |
| Verkabelung | Kupferlitze 0,75 mm² schwarz, 10 m | 1 |
| Verkabelung | Kupferlitze 0,75 mm² rot, 10 m | 1 |
| Gehäuse | Modulgehäuse 45 × 45 × 18 mm | 2 |
| Gehäuse | Universalgehäuse 205 × 180 × 70 mm | 1 |
| Bedienung | Kippschalter mit Schutzkappe und LED, 12 V / 20 A | 1 |
| Isolation | Schrumpfschlauch-Set, 100-teilig | 1 |

BerryBase-Bestellung: **22 Positionen / 29 Einzelartikel**.

### Bastelgarage Schweiz

| Bereich | Komponente | Menge |
|---|---|---:|
| Bodenfeuchte | DFRobot SEN0308 wasserdichter kapazitiver Bodenfeuchtesensor | 2 |
| Pumpensteuerung | 15-A-/400-W-MOSFET-Treiber, 5–36 V DC, 3,3-V-steuerbar | 2 |
| Lampendimmung | DFRobot GP8600, 1-Kanal I²C/PWM zu 0–10 V | 1 |

### Separat geplant

- 1× DFRobot Gravity Umgebungssensor für Temperatur, Luftfeuchtigkeit, Luftdruck, UV und Helligkeit

## Gehäuseaufteilung

Die beiden kleinen Modulgehäuse sind für die Signaltechnik vorgesehen:

```text
45 × 45 × 18 mm Gehäuse 1
-> GP8600 / Lampendimmung

45 × 45 × 18 mm Gehäuse 2
-> ADS1115 / Bodenfeuchte-Signaltechnik
```

Die große Euro-Box ist für die externe Bewässerungselektronik vorgesehen:

```text
205 × 180 × 70 mm
├── 12-V-Verteilung
├── Sicherungen
├── MOSFET-Treiber
├── Pumpenanschlüsse
└── Hauptschalter
```

Verbindungsklemmen und weiteres Montagematerial werden bei Bedarf lokal beschafft.

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

Das Projekt verwendet:

```text
/home/pi/.virtualenvs/pimoroni
```

FastAPI und Uvicorn laufen ebenfalls aus dieser Umgebung.

Installation der Web-Abhängigkeiten:

```bash
source ~/.virtualenvs/pimoroni/bin/activate
pip install fastapi uvicorn jinja2
```

---

# Aktuelle Sensorik

## Temperatur und Luftfeuchtigkeit

Aktuell stammen Temperatur und Luftfeuchtigkeit vom BME280 auf dem Enviro+.

Da der Sensor direkt über dem Raspberry Pi sitzt, wird die Temperatur durch die Pi-Abwärme beeinflusst.

Beispiel:

```text
BME280 Rohwert:     ~40 °C
CPU:                ~58 °C
korrigierter Wert:  ~32 °C
```

Aktuelle heuristische Korrektur:

```python
TEMP_FACTOR = 2.25

corrected_temperature = (
    raw_temperature
    - ((cpu_temperature - raw_temperature) / TEMP_FACTOR)
)
```

Die relative Luftfeuchtigkeit wird anschließend temperaturabhängig korrigiert.

Mit dem geplanten Gravity-Umgebungssensor soll diese Korrektur entfallen, da der Sensor räumlich vom Raspberry Pi getrennt montiert wird.

## VPD

```text
VPD = es(T) × (1 - RH / 100)
```

mit:

- `T` = Temperatur in °C
- `RH` = relative Luftfeuchtigkeit in %
- Ergebnis = kPa

Der VPD wird im Projekt aus Temperatur und Luftfeuchtigkeit berechnet.

## Licht

Aktuell liefert der LTR-559 des Enviro+ die Lux-Werte.

Beobachtete Werte:

```text
Schrank / Lampe aus:          ca. 4 Lux
Lampe mittlere Helligkeit:    ca. 1.800 Lux
Enviro+ bei voller Lampe:     ca. 13.352 Lux
Direkt unter Lampenmitte:     ca. 22.600 Lux
```

Die Lampe gilt ab:

```python
LIGHT_ON_LUX = 100.0
```

als eingeschaltet.

---

# PPFD und DLI

## Lux -> PPFD

Aktueller projektspezifischer Arbeitsfaktor:

```text
52,5 Lux ≈ 1 µmol/m²/s PPFD
```

```python
LUX_PER_PPFD = 52.5
```

Beispiele:

```text
22.600 Lux / 52,5 ≈ 430 µmol/m²/s
13.000 Lux / 52,5 ≈ 248 µmol/m²/s
13.352 Lux / 52,5 ≈ 254 µmol/m²/s
```

Die PPFD-Werte sind Schätzwerte. Für exakte Messungen wäre ein PAR-/Quantum-Sensor nötig.

## Pflanzenmitte

Vergleichsmessung:

```text
Pflanzen-/Lampenmitte:  ~430 µmol/m²/s
Sensorposition:          ~250 µmol/m²/s
```

Daraus:

```python
CENTER_FACTOR = 1.72
```

```text
PPFD Pflanzenmitte = PPFD Sensor × 1,72
```

Dieser Faktor gilt nur für die aktuelle Position von Lampe und Sensor.

## DLI

```text
DLI =
Summe(PPFD × Messintervall in Sekunden)
/
1.000.000
```

Das Dashboard integriert die aufgezeichneten Lichtwerte über den Tag.

Zum Schutz vor Datenlücken:

```python
MAX_SAMPLE_GAP_SECONDS = 120
```

---

# Datenbank und Messintervall

Datenbank:

```text
~/plant-monitor/data/plant.db
```

Aktuelle Tabelle:

```sql
measurements
```

Aktuell gespeicherte Felder:

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

PPFD und DLI werden derzeit aus Lux berechnet.

Messintervall:

```text
ca. 60 Sekunden
```

History-Aggregation:

```text
24h    -> 1 Minute
7d     -> 10 Minuten
30d    -> 1 Stunde
1 Jahr -> 1 Tag
```

Konfiguration:

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

## History

```http
GET /api/history?range=24h
GET /api/history?range=7d
GET /api/history?range=30d
GET /api/history?range=1y
```

## Lichtdaten des aktuellen Tages

```http
GET /api/light/today
```

---

# Dashboard

## Aktuell

Live-Anzeige:

- Temperatur
- Luftfeuchtigkeit
- VPD
- Lux
- CPU-Temperatur
- rohe Temperatur
- rohe Luftfeuchtigkeit

Licht:

- Licht An/Aus
- Lux
- PPFD am Sensor
- geschätzter PPFD Pflanzenmitte
- tägliche Beleuchtungsdauer
- DLI heute
- Tagesmaximum Lux
- maximales geschätztes PPFD

History:

- Temperatur
- Luftfeuchtigkeit
- VPD
- Licht
- Zeiträume 24 h / 7 d / 30 d / 1 Jahr

## Geplant

- Feuchtigkeit Topf 1 / Topf 2
- Tankstatus
- letzte Bewässerung je Topf
- manueller Bewässerungsstart
- Pumpenstatus
- Lampenleistung 0–100 %
- aktives Lichtprofil
- Zuluft-/Abluftleistung
- Automatik-/Manuell-Modi
- Kamerabild / Galerie / Timelapse

---

# Kamera

Verwendet wird das Raspberry Pi Camera Module v2.1 / IMX219.

Geplant:

- Picamera2-Erkennung
- aktuelles Bild im Dashboard
- manueller Foto-Button
- Galerie
- automatische Fotos
- Timelapse

---

# Bodenfeuchtigkeit

```text
SEN0308 Topf 1 -> ADS1115 A0
SEN0308 Topf 2 -> ADS1115 A1
```

Jeder Sensor wird separat kalibriert.

Geplant sind:

- Rohwerte
- Prozentwerte
- Datenbank-History
- Anzeige im Dashboard
- spätere Nutzung als Eingang für die Bewässerungslogik

---

# Bewässerung

Die komplette Pumpen- und Tanktechnik befindet sich **außerhalb des Pflanzenschranks**.

## Wasserkreis

```text
Kanister
   │
   └── T-Connector
        ├── Pumpe 1 -> Netafim NetBow Topf 1
        └── Pumpe 2 -> Netafim NetBow Topf 2
```

Verwendet werden:

- 2× PPFL-1 12-V-Peristaltikpumpe
- 3 mm ID / 5 mm OD Silikonschlauch
- Netafim NetBow als Wasserauslass je Topf
- vertikaler Schwimmerschalter im Kanister
- keine Rückschlagventile vorgesehen

## Elektrik

```text
Mean Well 12 V / 3 A
   │
   ├── Sicherung 1 -> MOSFET 1 -> Pumpe 1
   └── Sicherung 2 -> MOSFET 2 -> Pumpe 2

Raspberry Pi
   ├── GPIO -> MOSFET 1
   ├── GPIO -> MOSFET 2
   └── GPIO -> Schwimmerschalter
```

Die Pumpen werden niemals direkt vom Raspberry Pi versorgt.

## Sicherheitslogik

- maximale Pumpdauer pro Vorgang
- Mindestpause zwischen Bewässerungen
- Tank-leer-Sperre
- manueller Stop / Override
- getrennte Steuerung je Topf
- Protokollierung jeder Bewässerung
- Kalibrierung der realen Fördermenge in ml/s

---

# Lampensteuerung

Vorhandener LED-Treiber:

```text
Mean Well XLG-150-H-AB
```

Die Steuerung erfolgt über dessen Dimm-Eingang, nicht über die 230-V-Seite.

```text
Raspberry Pi
   │
   └── I²C
        │
        ▼
GP8600 0–10-V-DAC
        │
        ├── OUT+ -> Mean Well DIM+
        └── OUT- -> Mean Well DIM-
```

Der vorhandene manuelle Dimmer soll durch den GP8600 ersetzt werden.

Geplante Funktionen:

- manuelle Leistung 0–100 %
- speicherbare Lichtprofile
- Ein-/Ausschaltzeiten
- Anzeige des aktiven Profils
- nächste Umschaltung
- manueller Override
- manueller AUS-Modus
- Zeitpläne über Mitternacht
- Wiederherstellung nach Neustart
- Kalibrierung von Dimmwert zu Lux / PPFD

Geplante API:

```text
GET  /api/light/config
POST /api/light/config
POST /api/light/mode
POST /api/light/override
GET  /api/light/status
```

---

# Lüftersteuerung

Vorhanden:

```text
Zuluft unten
Abluft oben
```

Beide Lüfter sind 4-Pin-Noctua-PWM-Lüfter.

Als erster Schritt bleibt der **NA-FC1** erhalten. Der Raspberry Pi soll ein PWM-Signal mit etwa 25 kHz an dessen PWM-Eingang liefern.

```text
Raspberry Pi
   ├── GND -> NA-FC1 GND
   └── PWM -> NA-FC1 PWM-Eingang

NA-FC1
   └── Noctua-Lüfter
```

Die 12-V-Versorgung der Lüfter bleibt separat.

Zuerst wird geprüft, ob der beschädigte Drehregler des NA-FC1 das externe PWM-Signal beeinflusst. Ein zusätzlicher Pegelwandler oder Lüftertreiber wird deshalb vorerst nicht beschafft.

Später vorgesehen:

- AUS / AUTO / MANUELL
- Leistungswert in %
- temperaturabhängige Regelung
- RH-/VPD-basierte Regelung
- Tag-/Nachtverhalten
- Mindestdrehzahl

Ein optionaler 230-V-Rohrlüfter würde nur über ein dafür geeignetes galvanisch getrenntes Relais bzw. Schütz geschaltet.

---

# Umgebungssensor als Enviro+-Ersatz

Geplant ist ein kombinierter DFRobot Gravity Umgebungssensor für:

- Temperatur
- Luftfeuchtigkeit
- Luftdruck
- UV
- Helligkeit

Vorteile gegenüber dem Enviro+:

- Sensor kann auf geeigneter Messhöhe montiert werden
- keine direkte Pi-Abwärme
- keine heuristische CPU-Temperaturkorrektur nötig
- zusätzlicher UV-Messwert
- 40-Pin-Header des Raspberry Pi wird frei
- mehr direkte GPIOs für Pumpen, Schwimmerschalter und Lüfter-PWM

Das Enviro+ wird bis zur erfolgreichen Migration weiterverwendet.

---

# E-Ink-Statusdisplay

Später ist außen am Schrank ein separates E-Ink-Display vorgesehen, idealerweise in einem Holzrahmen.

Das E-Ink-Display dient als ruhige Statusanzeige; die vollständige Bedienung bleibt im Web-Dashboard.

Mögliche Inhalte:

- Temperatur
- Luftfeuchtigkeit
- VPD
- Bodenfeuchte Topf 1 / Topf 2
- Tankstatus
- Lichtstatus / Leistung
- letzte Bewässerung
- Systemstatus

---

# Roadmap

Die Hardware wird schrittweise integriert, damit jede Stufe einzeln getestet werden kann.

## Phase 1 – Kamera

- [ ] neuen Raspberry-Pi-Kernel booten und prüfen
- [ ] IMX219 mit `rpicam-hello --list-cameras` testen
- [ ] Picamera2-Erkennung prüfen
- [ ] Testfoto speichern
- [ ] Kamera-Endpunkte in FastAPI ergänzen
- [ ] Kamerabild im Dashboard anzeigen
- [ ] Foto-Button ergänzen
- [ ] Galerie / Timelapse ergänzen

## Phase 2 – Bodenfeuchtigkeit

- [ ] ADS1115 anschließen
- [ ] I²C-Adresse prüfen
- [ ] SEN0308 Topf 1 an A0 anschließen
- [ ] SEN0308 Topf 2 an A1 anschließen
- [ ] Rohwerte testen
- [ ] beide Sensoren separat kalibrieren
- [ ] Prozentwerte berechnen
- [ ] Datenbank erweitern
- [ ] API erweitern
- [ ] Dashboard und History erweitern

## Phase 3 – Lampensteuerung

- [ ] GP8600 anschließen
- [ ] I²C-Adresse prüfen
- [ ] 0–10-V-Ausgang ohne Lampe testen
- [ ] vorhandenen manuellen Dimmer dokumentieren und abklemmen
- [ ] GP8600 mit DIM+ / DIM− verbinden
- [ ] 0–100-%-Steuerung testen
- [ ] Dashboard-Steuerung ergänzen
- [ ] Lichtprofile und Timer ergänzen
- [ ] Override / AUS ergänzen
- [ ] Konfiguration nach Neustart wiederherstellen
- [ ] Dimmwert gegen Lux / PPFD kalibrieren

## Phase 4 – Bewässerung

- [ ] Pumpen und Elektronik außerhalb des Schranks montieren
- [ ] 12-V-Netzteil installieren
- [ ] Sicherungen und MOSFET-Treiber verdrahten
- [ ] beide Pumpen einzeln testen
- [ ] Kanister, T-Stück und Schläuche montieren
- [ ] NetBow je Topf anschließen
- [ ] Schwimmerschalter installieren
- [ ] Tankstatus ins Dashboard integrieren
- [ ] Fördermenge pro Pumpe kalibrieren
- [ ] manuellen Bewässerungsstart ergänzen
- [ ] Sicherheitsgrenzen implementieren
- [ ] Bewässerungsereignisse protokollieren
- [ ] Automatik erst nach erfolgreicher Kalibrierung aktivieren

## Phase 5 – Lüfter

- [ ] aktuelle Verkabelung dokumentieren
- [ ] Zuluft / Abluft eindeutig kennzeichnen
- [ ] NA-FC1-PWM-Eingang mit Pi-GPIO bei ca. 25 kHz testen
- [ ] Verhalten des beschädigten Reglers prüfen
- [ ] manuelle Lüftersteuerung ins Dashboard integrieren
- [ ] AUS / AUTO / MANUELL ergänzen
- [ ] Mindestdrehzahl festlegen
- [ ] Automatik auf Temperatur / RH / VPD abstimmen

## Phase 6 – Enviro+-Migration

- [ ] Gravity-Umgebungssensor montieren
- [ ] I²C-Kommunikation testen
- [ ] Temperatur / RH / Luftdruck / Lux / UV auslesen
- [ ] `sensor.py` umstellen
- [ ] alte Enviro+-Korrektur entfernen
- [ ] Messwerte vergleichen
- [ ] Enviro+ entfernen
- [ ] GPIO-Belegung finalisieren

## Phase 7 – E-Ink

- [ ] Displaygröße und Modell festlegen
- [ ] Holzrahmen planen
- [ ] Statuslayout erstellen
- [ ] Daten aus der FastAPI-API übernehmen
- [ ] Aktualisierungsintervall festlegen
- [ ] Montage außen am Schrank

---

# Spätere Erweiterungen

Diese Punkte sind nicht Teil der unmittelbar geplanten Hardwareintegration:

- erweiterte Bewässerungs-History und Statistiken
- Min / Max / Durchschnitt je Zeitraum
- frei konfigurierbare Zielbereiche
- Warnungen bei Temperatur-, RH- oder VPD-Grenzwerten
- Benachrichtigungen bei kritischen Zuständen
- Licht-An/Aus-Zeitlinie
- DLI- und PPFD-History
- CSV-Export
- automatische SQLite-Backups
- Kalibrierungsseite für Temperatur, RH, Licht und Bodenfeuchte
- optionaler 230-V-Abluftlüfter über geeignetes Relais / Schütz

---

# Betrieb

## Uvicorn manuell starten

```bash
cd ~/plant-monitor

/home/pi/.virtualenvs/pimoroni/bin/uvicorn     app:app     --host 127.0.0.1     --port 8000
```

## systemd

Datei:

```text
/etc/systemd/system/plant-monitor.service
```

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

Befehle:

```bash
sudo systemctl daemon-reload
sudo systemctl restart plant-monitor
sudo systemctl enable plant-monitor
sudo systemctl status plant-monitor
journalctl -u plant-monitor -f
```

## Nginx

Uvicorn läuft nur auf:

```text
127.0.0.1:8000
```

Nginx stellt das Dashboard auf Port 80 bereit.

Beispiel:

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

Dashboard:

```text
http://raspberrypi.local/
```

---

# Tests

```bash
curl http://127.0.0.1:8000/api/status
curl http://127.0.0.1:8000/api/current
curl http://127.0.0.1:8000/api/history?range=24h
curl http://127.0.0.1:8000/api/light/today
curl http://raspberrypi.local/api/current
```

Nach Änderungen an `app.py`, `sensor.py` oder `database.py`:

```bash
sudo systemctl restart plant-monitor
```

Bei Änderungen an HTML/CSS/JavaScript reicht normalerweise ein Browser-Reload.

---

# Hinweise zur Messgenauigkeit

Das Projekt ist ein Monitoring- und Automatisierungssystem und kein kalibriertes Laborinstrument.

## Temperatur / Feuchte

Die aktuelle Enviro+-Messung wird durch die Raspberry-Pi-Abwärme beeinflusst. Dieser Punkt soll mit dem extern montierten Gravity-Umgebungssensor behoben werden.

## PPFD / DLI

Die Umrechnung von Lux zu PPFD hängt vom Spektrum der Lampe ab.

Aktueller Arbeitswert:

```text
52,5 Lux pro µmol/m²/s
```

Geschätzte Unsicherheit:

```text
±15–20 %
```

Für exakte PPFD-/DLI-Werte wäre ein PAR-/Quantum-Sensor erforderlich.

---

# Lizenz

Noch nicht festgelegt.

Für ein öffentliches Open-Source-Repository kann später beispielsweise eine MIT-Lizenz ergänzt werden.
