// Kurs-Bote für das Börsenspiel auf sek1.ch: holt die aktuellen Kurse
// (CoinGecko für Kryptos, Yahoo Finance für Devisen/Indizes/Aktien/Metalle,
// frankfurter.dev als Devisen-Reserve) und meldet sie der Spiel-Datenbank
// (Supabase-RPC kurse_setzen, geschützt durch das Secret KURS_GEHEIM).
//
// Dieses Repo ist ÖFFENTLICH, damit die GitHub-Action gratis alle 10 Minuten
// laufen darf. Es enthält keinerlei Schul- oder Schülerdaten – nur diesen
// Melder. Projekt-Adresse und publishable-Schlüssel sind ohnehin öffentlich
// (stehen auch im Website-Code); das einzige Geheimnis ist KURS_GEHEIM.
//
// Gemeldet werden NUR frisch geholte Kurse: fällt eine Quelle aus, behält
// die betroffene Anlage in der Datenbank ihren letzten Stand samt ehrlichem
// Zeitstempel (die Website zeigt «Kurse zuletzt aktualisiert: …»).
//
// ACHTUNG: Die Symbol-Liste unten muss zu public/anlagen.js und
// werkzeuge/boersenwaechter.sql im (privaten) Website-Repo lapensio/schule
// passen. Neue Anlagen dort UND hier eintragen.

const URL = "https://dltmkcspedtgnwumwyqb.supabase.co";
const SCHLUESSEL = "sb_publishable_PnIj5zYZanMmP-HOgUZwpg_VAiDGZdK";

const geheim = process.env.KURS_GEHEIM;
if (!geheim) {
  console.error("KURS_GEHEIM ist nicht gesetzt – ohne Geheimnis keine Meldung.");
  process.exit(1);
}

// Symbol-Listen (Kopie aus lapensio/schule, werkzeuge/symbole.mjs – dort
// stehen die Begründungen zu jedem Symbol).
const YAHOO = {
  // Owner 02.09.2026: ETFs der Heimatbörsen statt Index-Punktestände
  IWDA: "IWDA.L",
  SPY: "SPY",
  QQQ: "QQQ",
  SMICHA: "SMICHA.SW",
  EUN2: "EUN2.DE",
  NVDA: "NVDA", AAPL: "AAPL", GOOGL: "GOOGL", MSFT: "MSFT",
  AMZN: "AMZN", TSLA: "TSLA",
  ROG: "RO.SW", NOVN: "NOVN.SW", NESN: "NESN.SW", UBSG: "UBSG.SW",
  IMMO: "SRECHA.SW",
  OBLI: "CSBGC0.SW",
  GOLD: "GC=F",
  SILBER: "SI=F"
};
const DEVISEN = { USDCHF: "USDCHF=X", EURCHF: "EURCHF=X" };
const WAEHRUNG_FALLBACK = {};
const KRYPTO = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin", XRP: "ripple" };

async function holJson(url, kopf) {
  const r = await fetch(url, { headers: { "user-agent": "kurs-bote (github-action)", ...(kopf || {}) } });
  if (!r.ok) throw new Error(url + " -> HTTP " + r.status);
  return r.json();
}
async function yahooMeta(symbol) {
  const y = await holJson("https://query1.finance.yahoo.com/v8/finance/chart/"
    + encodeURIComponent(symbol) + "?range=5d&interval=1d");
  const m = y.chart && y.chart.result && y.chart.result[0] && y.chart.result[0].meta;
  return m || {};
}
const pause = () => new Promise((fertig) => setTimeout(fertig, 250));

// Letzte bekannte Referenzkurse als Rechen-Reserve (öffentlich lesbar) –
// gebraucht, wenn die Devisen-Quellen gerade nicht antworten.
let ref = {};
try {
  const zeilen = await holJson(URL + "/rest/v1/kurs_referenz?select=code,chf",
    { apikey: SCHLUESSEL, Authorization: "Bearer " + SCHLUESSEL });
  zeilen.forEach((z) => { ref[z.code] = Number(z.chf); });
} catch (e) { console.error("Referenz lesen:", e.message); }

const frisch = {}; // nur diese Codes werden gemeldet

// 1) Kryptos (CoinGecko, ein Aufruf)
try {
  const cg = await holJson("https://api.coingecko.com/api/v3/simple/price?ids="
    + Object.values(KRYPTO).join(",") + "&vs_currencies=chf");
  for (const code of Object.keys(KRYPTO)) {
    const e = cg[KRYPTO[code]];
    if (e && e.chf > 0) frisch[code] = e.chf;
  }
} catch (e) { console.error("CoinGecko:", e.message); }

// 2) Devisen: Yahoo zuerst, frankfurter als Reserve, alte Referenz als letzte
let usdChf = 0, eurChf = 0;
for (const [paar, symbol] of Object.entries(DEVISEN)) {
  try {
    const m = await yahooMeta(symbol);
    if (m.regularMarketPrice > 0) {
      if (paar === "USDCHF") usdChf = m.regularMarketPrice;
      if (paar === "EURCHF") eurChf = m.regularMarketPrice;
    }
  } catch (e) { console.error("Yahoo Devisen " + paar + ":", e.message); }
  await pause();
}
if (!(usdChf > 0)) {
  try {
    const fu = await holJson("https://api.frankfurter.dev/v1/latest?from=USD&to=CHF");
    if (fu.rates && fu.rates.CHF > 0) usdChf = fu.rates.CHF;
  } catch (e) { console.error("frankfurter USD:", e.message); }
}
if (!(eurChf > 0)) {
  try {
    const fr = await holJson("https://api.frankfurter.dev/v1/latest?from=EUR&to=CHF");
    if (fr.rates && fr.rates.CHF > 0) eurChf = fr.rates.CHF;
  } catch (e) { console.error("frankfurter EUR:", e.message); }
}
if (usdChf > 0) frisch.USD = usdChf; else usdChf = ref.USD || 0;
if (eurChf > 0) frisch.EUR = eurChf; else eurChf = ref.EUR || 0;

// 3) Aktien, Indizes, Metalle, ETFs (Yahoo, ein Aufruf pro Symbol)
const NACH_CHF = { CHF: 1, USD: usdChf, EUR: eurChf };
for (const code of Object.keys(YAHOO)) {
  try {
    const m = await yahooMeta(YAHOO[code]);
    const kurs = m.regularMarketPrice;
    const faktor = NACH_CHF[m.currency || WAEHRUNG_FALLBACK[code]];
    if (kurs > 0 && faktor > 0) frisch[code] = Math.round(kurs * faktor * 100) / 100;
    else console.error("Yahoo " + code + ": kein Kurs/Währung – letzter Stand bleibt.");
  } catch (e) { console.error("Yahoo " + code + ":", e.message); }
  await pause();
}

// 4) Melden (nur wenn etwas Frisches da ist)
if (!Object.keys(frisch).length) {
  console.error("Keine einzige Quelle hat geantwortet – nichts gemeldet.");
  process.exit(1);
}
const r = await fetch(URL + "/rest/v1/rpc/kurse_setzen", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: SCHLUESSEL,
    Authorization: "Bearer " + SCHLUESSEL
  },
  body: JSON.stringify({ geheim: geheim, daten: frisch })
});
if (!r.ok) {
  console.error("Kurs-Meldung fehlgeschlagen: HTTP " + r.status + " " + (await r.text()).slice(0, 300));
  process.exit(1);
}
console.log("Gemeldet (" + Object.keys(frisch).length + " Kurse): " + Object.keys(frisch).join(", "));
