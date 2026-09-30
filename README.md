# Plant Monitor

Web-Dashboard für einen Pflanzenschrank auf einem Raspberry Pi 4.
FastAPI erfasst Klima- und Lichtwerte, SQLite speichert den Verlauf und
das responsive Dashboard zeigt Messwerte, Kamera und Geräteeinstellungen.

Stand: **01.10.2026 · `main`**. Das Windows-2000-Design und die
SEN0501-Integration sind in den Hauptbranch übernommen.

## Funktionsstand

| Bereich | Aktueller Stand | Noch offen |
|---|---|---|
| Umgebungssensor | SEN0501 V2.0 auf Bus 3 / `0x22`; Temperatur, Feuchte, Lux, Luftdruck und UV ausgelesen | Referenzkalibrierung |
| Klima | Livewerte, Luft-VPD und gespeicherter Verlauf | Zielbereiche und Warnungen |
| Lichtmessung | Lux, Lichtstatus, geschätzte PPFD/DLI, Tagesmaximum und Beleuchtungsdauer | Spektrale Referenzmessung |
| Oberfläche | Übersicht und Steuerung; Glasdesign und Windows 2000 | Weitere Designs |
| Kamera | IMX219: Livestream, Fotos, Galerie und Zeitraffer | — |
| Bodenfeuchte | Zwei Topfkonfigurationen, Kalibrierung, Prozentberechnung und Verlauf vorbereitet | ADS1115-/SEN0308-Lesetreiber und Hardwaretest |
| Pflanzenlampe | Getrennte Profile und Zeitpläne gespeichert; GP8600-Treiber und separates Testprogramm vorhanden | Ausgangsspannung messen, Dashboard-Ausgabe und Zeitplanausführung |
| Bewässerung | Einstellungen, Dosierberechnung, Entscheidungsvorschau und Ereignisspeicher vorhanden | Pumpen-/Tanktreiber und aktive Regelung |
| Lüftung | Getrennte Sollwerte für Zu- und Abluft gespeichert | Pi-PWM, Drehzahlerfassung und Automatik |
| E-Ink | Externes Statusdisplay geplant | Modell, Anschluss und Umsetzung |

**Die Website steuert derzeit keine Lampen-, Pumpen- oder Lüfterausgänge.**
Das separate GP8600-Testprogramm kann mit ausdrücklich gesetzten Testflags
einen Ausgang ansteuern. Gespeicherte Automatik- und Zeitplaneinstellungen
aktivieren noch keine Hardware.

Der Enviro+ ist entfernt und wird vom Sensorcode nicht mehr verwendet.
Die frühere CPU-basierte Temperatur-/Feuchtekorrektur ist entfallen.

## Inhalt

- [Betrieb auf dem Raspberry Pi](#betrieb-auf-dem-raspberry-pi)
- [Oberfläche](#oberfläche)
- [Sensor und Messgrundlagen](#sensor-und-messgrundlagen)
- [Gerätevorbereitung](#gerätevorbereitung)
- [Daten und API](#daten-und-api)
- [Projektdateien und Prüfungen](#projektdateien-und-prüfungen)
- [Nächste Schritte](#nächste-schritte)
- [Hardwarebestand und Bestellungen](#hardwarebestand-und-bestellungen)

## Betrieb auf dem Raspberry Pi

### Umgebung und Abhängigkeiten

Die vorhandene Installation verwendet Raspberry Pi OS Bookworm und
`/home/pi/.virtualenvs/pimoroni`. Benutzername und Pfade in den Beispielen
bei einer anderen Installation anpassen.

`app.py` benötigt zusätzlich **Picamera2** und dessen Raspberry-Pi-Systembibliotheken.
Diese müssen in der Python-Umgebung verfügbar sein; die folgenden
Web-/I²C-Pakete allein reichen für eine Neuinstallation nicht aus.

```bash
cd ~/plant-monitor
/home/pi/.virtualenvs/pimoroni/bin/python -m pip install fastapi uvicorn jinja2 smbus2
/home/pi/.virtualenvs/pimoroni/bin/python -c 'from picamera2 import Picamera2; from sensor import read_sensors; print(read_sensors())'
```

Dashboard im lokalen Netz: [http://raspberrypi.local/](http://raspberrypi.local/).

### Aktualisieren

Lokale Änderungen vor einem Branchwechsel mit `git status` prüfen.

```bash
cd ~/plant-monitor
git status --short --branch
git switch main
git pull --ff-only
```

Nach Python-Änderungen:

```bash
sudo systemctl restart plant-monitor
sudo systemctl status plant-monitor --no-pager -l
```

Anschließend die Website mit **Strg+F5** neu laden.
Reine CSS-/JavaScript-Änderungen benötigen normalerweise nur einen Browser-Reload.
**README-Änderungen benötigen keinen Dienstneustart.**

### systemd

Beispiel für `/etc/systemd/system/plant-monitor.service`:

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

Nach einer Änderung der Unit:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now plant-monitor
sudo systemctl restart plant-monitor
```

Dienstprotokoll:

```bash
journalctl -u plant-monitor -f
```

Für einen manuellen Start den bestehenden Dienst zunächst stoppen, damit
Port und Kamera nicht gleichzeitig von zwei Prozessen verwendet werden:

```bash
sudo systemctl stop plant-monitor
cd ~/plant-monitor
/home/pi/.virtualenvs/pimoroni/bin/uvicorn app:app --host 127.0.0.1 --port 8000
```

Nach Ende des manuellen Starts den Dienst wieder mit
`sudo systemctl start plant-monitor` starten.

### Nginx

Uvicorn lauscht auf `127.0.0.1:8000`; Nginx stellt das Dashboard auf Port 80 bereit.

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

## Oberfläche

**Übersicht:** Livewerte für Temperatur, Feuchte, VPD und Licht, zwei Töpfe,
Versorgungskarten für Lampe/Bewässerung/Lüfter, Messverläufe und Kamera.
UV steht im Verlauf nach den beiden Bodenfeuchtediagrammen.
Galerie und Zeitraffer sind bei Bedarf aufklappbar.

**Steuerung:** Sprungnavigation zu Licht, Wasser & Töpfen, Lüftung und
Systemdiagnose. Geräteeinstellungen und Kalibrierungen bleiben von den
tatsächlichen Hardwarezuständen getrennt.

### Designauswahl

Oben lässt sich zwischen **Standard · Glasdesign** und **Windows 2000**
wechseln; Glas ist die Voreinstellung. Beide Designs gehören zu `main`
und verwenden dieselben Funktionen und APIs.

Die Auswahl gilt für beide Ansichten und wird im jeweiligen Browser unter
`plant-monitor.design` gespeichert. Symbole, Profilbilder und Diagrammfarben
wechseln mit. Ist Browserspeicherung blockiert, funktioniert der Wechsel
für die aktuelle Seite trotzdem. Geräteeinstellungen bleiben davon unabhängig.

### Aktualisierung

| Anzeige | Intervall |
|---|---|
| Livewerte | 5 Sekunden |
| Verläufe und Licht-Tagesstatistik | 60 Sekunden |
| Versorgungskarten der sichtbaren Übersicht | 15 Sekunden |
| Neue Messung in SQLite | ungefähr 60 Sekunden, zuzüglich Auslesedauer |

Die Browserabfrage ist kein Nachweis für das interne Messintervall des Sensors.
Gleichbleibende gerundete Temperatur-/Feuchtewerte sind möglich.

Das Lichtsymbol folgt gültigen Lux-/Lichtstatuswerten. Nach einem Abruffehler
oder mehr als 20 Sekunden ohne gültigen Empfang wird sein Zustand unbekannt.
Die Frischeprüfung beruht auf dem Empfang im Browser.
`/api/status` meldet derzeit pauschal „online“; es ist kein umfassender
Nachweis für Sensorzustand und erfolgreiche Datenaufzeichnung.

## Sensor und Messgrundlagen

### SEN0501 V2.0 anschließen

Aktive Messquelle: **DFRobot SEN0501 V2.0**, I²C-Bus **3**, Adresse **`0x22`**.
Die folgende Belegung dokumentiert den bestehenden Aufbau:

| Gerät | Signal | BCM-GPIO | Physischer Pi-Pin |
|---|---|---:|---:|
| SEN0501 | + / 3,3 V | — | 17 |
| SEN0501 | − / GND | — | 9 |
| SEN0501 | D/T / SDA | 4 | 7 |
| SEN0501 | C/R / SCL | 5 | 29 |
| GP8600 | + / 3,3 V | — | 1 |
| GP8600 | − / GND | — | 6 |
| GP8600 | D / SDA | 2 | 3 |
| GP8600 | C / SCL | 3 | 5 |

SEN0501-Schalter auf I²C. In `/boot/firmware/config.txt` unter `[all]`:

```ini
dtparam=i2c_arm=on
dtoverlay=i2c3,pins_4_5
```

Nach einer Änderung neu starten. Bei angeschlossenen Modulen prüfen:

```bash
i2cdetect -y 3
i2cdetect -y 1
```

Erwartet: `22` auf Bus 3; beim GP8600 mit A0/A1/A2 auf 0: `58` auf Bus 1.
Die beiden Busse haben getrennte Datenleitungen und gemeinsame Versorgung/Masse.

### Temperatur, Feuchte und VPD

Temperatur und Feuchte werden ohne CPU-Korrektur übernommen.
`raw_temperature` und `temperature` beziehungsweise `raw_humidity` und
`humidity` enthalten deshalb dieselben gerundeten Sensorwerte.
Die CPU-Temperatur dient nur der Diagnose.

Beim ersten Vergleich lieferte der SEN0501 **25,1 °C / 51,2 % RH**,
das analoge Gerät ungefähr **25 °C / 53 % RH**. Das ist ein
Plausibilitätsvergleich, keine abgeschlossene Referenzkalibrierung.

VPD wird aus ungerundeter Lufttemperatur und Feuchte berechnet:

```text
es(T) = 0,6108 × exp(17,27 × T / (T + 237,3))
VPD = es(T) × (1 − RH / 100)
```

Ergebnis in kPa. Es handelt sich um **Luft-VPD**; eine Blatttemperatur wird
nicht gemessen. Der Wert übernimmt die Unsicherheit der Eingangsmessungen.

Sensorzugriffe erfolgen erst bei einer Messung, nicht beim Import.
Ein nicht erreichbarer Sensor verhindert deshalb nicht den Website-Start.
Betroffene Liveabfragen liefern HTTP 503; der Messworker protokolliert Fehler
und speichert keine erfundenen Ersatzmessungen.

### Lux, PPFD und DLI

Lux wird direkt vom SEN0501 gelesen und umgerechnet.
Ab **100 Lux** gilt Licht als erkannt. Das ist ein optischer Status am Sensor,
keine elektrische Rückmeldung des Lampentreibers; Fremdlicht kann ihn beeinflussen.

Die spektrale Umrechnung bleibt eine unbestätigte Schätzung:

```text
PPFD Sensor ≈ Lux / 52,5
PPFD Referenzpunkt ≈ PPFD Sensor × 4,68
```

Konstanten in `database.py`: `LUX_PER_PPFD = 52.5`,
`CENTER_FACTOR = 4.68`, `LIGHT_ON_LUX = 100.0`.

Der Positionsfaktor stammt aus dem SEN0501-Vergleich vom 30.09.2026
bei gleicher Dimmung:

| Messposition | Lux |
|---|---:|
| Feste Wandposition | ca. 4060 |
| Mittig, 24 cm über dem Topf, Messseite nach oben | 18 000–20 000 |

Arbeitswert: **19 000 / 4060 ≈ 4,68**, gemessene Spanne etwa 4,43–4,93.
Bei 4060 Lux ergeben sich ungefähr 77,3 µmol/m²/s am Sensor und
361,9 µmol/m²/s am Referenzpunkt.

Der Faktor ersetzt den früheren Wert 1,72 und gilt nur für die verglichene
Geometrie und Sensorausrichtung. Bei Änderung von Lampenposition,
Sensorposition oder Referenzhöhe erneut messen. Er beschreibt keine
allgemeine Lichtverteilung über alle Pflanzen.

DLI integriert die geschätzte PPFD über die aufgezeichnete Zeit:

```text
DLI (mol/m²) = Summe(PPFD × Intervall in Sekunden) / 1 000 000
```

Pro Messwert werden höchstens **120 Sekunden** integriert.
Grössere Datenlücken werden dadurch nicht vollständig als Beleuchtung gezählt.
Licht-Tagesgrenzen verwenden die lokale Zeitzone des Pi; für diesen Aufbau
sollte sie `Europe/Zurich` sein.

Tageswerte werden mit den aktuellen Faktoren aus gespeicherten Luxwerten
berechnet. Der Sensorwechsel oder ein neuer Faktor löscht keine Historie:
Tage mit alten Enviro+- und neuen SEN0501-Werten bleiben gemischte Messreihen.

Eine belastbare prozentuale Genauigkeit wurde nicht ermittelt.
Der frühere ±20-%-Hinweis ist aus der Oberfläche entfernt; die API
`/api/light/today` liefert derzeit noch das alte Feld
`uncertainty_percent: 20`. Dieses Feld ist keine verifizierte Genauigkeitsangabe.
Für eine Referenzkalibrierung der PPFD ist eine passende Referenzmessung nötig.

### UV und Luftdruck

`/api/current` liefert `pressure_hpa`, `uv_raw`, `uv_mw_cm2`,
`uv_saturated` und `sensor_model`.
UV wird live, in der Diagnose und als eigener Verlauf angezeigt.
Luftdruck ist vorerst nur über die API verfügbar und wird nicht als eigene
Zeitreihe gespeichert.

Die UV-Umrechnung in `sensor.py` folgt der DFRobot-verlinkten V2-Bibliothek:

```text
uv_mw_cm2 = uv_raw / (2300 / 3) × (0,23 × 1,58 / 3,35)
```

Sie setzt deren V2-Konfiguration voraus (20 Bit, Gain 6) und liefert eine
**geschätzte äquivalente UV-A-Bestrahlungsstärke in mW/cm²**, keinen UV-Index.
Ein Rohwert von 0 wird als Null angezeigt, ein fehlender Wert als nicht verfügbar.
65535 wird vorsorglich als Sättigung markiert; die umgerechnete Stärke bleibt
dann unbekannt. Ein einzelner UV-Lesefehler lässt die übrigen Messwerte verfügbar.

Im kurzen Lampentest: zweimal Rohwert **8** bei ungefähr **4060 Lux**,
Rohwert **0** bei ausgeschalteter Lampe. Rohwert 8 ergibt **0,001132 mW/cm²**.
Das bestätigt die Reaktion auf die Lampe, keine absolute UV-Genauigkeit.

Protokoll-/Umrechnungsreferenzen:
[DFRobot SEN0501](https://wiki.dfrobot.com/sen0501/docs/21745),
[DFRobot EnvironmentalSensor](https://github.com/DFRobot/DFRobot_EnvironmentalSensor/tree/7b49ec64e605dd764f0897b9a5cde4eec1afa3c4),
[V2-Bibliothek](https://github.com/cdjq/DFRobot_EnvironmentalSensor).

## Gerätevorbereitung

### Pflanzenlampe und GP8600

Die Profile **Benutzerdefiniert, Wachstum und Blüte** besitzen getrennte
Leistungs-/Zeitplaneinstellungen. Neue Profile beginnen mit 0 %,
08:00–20:00 Uhr und deaktiviertem Zeitplan. Zeiträume über Mitternacht
werden angezeigt; eine aktive Schaltung erfolgt noch nicht.
Einstellungen werden über den Speichern-Button gesichert.

`gp8600.py` implementiert den 16-Bit-DAC auf Bus 1 / `0x58`.
Für 0–10 V schreibt er Register `0x01 = 0x08`; der Ausgangswert
geht an `0x02`, Low-Byte zuerst, 0–65535. EEPROM-Befehle werden nicht gesendet.
Grundlage: [DFRobot_GP8XXX](https://github.com/DFRobot/DFRobot_GP8XXX).
Die Website ruft diesen Treiber noch nicht auf.

**Simulation ohne Hardwarezugriff:**

```bash
cd ~/plant-monitor
/home/pi/.virtualenvs/pimoroni/bin/python lamp_dac_test.py --volts 5
```

**Ausgangstest erst mit Multimeter und abgetrenntem Lampen-DIM-Eingang:**

```bash
/home/pi/.virtualenvs/pimoroni/bin/python lamp_dac_test.py --volts 1 --seconds 20 --apply --output-disconnected
```

Danach separat mit `--volts 5` und `--volts 10` wiederholen.
DC-Spannung zwischen OUT und GND messen. `--output-disconnected`
ist eine manuelle Bestätigung; die Software erkennt die Trennung nicht.

Das Programm setzt den Sollwert vor/nach der Bereichswahl auf Null,
gibt die Prüfspannung für höchstens 60 Sekunden aus und versucht bei Ende,
Strg+C, SIGTERM oder Fehler auf Null zurückzusetzen. Parallele Tests sind gesperrt.
Bei Busausfall, SIGKILL oder Stromproblemen ist das Rücksetzen nicht garantiert.
Es gibt keine Spannungsrückmessung; ein 0-V-Sollwert bestätigt weder
eine gemessene Ausgangsspannung noch den Aus-Zustand der Lampe.

### Bodenfeuchte

Geplant: **SEN0308 Topf 1 → ADS1115 A0**, **Topf 2 → A1**.
Namen, getrennte Trocken-/Nassreferenzen, Prozentberechnung und Verlauf sind
vorbereitet. Der ADS1115-Treiber muss noch gültige `soil_raw_1` und
`soil_raw_2` bereitstellen. Bis dahin bleiben Messwerte unbekannt.

Die Kalibrierreferenzen müssen verschieden sein. Die Prozentanzeige ist
eine relative Sensorkalibrierung, kein volumetrischer Wassergehalt.

### Bewässerung und Tank

Je Topf speicherbar: Name, vorgemerkte Automatik, Feuchteschwelle,
Einzelmenge, Tageslimit, Einziehpause, maximale Laufzeit und Pumpenkalibrierung.
Automatik ist anfangs AUS; Pause 30 Minuten und Laufzeitgrenze 60 Sekunden
sind technische Startwerte. Pflanzenspezifische Mengen/Schwellen sind nicht vorgegeben.

```text
Fördermenge (ml/s) = aufgefangene Menge / gemessene Sekunden
Pumpdauer (s) = gewünschte Menge / Fördermenge
```

Das Formular führt keinen Kalibrierlauf aus. Werte müssen für jede Pumpe
separat gemessen werden. Unvollständige Kalibrierung und eine berechnete
Dauer oberhalb der Laufzeitgrenze werden beim Speichern abgelehnt.
Derzeit lassen sich Laufzeitgrenzen bis 600 Sekunden konfigurieren.

Die Entscheidungsvorschau prüft Tank, Sensoralter (maximal 120 Sekunden),
Feuchteschwelle, Pause, Tageslimit und berechnete Dauer.
`POST /api/irrigation/preview` ist ausschliesslich eine Simulation:
`simulation: true`, `output_available: false`.

Der SQLite-Ereignisspeicher und die Historie sind vorhanden.
`record_watering_event` muss nach realen Pumpenläufen angebunden werden;
Vorschauen und Animationstests erzeugen keine Ereignisse.
Mengen werden aus tatsächlicher Laufzeit und kalibrierter Fördermenge berechnet,
nicht per Durchflusssensor gemessen. Kalibrierläufe zählen nicht als Topfbewässerung.
Die Historie zeigt Tagesmengen und einen 7-Tage-Verlauf mit Tagesgrenzen
in `Europe/Zurich`.

Tankstatus bleibt ohne Live-Schalter unbekannt. Der geplante WLSW1 erkennt
einen Schaltzustand, keinen Füllstand in Prozent. Die aktive Überwachung,
Abschaltungen und Erhaltung von Verbrauch/Einziehpause über Neustarts fehlen noch.

Geplanter Wasserkreis: Kanister → T-Verteiler → zwei PPFL-1-Pumpen →
je ein Netafim NetBow. Pumpenversorgung über Mean Well 12 V / 3 A,
je Pumpe Sicherung und MOSFET-Treiber; die Technik kommt ausserhalb des Schranks.
Der Pi liefert nur Steuersignale. GPIO-Zuordnung ist noch festzulegen.

### Lüftung

Vorhanden: zwei **Noctua NF-F12 industrialPPC-3000 PWM, 12 V**,
Zuluft unten und Abluft oben. Aktuell werden sie gemeinsam über
einen NA-FC1 mit separatem Lüfternetzteil geregelt.

Die Website speichert je Lüfter Name, AUS/MANUELL, gewünschte Leistung
und Mindestleistung. Positive manuelle Sollwerte verwenden den grösseren
Wert aus Wunsch- und Mindestleistung; AUS oder 0 % ergibt 0 % Sollwert.
Diese Werte sind keine gemessene Drehzahl. AUTO und PWM-Ausgabe fehlen.

Für eine spätere unabhängige Regelung sind BCM GPIO18 / Pin 12 und
BCM GPIO13 / Pin 33 als Kandidaten vorgesehen, ungefähr 25 kHz.
**Das ist noch keine bestätigte Verdrahtungsbelegung.**
Die Signalschnittstelle, Gesamtpinbelegung und das Verhalten bei stromlosem Pi
müssen vor der Integration geprüft werden. Die 12-V-Versorgung bleibt extern.
Bis zur geprüften Umstellung bleibt der NA-FC1 die bestehende Steuerung.

**Animation testen** bei Pumpen und Lüftern ist nur eine Symbolvorschau,
keine Hardwareansteuerung.

### Kamera

Raspberry Pi Camera Module v2.1 / IMX219 mit Picamera2:

- MJPEG-Livestream: 1280 × 720, konfigurierte 15 Bilder/s.
- Gespeicherte Fotos: 3280 × 2464.
- Manueller Foto-Button, Galerie und Zeitraffer-Wiedergabe im Browser.
- Zeitraffer mit wählbarem Intervall; Standard 720 Minuten.
- Vorschau bis 320 px breit, Vollbild verfügbar.

## Daten und API

### Speicherung

| Datei / Tabelle | Inhalt |
|---|---|
| `data/plant.db` → `measurements` | Zeitstempel, Klima, Lux, Rohwerte, CPU-Temperatur, Bodenfeuchte und UV |
| `data/plant.db` → `watering_events` | Vorgangs-ID, Zeit, Topf, tatsächliche Laufzeit, Fördermenge und Auslöser |
| `data/soil_moisture.json` | Topfnamen und Sensorkalibrierung |
| `data/lamp_control.json` | Lichtprofile und Zeitpläne |
| `data/irrigation.json` | Tank-/Pumpeneinstellungen |
| `data/fan_control.json` | Lüftereinstellungen |
| `data/timelapse.json` | Zeitrafferkonfiguration |
| `photos/` | Fotos |

JSON-Konfigurationen werden validiert und atomar ersetzt.
Geräteeinstellungen bleiben nach Browser- und Pi-Neustart erhalten.
Die Designauswahl wird dagegen nur im Browser gespeichert.

Fehlende Bodenfeuchtewerte sind `NULL`. UV-Spalten werden beim Dienststart
automatisch ergänzt; alte Messungen ohne UV bleiben im UV-Verlauf leer.
PPFD und DLI werden aus Lux berechnet und nicht als eigene Messspalten gespeichert.

| History-Zeitraum | Aggregationsintervall |
|---|---|
| 24 Stunden (`24h`) | 1 Minute |
| 7 Tage (`7d`) | 10 Minuten |
| 30 Tage (`30d`) | 1 Stunde |
| 1 Jahr (`1y`) | 1 Tag |

Messdaten, Konfiguration und Fotos vor manuellen Änderungen sichern.
Ein Update setzt die Datenbank nicht automatisch zurück.

### Endpunkte

| Bereich | Endpunkte |
|---|---|
| Status / Livewerte | `GET /api/status`, `GET /api/current` |
| Messverlauf | `GET /api/history?range=24h` (auch `7d`, `30d`, `1y`) |
| Lichtstatistik | `GET /api/light/today` |
| Lampeneinstellungen | `GET/POST /api/light/config`, `GET /api/light/status` |
| Bodenfeuchte | `GET/POST /api/soil/config`, `GET /api/soil/status` |
| Bewässerung | `GET/POST /api/irrigation/config`, `GET /api/irrigation/status`, `GET /api/irrigation/history` |
| Entscheidungsvorschau | `POST /api/irrigation/preview` |
| Lüfter | `GET/POST /api/fans/config`, `GET /api/fans/status` |
| Kamera | `GET /api/camera/status`, `GET /api/camera/stream`, `GET /api/camera/image`, `POST /api/camera/capture` |
| Fotos / Zeitraffer | `GET /api/camera/photos`, `GET /api/camera/photos/{filename}`, `GET/POST /api/camera/timelapse` |

Für die Entscheidungsvorschau werden `pot_id`, `moisture`,
`sensor_age_seconds`, `tank_ok`, `seconds_since_last` und
`used_today_ml` übergeben. Es wird kein Pumpenlauf gestartet.

Beispiel eines aktuellen Sensorwertsatzes mit berechneten Lichtwerten
(zusätzliche Bodenfeuchtefelder sind hier weggelassen):

```json
{
  "raw_temperature": 25.9,
  "temperature": 25.9,
  "raw_humidity": 58.8,
  "humidity": 58.8,
  "cpu_temperature": 47.2,
  "vpd": 1.38,
  "lux": 4073.0,
  "pressure_hpa": 973,
  "uv_raw": 8,
  "uv_mw_cm2": 0.001132,
  "uv_saturated": false,
  "sensor_model": "SEN0501 V2.0",
  "ppfd_sensor": 77.6,
  "ppfd_center": 363.1,
  "light_on": true
}
```

## Projektdateien und Prüfungen

| Datei / Verzeichnis | Aufgabe |
|---|---|
| `app.py` | FastAPI, Worker, Kamera und Konfigurationsendpunkte |
| `sensor.py` | SEN0501-Auslesung und VPD-/UV-Umrechnung |
| `database.py` | SQLite, Historie, Lichtstatistik und Bewässerungsereignisse |
| `configuration.py` | Validierung und atomare JSON-Speicherung |
| `lamp_profiles.py` | Getrennte Lampenprofile |
| `gp8600.py`, `lamp_dac_test.py` | DAC-Treiber und manueller Ausgangstest |
| `irrigation.py` | Bewässerungseinstellungen und reine Entscheidungsvorschau |
| `fan_control.py` | Lüftereinstellungen ohne PWM-Ausgabe |
| `templates/index.html` | Dashboard |
| `static/` | Stylesheets, JavaScript, SVGs und lokale Chart.js-Bibliothek |
| `static/theme.js`, `static/theme-switch.css` | Designwechsel |
| `static/windows-2000.css`, `static/windows-2000/` | Klassisches Design und Profil-SVGs |
| `tests/` | Hardwareunabhängige Prüfungen |

Python-Tests vom Repository-Verzeichnis aus:

```bash
python -m unittest discover -s tests -v
```

JavaScript-Prüfungen mit Node.js:

```bash
node tests/test_theme.cjs
node tests/test_uv_ui.cjs
```

Die Tests prüfen unter anderem Sensor-/UV-Umrechnung, Datenbankmigration,
GP8600-Registerbefehle, Konfigurationsvalidierung und Bewässerungssperren.
Sie ersetzen keine Messung der Ausgangsspannung oder reale Pumpen-/Lüftertests.

Lokale API-Prüfung bei laufendem Dienst:

```bash
curl http://127.0.0.1:8000/api/current
curl 'http://127.0.0.1:8000/api/history?range=24h'
curl http://127.0.0.1:8000/api/light/today
curl http://127.0.0.1:8000/api/irrigation/status
```

## Nächste Schritte

- GP8600-Ausgang bei abgetrennter DIM-Verbindung mit Multimeter prüfen;
  danach Lampensteuerung, Zeitpläne und Ein/Aus-Verhalten anbinden.
- ADS1115 und beide SEN0308 auslesen und separat kalibrieren.
- Pumpen, MOSFETs und Tank-Schalter anschliessen; Fördermenge je Pumpe messen.
- Reale Bewässerung mit Laufzeit-/Tankabschaltung, Tageslimit, Pause und
  Ereignisprotokollierung implementieren.
- Lüfterschnittstelle und Pinbelegung festlegen; beide PWM-Kanäle einzeln testen.
- E-Ink-Modell und Statuslayout auswählen.

Spätere Erweiterungen: Zielbereiche und Warnungen, Benachrichtigungen,
UV-Tagesstatistik, weitere Lichtauswertungen, CSV-Export und automatische Backups.

## Hardwarebestand und Bestellungen

Aktuell vorhanden: Raspberry Pi 4, SEN0501 V2.0, GP8600, IMX219,
120-W-Quantum-Board mit Mean Well XLG-150-H-AB sowie die beiden Noctua-Lüfter
mit NA-FC1 und separatem 12-V-Lüfternetzteil.
Die 120 W sind eine Nennangabe, keine gemessene Steckdosenaufnahme.
Der ehemalige Enviro+ gehört nicht mehr zur aktiven Sensorik.

Die Bestellliste bleibt als Aufbau-/Materialreferenz erhalten; das Bestelldatum
sagt nichts über den aktuellen Liefer- oder Inbetriebnahmestatus aus.

<details>
<summary>Materialbestellungen und geplante Gehäuseaufteilung</summary>

### Bestellungen vom 28.09.2026

#### BerryBase Schweiz

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

#### Bastelgarage Schweiz

| Bereich | Komponente | Menge |
|---|---|---:|
| Bodenfeuchte | DFRobot SEN0308 wasserdichter kapazitiver Bodenfeuchtesensor | 2 |
| Pumpensteuerung | 15-A-/400-W-MOSFET-Treiber, 5–36 V DC, 3,3-V-steuerbar | 2 |
| Lampendimmung | DFRobot GP8600, 1-Kanal I²C/PWM zu 0–10 V | 1 |

### Gehäuseaufteilung

Die beiden kleinen Modulgehäuse sind für die Signaltechnik vorgesehen:

| Gehäuse | Vorgesehener Inhalt |
|---|---|
| 45 × 45 × 18 mm, Gehäuse 1 | GP8600 |
| 45 × 45 × 18 mm, Gehäuse 2 | ADS1115 |

Die große Euro-Box ist für die externe Bewässerungselektronik vorgesehen:

205 × 180 × 70 mm: 12-V-Verteilung, Sicherungen, MOSFET-Treiber,
Pumpenanschlüsse und Hauptschalter.

Verbindungsklemmen und weiteres Montagematerial werden bei Bedarf lokal beschafft.


</details>

## Lizenz

Noch nicht festgelegt. Eine Lizenzdatei wurde bisher nicht ergänzt.
