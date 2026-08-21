// Súgó oldal — összecsukható szekciók listája, mindegyik egy funkciót
// magyaráz el egyszerű, nem technikai nyelven. Tisztán statikus, olvasásra
// szánt tartalom, ezért a nyitott/csukott állapotot nem a globális
// state-ben tartjuk (nem indokolt egy teljes app-rerendert kiváltani egy
// szekció ki/becsukásáért) — helyi closure-ök közvetlenül a saját
// DOM-részüket módosítják, a demó CollapsibleCard mintáját követve.

import { closeHelp } from "./session.js";

function h(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.style) Object.assign(node.style, opts.style);
  if (opts.onClick) node.addEventListener("click", opts.onClick);
  children.forEach((c) => c && node.appendChild(c));
  return node;
}

const SECTIONS = [
  {
    icon: "⚖️", color: "var(--green)", title: "Ruhátlan testsúlymérés",
    text: "Ez adja az alapját annak, hogy a gyerek-dobozban a helyes aktuális súlyt és a heti gyarapodást lássátok. Amikor lemérted a babát ruha nélkül, itt rögzítsd a dátumot, időt és a súlyt grammban. Érdemes rendszeresen (pl. hetente egyszer-kétszer) felvinni, hogy a heti gyarapodás-jelzés pontos legyen.",
  },
  {
    icon: "💧", color: "var(--pink)", title: "Szoptatás",
    text: "Rögzítsd, mikor kezdődött és fejeződött be a szoptatás, melyik oldalról (vagy mindkettőről) szopott a baba. Ha le tudtad mérni a babát a szoptatás előtt és után, add meg mindkét súlyt — az app automatikusan kiszámolja, kb. mennyit ivott. Ha nem tudtad lemérni, kapcsold be a \"Nem mérhető most\" gombot, és a súlymezők eltűnnek. Ha adtál mellé plusz anyatejet vagy tápszert cumisüvegből, azt is jelöld be ml-ben.",
  },
  {
    icon: "🧷", color: "var(--amber)", title: "Pelenkacsere",
    text: "Jelöld, hogy pisis, kakis, vagy mindkettő volt-e a pelenka. Ha volt kaki, add meg a színét és állagát is — ez hasznos lehet, ha bármi szokatlant észreveszel, és meg tudod mutatni a védőnőnek/orvosnak, mit láttatok korábban.",
  },
  {
    icon: "🩺", color: "var(--accent)", title: "Egyéb (köldökápolás, gyógyszerek, vitaminok)",
    text: "Itt jelölheted be, hogy megtörtént-e aznap a köldökápolás, és hogy be lettek-e adva a beállított gyógyszerek/vitaminok (pl. D-vitamin naponta, K-vitamin havonta). Ha valami esedékes, és még nem történt meg, piros figyelmeztetés jelzi. A gyógyszer- és tevékenység-sablonokat a Karbantartás oldalon tudod szerkeszteni, törölni, vagy újat felvenni.",
  },
  {
    icon: "❓", color: "var(--faint)", title: "Kérdések a védőnőnek / orvosnak",
    text: "Ha eszedbe jut egy kérdés, amit meg szeretnél kérdezni a következő látogatáskor, írd ide, hogy ne felejtsd el. Megadhatod, hogy a védőnőnek vagy az orvosnak szól-e. Amikor megkaptátok a választ, ide beírhatod, és átállíthatod \"Megválaszolva\" státuszra — a szűrőkkel könnyen megtalálod, mi van még nyitva.",
  },
  {
    icon: "📋", color: "var(--accent)", title: "Historikus adatok",
    text: "Itt látod időrendben az összes korábbi bejegyzést (súlymérés, szoptatás, pelenkacsere, egyéb). Szűrhetsz típus szerint, ha csak egy adott fajta bejegyzést keresel. Ha bármit elgépeltetek, a toll-ikonra koppintva bármelyik bejegyzést utólag is módosíthatjátok vagy törölhetitek.",
  },
  {
    icon: "📊", color: "var(--green)", title: "Grafikonok",
    text: "A Historikus adatok oldalról érhető el. Itt láthatod a súlygörbét (a kitűzött heti gyarapodási célhoz képest), valamint a szoptatások és pelenkacserék gyakoriságát, napi/heti/havi bontásban. A nyilakkal léptethetsz korábbi vagy későbbi időszakokra.",
  },
  {
    icon: "🔧", color: "var(--amber)", title: "Karbantartás",
    text: "Itt szerkesztheted a baba alapadatait (név, születési adatok, heti gyarapodási cél), valamint a gyógyszer- és tevékenység-sablonokat, amiket az Egyéb doboz használ.",
  },
  {
    icon: "👥", color: "var(--pink)", title: "Userek és jogosultságok",
    text: "Ha te vagy az első, aki regisztrálja a babát, automatikusan admin leszel — te hagyod jóvá, ha valaki más is csatlakozni szeretne ugyanahhoz a babához. Adminként másokat is kinevezhetsz adminná. Ha egy babánál több szülő/hozzátartozó is regisztrál, mindannyian ugyanazokat az adatokat látjátok és szerkeszthetitek.",
  },
  {
    icon: "🔀", color: "var(--accent)", title: "Több baba között váltás",
    text: "Ha több babához is hozzáférésed van (pl. ikrek esetén, vagy mert több családnál is segítesz), a baba neve mellett egy váltógomb jelenik meg, amivel átválthatsz köztük.",
  },
  {
    icon: "🕐", color: "var(--green)", title: "Dátum, idő és szám megadása",
    text: "Mindenhol, ahol dátumot vagy időt kell megadni, egy naptár, illetve egy görgethető óra-választó jelenik meg — nem kell begépelni. A \"Ma\" és \"Most\" gombokkal egy koppintással beállíthatod a jelenlegi időpontot. Ha korábbi dátumot választasz, az app rákérdez, hogy biztosan azt szeretnéd-e rögzíteni. Súly és mennyiség (ml) megadásához egy nagy, felugró számbillentyűzet jelenik meg — ez kényelmesebb egy kézzel, szoptatás közben is.",
  },
  {
    icon: "📲", color: "var(--amber)", title: "Alkalmazás telepítése a telefonra",
    text: "Nyisd meg az anyanotesz.vercel.app oldalt Chrome-ban, koppints a ⋮ menüre, majd válaszd az \"Alkalmazás telepítése\" opciót. Ezután az alkalmazás egy ikonként megjelenik a kezdőképernyődön, és úgy nyílik meg, mint egy natív app.",
  },
];

function buildSection({ icon, color, title, text }) {
  const card = h("div", { className: "card" });

  const chevron = h("span", { className: "coll-chevron", text: "⌄" });
  const head = h("button", { className: "coll-head" });
  head.appendChild(h("span", { className: "coll-icon-chip", text: icon, style: { background: `color-mix(in srgb, ${color} 22%, var(--panel))` } }));
  head.appendChild(h("h3", { text: title }));
  head.appendChild(chevron);

  const body = h("div", { className: "coll-body" });
  body.appendChild(h("p", { text, style: { fontSize: "13.5px", color: "var(--muted)", lineHeight: "1.5", margin: 0 } }));
  body.style.display = "none";

  let open = false;
  head.addEventListener("click", () => {
    open = !open;
    chevron.classList.toggle("open", open);
    body.style.display = open ? "" : "none";
  });

  card.append(head, body);
  return card;
}

export function buildHelpPage() {
  const wrap = h("div");

  const headRow = h("div", { className: "history-head-row" });
  const backBtn = h("button", { className: "back-btn", onClick: () => closeHelp() });
  backBtn.append(h("span", { text: "←" }), h("span", { text: "Vissza" }));
  headRow.append(backBtn, h("h2", { className: "history-title", text: "Súgó" }));
  wrap.appendChild(headRow);

  SECTIONS.forEach((section) => wrap.appendChild(buildSection(section)));

  return wrap;
}
