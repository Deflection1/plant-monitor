# Plant Monitor

Web-Dashboard für einen Pflanzenschrank auf einem **Raspberry Pi 4**.
FastAPI liefert Klima- und Lichtwerte, SQLite speichert die Messhistorie.
Die Oberfläche verbindet Messwerte, Geräteeinstellungen, Kamera und Zeitraffer.

**Dokumentationsstand: 09.10.2026 · `main`**

## Funktionsstand

| Bereich | Implementiert | Noch offen |
|---|---|---|
| Umgebungssensor | SEN0501 V2.0: Temperatur, Luftfeuchte, Lux, Luftdruck und UV | Referenzkalibrierung |
| Klima und Licht | Livewerte, Luft-VPD, Messverläufe, geschätzte PPFD/DLI und Licht-Tagesstatistik | Zielbereiche und Warnungen |
| Pflanzenlampe | GP8600-Ausgabe 0–10 V, manuelle Dimmung, getrennte Profile und Zeitpläne | Prüfung am realen Aufbau nach Änderungen |
| Bodenfeuchte | ADS1115 A0/A1 auf Bus 4, Rohwerte, Spannung, getrennte Kalibrierung und relative Prozentberechnung | Prüfung und Kalibrierung beider SEN0308 am Aufbau |
| Bewässerung | Einstellungen, Dosierberechnung, Entscheidungsvorschau, WLSW1-Tank-Eingang und manuelle Pumpentests | Ausführende Automatik |
| Lüftung | Getrennte Einstellungen und Sollwerte für Zu- und Abluft | Pi-PWM, Drehzahlerfassung und Automatik |
| Kamera | IMX219-Livestream, Fotos, Galerie und Zeitraffer | — |
| Oberfläche | Fünf Designs und zwei unabhängig wählbare Layouts | — |

**Die aktivierte Lampensteuerung kann reale Hardware ansteuern.**
Pumpen können über die ausdrücklich beschrifteten Testknöpfe real laufen.
Automatik-Einstellungen und Lüftereinstellungen schalten keine Ausgänge.
„Animation testen“ bleibt eine reine Symbolvorschau.

## Inhalt

### Manueller Pumpentest

| MOSFET-Anschluss | Raspberry Pi (physische Pinnummer) |
| --- | --- |
| Pumpe 1 TRIG/PWM | Pin 11, BCM GPIO17 |
| Pumpe 2 TRIG/PWM | Pin 13, BCM GPIO27 |
| Beide Signal-GND, gemeinsam mit 12-V-Minus | Pin 14, GND |

12 V versorgen nur die Lastanschlüsse der MOSFET-Module, niemals einen Pi-GPIO.
Die Pumpen bleiben bei Software-Initialisierung aus. Unter **Bewässerung**
startet „Pumpe 5 Sekunden testen“ einen echten Lauf. „Beide Pumpen stoppen“
schaltet beide Ausgänge ab. Es läuft höchstens eine Pumpe gleichzeitig.
Ein eigener Hintergrundthread überwacht alle 100 ms die Testzeit.
Die Tankprüfung ist für manuelle Tests vorläufig deaktiviert; der WLSW1
bleibt als Statusanzeige aktiv. Mit der Service-Umgebungsvariable
`PUMP_TEST_REQUIRE_TANK=1` und einem Neustart wird die Tankprüfung wieder
aktiviert: leerer oder unbekannter Tank blockiert bzw. beendet dann den Test.
Die GPIO-Verfügbarkeit bestätigt keine angeschlossene Pumpe.
Ein 10-kΩ-Pulldown zwischen jedem TRIG/PWM und GND hält den Eingang auch
bei freigegebenem GPIO definiert auf LOW, sofern kein solcher Widerstand
im Modul vorhanden ist. Für den ersten Test Wasser ansaugen und den
Ausgangsschlauch in einen Auffangbehälter legen.

`POST /api/irrigation/test` akzeptiert `{"pump_id":1,"seconds":5}`
(Pumpe 1 oder 2, 1–10 Sekunden). `POST /api/irrigation/stop` stoppt beide.
Tests werden noch nicht als dosierte Bewässerung in der Historie erfasst.
Die Automatik bleibt eine Entscheidungsvorschau.

- [Betrieb auf dem Raspberry Pi](#betrieb-auf-dem-raspberry-pi)
- [Oberfläche](#oberfläche)
- [Sensoranschlüsse und Messwerte](#sensoranschlüsse-und-messwerte)
- [Geräte und Steuerung](#geräte-und-steuerung)
- [Daten und API](#daten-und-api)
- [Projektaufbau und Prüfungen](#projektaufbau-und-prüfungen)
- [Geplante Erweiterungen](#geplante-erweiterungen)
- [Hardware und Materialliste](#hardware-und-materialliste)

## Betrieb auf dem Raspberry Pi

### Umgebung

Die bestehende Installation verwendet **Raspberry Pi OS Bookworm**, das
Repository unter `/home/pi/plant-monitor` und die Python-Umgebung
`/home/pi/.virtualenvs/pimoroni`. Benutzername und Pfade bei einer anderen
Installation entsprechend anpassen.

Benötigt werden FastAPI, Uvicorn, Jinja2, smbus2 sowie **Picamera2 mit den
Raspberry-Pi-Systembibliotheken**. Picamera2 muss in der verwendeten
Python-Umgebung verfügbar sein; die folgenden pip-Pakete allein ergeben
keine vollständige Neuinstallation.

```bash
cd ~/plant-monitor
/home/pi/.virtualenvs/pimoroni/bin/python -m pip install fastapi uvicorn jinja2 smbus2 Pillow gpiozero lgpio
/home/pi/.virtualenvs/pimoroni/bin/python -c 'from picamera2 import Picamera2; from sensor import read_sensors; print(read_sensors())'
```

I²C-Konfiguration: siehe [Sensoranschlüsse](#sensoranschlüsse).
Für die Licht-Tagesstatistik sollte die lokale Pi-Zeitzone `Europe/Zurich` sein.
Lampenzeitpläne und Bewässerungshistorie verwenden diese Zeitzone ausdrücklich.

Mit der folgenden Nginx-Konfiguration ist das Dashboard im lokalen Netz unter
[http://raspberrypi.local/](http://raspberrypi.local/) erreichbar, sofern dieser
Hostname auf den Pi aufgelöst wird.

### Aktualisieren

Vor dem Update lokale Änderungen prüfen:

```bash
cd ~/plant-monitor
git status --short --branch
git switch main
git pull --ff-only
```

Nach Änderungen am Python-Code:

```bash
sudo systemctl restart plant-monitor
sudo systemctl status plant-monitor --no-pager -l
```

CSS-/JavaScript-Änderungen benötigen normalerweise nur **Strg+F5** im Browser.
README-Änderungen benötigen keinen Dienstneustart. Gespeicherte Daten und
Konfigurationen werden durch ein normales Update nicht zurückgesetzt.

### systemd-Dienst

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

Nach Änderungen an der Unit:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now plant-monitor
sudo systemctl restart plant-monitor
```

Protokoll anzeigen:

```bash
journalctl -u plant-monitor -f
```

Für einen manuellen Start zuerst den Dienst stoppen:

```bash
sudo systemctl stop plant-monitor
cd ~/plant-monitor
/home/pi/.virtualenvs/pimoroni/bin/uvicorn app:app --host 127.0.0.1 --port 8000
```

Nach Ende des manuellen Starts den Dienst mit
`sudo systemctl start plant-monitor` wieder starten.
**Nur einen Uvicorn-Worker verwenden, kein `--reload`**: Kamera und DAC sollen
jeweils von einem Prozess verwaltet werden.

### Nginx und Zugriff

Uvicorn lauscht lokal auf Port 8000; Nginx stellt die Website auf Port 80 bereit:

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

Die Anwendung enthält derzeit keine Anmeldung oder Zugriffskontrolle.
Dieses Beispiel richtet auch kein HTTPS ein. Für einen Zugriff ausserhalb
des lokalen Netzes muss ein geschützter Zugang separat eingerichtet werden.

## Oberfläche

Die **Übersicht** zeigt Livewerte, ein gemeinsames Temperatur-/Feuchtediagramm
mit zwei Achsen, eine Lichtkarte mit Luxverlauf und Tageswerten, zwei Töpfe,
Versorgungskarten und Kamera. Die **Steuerung** bündelt Licht, Bewässerung,
Bodenfeuchte, Lüftung und Systemdiagnose. Fehlende Messwerte bleiben leer;
Abruffehler werden angezeigt.

### Designs und Layouts

Alle Varianten sind in `main` enthalten und verwenden dieselben Funktionen:

| Auswahl | Varianten | Voreinstellung |
|---|---|---|
| Design | Glas, Windows 2000, Windows XP · Luna, OSRS · Old School, Botanisch minimalistisch | Glas |
| Layout | Klassisch, Seitennavigation | Seitennavigation |

Im klassischen Layout liegen die vollständigen Verläufe auf der Übersicht.
Die Seitennavigation bietet dafür eine eigene Ansicht und auf kleinen
Bildschirmen ein aufklappbares Menü. Beide Layouts unterstützen alle Designs.
Die Gestaltung umfasst auch Symbole, Profilbilder und Diagrammfarben.
OSRS verwendet selbst erstellte Pixel-SVGs ohne externe Spielassets.

Design und Layout lassen sich ohne Neuladen wechseln. Messwerte, Diagramme
und noch nicht gespeicherte Formulareingaben bleiben erhalten.
Die Auswahl wird im Browser unter `plant-monitor.design` und
`plant-monitor.layout` gespeichert und mit anderen Tabs synchronisiert.
Bei gesperrter Browserspeicherung gilt sie für die aktuelle Seite.
Geräteeinstellungen werden unabhängig davon auf dem Pi gespeichert.

### Aktualisierung und Status

| Anzeige | Intervall |
|---|---|
| Livewerte | 5 Sekunden |
| Messverläufe und Licht-Tagesstatistik | 60 Sekunden |
| Versorgungskarten der sichtbaren Übersicht | 15 Sekunden |
| Neue Messung in SQLite | ungefähr 60 Sekunden zuzüglich Auslesedauer |

Die Zeiträume **24 Stunden, 7 Tage, 30 Tage und 1 Jahr** werden gemeinsam
für Übersicht und vollständige Verläufe gewählt.

Das Lichtsymbol folgt dem Luxwert am Sensor. Bei einem Abruffehler oder
mehr als 20 Sekunden ohne gültigen Empfang im Browser wird sein Zustand
unbekannt. Es bestätigt nicht den elektrischen Lampenzustand.
`/api/status` meldet pauschal „online“ und prüft weder die Sensoren noch die
Datenaufzeichnung vollständig.

## Sensoranschlüsse und Messwerte

### Sensoranschlüsse

Aktiver Umgebungssensor: **DFRobot SEN0501 V2.0**, I²C-Bus **3**, Adresse
**`0x22`**. Der GP8600 verwendet Bus **1**, Adresse **`0x58`** bei A0/A1/A2 = 0.
Die Tabelle dokumentiert den bestehenden Anschluss:

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

Den SEN0501-Schalter auf I²C stellen. In `/boot/firmware/config.txt` unter
`[all]` müssen die beiden Busse aktiviert sein:

```ini
dtparam=i2c_arm=on
dtoverlay=i2c3,pins_4_5
```

Nach Änderungen neu starten. Angeschlossene Module prüfen:

```bash
i2cdetect -y 3
i2cdetect -y 1
```

Erwartet werden `22` auf Bus 3 und `58` auf Bus 1. Die Datenleitungen sind
getrennt, Versorgung und Masse gemeinsam.

### Klima und VPD

Temperatur und relative Luftfeuchte stammen vom SEN0501.
Die CPU-Temperatur ist ein separater Diagnosewert. VPD wird aus ungerundeter
Lufttemperatur und relativer Feuchte berechnet:

```text
es(T) = 0,6108 × exp(17,27 × T / (T + 237,3))
VPD = es(T) × (1 − RH / 100)
```

Das Ergebnis ist **Luft-VPD in kPa**; eine Blatttemperatur wird nicht gemessen.
Der erste Vergleich von SEN0501 (25,1 °C / 51,2 % RH) und analogem Gerät
(ca. 25 °C / 53 % RH) war ein Plausibilitätsvergleich, keine Kalibrierung.

Ein nicht erreichbarer Sensor verhindert den Website-Start nicht.
Betroffene Liveabfragen liefern HTTP 503; der Messworker protokolliert
Fehler und speichert keine erfundenen Ersatzwerte.

### Lux, PPFD und DLI

Ab **100 Lux** gilt Licht am Sensor als erkannt. Fremdlicht kann diesen
Status beeinflussen. Die PPFD-Werte sind Schätzungen aus Lux:

```text
PPFD Sensor ≈ Lux / 52,5
PPFD Referenzpunkt ≈ PPFD Sensor × 4,68
DLI (mol/m²) = Summe(PPFD × Intervall in Sekunden) / 1 000 000
```

Die Konstanten liegen in `database.py`. Der Positionsfaktor **4,68** stammt
vom Vergleich am 30.09.2026 bei gleicher Dimmung: ca. 4060 Lux an der festen
Wandposition und 18 000–20 000 Lux mittig, 24 cm über dem Topf, Messseite
nach oben. Arbeitswert: 19 000 / 4060 ≈ 4,68. Der Faktor gilt für diese Geometrie. Nach Änderung der Lampen-/Sensorposition
oder Referenzhöhe muss erneut gemessen werden.

DLI integriert pro Messwert höchstens **120 Sekunden**, damit grössere
Datenlücken nicht vollständig als Beleuchtung zählen. Tagesstatistiken
werden aus gespeicherten Luxwerten mit den aktuellen Faktoren berechnet.

Eine prozentuale PPFD-Genauigkeit wurde nicht ermittelt. Das API-Feld
`uncertainty_percent: 20` ist keine verifizierte Genauigkeitsangabe.

### UV und Luftdruck

Die Live-API liefert `pressure_hpa`, `uv_raw`, `uv_mw_cm2`, `uv_saturated`
und `sensor_model`. UV erscheint auch in Diagnose und Verlauf; Luftdruck
wird bisher nur über die API ausgegeben und nicht als Zeitreihe gespeichert.

Die Umrechnung folgt der DFRobot-verlinkten V2-Bibliothek (20 Bit, Gain 6):

```text
uv_mw_cm2 = uv_raw / (2300 / 3) × (0,23 × 1,58 / 3,35)
```

Das Ergebnis ist eine **geschätzte äquivalente UV-A-Bestrahlungsstärke in
mW/cm²**, kein UV-Index. Rohwert 0 bedeutet Null; fehlende Werte bleiben
unbekannt. 65535 wird vorsorglich als Sättigung markiert, ohne umgerechneten
Wert. Ein einzelner UV-Lesefehler lässt die übrigen Messwerte verfügbar.
Der kurze Lampentest mit Rohwert 8 bei Licht und 0 bei ausgeschalteter Lampe
bestätigte eine Reaktion, keine absolute Messgenauigkeit.

Referenzen: [DFRobot SEN0501](https://wiki.dfrobot.com/sen0501/docs/21745),
[DFRobot EnvironmentalSensor](https://github.com/DFRobot/DFRobot_EnvironmentalSensor/tree/7b49ec64e605dd764f0897b9a5cde4eec1afa3c4),
[V2-Bibliothek](https://github.com/cdjq/DFRobot_EnvironmentalSensor).

## Geräte und Steuerung

### Pflanzenlampe

Hardware: **120-W-Quantum-Board**, Mean Well **XLG-150-H-AB** und
**DFRobot GP8600** für die 0–10-V-Dimmung. Die 120 W sind eine Nennangabe,
keine gemessene Steckdosenaufnahme.

Die Profile **Benutzerdefiniert, Wachstum und Blüte** speichern getrennte
Leistungs- und Zeitplaneinstellungen. Neue Profile beginnen mit 0 %,
08:00–20:00 Uhr und deaktiviertem Zeitplan. Die globale Freigabe
**Lampensteuerung aktivieren** ist standardmässig aus. Zum ersten Betrieb
Freigabe setzen und speichern; ohne Freigabe wird 0 V gesendet.

- Ohne Zeitplan gilt die gespeicherte Dimmung dauerhaft.
- Mit Zeitplan gilt sie ab Einschaltzeit bis vor Ausschaltzeit, sonst 0 V.
- Zeiten über Mitternacht werden unterstützt; gleiche Schaltzeiten bedeuten aus.
- Auswertung jede Sekunde in `Europe/Zurich`, einschliesslich Sommerzeit.
- 0–100 % entsprechen 0–10 V Sollspannung, keiner gemessenen Leistung.

Speichern wendet die Konfiguration auf den Ausgang an. Beim Dienststart
wird zunächst 0 V gesendet und danach die gespeicherte Freigabe angewendet.
Eine zuvor aktivierte Steuerung kann daher nach einem Neustart wieder dimmen.
Beim geordneten Dienstende wird 0 V gesendet. Eine Lux-Regelung oder
Sonnenaufgangsrampe ist nicht implementiert.

`/api/light/status` zeigt den zuletzt erfolgreich gesendeten Sollwert,
Zeitstempel und Fehler. **Es gibt keine Spannungsrückmessung.** Bei I²C-Fehlern
versucht der Controller 0 V zu senden, markiert den Ausgang als unbekannt
und stoppt weitere Ausgabeversuche. Nach Prüfung erneut speichern, um den
Fehler zurückzusetzen. Busausfall, SIGKILL oder Stromprobleme können das
Rücksetzen verhindern; ein 0-V-Sollwert bestätigt keinen gemessenen Aus-Zustand.

`gp8600.py` verwendet den 16-Bit-DAC auf Bus 1 / `0x58`, Bereichsregister
`0x01 = 0x08` und Ausgangsregister `0x02` (Low-Byte zuerst). Es werden keine
EEPROM-Befehle gesendet. Grundlage:
[DFRobot_GP8XXX](https://github.com/DFRobot/DFRobot_GP8XXX).

#### Separater DAC-Test

Dienst und Testprogramm teilen `data/gp8600-test.lock` für exklusiven Zugriff.
Vor einem Hardwaretest den Dienst stoppen. Simulation ohne Hardwarezugriff:

```bash
cd ~/plant-monitor
/home/pi/.virtualenvs/pimoroni/bin/python lamp_dac_test.py --volts 5
```

Ausgangstest mit Multimeter und **abgetrenntem Lampen-DIM-Eingang**:

```bash
sudo systemctl stop plant-monitor
/home/pi/.virtualenvs/pimoroni/bin/python lamp_dac_test.py --volts 1 --seconds 20 --apply --output-disconnected
```

DC-Spannung zwischen OUT und GND messen; danach separat mit `--volts 5`
und `--volts 10` wiederholen. `--output-disconnected` ist eine manuelle
Bestätigung, keine automatische Erkennung. Der Test läuft höchstens
60 Sekunden und versucht bei normalem Ende, Strg+C, SIGTERM oder Fehler
auf Null zurückzusetzen. Danach den Dienst wieder starten.

### Bodenfeuchte

**SEN0308 Topf 1 → ADS1115 A0**, **Topf 2 → A1**. `soil_sensor.py`
liest beide Kanäle einzeln gegen GND: 128 SPS, Messbereich ±4,096 V,
125 µV pro Rohwertschritt. Die Anwendung verwendet Bus **4**, Adresse
**0x48** (Aufdruck auf dem Soldered-Modul). Gleichzeitige API-Abfragen
teilen sich einen für eine Sekunde zwischengespeicherten Messwert.
Bei ADC-Fehlern bleiben Rohwerte und Prozentwerte `null`; Klimamessungen
laufen weiter. `/api/soil/status` funktioniert auch ohne Umgebungssensor
und enthält ADC-Diagnose sowie Spannung pro Topf.

Auch `/api/current` liefert bei SEN0501-Ausfall die verfügbaren Bodenwerte.
`environment_available: false` und `environment_error` kennzeichnen die
Störung; Klima, Lux, PPFD und Lichtzustand bleiben dann `null`. Das Dashboard
zeigt die Bodenfeuchte weiter an und meldet die Umgebungssensor-Störung.
Eine ausgefallene Luxmessung wird nicht als 0 Lux oder ausgeschaltete Lampe
interpretiert. Gespeicherte Klimamessungen erfordern weiterhin den SEN0501.

| ADS1115 | Raspberry Pi (physische Pins) |
|---|---|
| VCC | 3,3 V von Pin 17 über Verteiler, gemeinsam mit SEN0501 |
| GND | Pin 20 |
| SDA | Pin 16 / BCM23 |
| SCL | Pin 18 / BCM24 |
| ALERT | Nicht angeschlossen |

Je SEN0308: Rot an dieselben 3,3 V, beide schwarzen Masse-/Schirmleitungen
an gemeinsame Masse, Gelb an A0 bzw. A1. Beide GND-Anschlüsse des Moduls
sind verbunden; eine Masseleitung zum Pi reicht. Nur stromlos umstecken.

Separaten Bus aktivieren: In `/boot/firmware/config.txt` (bei älteren
Systemen `/boot/config.txt`) unter `[all]` zusätzlich eintragen. Die
bestehenden Bus-1-/Bus-3-Einträge beibehalten; Bus 4 muss frei sein.

```ini
dtoverlay=i2c-gpio,bus=4,i2c_gpio_sda=23,i2c_gpio_scl=24
```

Danach neu starten und prüfen:

```bash
sudo apt install i2c-tools
i2cdetect -l
i2cdetect -y 4 0x48 0x48
```

Erwartet wird `48`. Fehlende Adresse zuerst anhand Versorgung und
Verdrahtung prüfen. Der bestehende Python-Bedarf `smbus2` reicht.
Test über den laufenden Dienst:

```bash
curl -s http://127.0.0.1:8000/api/soil/status | python3 -m json.tool
```

Alternativ unabhängig vom Dienst testen; währenddessen den Dienst stoppen,
damit zwei Prozesse nicht gleichzeitig die ADC-Kanäle umschalten:

```bash
sudo systemctl stop plant-monitor
/home/pi/.virtualenvs/pimoroni/bin/python soil_sensor.py --samples 5
sudo systemctl start plant-monitor
```

Ein antwortender ADC beweist nicht, dass die Sensoren angeschlossen oder
unbeschädigt sind: Offene Analogeingänge können ebenfalls Zahlen liefern.
Beide Sensoren einzeln in trockenem und feuchtem Substrat prüfen.
In der Bodenfeuchte-Ansicht die stabilen **Rohwerte** als Trocken- und
Nassreferenz für den jeweiligen Topf speichern. Bis beide Referenzen
gesetzt sind, bleibt dessen Prozentwert unbekannt. Kalibrierwerte sind
ADC-Zählwerte, keine Voltwerte. Für vergleichbare Ergebnisse dieselbe
Einstecktiefe und das spätere Substrat verwenden.

Vorläufige Startkalibrierung aus dem Coco-Test vom 09.10.2026:

| Topf / Kanal | Trockenreferenz (0 %) | Nassreferenz (100 %) |
|---|---:|---:|
| Topf 1 / A0 | 17670 | 3143 |
| Topf 2 / A1 | 18359 | 2892 |

Diese Werte sind die Standardkonfiguration, wenn noch keine gespeicherte
Bodenfeuchte-Konfiguration vorhanden ist. Bestehende Einstellungen bleiben
erhalten. Um die Referenzen am laufenden Aufbau ausdrücklich zu übernehmen,
die vier Felder im Dashboard speichern oder lokal diesen Befehl ausführen
(setzt auch die Topfnamen auf Topf 1 und Topf 2):

```bash
curl -sS -X POST http://127.0.0.1:8000/api/soil/config \
  -H 'Content-Type: application/json' \
  -d '{"pots":[{"name":"Topf 1","dry_raw":17670,"wet_raw":3143},{"name":"Topf 2","dry_raw":18359,"wet_raw":2892}]}'
```

Die Nassreferenzen stammen aus der letzten gemeinsamen Messreihe und sind
vorläufig: Neueinstecken und Andrücken haben im Versuch deutliche
Änderungen verursacht. Ähnliche Werte zwischen den Sensoren allein belegen
keine bessere Kalibrierung. Nach endgültigem Einbau erneut prüfen.

Die Referenzen müssen verschieden sein. Angezeigt wird eine relative
Sensorkalibrierung, kein volumetrischer Wassergehalt.

### Bewässerung und Tank

Geplanter Wasserkreis: Kanister → T-Verteiler → zwei **PPFL-1-12-V-Pumpen**
→ je ein Netafim NetBow. Versorgung: **Mean Well GST36E12-P1J, 12 V / 3 A**,
je Pumpe eine Sicherung und ein MOSFET-Modul, Elektronik ausserhalb des Schranks.
Der Pi liefert die Steuersignale; die endgültige GPIO-Belegung ist noch offen.

Das ausgewählte MOSFET-Modul ist der **Purecrea-Treiber mit AOD4184**,
Bastelgarage **Artikel 420985**: Steuereingang 3,3–5 V, Lastversorgung
5–36 V DC. Die Produktbezeichnung lautet „15A 400W MOSFET Treiber“;
diese Händlerangabe ist keine Bestätigung der zulässigen Dauerlast im Aufbau.
[Produkt und technische Angaben](https://www.bastelgarage.ch/15a-400w-mosfet-treiber-5-36v-dc).
Der Freilaufschutz für die Pumpen ist am tatsächlichen Modul noch zu prüfen.

Je Topf speicherbar: Automatikfreigabe, Feuchteschwelle, Einzelmenge,
Tageslimit, Einziehpause, maximale Laufzeit und Pumpenkalibrierung.
Startwerte: Automatik aus, Pause 30 Minuten, Laufzeitgrenze 60 Sekunden;
Mengen und Schwellen sind nicht pflanzenspezifisch vorgegeben.

```text
Fördermenge (ml/s) = aufgefangene Menge / gemessene Sekunden
Pumpdauer (s) = gewünschte Menge / Fördermenge
```

Die Kalibrierung ist derzeit **eine Eingabe von gemessenen ml und Sekunden
pro Pumpe**, kein automatisch gestarteter Lauf. Unvollständige Kalibrierung
und eine Dosierdauer oberhalb der Laufzeitgrenze werden abgelehnt.
Die konfigurierbare Grenze beträgt **1–600 Sekunden**; ein 20-Minuten-Lauf
ist damit aktuell nicht konfigurierbar.

Die Entscheidungsvorschau prüft Tankstatus, Sensoralter (höchstens 120 Sekunden),
Feuchteschwelle, Pause, Tageslimit und Laufzeit. Sie liefert
`simulation: true` und `output_available: false` und startet keine Pumpe.
**Die ausführende Bewässerungsautomatik fehlt noch.**

Die Historie zeigt Tagesmengen und einen 7-Tage-Verlauf in `Europe/Zurich`.
`record_watering_event` muss nach realen Pumpenläufen angebunden werden.
Mengen werden aus tatsächlicher Laufzeit und kalibrierter Fördermenge berechnet,
nicht durch einen Durchflusssensor gemessen. Kalibrierläufe zählen nicht als
Topfbewässerung; Vorschauen und Animationen erzeugen keine Ereignisse.

Der geplante **WLSW1-Schwimmerschalter** liefert einen Schaltzustand,
keinen Prozentfüllstand. Ohne Live-Treiber bleibt der Tankstatus unbekannt.
Aktive Abschaltungen sowie eine an reale Läufe gekoppelte Verwaltung von
Verbrauch und Einziehpause über Neustarts fehlen noch.

### Lüftung

Vorhanden sind zwei **Noctua NF-F12 industrialPPC-3000 PWM, 12 V**:
Zuluft unten, Abluft oben. Aktuell regelt ein **NA-FC1** beide gemeinsam,
mit separatem 12-V-Lüfternetzteil.

Die Website speichert getrennt Name, AUS/MANUELL, gewünschte Leistung und
Mindestleistung. Bei einem positiven Sollwert gilt der grössere Wert aus
Wunsch- und Mindestleistung; AUS oder 0 % ergibt 0 % Sollwert.
Das ist keine gemessene Drehzahl. AUTO, PWM-Ausgabe und Drehzahlerfassung fehlen.

BCM GPIO18 / Pin 12 und GPIO13 / Pin 33 sind Kandidaten für getrennte
PWM-Kanäle bei ungefähr 25 kHz, **keine bestätigte Anschlussbelegung**.
Signalschnittstelle, Pinbelegung und Verhalten bei stromlosem Pi müssen
vor der Umsetzung geprüft werden. Die 12-V-Versorgung bleibt extern.

### Kamera

**Raspberry Pi Camera Module v2.1 / IMX219**, betrieben mit Picamera2:

| Funktion | Einstellung |
|---|---|
| MJPEG-Livestream | 1280 × 720, konfigurierte 15 Bilder/s |
| Gespeicherte Fotos | 3280 × 2464 |
| Zeitraffer | Wählbares Intervall, Standard 720 Minuten |
| Bedienung | Fotoaufnahme, Galerie mit „Mehr laden“, Browser-Wiedergabe und Großansicht auf derselben Seite |
| Galerie | 12 Bilder pro Abruf, gecachte JPEG-Vorschaubilder mit maximal 320 Pixeln |
| Zeitraffer-Wiedergabe | Vorschauen mit maximal 960 Pixeln, nächstes Bild erst nach dem Laden; bis zu 1000 neueste Fotos |

Die Originalfotos bleiben unverändert. Beim Anklicken wird das Original in einer Großansicht auf derselben Seite geladen; „Schließen“ oder Escape kehrt zur Galerie zurück. Verkleinerte Bilder werden bei Bedarf einmalig erzeugt und unter `photos/.cache/` gespeichert. Die Wiedergabe stoppt beim Schließen des Archivs, Seitenwechsel oder Wechsel in den Hintergrund.

## Daten und API

### Speicherung

| Datei / Tabelle | Inhalt |
|---|---|
| `data/plant.db` → `measurements` | Klima, Lux, CPU-Temperatur, Bodenfeuchte und UV |
| `data/plant.db` → `watering_events` | Vorgangs-ID, Zeit, Topf, Laufzeit, Fördermenge und Auslöser |
| `data/soil_moisture.json` | Topfnamen und Sensorkalibrierung |
| `data/lamp_control.json` | Globale Freigabe, Lichtprofile und Zeitpläne |
| `data/irrigation.json` | Tank-/Pumpeneinstellungen |
| `data/fan_control.json` | Lüftereinstellungen |
| `data/timelapse.json` | Zeitrafferkonfiguration |
| `photos/` | Aufgenommene Fotos |

Konfigurationen werden validiert und atomar ersetzt. Sie bleiben nach
Neustarts erhalten. Design und Layout werden nur im Browser gespeichert.
Vor manuellen Änderungen `data/` und `photos/` sichern.

Fehlende Messwerte werden als `NULL` gespeichert.
PPFD und DLI werden aus Lux berechnet und nicht als eigene Messspalten gespeichert.

| History-Zeitraum | Aggregation |
|---|---|
| `24h` | 1 Minute |
| `7d` | 10 Minuten |
| `30d` | 1 Stunde |
| `1y` | 1 Tag |

### Endpunkte

| Bereich | Endpunkte |
|---|---|
| Status und Livewerte | `GET /api/status`, `GET /api/current` |
| Messverlauf | `GET /api/history?range=24h` (auch `7d`, `30d`, `1y`) |
| Lichtstatistik | `GET /api/light/today` |
| Lampe | `GET/POST /api/light/config`, `GET /api/light/status` |
| Bodenfeuchte | `GET/POST /api/soil/config`, `GET /api/soil/status` |
| Bewässerung | `GET/POST /api/irrigation/config`, `GET /api/irrigation/status`, `GET /api/irrigation/history` |
| Entscheidungsvorschau | `POST /api/irrigation/preview` |
| Lüfter | `GET/POST /api/fans/config`, `GET /api/fans/status` |
| Kamera | `GET /api/camera/status`, `GET /api/camera/stream`, `GET /api/camera/image`, `POST /api/camera/capture` |
| Fotos | `GET /api/camera/photos`, `GET /api/camera/photos/{filename}`, `GET /api/camera/photos/{filename}/{thumb|preview}`; Liste unterstützt `limit` und `offset` |
| Zeitraffer | `GET/POST /api/camera/timelapse` |
| Schwimmerschalter | `GET /api/tank/status` |

Die Entscheidungsvorschau erwartet `pot_id`, `moisture`, `sensor_age_seconds`,
`tank_ok`, `seconds_since_last` und `used_today_ml`; sie startet keinen Lauf.

Lokale Abfragen bei laufendem Dienst:

```bash
curl http://127.0.0.1:8000/api/current
curl 'http://127.0.0.1:8000/api/history?range=24h'
curl http://127.0.0.1:8000/api/light/status
curl http://127.0.0.1:8000/api/irrigation/status
```

## Projektaufbau und Prüfungen

| Datei / Verzeichnis | Aufgabe |
|---|---|
| `app.py` | FastAPI, Hintergrundworker, Kamera und Endpunkte |
| `sensor.py` | SEN0501-Auslesung, VPD und UV-Umrechnung |
| `database.py` | SQLite, Messverlauf, Lichtstatistik und Bewässerungsereignisse |
| `configuration.py` | Validierung und atomare Konfigurationsspeicherung |
| `lamp_profiles.py` | Getrennte Lampenprofile |
| `gp8600.py`, `lamp_control.py`, `lamp_dac_test.py` | DAC-Treiber, Lampencontroller und Ausgangstest |
| `irrigation.py`, `fan_control.py` | Einstellungen und Vorschau ohne Pumpen-/Lüfterausgabe |
| `templates/index.html` | Dashboard |
| `static/theme.js`, `static/layout-choice.js` | Unabhängiger Design-/Layoutwechsel |
| `static/dashboard-layout.css`, `static/dashboard.js` | Seitenaufbau und Übersicht |
| `static/` | Designs, weitere Skripte, SVGs und lokale Chart.js-Bibliothek |
| `tests/` | Hardwareunabhängige Regressionstests |

Vom Repository-Verzeichnis aus:

```bash
python -m unittest discover -s tests -v
node tests/test_theme.cjs
node tests/test_layout_choice.cjs
node tests/test_dashboard.cjs
node tests/test_uv_ui.cjs
node tests/test_lamp_ui.cjs
```

JavaScript-Syntax prüfen (Node.js erforderlich):

```bash
for file in static/*.js; do
    node --check "$file" || exit 1
done
```

Bei der Prüfung vom **05.10.2026** bestanden **53 Python-Tests**, alle
**fünf JavaScript-Testprogramme** und die Syntaxprüfungen.
Die Tests decken unter anderem Sensorumrechnung, Datenbankmigration,
Konfiguration, Bewässerungsentscheidungen, GP8600-Registerbefehle,
Lampenzeitpläne, Start/Stop, Fehlerbehandlung und UI-Wechsel ab.
Hardwarezugriffe werden nachgebildet; reale Spannungsmessungen,
Pumpen-/Lüftertests und eine visuelle Browserprüfung werden dadurch nicht ersetzt.

## Geplante Erweiterungen

- Beide SEN0308 am Aufbau prüfen und je Topf kalibrieren.
- Bewässerungsautomatik und Mengenprotokollierung an den Pumpentreiber anbinden.
- Geführte Pumpenkalibrierung: Schlauch befüllen, 60 Sekunden laufen lassen,
  aufgefangene ml eingeben; bisher noch nicht implementiert.
- Laufzeitgrenze an die benötigten Dosiermengen und zulässige Pumpenlaufzeit anpassen.
- Bewässerungsautomatik mit Tank-/Laufzeitabschaltung, Tageslimit,
  Einziehpause und Protokollierung realer Läufe umsetzen.
- Überlaufsensor in der Auffangwanne zur Abschaltung beider Pumpen ergänzen;
  Sensorwahl und Umsetzung sind noch offen.
- Lüfterschnittstelle prüfen und getrennte PWM-Kanäle mit Drehzahlerfassung umsetzen.
- E-Ink-Modell und Statusanzeige auswählen.

Weitere Ideen: Zielbereiche, Warnungen, Benachrichtigungen, zusätzliche
Licht-/UV-Auswertungen, CSV-Export und automatische Backups.

## Hardware und Materialliste

Aktiver Bestand: Raspberry Pi 4, SEN0501 V2.0, GP8600, IMX219,
120-W-Quantum-Board mit XLG-150-H-AB sowie zwei Noctua-Lüfter mit NA-FC1
und separatem 12-V-Lüfternetzteil.

Die folgende Bestellliste dokumentiert die Materialplanung. Das Bestelldatum
belegt weder Lieferung noch Inbetriebnahme.

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
| Pumpensteuerung | Purecrea MOSFET-Treiber mit AOD4184, Artikel 420985, 5–36 V DC, 3,3–5 V Steuereingang | 2 |
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




### WLSW1-Schwimmerschalter testen

Der WLSW1 wird zwischen **BCM GPIO22 (physischer Pin 15)** und **GND (Pin 14)** angeschlossen. Der Eingang verwendet einen internen Pull-up. Keine externe Spannung anlegen. Die Software liest nur diesen Eingang; Pumpenausgänge werden dadurch nicht aktiviert.

| Kontakt | Anzeige | Logik |
|---|---|---|
| Geschlossen, stabil seit mindestens 300 ms | Wasser vorhanden | GPIO LOW, `tank_ok: true` |
| Offen / Kabel unterbrochen | Tank leer | GPIO HIGH, `tank_ok: false` |
| GPIO nicht verfügbar oder Lesung älter als 2 Sekunden | Tankstatus unbekannt | `tank_ok: false` |

Der Schwimmer muss so montiert bzw. umgedreht werden, dass der Kontakt bei ausreichend Wasser geschlossen ist. Ein offener Kontakt kann nicht von einem unterbrochenen Kabel unterschieden werden. Ein erfolgreich lesbarer GPIO bestätigt nicht, dass der Schalter angeschlossen ist. GPIO-Fehler werden nach zehn Sekunden automatisch erneut geprüft.

Abhängigkeiten in der Dienstumgebung installieren und den Dienst neu starten:

```bash
/home/pi/.virtualenvs/pimoroni/bin/python -m pip install gpiozero lgpio
sudo systemctl restart plant-monitor
```

In der Oberfläche unter Bewässerung den Tankzustand beobachten (Aktualisierung ungefähr alle fünf Sekunden). Für einen schnellen Test direkt auf dem Pi:

```bash
watch -n 1 'curl -s http://127.0.0.1:8000/api/tank/status'
```

Schwimmer hoch- und herunterbewegen. `tank_state` muss zwischen `ok` und `empty` wechseln; `contact_closed` und `gpio_level` zeigen das rohe Kontaktsignal. Bei `unknown` den Wert `error` prüfen, insbesondere GPIO-Bibliotheken, Zugriffsrechte und eine mögliche anderweitige Belegung von GPIO22.

