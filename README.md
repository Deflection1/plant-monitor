# 🌿 Plant Monitor – Raspberry Pi 4

Web-Dashboard und Automatisierungsprojekt für einen Pflanzenschrank auf Basis eines **Raspberry Pi 4**.

Das System erfasst Klima-, Licht- und später Bodenfeuchtedaten, speichert Messwerte in SQLite und stellt Live-Werte sowie Zeitreihen über ein responsives Web-Dashboard dar. Schrittweise kommen Kamera, Lampendimmung, Bewässerung, Lüftersteuerung und ein externes E-Ink-Statusdisplay hinzu.

---

# Status

Stand: **29.09.2026**, Entwicklungsbranch **`test/overview-controls`**. Die folgenden Software-Erweiterungen beziehen sich auf diesen Branch; sie sind nicht automatisch auf `main` verfügbar.

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
- ✅ Liquid-Glass-Oberfläche mit Übersicht und Steuerung
- ✅ Kamera-Livestream, Galerie und Zeitraffer
- ✅ Bodenfeuchte-Konfiguration und Kalibrierungsoberfläche für zwei Töpfe
- ✅ getrennt speicherbare Lampenprofile mit eigenen SVG-Symbolen
- ✅ Bewässerungs-Konfiguration, Pumpenkalibrierungsberechnung und reine Entscheidungsvorschau
- ✅ animierbare Pumpensymbole mit separatem Animationstest
- ✅ vorbereitete Lüftersteuerung für Zu-/Abluft mit speicherbaren Sollwerten und Symbolvorschau

**Hardwaregrenze:** Lampendimmung, Bewässerung und Lüftersteuerung geben weiterhin keine Steuersignale aus. Die Bodenfeuchtesensoren müssen noch angebunden werden. Gespeicherte Automatik-Einstellungen sind keine aktive Bewässerung.

## In Arbeit / Hardware bestellt

- ✅ Raspberry Pi Camera Module v2.1 / IMX219
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
├── configuration.py       # Validierung und atomare JSON-Speicherung
├── lamp_profiles.py       # getrennte Profileinstellungen
├── irrigation.py          # Konfiguration und reine Entscheidungsvorschau
├── fan_control.py         # Lüftereinstellungen ohne PWM-Ausgabe
├── templates/
│   └── index.html
├── static/
│   ├── style.css
│   ├── app.js
│   ├── overview.js
│   ├── overview-equipment.js
│   ├── layout.js
│   ├── liquid-glass.css
│   ├── pump-icons.js
│   ├── fans.js
│   ├── profile-growth.svg
│   ├── profile-flower.svg
│   └── chart.umd.min.js
├── tests/                  # hardwareunabhängige Python-Tests
├── photos/
└── data/
    ├── plant.db
    ├── soil_moisture.json
    ├── timelapse.json
    ├── lamp_control.json
    ├── irrigation.json
    └── fan_control.json
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

## Gestaltung und Ansichten

Die Seite trennt Beobachten und Einstellen; das Liquid-Glass-Design und die vorhandenen Symbole bleiben erhalten.

**Übersicht**, von oben nach unten:

1. Verbindungsstatus und letzte Messung
2. Temperatur, Luftfeuchtigkeit, VPD und Licht
3. Topf 1/2 mit Bodenfeuchte, vorgemerktem Bewässerungsmodus und Einzelmenge
4. kompakte Versorgungskarten für Lampe, Tank/Bewässerung und Lüfter
5. Kamera mit maximal 320 px breiter Vorschau; Archiv bei Bedarf
6. aufklappbarer Klima- und Lichtverlauf einschließlich Beleuchtungsstatistik

Gespeicherte Sollwerte bleiben ausdrücklich von tatsächlichen Ausgängen getrennt. Die Versorgungskarten aktualisieren sich bei sichtbarer Übersicht alle 15 Sekunden und bei Rückkehr zur Ansicht. Abruffehler blenden alte Werte der betroffenen Karte aus. Direkte Links führen zur passenden Steuerung.

**Steuerung**, mit Sprungnavigation:

1. Licht: Profil, Leistung und Zeitplan
2. Wasser & Töpfe: gemeinsame Tankanzeige; je Topf Bodenfeuchte und passende Pumpe zusammen; Bewässerungseinstellungen und separate Sensorkalibrierung
3. Lüftung: Zu- und Abluft nebeneinander
4. Kamera und Zeitraffer
5. aufklappbare Systemdiagnose mit Rohwerten und CPU-Temperatur

Technische Grenzen und Pumpenkalibrierung sind pro Topf aufklappbar, ebenso die Mindestleistung der Lüfter. Speichern erfolgt weiterhin über die bestehenden Formulare. Die Kamera bleibt in beiden Ansichten kompakt; Vollbild ist weiterhin verfügbar. Auf Tablets können zwei Versorgungskarten nebeneinander stehen, auf schmalen Bildschirmen eine.

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

## Vorbereitet, Hardware noch ausstehend

- Bodenfeuchte je Topf mit Rohwert, Prozentwert, Namen und Kalibrierung
- Lampenleistung 0–100 % und getrennte Lichtprofile als speicherbare Einstellungen
- Tank- und Pumpenkarten; Tankstatus derzeit unbekannt, Pumpen nicht verbunden
- Bewässerungsmenge, Feuchteschwelle und Pumpenkalibrierung je Topf
- Lüfternamen, AUS/MANUELL-Modus, gewünschte Leistung und Mindestleistung je Zu-/Abluft

## Noch offen

- tatsächliche Sensor-, Tank- und Pumpen-Anbindung
- letzte Bewässerung und dauerhaftes Ereignisprotokoll
- manueller Bewässerungsstart und aktive Automatik
- tatsächliche Lampendimmung und Ausführung der Zeitpläne
- tatsächliche PWM-Ausgabe, Lüfterdrehzahl und automatische Lüfterregelung

---

# Kamera

Verwendet wird das Raspberry Pi Camera Module v2.1 / IMX219.

Umgesetzt:

- Picamera2-Erkennung
- MJPEG-Livestream im Dashboard
- manueller Foto-Button
- gespeicherte Fotos in voller IMX219-Auflösung 3280 × 2464 (8 MP), unabhängig vom 1280 × 720-Livestream
- Bild-History / Galerie
- automatische Zeitraffer-Aufnahmen mit wählbarem Intervall; Standard 12 Stunden / 2 Bilder pro Tag
- Zeitraffer-Wiedergabe direkt im Browser

---

# Bodenfeuchtigkeit

```text
SEN0308 Topf 1 -> ADS1115 A0
SEN0308 Topf 2 -> ADS1115 A1
```

Die Software-Seite ist bereits vorbereitet, obwohl ADS1115 und SEN0308 noch nicht angeschlossen sind.

Bereits umgesetzt:

- Dashboard-Bereich für Topf 1 und Topf 2
- Anzeige von Rohwert und Bodenfeuchte in %
- persistente Namen und Kalibrierwerte je Sensor
- separate Trocken-/Nass-Kalibrierung je Topf
- Speicherung der Konfiguration in `data/soil_moisture.json`
- Datenbankspalten für Rohwerte und Prozentwerte
- Bodenfeuchte-History in den bestehenden Zeiträumen
- API für Konfiguration und Status
- Prozentberechnung automatisch aus Rohwert + Kalibrierung

Sobald die Hardware angeschlossen ist, muss `sensor.py` nur noch `soil_raw_1` und `soil_raw_2` liefern. Die Prozentberechnung, Speicherung, API und Dashboard-Anzeige sind bereits vorbereitet.

API:

```text
GET  /api/soil/config
POST /api/soil/config
GET  /api/soil/status
```

Die Konfiguration bleibt nach Browser-Neuladen und Raspberry-Pi-Neustart erhalten. Trocken- und Nassreferenz müssen gültige, unterschiedliche Zahlen sein. Die daraus berechneten Prozentwerte sind eine relative Kalibrierung, kein exakt gemessener volumetrischer Wassergehalt.

---

# Bewässerung

Die komplette Pumpen- und Tanktechnik befindet sich **außerhalb des Pflanzenschranks**.

## Software-Vorbereitung

Auf dem Test-Branch sind Oberfläche, persistente Konfiguration und eine hardwareunabhängige Entscheidungsvorschau vorhanden:

- Liquid-Glass-Bereich unter Steuerung für Tank und beide Pumpen
- persistent speicherbare Namen in `data/irrigation.json`
- `GET /api/irrigation/config`, `POST /api/irrigation/config`
- `GET /api/irrigation/status` meldet ausdrücklich nicht verfügbare Hardware
- Tankstatus unbekannt; keine erfundenen Füllstände oder Bewässerungsereignisse
- deaktivierte Start-Schaltflächen; keine GPIO-Ausgabe, Timer oder Automatik
- konkrete GPIO-Zuordnung, reale Fördermengenmessung, aktive Abschaltung und Ereignisprotokollierung bleiben ausstehend

Zusätzlich werden pro Topf gespeichert:

- Automatik vorgemerkt (standardmäßig AUS; Hardwareausgabe bleibt gesperrt)
- Feuchteschwelle, feste Wassermenge pro Vorgang in ml und Tageslimit (bewusst ohne Pflanzenvorgaben)
- Einziehpause und maximale Laufzeit
- Kalibrierung: aufgefangene ml / gemessene Sekunden; daraus berechnete ml/s und Dosierdauer

Bestehende reine Namenskonfigurationen werden beim Laden ergänzt. Die Bodenfeuchtekalibrierung bleibt im vorhandenen Bodenfeuchtebereich.

Die reine Entscheidungsfunktion prüft Automatik, Tankstatus, Sensoralter (max. 120 s), Einziehpause, Tagesverbrauch, Feuchteschwelle und maximale Laufzeit. Unterhalb der Schwelle ist eine feste Einzelgabe vorgesehen; weitere Gaben brauchen eine neue Prüfung nach der Pause. Ungültige oder fehlende Statusdaten sperren die Entscheidung.

`POST /api/irrigation/preview` erlaubt ausschließlich eine Simulation mit `pot_id`, `moisture`, `sensor_age_seconds`, `tank_ok`, `seconds_since_last` und `used_today_ml`. Die Antwort enthält immer `simulation: true` und `output_available: false`.

**Noch nicht aktiv:** GPIO-Pumpentreiber, Regelungs-Worker, dauerhafte Verbrauchs-/Ereignisspeicherung und Live-Tanküberwachung. Es werden keine Pumpen gestartet. Vor realem Betrieb muss die Steuerung kalibrierte Sensorwerte verwenden, Verbrauch und Pause über Neustarts erhalten, Pumpenzugriff serialisieren und Tank-/Laufzeitabschaltung während des Pumpens überwachen. Die reine Vorschau ersetzt diese Hardwareintegration nicht.

## Einstellungen und Kalibrierung

Unter **Steuerung → Wasser & Töpfe → Bewässerung einrichten** lassen sich beide Pumpen unabhängig konfigurieren.

| Einstellung | Bedeutung |
|---|---|
| Automatik vormerken | speichert die Absicht; aktiviert derzeit keine Hardware |
| Feuchteschwelle (%) | eine Einzelgabe ist nur bei einem Wert **unterhalb** der Schwelle vorgesehen |
| Wassermenge (ml) | feste Menge pro Vorgang, frei konfigurierbar |
| Einziehpause (Minuten) | Wartezeit vor der nächsten Prüfung |
| Tageslimit (ml) | eine Einzelgabe, die das Limit überschreiten würde, wird in der Vorschau blockiert |
| Maximale Laufzeit (Sekunden) | obere Grenze für die berechnete Dauer |
| Gemessene Menge / Laufzeit | je Pumpe separat erfasste Kalibrierwerte |

Schwelle, Wassermenge, Tageslimit und Pumpenkalibrierung sind zunächst leer; Automatik ist AUS. Die anfängliche Einziehpause von 30 Minuten und Laufzeitgrenze von 60 Sekunden sind technische Startwerte, keine Empfehlung für bestimmte Pflanzen.

Nach Aufbau und Messung werden für **jede Pumpe separat** die tatsächlich aufgefangenen ml und die zugehörigen Sekunden eingetragen. Diese Messwerte stehen noch aus. Das Eingabeformular führt keinen Kalibrierlauf aus.

```text
Fördermenge (ml/s) = gemessene Menge (ml) / gemessene Laufzeit (s)
Berechnete Pumpdauer (s) = gewünschte Wassermenge (ml) / Fördermenge (ml/s)
```

Die Oberfläche zeigt Fördermenge und berechnete Laufzeit direkt an. Unvollständige Kalibrierpaare, ungültige Zahlen, eine Einzelmenge über dem Tageslimit oder eine berechnete Dauer über der Laufzeitgrenze werden beim Speichern abgelehnt.

## Pumpensymbole und Animation

- Je Pumpenkarte ein SVG mit rundem Glasgehäuse, Schlauchanschlüssen und Rotor.
- **Animation testen** dreht nur das jeweilige Symbol für etwa 3,6 Sekunden; es wird kein Pumpenbefehl gesendet.
- Die Statusanzeige fragt `GET /api/irrigation/status` regelmäßig ab.
- Eine Betriebsanimation setzt `hardware_connected: true`, `output_available: true` und `state: "running"` für die jeweilige Pumpe voraus.
- Ohne Verbindung oder bei einem Abruffehler stoppt die Betriebsanimation. Die separate Symbolvorschau ist weiterhin möglich.
- Die Betriebssystem-Einstellung für reduzierte Bewegung wird berücksichtigt; dann bleibt der Rotor auch im Vorschautest stehen.
- Der aktuelle Backend-Status meldet weiterhin fehlende Hardware. Dauerhafte Rotation ist daher noch kein realer Betriebszustand.

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

## Sicherheitslogik für den späteren Hardwarebetrieb

Die Entscheidungsvorschau prüft bereits die konfigurierten Grenzen. Die folgende aktive Durchsetzung einschließlich Abschaltung und Protokollierung muss noch an die Hardware angebunden werden:

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

Die Software-Seite ist jetzt wie bei der Bodenfeuchte bereits vorbereitet, obwohl der GP8600 noch nicht angeschlossen ist.

Bereits umgesetzt:

- eigenes Liquid-Glass-Panel für die Lampensteuerung
- persistenter Lampenname
- vorbereitete Profile: Benutzerdefiniert / Wachstum / Blüte
- pro Profil separat gespeicherte Leistung, Ein-/Ausschaltzeiten und Zeitplanstatus
- Profilwechsel lädt die zugehörigen Werte und berechnet die angezeigte Dauer neu, auch über Mitternacht
- Wachstum und Blüte mit eigenen Liquid-Glass-SVG-Symbolen
- persistenter Zielwert 0–100 %
- vorbereiteter Ein-/Ausschaltzeitplan
- Zeitplan kann vorab aktiviert/deaktiviert und gespeichert werden
- Speicherung in `data/lamp_control.json`
- sicherer Standard: **0 % Leistung und Zeitplan AUS**
- Status zeigt weiterhin **Hardware ausstehend**
- solange der GP8600 nicht angebunden ist, wird **kein 0–10-V-Ausgang angesteuert**

Neue Profile beginnen derzeit alle mit **08:00–20:00**, 0 % Leistung und deaktiviertem Zeitplan. Es gibt noch keine unterschiedlichen Standardzeiten je Phase. Alte Konfigurationen werden unter dem zuvor ausgewählten Profil übernommen. Änderungen müssen über **Einstellungen speichern** gesichert werden.

Bereits verfügbare API:

```text
GET  /api/light/config
POST /api/light/config
GET  /api/light/status
```

Für die spätere Hardwareintegration vorgesehen:

- tatsächliche 0–100-%-Ausgabe über GP8600
- nächste Umschaltung
- manueller Override
- manueller AUS-Modus
- tatsächliche Ausführung der bereits darstellbaren Zeitpläne über Mitternacht
- sichere Wiederherstellung nach Neustart
- Kalibrierung von Dimmwert zu Lux / PPFD
- spätere Endpunkte `POST /api/light/mode` und `POST /api/light/override`

---

# Lüftersteuerung

## Software-Vorbereitung

Unter **Steuerung → Lüftersteuerung** gibt es zwei Karten für **Zuluft unten** und **Abluft oben**. Beide haben ein eigenes Liquid-Glass-Lüftersymbol. **Animation testen** dreht nur das jeweilige Symbol für drei Sekunden; dabei wird kein Steuerbefehl gesendet. Reduzierte Bewegung wird berücksichtigt.

Unter **Lüfter einrichten** sind getrennt speicherbar:

| Einstellung | Bedeutung |
|---|---|
| Name | Bezeichnung des jeweiligen Lüfters |
| AUS / MANUELL | vorgemerkter Modus; standardmäßig AUS |
| Gewünschte Leistung | ganzzahliger Sollwert von 0 bis 100 %, standardmäßig 0 % |
| Mindestleistung bei Betrieb | untere Grenze für positive manuelle Sollwerte; standardmäßig 0 % und noch am Lüfter zu prüfen |

AUS oder ein gewünschter Wert von 0 % ergibt einen Sollwert von 0 %. Bei einem positiven manuellen Wert gilt der größere Wert aus gewünschter Leistung und Mindestleistung. Die Oberfläche zeigt den Entwurf und den gespeicherten Sollwert getrennt. Diese Prozentangaben sind keine gemessene Drehzahl.

- Persistente Einstellungen in `data/fan_control.json`
- `GET /api/fans/config` und `POST /api/fans/config`
- `GET /api/fans/status` mit berechnetem Sollwert, `hardware_connected: false` und `output_available: false`
- Tatsächliche Leistung und Drehzahl bleiben unbekannt (`null` / „—“).
- Keine GPIO-Zugriffe, PWM-Signale oder automatische Regelung
- AUTO ist in der Oberfläche als spätere Funktion gekennzeichnet und nicht auswählbar.
- Laden, Validierung und atomare Speicherung sind vorbereitet; ein Speicherfehler übernimmt keine neue aktive Konfiguration.

**Kanalzuordnung noch offen:** Die zwei getrennten Softwareeinstellungen bedeuten nicht, dass der vorhandene NA-FC1 bereits zwei unabhängig steuerbare PWM-Kanäle bereitstellt. Die tatsächliche Anbindung und Zuordnung muss vor der Hardwareintegration geprüft werden.

## Geplante Hardware-Anbindung

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

- [x] neuen Raspberry-Pi-Kernel booten und prüfen
- [x] IMX219 mit `rpicam-hello --list-cameras` testen
- [x] Picamera2-Erkennung prüfen
- [x] Testfoto speichern
- [x] Kamera-Endpunkte in FastAPI ergänzen
- [x] MJPEG-Livestream im Dashboard anzeigen
- [x] Foto-Button ergänzen
- [x] Bild-History / Galerie ergänzen
- [x] automatische Zeitraffer-Aufnahmen ergänzen
- [x] Zeitraffer-Wiedergabe im Browser ergänzen

## Phase 2 – Bodenfeuchtigkeit

- [ ] ADS1115 anschließen
- [ ] I²C-Adresse prüfen
- [ ] SEN0308 Topf 1 an A0 anschließen
- [ ] SEN0308 Topf 2 an A1 anschließen
- [ ] Rohwerte testen
- [ ] beide Sensoren separat kalibrieren
- [x] Prozentberechnung aus Kalibrierwerten vorbereiten
- [ ] Prozentwerte mit angeschlossenen Sensoren prüfen
- [x] Datenbank für Bodenfeuchte vorbereiten
- [x] persistente Konfigurations-API vorbereiten
- [x] Dashboard und History vorbereiten

## Phase 3 – Lampensteuerung

- [ ] GP8600 anschließen
- [ ] I²C-Adresse prüfen
- [ ] 0–10-V-Ausgang ohne Lampe testen
- [ ] vorhandenen manuellen Dimmer dokumentieren und abklemmen
- [ ] GP8600 mit DIM+ / DIM− verbinden
- [ ] 0–100-%-Steuerung testen
- [x] Dashboard-Steuerung vorbereiten
- [x] persistente Konfigurations-API vorbereiten
- [ ] GP8600-Ausgabe an Dashboard-Steuerung anbinden
- [ ] Lichtprofile und Timer aktiv ausführen
- [ ] Override / AUS ergänzen
- [x] gespeicherte Profileinstellungen nach Neustart laden
- [ ] Hardwareausgabe nach Neustart sicher wiederherstellen
- [ ] Dimmwert gegen Lux / PPFD kalibrieren

## Phase 4 – Bewässerung

- [x] Liquid-Glass-Bereich für Tank und beide Pumpen
- [x] persistente Namen und Einstellungen je Topf
- [x] einstellbare Feuchteschwelle, Einzelmenge, Pause und Grenzen
- [x] Eingabe der Pumpenkalibrierung und Berechnung der Dosierdauer
- [x] hardwareunabhängige Entscheidungslogik und Vorschau-API
- [x] Unit-Tests für Kalibrierung, Grenzwerte und Sperrbedingungen
- [x] überarbeitete Pumpensymbole mit Statusanimation und Animationstest

- [ ] Pumpen und Elektronik außerhalb des Schranks montieren
- [ ] 12-V-Netzteil installieren
- [ ] Sicherungen und MOSFET-Treiber verdrahten
- [ ] beide Pumpen einzeln testen
- [ ] Kanister, T-Stück und Schläuche montieren
- [ ] NetBow je Topf anschließen
- [ ] Schwimmerschalter installieren
- [ ] echten Schwimmerschalterstatus an die vorbereitete Tankanzeige anbinden
- [ ] Fördermenge pro Pumpe kalibrieren
- [ ] manuellen Bewässerungsstart ergänzen
- [ ] Regelungs-Worker und GPIO-Treiber anbinden
- [ ] Sicherheitsgrenzen während realer Pumpenläufe durchsetzen
- [ ] Verbrauch und Einziehpause über Neustarts erhalten
- [ ] Bewässerungsereignisse protokollieren
- [ ] Automatik erst nach erfolgreicher Kalibrierung aktivieren

## Phase 5 – Lüfter

- [x] Liquid-Glass-Karten für Zu- und Abluft
- [x] getrennte Namen, AUS/MANUELL-Sollwerte und Mindestleistung speichern
- [x] Konfigurations-/Status-API ohne Hardwareausgabe
- [x] Lüftersymbole mit separatem Animationstest
- [x] Validierung und Speicherung hardwareunabhängig testen
- [ ] tatsächliche PWM-Kanalzuordnung am vorhandenen NA-FC1 klären

- [ ] aktuelle Verkabelung dokumentieren
- [ ] Zuluft / Abluft eindeutig kennzeichnen
- [ ] NA-FC1-PWM-Eingang mit Pi-GPIO bei ca. 25 kHz testen
- [ ] Verhalten des beschädigten Reglers prüfen
- [ ] gespeicherte manuelle Sollwerte an die reale PWM-Ausgabe anbinden
- [ ] aktive AUS-/MANUELL-Ausgabe und AUTO-Regelung ergänzen
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

## Test-Branch aktualisieren

```bash
cd ~/plant-monitor
git switch test/overview-controls
git pull --ff-only
```

Nach Python-Änderungen den Dienst neu starten; anschließend die Website mit **Strg + F5** neu laden. Für reine HTML-/CSS-/JavaScript-Änderungen genügt der Browser-Reload. Eine reine README-Änderung benötigt keinen Neustart.

## Konfiguration speichern

Bodenfeuchte-, Lampen-, Zeitraffer-, Bewässerungs- und Lüftereinstellungen werden in JSON-Dateien unter `data/` gespeichert. Die Speicherung erfolgt über eine temporäre Datei und atomaren Austausch. Bei einem Speicherfehler meldet die API einen Fehler, statt die neue Konfiguration im Arbeitsspeicher als erfolgreich gespeichert zu übernehmen.

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

Hardwareunabhängige Python-Tests vom Repository-Verzeichnis aus:

```bash
python -m unittest discover -s tests -v
```

Die Bewässerungstests prüfen unter anderem Dosierdauer, getrennte Topfeinstellungen, Migration alter Namenskonfigurationen sowie Sperren bei ungültigen/veralteten Sensorwerten, unbekanntem Tankstatus, laufender Einziehpause und überschrittenem Tageslimit. Diese Tests ersetzen keinen Hardwaretest.

API-Abfragen:

```bash
curl http://127.0.0.1:8000/api/status
curl http://127.0.0.1:8000/api/current
curl http://127.0.0.1:8000/api/history?range=24h
curl http://127.0.0.1:8000/api/light/today
curl http://raspberrypi.local/api/current
curl http://127.0.0.1:8000/api/irrigation/config
curl http://127.0.0.1:8000/api/irrigation/status
curl http://127.0.0.1:8000/api/fans/config
curl http://127.0.0.1:8000/api/fans/status
```

Nach Änderungen an Python-Code (z. B. `app.py`, `sensor.py`, `database.py`, `configuration.py`, `lamp_profiles.py`, `irrigation.py` oder `fan_control.py`):

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
