# kurs-bote

Meldet alle 10 Minuten die aktuellen Kurse (Kryptos, Devisen, Indizes,
Aktien, Metalle) an die Spiel-Datenbank des Schul-Börsenspiels auf
[sek1.ch](https://sek1.ch/boersenspiel) – eine Lernsimulation mit Spielgeld,
ohne echte Finanzdienstleistung.

Dieses Repo ist bewusst öffentlich (GitHub-Actions laufen so gratis) und
enthält nur den Melder – keine Schul- oder Schülerdaten. Das einzige
Geheimnis ist das Action-Secret `KURS_GEHEIM` (Schreib-Schlüssel der
Kurs-Meldung); Details stehen im Kopf von `kurse-melden.mjs`.

Die Website selbst liegt im privaten Repo `lapensio/schule`.
