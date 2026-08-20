// Grafikonok oldal — a demó (anyanotesz-demo.jsx) "graphs" nézetének natív
// ES-modul portja. A projekt build-eszköz és keretrendszer nélküli, ezért itt
// nincs Recharts/React — a specifikáció "vagy natív Canvas" alternatíváját
// követve saját, kézzel épített SVG vonal-/oszlopdiagramokat rajzolunk.
// A három diagramhoz szükséges nyers idősorokat a session.openGraphs() tölti
// be egyszer; a nap/hét/hónap váltás és a léptetés kliens oldalon, helyi
// (nem globális) állapotból dolgozik, hogy ne kelljen újrarenderelni az
// egész appot minden nyílgombra kattintáskor.

import { closeGraphs } from "./session.js";

function h(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.style) Object.assign(node.style, opts.style);
  if (opts.onClick) node.addEventListener("click", opts.onClick);
  children.forEach((c) => c && node.appendChild(c));
  return node;
}

function svg(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function pad(n) { return String(n).padStart(2, "0"); }

const HU_DAYS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
const HU_MONTHS = ["jan", "febr", "márc", "ápr", "máj", "jún", "júl", "aug", "szept", "okt", "nov", "dec"];
const HU_MONTHS_FULL = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];

function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // hétfő=0
  x.setDate(x.getDate() - day);
  return x;
}

function sameDay(a, b) { return a.toDateString() === b.toDateString(); }

function weekRangeLabel(start) {
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const m1 = HU_MONTHS[start.getMonth()], m2 = HU_MONTHS[end.getMonth()];
  return sameMonth
    ? `${start.getFullYear()}. ${m1}. ${start.getDate()}–${end.getDate()}.`
    : `${start.getFullYear()}. ${m1}. ${start.getDate()}. – ${m2}. ${end.getDate()}.`;
}

function monthLabel(offset) {
  const now = new Date();
  const m = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${m.getFullYear()}. ${HU_MONTHS_FULL[m.getMonth()]}`;
}

function dayLabel(offset) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const rel = sameDay(d, now) ? "ma" : sameDay(d, yesterday) ? "tegnap" : HU_DAYS[(d.getDay() + 6) % 7].toLowerCase();
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}. · ${rel}`;
}

// ---- Súlygörbe adatok ----

function targetWeightForDate(d, growth) {
  if (!growth?.born_at) return null;
  const born = new Date(growth.born_at);
  const days = Math.floor((d - born) / 86400000);
  if (days < 0) return null;
  const dailyTarget = (growth.weekly_gain_target_g || 150) / 7;
  return Math.round((growth.birth_weight_g || 0) + dailyTarget * days);
}

function lastMeasurementOnDay(weightSeries, d) {
  const onDay = weightSeries.filter((m) => sameDay(m.when, d));
  return onDay.length ? onDay[onDay.length - 1].weightG : null;
}

function weightWeekData(weightSeries, growth, offset) {
  const now = new Date();
  const start = startOfWeek(now); start.setDate(start.getDate() + offset * 7);
  return HU_DAYS.map((label, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i);
    if (d > now) return { label, cel: null, teny: null };
    return { label, cel: targetWeightForDate(d, growth), teny: lastMeasurementOnDay(weightSeries, d) };
  });
}

function weightMonthData(weightSeries, growth, offset) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const isCurrent = offset === 0;
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const lastDay = isCurrent ? now.getDate() : daysInMonth;
  const arr = [];
  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    arr.push({ label: String(day), cel: targetWeightForDate(d, growth), teny: lastMeasurementOnDay(weightSeries, d) });
  }
  return arr;
}

// ---- Szoptatás / pelenkacsere adatok ----

function countsByDay(times, offset) {
  const day = new Date(); day.setDate(day.getDate() + offset); day.setHours(0, 0, 0, 0);
  const counts = Array(24).fill(0);
  times.forEach((t) => { if (sameDay(t, day)) counts[t.getHours()]++; });
  return counts.map((count, hh) => ({ label: pad(hh), count }));
}

function countsByWeek(times, offset) {
  const start = startOfWeek(new Date()); start.setDate(start.getDate() + offset * 7);
  return HU_DAYS.map((label, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i);
    return { label, count: times.filter((t) => sameDay(t, d)).length };
  });
}

function countsByMonth(times, offset) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const isCurrent = offset === 0;
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const lastDay = isCurrent ? now.getDate() : daysInMonth;
  const arr = [];
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), d);
    arr.push({ label: String(d), count: times.filter((t) => sameDay(t, date)).length });
  }
  return arr;
}

function feedDayData(feedingTimes, offset) { return countsByDay(feedingTimes, offset); }
function feedWeekData(feedingTimes, offset) { return countsByWeek(feedingTimes, offset); }
function feedMonthData(feedingTimes, offset) { return countsByMonth(feedingTimes, offset); }

function diaperCountsFor(events, matchDay) {
  let pisi = 0, kaki = 0;
  events.forEach((e) => {
    if (!matchDay(e.when)) return;
    if (e.type === "pisi" || e.type === "mindketto") pisi++;
    if (e.type === "kaki" || e.type === "mindketto") kaki++;
  });
  return { pisi, kaki };
}

function diaperDayData(diaperEvents, offset) {
  const day = new Date(); day.setDate(day.getDate() + offset); day.setHours(0, 0, 0, 0);
  const arr = [];
  for (let hh = 0; hh < 24; hh++) {
    const { pisi, kaki } = diaperCountsFor(diaperEvents, (w) => sameDay(w, day) && w.getHours() === hh);
    arr.push({ label: pad(hh), pisi, kaki });
  }
  return arr;
}

function diaperWeekData(diaperEvents, offset) {
  const start = startOfWeek(new Date()); start.setDate(start.getDate() + offset * 7);
  return HU_DAYS.map((label, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const { pisi, kaki } = diaperCountsFor(diaperEvents, (w) => sameDay(w, d));
    return { label, pisi, kaki };
  });
}

function diaperMonthData(diaperEvents, offset) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const isCurrent = offset === 0;
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const lastDay = isCurrent ? now.getDate() : daysInMonth;
  const arr = [];
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), d);
    const { pisi, kaki } = diaperCountsFor(diaperEvents, (w) => sameDay(w, date));
    arr.push({ label: String(d), pisi, kaki });
  }
  return arr;
}

// ---- SVG diagram-építők ----

const CHART_W = 320;
const CHART_H = 160;
const PAD = { left: 30, right: 8, top: 10, bottom: 18 };

function chartSkeleton() {
  const el = svg("svg", { viewBox: `0 0 ${CHART_W} ${CHART_H}`, width: "100%", height: "160", preserveAspectRatio: "none" });
  const innerH = CHART_H - PAD.top - PAD.bottom;
  for (let g = 0; g <= 3; g++) {
    const y = PAD.top + (innerH / 3) * g;
    el.appendChild(svg("line", { x1: PAD.left, x2: CHART_W - PAD.right, y1: y, y2: y, stroke: "var(--line)", "stroke-width": 1 }));
  }
  return el;
}

function xLabels(el, data) {
  const n = data.length;
  const innerW = CHART_W - PAD.left - PAD.right;
  const step = n > 1 ? innerW / (n - 1) : 0;
  const every = n > 10 ? Math.ceil(n / 6) : 1;
  data.forEach((d, i) => {
    if (i % every !== 0) return;
    const t = svg("text", { x: PAD.left + step * i, y: CHART_H - 4, "text-anchor": "middle", "font-size": "9" });
    t.setAttribute("fill", "var(--faint)");
    t.textContent = d.label;
    el.appendChild(t);
  });
}

function buildLineChartSvg(data) {
  const el = chartSkeleton();
  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const n = data.length;
  const step = n > 1 ? innerW / (n - 1) : 0;
  const values = data.flatMap((d) => [d.cel, d.teny]).filter((v) => v != null);
  const min = Math.min(...values) - 25;
  const max = Math.max(...values) + 25;

  function xFor(i) { return PAD.left + step * i; }
  function yFor(v) { return PAD.top + innerH - ((v - min) / (max - min)) * innerH; }

  const celPoints = data.map((d, i) => (d.cel != null ? `${xFor(i)},${yFor(d.cel)}` : null)).filter(Boolean).join(" ");
  if (celPoints) {
    const line = svg("polyline", { points: celPoints, fill: "none", "stroke-width": "1.5", "stroke-dasharray": "4 3" });
    line.setAttribute("stroke", "var(--faint)");
    el.appendChild(line);
  }

  const tenyPts = data.map((d, i) => (d.teny != null ? { x: xFor(i), y: yFor(d.teny) } : null)).filter(Boolean);
  if (tenyPts.length) {
    const line = svg("polyline", { points: tenyPts.map((p) => `${p.x},${p.y}`).join(" "), fill: "none", "stroke-width": "2.5" });
    line.setAttribute("stroke", "var(--green)");
    el.appendChild(line);
    tenyPts.forEach((p) => {
      const dot = svg("circle", { cx: p.x, cy: p.y, r: "2.5" });
      dot.setAttribute("fill", "var(--green)");
      el.appendChild(dot);
    });
  }

  xLabels(el, data);
  return el;
}

function buildBarChartSvg(data, series) {
  const el = chartSkeleton();
  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const n = data.length;
  const maxTotal = Math.max(1, ...data.map((d) => series.reduce((sum, s) => sum + (d[s.key] || 0), 0)));
  const slotW = innerW / n;
  const barW = Math.min(16, slotW * 0.6);

  const maxLabel = svg("text", { x: PAD.left - 4, y: PAD.top + 4, "text-anchor": "end", "font-size": "9" });
  maxLabel.setAttribute("fill", "var(--faint)");
  maxLabel.textContent = String(maxTotal);
  el.appendChild(maxLabel);
  const zeroLabel = svg("text", { x: PAD.left - 4, y: PAD.top + innerH, "text-anchor": "end", "font-size": "9" });
  zeroLabel.setAttribute("fill", "var(--faint)");
  zeroLabel.textContent = "0";
  el.appendChild(zeroLabel);

  data.forEach((d, i) => {
    const cx = PAD.left + slotW * i + slotW / 2;
    let yCursor = PAD.top + innerH;
    series.forEach((s) => {
      const v = d[s.key] || 0;
      if (v <= 0) return;
      const barH = (v / maxTotal) * innerH;
      const y = yCursor - barH;
      const rect = svg("rect", { x: cx - barW / 2, y, width: barW, height: Math.max(barH, 1), rx: "2" });
      rect.setAttribute("fill", s.color);
      el.appendChild(rect);
      yCursor -= barH;
    });
  });

  xLabels(el, data);
  return el;
}

function legendItem(color, label, dashed) {
  const item = h("span", { className: "chart-legend-item" });
  const swatch = h("span", { className: "chart-legend-swatch" + (dashed ? " dashed" : "") });
  swatch.style.background = dashed ? "transparent" : color;
  swatch.style.borderColor = color;
  item.append(swatch, h("span", { text: label }));
  return item;
}

// ---- Kártya-építők ----

function buildWeightChartCard(weightSeries, growth) {
  const card = h("div", { className: "card" });

  const headRow = h("div", { className: "row-between", style: { marginBottom: "10px" } });
  const titleWrap = h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } });
  titleWrap.appendChild(h("div", { className: "coll-icon-chip", text: "📈", style: { background: "color-mix(in srgb, var(--accent) 22%, var(--panel))", color: "var(--accent)" } }));
  titleWrap.appendChild(h("h3", { text: "Súlygörbe", style: { fontFamily: "var(--font-display)", fontSize: "15px", fontWeight: "700", margin: 0 } }));
  headRow.appendChild(titleWrap);

  const periodRow = h("div", { style: { display: "flex", gap: "4px" } });
  const weekBtn = h("button", { className: "period-chip active", text: "Heti" });
  const monthBtn = h("button", { className: "period-chip", text: "Havi" });
  periodRow.append(weekBtn, monthBtn);
  headRow.appendChild(periodRow);
  card.appendChild(headRow);

  const navRow = h("div", { className: "row-between", style: { marginBottom: "6px" } });
  const prevBtn = h("button", { className: "chart-nav-btn", text: "‹" });
  const labelEl = h("span", { className: "chart-nav-label" });
  const nextBtn = h("button", { className: "chart-nav-btn", text: "›" });
  navRow.append(prevBtn, labelEl, nextBtn);
  card.appendChild(navRow);

  const chartArea = h("div", { className: "chart-area" });
  card.appendChild(chartArea);

  let period = "week";
  let weekOffset = 0;
  let monthOffset = 0;

  function render() {
    const offset = period === "week" ? weekOffset : monthOffset;
    const data = period === "week" ? weightWeekData(weightSeries, growth, offset) : weightMonthData(weightSeries, growth, offset);
    if (period === "week") {
      const start = startOfWeek(new Date()); start.setDate(start.getDate() + offset * 7);
      labelEl.textContent = weekRangeLabel(start);
    } else {
      labelEl.textContent = monthLabel(offset);
    }
    nextBtn.disabled = offset === 0;

    chartArea.innerHTML = "";
    const hasData = data.some((d) => d.teny != null);
    if (!hasData) {
      chartArea.appendChild(h("div", { className: "hint-box", text: "Nincs mérési adat ebben az időszakban.", style: { textAlign: "center", marginBottom: 0 } }));
      return;
    }
    chartArea.appendChild(buildLineChartSvg(data));
    const legend = h("div", { className: "chart-legend" });
    legend.append(legendItem("var(--faint)", "Cél", true), legendItem("var(--green)", "Tényleges"));
    chartArea.appendChild(legend);
  }

  weekBtn.addEventListener("click", () => {
    period = "week"; weekBtn.classList.add("active"); monthBtn.classList.remove("active"); render();
  });
  monthBtn.addEventListener("click", () => {
    period = "month"; monthBtn.classList.add("active"); weekBtn.classList.remove("active"); render();
  });
  prevBtn.addEventListener("click", () => { if (period === "week") weekOffset--; else monthOffset--; render(); });
  nextBtn.addEventListener("click", () => {
    const offset = period === "week" ? weekOffset : monthOffset;
    if (offset >= 0) return;
    if (period === "week") weekOffset++; else monthOffset++;
    render();
  });

  render();
  return card;
}

function buildCountChartCard({ title, icon, color, series, genDay, genWeek, genMonth }) {
  const card = h("div", { className: "card" });

  const headRow = h("div", { className: "row-between", style: { marginBottom: "10px" } });
  const titleWrap = h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } });
  titleWrap.appendChild(h("div", { className: "coll-icon-chip", text: icon, style: { background: `color-mix(in srgb, ${color} 22%, var(--panel))`, color } }));
  titleWrap.appendChild(h("h3", { text: title, style: { fontFamily: "var(--font-display)", fontSize: "15px", fontWeight: "700", margin: 0 } }));
  headRow.appendChild(titleWrap);

  const periodRow = h("div", { style: { display: "flex", gap: "4px" } });
  const dayBtn = h("button", { className: "period-chip", text: "Napi" });
  const weekBtn = h("button", { className: "period-chip active", text: "Heti" });
  const monthBtn = h("button", { className: "period-chip", text: "Havi" });
  periodRow.append(dayBtn, weekBtn, monthBtn);
  headRow.appendChild(periodRow);
  card.appendChild(headRow);

  const navRow = h("div", { className: "row-between", style: { marginBottom: "6px" } });
  const prevBtn = h("button", { className: "chart-nav-btn", text: "‹" });
  const labelEl = h("span", { className: "chart-nav-label" });
  const nextBtn = h("button", { className: "chart-nav-btn", text: "›" });
  navRow.append(prevBtn, labelEl, nextBtn);
  card.appendChild(navRow);

  const chartArea = h("div", { className: "chart-area" });
  card.appendChild(chartArea);

  let period = "week";
  let dayOffset = 0, weekOffset = 0, monthOffset = 0;
  const periodBtns = { day: dayBtn, week: weekBtn, month: monthBtn };

  function currentOffset() { return period === "day" ? dayOffset : period === "week" ? weekOffset : monthOffset; }
  function setOffset(v) { if (period === "day") dayOffset = v; else if (period === "week") weekOffset = v; else monthOffset = v; }

  function render() {
    const offset = currentOffset();
    const data = period === "day" ? genDay(offset) : period === "week" ? genWeek(offset) : genMonth(offset);
    if (period === "day") labelEl.textContent = dayLabel(offset);
    else if (period === "week") {
      const start = startOfWeek(new Date()); start.setDate(start.getDate() + offset * 7);
      labelEl.textContent = weekRangeLabel(start);
    } else labelEl.textContent = monthLabel(offset);
    nextBtn.disabled = offset === 0;

    chartArea.innerHTML = "";
    const total = data.reduce((sum, d) => sum + series.reduce((s2, s) => s2 + (d[s.key] || 0), 0), 0);
    if (total === 0) {
      chartArea.appendChild(h("div", { className: "hint-box", text: "Nincs adat ebben az időszakban.", style: { textAlign: "center", marginBottom: 0 } }));
      return;
    }
    chartArea.appendChild(buildBarChartSvg(data, series));
    if (series.length > 1) {
      const legend = h("div", { className: "chart-legend" });
      series.forEach((s) => legend.appendChild(legendItem(s.color, s.label)));
      chartArea.appendChild(legend);
    }
  }

  Object.entries(periodBtns).forEach(([key, btn]) => {
    btn.addEventListener("click", () => {
      period = key;
      Object.values(periodBtns).forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      render();
    });
  });
  prevBtn.addEventListener("click", () => { setOffset(currentOffset() - 1); render(); });
  nextBtn.addEventListener("click", () => { if (currentOffset() < 0) { setOffset(currentOffset() + 1); render(); } });

  render();
  return card;
}

// ---- Oldal ----

export function buildGraphsPage(st) {
  const wrap = h("div");

  const headRow = h("div", { className: "history-head-row" });
  const backBtn = h("button", { className: "back-btn", onClick: () => closeGraphs() });
  backBtn.append(h("span", { text: "←" }), h("span", { text: "Vissza" }));
  headRow.append(backBtn, h("h2", { className: "history-title", text: "Grafikonok" }));
  wrap.appendChild(headRow);

  if (!st.graphsData) {
    wrap.appendChild(h("div", { className: "hint-box", text: "Betöltés…" }));
    return wrap;
  }

  const { weightSeries, feedingTimes, diaperEvents, growth } = st.graphsData;

  wrap.appendChild(buildWeightChartCard(weightSeries, growth));
  wrap.appendChild(buildCountChartCard({
    title: "Szoptatások", icon: "💧", color: "var(--pink)",
    series: [{ key: "count", label: "Szoptatások száma", color: "var(--pink)" }],
    genDay: (o) => feedDayData(feedingTimes, o), genWeek: (o) => feedWeekData(feedingTimes, o), genMonth: (o) => feedMonthData(feedingTimes, o),
  }));
  wrap.appendChild(buildCountChartCard({
    title: "Pelenkacserék", icon: "🧷", color: "var(--amber)",
    series: [{ key: "pisi", label: "Pisi", color: "var(--amber)" }, { key: "kaki", label: "Kaki", color: "var(--red)" }],
    genDay: (o) => diaperDayData(diaperEvents, o), genWeek: (o) => diaperWeekData(diaperEvents, o), genMonth: (o) => diaperMonthData(diaperEvents, o),
  }));

  return wrap;
}
