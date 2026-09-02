# kurs-bote

Reserve-Melder für die Kurse (Kryptos, Devisen, Indizes, Aktien, Metalle) der
Spiel-Datenbank des Schul-Börsenspiels auf [sek1.ch](https://sek1.ch/boersenspiel)
– eine Lernsimulation mit Spielgeld, ohne echte Finanzdienstleistung.

**Seit 02.09.2026 meldet die 10-Minuten-Kurse die «Datenbank-Uhr» in Supabase**
(pg_cron ruft alle 10 Minuten die Supabase-Funktion `kurse-melden` auf, die
denselben Ablauf wie `kurse-melden.mjs` hier ausführt). GitHub liess den
Zeitplan dieses Repos nur alle 2 bis 4 Stunden laufen. Die Action hier ist
darum nur noch von Hand startbar (Actions-Tab) – als Reserve.

Dieses Repo ist bewusst öffentlich und enthält nur den Melder – keine Schul-
oder Schülerdaten. Das einzige Geheimnis ist das Action-Secret `KURS_GEHEIM`
(Schreib-Schlüssel der Kurs-Meldung); Details stehen im Kopf von
`kurse-melden.mjs`.

Die Website selbst liegt im privaten Repo `lapensio/schule`.
