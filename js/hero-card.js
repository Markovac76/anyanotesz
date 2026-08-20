// Gyerek-doboz — a demó (anyanotesz-demo.jsx) BABY_INFO kártyájának natív
// ES-modul portja, valós adatokkal (specifikacio.md 5. pont).
//
// Heti gyarapodás számítása: a hét eleje (hétfő 00:00) előtti utolsó ismert
// súlyhoz képest mért tényleges gyarapodás, a cél EDDIGI (a hétből eltelt
// napok arányos) részéhez viszonyítva — nem a teljes heti célhoz, hiszen
// a hét közepén még nem várható el a teljes heti gyarapodás.

function h(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.style) Object.assign(node.style, opts.style);
  children.forEach((c) => c && node.appendChild(c));
  return node;
}

function pad(n) { return String(n).padStart(2, "0"); }

const STATUS_LABEL = {
  green: "✓ Az elvárt ütemen belül",
  amber: "△ Eltér, de behozható",
  red: "! Jelentős eltérés",
};

function computeGainStatus(info) {
  const { baby, latestWeight, weekBaselineWeight, weekEarliestWeight, weekStart } = info;
  if (!latestWeight) return null;

  const target = baby.weekly_gain_target_g || 150;
  const now = new Date();

  let baseline;
  let elapsedDays;
  let approximate = false;

  if (weekBaselineWeight) {
    // A rendes eset: van mérés a hét eleje (hétfő) előttről is, tehát a
    // teljes eddig eltelt hétre (hétfőtől máig) tudjuk vetíteni a célt.
    baseline = weekBaselineWeight;
    elapsedDays = Math.min(7, Math.max(1, Math.floor((now - weekStart) / 86400000) + 1));
  } else if (weekEarliestWeight && new Date(weekEarliestWeight.measured_at).getTime() !== new Date(latestWeight.measured_at).getTime()) {
    // Fallback: nincs korábbi (hét eleje előtti) mérés — pl. csak most
    // kezdődött a naplózás. A héten belüli első méréstől máig eltelt
    // (rövidebb, pontatlanabb) időszakra vetítjük a célt.
    baseline = weekEarliestWeight;
    const baselineDate = new Date(weekEarliestWeight.measured_at);
    elapsedDays = Math.max(0.5, (now - baselineDate) / 86400000);
    approximate = true;
  } else {
    // Egyetlen mérés van csak összesen — nincs miből trendet számolni.
    return null;
  }

  const expectedSoFar = (target * elapsedDays) / 7;
  if (expectedSoFar <= 0) return null;

  const actualGain = latestWeight.weight_g - baseline.weight_g;
  const ratio = actualGain / expectedSoFar;
  const status = ratio >= 0.85 && ratio <= 1.15 ? "green" : ratio >= 0.5 && ratio <= 1.5 ? "amber" : "red";
  return { status, actualGain, target, approximate };
}

export function buildHeroCard(st) {
  const info = st.babyInfo;
  if (!info || !info.baby) return null;
  const { baby, latestWeight } = info;

  const card = h("div", { className: "card hero-card" });

  if (baby.born_at) {
    const d = new Date(baby.born_at);
    card.appendChild(h("div", {
      className: "hero-eyebrow",
      text: `Született ${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}. ${pad(d.getHours())}:${pad(d.getMinutes())}`,
    }));
  }
  if (baby.birth_place) {
    card.appendChild(h("div", { className: "hero-place", text: baby.birth_place }));
  }
  if (baby.birth_weight_g != null || baby.birth_length_cm != null) {
    const row = h("div", { className: "hero-birth-stats" });
    if (baby.birth_weight_g != null) {
      row.appendChild(h("span", {}, [document.createTextNode("Sz. súly: "), h("b", { text: `${baby.birth_weight_g} g` })]));
    }
    if (baby.birth_length_cm != null) {
      row.appendChild(h("span", {}, [document.createTextNode("Sz. hossz: "), h("b", { text: `${baby.birth_length_cm} cm` })]));
    }
    card.appendChild(row);
  }

  if (!latestWeight) {
    card.appendChild(h("div", { className: "hero-hint", text: "Még nincs rögzítve súlymérés." }));
    return card;
  }

  const weightRow = h("div", { className: "hero-weight-row" });
  weightRow.appendChild(h("div", { className: "hero-weight", text: `${latestWeight.weight_g.toLocaleString("hu-HU")} g` }));
  weightRow.appendChild(h("div", { className: "hero-weight-label", text: "aktuális súly" }));
  card.appendChild(weightRow);

  const gain = computeGainStatus(info);
  if (!gain) {
    card.appendChild(h("div", { className: "hero-hint", text: "Még nincs elég korábbi adat a heti gyarapodás számításához." }));
    return card;
  }

  const statusRow = h("div", { className: "hero-status-row" });
  statusRow.appendChild(h("span", { className: `status-badge ${gain.status}`, text: STATUS_LABEL[gain.status] }));
  const sign = gain.actualGain >= 0 ? "+" : "";
  const approxNote = gain.approximate ? " (közelítő, kevés adat alapján)" : "";
  statusRow.appendChild(h("span", { className: "hero-status-detail", text: `${sign}${gain.actualGain} g a héten eddig (cél: ${gain.target} g/hét)${approxNote}` }));
  card.appendChild(statusRow);

  return card;
}
