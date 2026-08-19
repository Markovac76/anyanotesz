import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Wrench, HelpCircle, LogOut, Users, ChevronDown, ChevronLeft, ChevronRight, Check, Download,
  BarChart3, ArrowLeft, Baby, Droplets, ListChecks, HeartPulse,
  MessageCircleQuestion, Plus, AlertTriangle, Clock, Scale, Pencil, Trash2
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ---- Design tokens (a Lapról Lapra stílusából átvéve) ----
const T = {
  bg: "#0f1220", panel: "#171a2b", panel2: "#1e2236", line: "#2a2f47",
  ink: "#eef0f8", muted: "#a2a8c3", faint: "#6f7699", accent: "#3a6ea5",
  green: "#37c26b", greenD: "#15361f", amber: "#e0a13a", amberD: "#3a2c12",
  red: "#e0574a", redD: "#3a1512", pink: "#e0578f",
};
const display = { fontFamily: "'Space Grotesk', sans-serif" };

// "Most" — rögzített referencia-időpont a demóhoz
const NOW = new Date(2026, 7, 18, 14, 20);

const HU_MONTHS = ["jan", "febr", "márc", "ápr", "máj", "jún", "júl", "aug", "szept", "okt", "nov", "dec"];
const HU_DAYS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];

function pad(n) { return String(n).padStart(2, "0"); }
function fmtDateTime(d) {
  const isToday = d.toDateString() === NOW.toDateString();
  const datePart = isToday ? "ma" : `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}.`;
  return `${datePart} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---- Görgethető szám-oszlop (óra / perc) ----
function WheelColumn({ values, value, onChange, itemH = 40, visible = 5 }) {
  const ref = useRef(null);
  const padCount = Math.floor(visible / 2);
  const scrollingRef = useRef(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const idx = values.indexOf(value);
    if (ref.current && idx >= 0 && !scrollingRef.current) {
      ref.current.scrollTop = idx * itemH;
    }
  }, [value, values, itemH]);

  const handleScroll = () => {
    scrollingRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (!ref.current) return;
      const idx = Math.round(ref.current.scrollTop / itemH);
      const clamped = Math.max(0, Math.min(values.length - 1, idx));
      ref.current.scrollTo({ top: clamped * itemH, behavior: "smooth" });
      onChange(values[clamped]);
      scrollingRef.current = false;
    }, 90);
  };

  return (
    <div className="relative rounded-xl" style={{ height: itemH * visible, width: 72, background: T.bg, border: `1px solid ${T.line}` }}>
      <div
        className="absolute left-0 right-0 pointer-events-none rounded-lg"
        style={{ top: itemH * padCount, height: itemH, background: `color-mix(in srgb, ${T.accent} 35%, ${T.panel2})`, border: `1.5px solid ${T.accent}` }}
      />
      {/* elhalványító sáv fent/lent, hogy jelezze a görgethetőséget */}
      <div className="absolute left-0 right-0 top-0 pointer-events-none z-10" style={{ height: itemH * padCount, background: `linear-gradient(180deg, ${T.bg}, transparent)` }} />
      <div className="absolute left-0 right-0 bottom-0 pointer-events-none z-10" style={{ height: itemH * padCount, background: `linear-gradient(0deg, ${T.bg}, transparent)` }} />
      <div
        ref={ref}
        onScroll={handleScroll}
        className="h-full overflow-y-auto no-scrollbar relative"
        style={{ scrollSnapType: "y mandatory", paddingTop: itemH * padCount, paddingBottom: itemH * padCount }}
      >
        {values.map((v) => (
          <div
            key={v}
            onClick={() => { onChange(v); }}
            className="flex items-center justify-center"
            style={{
              height: itemH, scrollSnapAlign: "center", fontSize: v === value ? 21 : 16,
              fontWeight: v === value ? 700 : 500, color: v === value ? "#ffffff" : T.muted,
              ...display, cursor: "pointer",
            }}
          >
            {pad(v)}
          </div>
        ))}
      </div>
    </div>
  );
}

function TimeWheel({ hour, minute, onChange }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);
  return (
    <div className="flex items-center justify-center gap-2">
      <WheelColumn values={hours} value={hour} onChange={(h) => onChange(h, minute)} />
      <div style={{ ...display, fontSize: 22, fontWeight: 700, color: T.faint }}>:</div>
      <WheelColumn values={minutes} value={minute} onChange={(m) => onChange(hour, m)} />
    </div>
  );
}

// ---- Naptár (dátumválasztó) ----
function Calendar({ selected, onSelect }) {
  const [viewMonth, setViewMonth] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1));
  const firstWeekday = (viewMonth.getDay() + 6) % 7; // hétfő=0
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} className="p-1" style={{ color: T.muted }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ ...display, fontSize: 14, fontWeight: 700 }}>
          {viewMonth.getFullYear()}. {HU_MONTHS[viewMonth.getMonth()]}
        </div>
        <button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} className="p-1" style={{ color: T.muted }}>
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {HU_DAYS.map((d) => (
          <div key={d} className="text-center" style={{ fontSize: 10.5, color: T.faint, fontWeight: 600 }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
          const isSelected = d.toDateString() === selected.toDateString();
          const isToday = d.toDateString() === NOW.toDateString();
          return (
            <button
              key={i}
              onClick={() => onSelect(d)}
              className="rounded-lg flex items-center justify-center"
              style={{
                height: 32, fontSize: 13, ...display, fontWeight: isSelected ? 700 : 500,
                background: isSelected ? T.accent : "transparent",
                color: isSelected ? "#fff" : T.ink,
                border: isToday && !isSelected ? `1px solid ${T.accent}` : "1px solid transparent",
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Közös modal-váz a dátum- és időválasztóhoz ----
function PickerModal({ title, onNow, onCancel, onApply, confirmPast, tempLabel, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(5,6,12,.6)" }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-full rounded-t-2xl p-4" style={{ background: T.panel, border: `1px solid ${T.line}`, borderBottom: "none", maxWidth: 460 }}>
        <div className="flex items-center justify-between mb-3">
          <h4 style={{ ...display, fontSize: 15, fontWeight: 700, margin: 0 }}>{title}</h4>
          <button onClick={onNow} className="rounded-full px-3 py-1.5" style={{ fontSize: 12, fontWeight: 600, background: T.panel2, border: `1px solid ${T.line}`, color: T.accent }}>Most</button>
        </div>

        {children}

        {confirmPast && (
          <div className="rounded-xl px-3 py-2.5 mb-2 mt-2 flex items-start gap-2" style={{ background: T.amberD, border: `1px solid ${T.amber}` }}>
            <AlertTriangle size={16} color={T.amber} className="shrink-0 mt-0.5" />
            <div style={{ fontSize: 12.5, color: "#f0c98a" }}>Ez egy korábbi időpont ({tempLabel}), nem a mostani. Biztosan ezt szeretnéd rögzíteni?</div>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <button onClick={onCancel} className="flex-1 rounded-xl py-2.5" style={{ background: T.panel2, border: `1px solid ${T.line}`, color: T.muted, fontSize: 14, fontWeight: 600 }}>Mégse</button>
          <button onClick={onApply} className="flex-1 rounded-xl py-2.5" style={{ ...display, background: confirmPast ? T.amber : T.accent, color: "#fff", fontWeight: 700, fontSize: 14 }}>
            {confirmPast ? "Igen, ezt rögzítem" : "Kész"}
          </button>
        </div>
      </div>
    </div>
  );
}

function isEarlierThanNow(d) {
  return d.getTime() < NOW.getTime() - 60000; // 1 percnél nagyobb eltérés a múltba
}

// ---- Szám-beviteli mező (felugró számbillentyűzettel — egykezes használatra) ----
function NumberField({ label, value, onChange, unit, placeholder }) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState(value || "");

  function openModal() { setTemp(value || ""); setOpen(true); }
  function press(d) {
    setTemp((t) => {
      if (d === "back") return t.slice(0, -1);
      if (d === "clear") return "";
      if (t.length >= 5) return t;
      return t + d;
    });
  }
  function handleApply() { onChange(temp); setOpen(false); }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

  return (
    <div className="mb-2.5">
      <label style={{ display: "block", fontSize: 11.5, color: T.muted, marginBottom: 4 }}>{label}</label>
      <button onClick={openModal} className="w-full rounded-xl py-2.5" style={{ background: T.panel2, border: `1px solid ${T.line}` }}>
        <span style={{ ...display, fontSize: 21, fontWeight: 700, color: value ? T.ink : T.faint }}>
          {value || placeholder || "0"}{unit && value ? ` ${unit}` : ""}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(5,6,12,.6)" }} onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full rounded-t-2xl p-4" style={{ background: T.panel, border: `1px solid ${T.line}`, borderBottom: "none", maxWidth: 460 }}>
            <div className="flex items-center justify-between mb-3">
              <h4 style={{ ...display, fontSize: 15, fontWeight: 700, margin: 0 }}>{label}</h4>
              <button onClick={() => press("clear")} className="rounded-full px-3 py-1.5" style={{ fontSize: 12, fontWeight: 600, background: T.panel2, border: `1px solid ${T.line}`, color: T.faint }}>Törlés</button>
            </div>

            <div className="rounded-xl mb-3 py-4 flex items-center justify-center" style={{ background: T.bg, border: `1px solid ${T.line}` }}>
              <span style={{ ...display, fontSize: 34, fontWeight: 700, color: T.ink }}>{temp || "0"}</span>
              {unit && <span style={{ ...display, fontSize: 16, fontWeight: 600, color: T.faint, marginLeft: 6 }}>{unit}</span>}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              {keys.map((k) => (
                <button
                  key={k}
                  onClick={() => press(k)}
                  className="rounded-xl flex items-center justify-center"
                  style={{ height: 54, background: T.panel2, border: `1px solid ${T.line}`, ...display, fontSize: k === "back" ? 15 : 20, fontWeight: 700, color: k === "clear" ? T.faint : T.ink }}
                >
                  {k === "back" ? "⌫" : k === "clear" ? "C" : k}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="flex-1 rounded-xl py-2.5" style={{ background: T.panel2, border: `1px solid ${T.line}`, color: T.muted, fontSize: 14, fontWeight: 600 }}>Mégse</button>
              <button onClick={handleApply} className="flex-1 rounded-xl py-2.5" style={{ ...display, background: T.accent, color: "#fff", fontWeight: 700, fontSize: 14 }}>Kész</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Dátum mező ----
function DateField({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState(value);
  const [confirmPast, setConfirmPast] = useState(false);

  function openModal() { setTemp(value); setConfirmPast(false); setOpen(true); }
  function handleApply() {
    if (isEarlierThanNow(temp) && !confirmPast) { setConfirmPast(true); return; }
    onChange(temp); setOpen(false);
  }
  function jumpToNow() {
    const merged = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), temp.getHours(), temp.getMinutes());
    setTemp(merged); setConfirmPast(false);
  }
  function setToday() {
    const merged = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), value.getHours(), value.getMinutes());
    onChange(merged);
  }

  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between mb-1">
        <label style={{ ...display, fontSize: 15, fontWeight: 700, color: T.ink }}>{label}</label>
        <button onClick={setToday} className="rounded-full px-2.5 py-1" style={{ fontSize: 11.5, fontWeight: 600, background: T.panel2, border: `1px solid ${T.line}`, color: T.accent }}>Ma</button>
      </div>
      <button onClick={openModal} className="w-full flex items-center justify-between rounded-xl px-3.5 py-2.5" style={{ background: T.panel2, border: `1px solid ${T.line}`, color: T.ink }}>
        <span style={{ ...display, fontSize: 15, fontWeight: 600 }}>
          {value.getFullYear()}.{pad(value.getMonth() + 1)}.{pad(value.getDate())}.
        </span>
        <ChevronDown size={16} color={T.faint} />
      </button>
      {open && (
        <PickerModal title={label} onNow={jumpToNow} onCancel={() => setOpen(false)} onApply={handleApply} confirmPast={confirmPast} tempLabel={fmtDateTime(temp)}>
          <Calendar
            selected={temp}
            onSelect={(d) => {
              const merged = new Date(d.getFullYear(), d.getMonth(), d.getDate(), temp.getHours(), temp.getMinutes());
              setTemp(merged); setConfirmPast(false);
            }}
          />
        </PickerModal>
      )}
    </div>
  );
}

// ---- Idő mező (görgethető óra) ----
function TimeField({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState(value);
  const [confirmPast, setConfirmPast] = useState(false);

  function openModal() { setTemp(value); setConfirmPast(false); setOpen(true); }
  function handleApply() {
    if (isEarlierThanNow(temp) && !confirmPast) { setConfirmPast(true); return; }
    onChange(temp); setOpen(false);
  }
  function jumpToNow() {
    const merged = new Date(temp.getFullYear(), temp.getMonth(), temp.getDate(), NOW.getHours(), NOW.getMinutes());
    setTemp(merged); setConfirmPast(false);
  }
  function setToNow() {
    const merged = new Date(value.getFullYear(), value.getMonth(), value.getDate(), NOW.getHours(), NOW.getMinutes());
    onChange(merged);
  }

  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between mb-1">
        <label style={{ ...display, fontSize: 15, fontWeight: 700, color: T.ink }}>{label}</label>
        <button onClick={setToNow} className="rounded-full px-2.5 py-1" style={{ fontSize: 11.5, fontWeight: 600, background: T.panel2, border: `1px solid ${T.line}`, color: T.accent }}>Most</button>
      </div>
      <button onClick={openModal} className="w-full flex items-center justify-between rounded-xl px-3.5 py-2.5" style={{ background: T.panel2, border: `1px solid ${T.line}`, color: T.ink }}>
        <span style={{ ...display, fontSize: 15, fontWeight: 600 }}>{pad(value.getHours())}:{pad(value.getMinutes())}</span>
        <Clock size={16} color={T.faint} />
      </button>
      {open && (
        <PickerModal title={label} onNow={jumpToNow} onCancel={() => setOpen(false)} onApply={handleApply} confirmPast={confirmPast} tempLabel={fmtDateTime(temp)}>
          <div className="py-2">
            <TimeWheel
              hour={temp.getHours()}
              minute={temp.getMinutes()}
              onChange={(h, m) => {
                const merged = new Date(temp.getFullYear(), temp.getMonth(), temp.getDate(), h, m);
                setTemp(merged); setConfirmPast(false);
              }}
            />
          </div>
        </PickerModal>
      )}
    </div>
  );
}

// ---- Historikus bejegyzés szerkesztő modal ----
function EditEntryModal({ entry, onCancel, onSave, onDelete }) {
  const [temp, setTemp] = useState({ ...entry });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meta = TYPE_META[entry.type];

  function set(patch) { setTemp((t) => ({ ...t, ...patch })); }

  const estimated = useMemo(() => {
    if (temp.type !== "feed" || temp.cantMeasure) return null;
    const s = parseFloat(temp.wStart), e = parseFloat(temp.wEnd);
    if (isNaN(s) || isNaN(e)) return null;
    return Math.max(0, Math.round(e - s));
  }, [temp]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(5,6,12,.65)" }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-full rounded-t-2xl p-4 overflow-y-auto" style={{ background: T.panel, border: `1px solid ${T.line}`, borderBottom: "none", maxWidth: 460, maxHeight: "88vh" }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center rounded-lg" style={{ width: 30, height: 30, background: `color-mix(in srgb, ${meta.color} 22%, ${T.panel})`, color: meta.color }}>
            <meta.icon size={16} />
          </div>
          <h3 style={{ ...display, fontSize: 15, fontWeight: 700, margin: 0, flex: 1 }}>{meta.label} módosítása</h3>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <DateField label="Dátum" value={temp.when} onChange={(d) => set({ when: d })} />
          <TimeField label="Idő" value={temp.when} onChange={(d) => set({ when: d })} />
        </div>

        {temp.type === "feed" && (
          <>
            <Field label="Melyik oldalról">
              <div className="flex gap-2">
                <ToggleChip active={temp.side === "left"} onClick={() => set({ side: "left" })} color={T.pink}>Bal</ToggleChip>
                <ToggleChip active={temp.side === "right"} onClick={() => set({ side: "right" })} color={T.pink}>Jobb</ToggleChip>
                <ToggleChip active={temp.side === "both"} onClick={() => set({ side: "both" })} color={T.pink}>Mindkettő</ToggleChip>
              </div>
            </Field>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 12, color: T.muted }}>Súly méréséhez</span>
              <button onClick={() => set({ cantMeasure: !temp.cantMeasure })} className="rounded-full px-3 py-1" style={{ fontSize: 11.5, fontWeight: 600, background: temp.cantMeasure ? T.panel2 : "transparent", border: `1px solid ${T.line}`, color: temp.cantMeasure ? T.amber : T.faint }}>
                {temp.cantMeasure ? "✓ Nem mérhető" : "Nem mérhető"}
              </button>
            </div>
            {!temp.cantMeasure && (
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="Súly – elején" value={temp.wStart} onChange={(v) => set({ wStart: v })} unit="g" />
                <NumberField label="Súly – végén" value={temp.wEnd} onChange={(v) => set({ wEnd: v })} unit="g" />
              </div>
            )}
            {estimated !== null && (
              <div className="rounded-lg px-3 py-2 mb-2" style={{ background: T.greenD, border: `1px solid ${T.green}`, fontSize: 13, color: "#8ee9ad" }}>
                Becsült elfogyasztott mennyiség: <b>≈ {estimated} g</b>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="+ Anyatej" value={temp.extraMilk} onChange={(v) => set({ extraMilk: v })} unit="ml" />
              <NumberField label="+ Tápszer" value={temp.extraFormula} onChange={(v) => set({ extraFormula: v })} unit="ml" />
            </div>
          </>
        )}

        {temp.type === "diaper" && (
          <>
            <Field label="Típus">
              <div className="flex gap-2">
                <ToggleChip active={temp.diaperType === "pisi"} onClick={() => set({ diaperType: "pisi" })} color={T.amber}>Pisi</ToggleChip>
                <ToggleChip active={temp.diaperType === "kaki"} onClick={() => set({ diaperType: "kaki" })} color={T.amber}>Kaki</ToggleChip>
                <ToggleChip active={temp.diaperType === "mindketto"} onClick={() => set({ diaperType: "mindketto" })} color={T.amber}>Mindkettő</ToggleChip>
              </div>
            </Field>
            {temp.diaperType !== "pisi" && (
              <>
                <Field label="Szín">
                  <div className="flex gap-1.5 flex-wrap">
                    {["sárga", "zöld", "barna", "fekete", "vörös", "fehér-szürke"].map((c) => (
                      <button key={c} onClick={() => set({ poopColor: c })} className="rounded-full px-2.5 py-1.5"
                        style={{ fontSize: 11.5, fontWeight: 600, border: `1px solid ${temp.poopColor === c ? T.amber : T.line}`, background: temp.poopColor === c ? `color-mix(in srgb, ${T.amber} 40%, ${T.panel})` : T.panel2, color: temp.poopColor === c ? "#fff" : T.muted }}>
                        {c}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Állag">
                  <div className="flex gap-1.5 flex-wrap">
                    {["pépes", "szilárd", "híg-vizes", "nyákos"].map((c) => (
                      <button key={c} onClick={() => set({ poopTexture: c })} className="rounded-full px-2.5 py-1.5"
                        style={{ fontSize: 11.5, fontWeight: 600, border: `1px solid ${temp.poopTexture === c ? T.amber : T.line}`, background: temp.poopTexture === c ? `color-mix(in srgb, ${T.amber} 40%, ${T.panel})` : T.panel2, color: temp.poopTexture === c ? "#fff" : T.muted }}>
                        {c}
                      </button>
                    ))}
                  </div>
                </Field>
              </>
            )}
            <Field label="Jegyzet (opcionális)"><input style={inputStyle} value={temp.note || ""} onChange={(e) => set({ note: e.target.value })} /></Field>
          </>
        )}

        {temp.type === "other" && (
          <Field label="Leírás"><input style={inputStyle} value={temp.note || ""} onChange={(e) => set({ note: e.target.value })} /></Field>
        )}

        {confirmDelete && (
          <div className="rounded-xl px-3 py-2.5 mb-2 mt-1 flex items-start gap-2" style={{ background: T.redD, border: `1px solid ${T.red}` }}>
            <AlertTriangle size={16} color={T.red} className="shrink-0 mt-0.5" />
            <div style={{ fontSize: 12.5, color: "#f5a8a0" }}>Biztosan törlöd ezt a bejegyzést? Ez nem vonható vissza.</div>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <button onClick={onCancel} className="flex-1 rounded-xl py-2.5" style={{ background: T.panel2, border: `1px solid ${T.line}`, color: T.muted, fontSize: 14, fontWeight: 600 }}>Mégse</button>
          <button onClick={() => onSave(temp)} className="flex-1 rounded-xl py-2.5" style={{ ...display, background: T.accent, color: "#fff", fontWeight: 700, fontSize: 14 }}>Mentés</button>
        </div>
        <button
          onClick={() => { if (confirmDelete) { onDelete(entry.id); } else { setConfirmDelete(true); } }}
          className="w-full rounded-xl py-2 mt-2 flex items-center justify-center gap-1.5"
          style={{ background: "transparent", border: `1px solid ${confirmDelete ? T.red : T.line}`, color: confirmDelete ? T.red : T.faint, fontSize: 12.5, fontWeight: 600 }}
        >
          <Trash2 size={13} /> {confirmDelete ? "Igen, törlöm" : "Bejegyzés törlése"}
        </button>
      </div>
    </div>
  );
}

function IconBtn({ icon: Icon, label, emphColor, onClick }) {
  return (
    <button onClick={onClick} title={label} className="flex flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 shrink-0"
      style={{ border: `1px solid ${emphColor || T.line}`, background: emphColor ? `color-mix(in srgb, ${emphColor} 25%, ${T.panel})` : T.panel, color: emphColor || T.muted, minWidth: 52 }}>
      <Icon size={19} strokeWidth={2} />
      <span style={{ fontSize: 9, fontWeight: 600 }}>{label}</span>
    </button>
  );
}

// ---- Egyszerű infó-modal ("fejlesztés alatt" stb.) ----
function InfoModal({ title, message, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(5,6,12,.65)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full rounded-2xl p-5" style={{ background: T.panel, border: `1px solid ${T.line}`, maxWidth: 380 }}>
        <h4 style={{ ...display, fontSize: 16, fontWeight: 700, marginBottom: 8, color: T.ink }}>{title}</h4>
        <p style={{ fontSize: 13.5, color: T.muted, marginBottom: 18, lineHeight: 1.5 }}>{message}</p>
        <button onClick={onClose} className="w-full rounded-xl py-2.5" style={{ ...display, background: T.accent, color: "#fff", fontWeight: 700, fontSize: 14 }}>OK</button>
      </div>
    </div>
  );
}
function Card({ children, style }) {
  return <div className="rounded-2xl p-4 mb-3" style={{ background: T.panel, border: `1px solid ${T.line}`, ...style }}>{children}</div>;
}
function SectionTitle({ icon: Icon, children, color }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex items-center justify-center rounded-lg" style={{ width: 30, height: 30, background: `color-mix(in srgb, ${color} 22%, ${T.panel})`, color }}>
        <Icon size={16} />
      </div>
      <h3 style={{ ...display, fontSize: 15, fontWeight: 700, margin: 0, color: T.ink }}>{children}</h3>
    </div>
  );
}
function CollapsibleCard({ icon, color, title, open, onToggle, children }) {
  return (
    <Card>
      <button onClick={onToggle} className="w-full flex items-center gap-2" style={{ marginBottom: open ? 12 : 0 }}>
        <div className="flex items-center justify-center rounded-lg" style={{ width: 30, height: 30, background: `color-mix(in srgb, ${color} 22%, ${T.panel})`, color }}>
          {icon}
        </div>
        <h3 style={{ ...display, fontSize: 15, fontWeight: 700, margin: 0, color: T.ink, flex: 1, textAlign: "left" }}>{title}</h3>
        <ChevronDown size={18} color={T.faint} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .15s" }} />
      </button>
      {open && children}
    </Card>
  );
}

// ---- Nap/hét/hónap bontású oszlopdiagram, léptethető ----
function PeriodChart({ title, icon, color, series, genDay, genWeek, genMonth }) {
  const [period, setPeriod] = useState("week");
  const [dayOffset, setDayOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const offset = period === "day" ? dayOffset : period === "week" ? weekOffset : monthOffset;
  const setOffset = period === "day" ? setDayOffset : period === "week" ? setWeekOffset : setMonthOffset;
  const atPresent = offset === 0;

  const data = useMemo(() => {
    if (period === "day") return genDay(dayOffset);
    if (period === "week") return genWeek(weekOffset);
    return genMonth(monthOffset);
  }, [period, dayOffset, weekOffset, monthOffset]);

  const label = useMemo(() => {
    if (period === "day") return dayLabel(dayOffset);
    if (period === "week") { const start = startOfWeek(NOW); start.setDate(start.getDate() + weekOffset * 7); return weekRangeLabel(start); }
    const m = new Date(NOW.getFullYear(), NOW.getMonth() + monthOffset, 1);
    return `${m.getFullYear()}. ${HU_MONTHS_FULL[m.getMonth()]}`;
  }, [period, dayOffset, weekOffset, monthOffset]);

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <SectionTitle icon={icon} color={color}>{title}</SectionTitle>
        <div className="flex gap-1">
          {[["day", "Napi"], ["week", "Heti"], ["month", "Havi"]].map(([key, lbl]) => (
            <button key={key} onClick={() => setPeriod(key)} className="rounded-full px-2.5 py-1" style={{ fontSize: 11, background: period === key ? color : T.panel2, color: period === key ? "#fff" : T.faint, fontWeight: 600 }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setOffset((o) => o - 1)} className="rounded-lg p-1.5" style={{ background: T.panel2, border: `1px solid ${T.line}`, color: T.muted }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ ...display, fontSize: 13, fontWeight: 700, color: T.ink }}>{label}</span>
        <button onClick={() => { if (!atPresent) setOffset((o) => o + 1); }} disabled={atPresent} className="rounded-lg p-1.5" style={{ background: T.panel2, border: `1px solid ${T.line}`, color: atPresent ? T.line : T.muted, opacity: atPresent ? 0.5 : 1 }}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div style={{ width: "100%", height: 190 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ left: -20, right: 8 }}>
            <CartesianGrid stroke={T.line} strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke={T.faint} fontSize={10.5} interval={period === "day" ? 2 : period === "month" ? Math.max(0, Math.floor(data.length / 6)) : 0} />
            <YAxis stroke={T.faint} fontSize={11} allowDecimals={false} />
            <Tooltip contentStyle={{ background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 12 }} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.name} stackId={series.length > 1 ? "a" : undefined} fill={s.color} radius={series.length === 1 ? [3, 3, 0, 0] : 0} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function Field({ label, children }) {
  return <div className="mb-2.5"><label style={{ display: "block", fontSize: 11.5, color: T.muted, marginBottom: 4 }}>{label}</label>{children}</div>;
}
const inputStyle = { width: "100%", background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.ink, padding: "9px 11px", fontSize: 14 };
function ToggleChip({ active, onClick, children, color }) {
  return (
    <button onClick={onClick} className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
      style={{ border: `1px solid ${active ? (color || T.accent) : T.line}`, background: active ? `color-mix(in srgb, ${color || T.accent} 55%, ${T.panel})` : T.panel2, color: active ? "#fff" : T.muted, ...display }}>
      {children}
    </button>
  );
}
function StatusBadge({ status, children }) {
  const map = { green: { bg: T.greenD, border: T.green, fg: "#8ee9ad" }, amber: { bg: T.amberD, border: T.amber, fg: "#f0c98a" }, red: { bg: T.redD, border: T.red, fg: "#f5a8a0" } };
  const c = map[status];
  return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.fg, fontSize: 12, fontWeight: 700 }}>{children}</span>;
}

// ---- Mock adatok ----
const BABIES = [{ id: 1, name: "Level" }, { id: 2, name: "Zsófi" }];
const BABY_INFO = { bornAt: "2026. 05. 02. 14:32", place: "Budapest, Szent János Kórház", birthWeight: "3200 g", birthLength: "51 cm", currentWeight: 4820, weeklyTarget: 150, weeklyActual: 160 };
const HU_MONTHS_FULL = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];

function startOfWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // hétfő=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function weekRangeLabel(start) {
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const m1 = HU_MONTHS[start.getMonth()], m2 = HU_MONTHS[end.getMonth()];
  return sameMonth
    ? `${start.getFullYear()}. ${m1}. ${start.getDate()}–${end.getDate()}.`
    : `${start.getFullYear()}. ${m1}. ${start.getDate()}. – ${m2}. ${end.getDate()}.`;
}
function genWeekData(offset) {
  const start = startOfWeek(NOW); start.setDate(start.getDate() + offset * 7);
  const baseline = BABY_INFO.currentWeight + offset * 160 - 160;
  return HU_DAYS.map((label, i) => {
    const cel = baseline + Math.round((BABY_INFO.weeklyTarget / 7) * (i + 1));
    const wobble = Math.round(Math.sin((i + offset * 4) * 1.3) * 12);
    const teny = cel + wobble;
    return { nap: label, cel, teny };
  });
}
function genMonthData(offset) {
  const monthStart = new Date(NOW.getFullYear(), NOW.getMonth() + offset, 1);
  const isCurrent = offset === 0;
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const lastDay = isCurrent ? NOW.getDate() : daysInMonth;
  const monthlyTarget = BABY_INFO.weeklyTarget * 4.33;
  const baseline = BABY_INFO.currentWeight + offset * (monthlyTarget) - monthlyTarget;
  const arr = [];
  for (let d = 1; d <= lastDay; d++) {
    const cel = Math.round(baseline + (monthlyTarget / daysInMonth) * d);
    const wobble = Math.round(Math.sin((d + offset * 5) * 0.35) * 15);
    arr.push({ nap: String(d), cel, teny: cel + wobble });
  }
  return arr;
}

// ---- Determinisztikus "véletlen" a demó grafikonokhoz ----
function prng(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
function dayLabel(offset) {
  const d = new Date(NOW); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}. · ${relLabel(d)}`;
}

function genFeedDayData(offset) {
  const arr = [];
  for (let h = 0; h < 24; h++) {
    const count = prng(offset * 97 + h * 13) > 0.62 ? 1 : 0;
    arr.push({ label: pad(h), count });
  }
  return arr;
}
function genFeedWeekData(offset) {
  const start = startOfWeek(NOW); start.setDate(start.getDate() + offset * 7);
  return HU_DAYS.map((label, i) => ({ label, count: 6 + Math.floor(prng(offset * 31 + i * 7) * 5) }));
}
function genFeedMonthData(offset) {
  const monthStart = new Date(NOW.getFullYear(), NOW.getMonth() + offset, 1);
  const isCurrent = offset === 0;
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const lastDay = isCurrent ? NOW.getDate() : daysInMonth;
  const arr = [];
  for (let d = 1; d <= lastDay; d++) arr.push({ label: String(d), count: 6 + Math.floor(prng(offset * 53 + d * 3) * 5) });
  return arr;
}

function genDiaperDayData(offset) {
  const arr = [];
  for (let h = 0; h < 24; h++) {
    arr.push({ label: pad(h), pisi: prng(offset * 61 + h * 5) > 0.75 ? 1 : 0, kaki: prng(offset * 71 + h * 9) > 0.9 ? 1 : 0 });
  }
  return arr;
}
function genDiaperWeekData(offset) {
  const start = startOfWeek(NOW); start.setDate(start.getDate() + offset * 7);
  return HU_DAYS.map((label, i) => ({
    label,
    pisi: 4 + Math.floor(prng(offset * 41 + i * 11) * 3),
    kaki: 1 + Math.floor(prng(offset * 43 + i * 13) * 3),
  }));
}
function genDiaperMonthData(offset) {
  const monthStart = new Date(NOW.getFullYear(), NOW.getMonth() + offset, 1);
  const isCurrent = offset === 0;
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const lastDay = isCurrent ? NOW.getDate() : daysInMonth;
  const arr = [];
  for (let d = 1; d <= lastDay; d++) {
    arr.push({ label: String(d), pisi: 4 + Math.floor(prng(offset * 67 + d * 5) * 3), kaki: 1 + Math.floor(prng(offset * 73 + d * 7) * 3) });
  }
  return arr;
}

const HISTORY = [
  { id: 1, type: "feed", when: new Date(2026, 7, 18, 14, 20), side: "left", cantMeasure: false, wStart: "4720", wEnd: "4780", extraMilk: "30", extraFormula: "" },
  { id: 2, type: "diaper", when: new Date(2026, 7, 18, 13, 5), diaperType: "kaki", poopColor: "sárga", poopTexture: "pépes", note: "" },
  { id: 3, type: "other", when: new Date(2026, 7, 18, 9, 0), note: "D-vitamin csepp beadva" },
  { id: 4, type: "feed", when: new Date(2026, 7, 18, 8, 40), side: "right", cantMeasure: false, wStart: "4700", wEnd: "4750", extraMilk: "", extraFormula: "" },
  { id: 5, type: "diaper", when: new Date(2026, 7, 18, 7, 55), diaperType: "pisi", poopColor: "sárga", poopTexture: "pépes", note: "" },
  { id: 6, type: "feed", when: new Date(2026, 7, 17, 22, 10), side: "both", cantMeasure: true, wStart: "", wEnd: "", extraMilk: "", extraFormula: "" },
];
const TYPE_META = { feed: { label: "Szoptatás", color: T.pink, icon: Droplets }, diaper: { label: "Pelenkacsere", color: T.amber, icon: Baby }, other: { label: "Egyéb", color: T.accent, icon: HeartPulse } };
function gainStatus(target, actual) { const r = actual / target; if (r >= 0.85 && r <= 1.15) return "green"; if (r >= 0.5 && r <= 1.5) return "amber"; return "red"; }

function relLabel(d) {
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const yesterday = new Date(NOW); yesterday.setDate(NOW.getDate() - 1);
  if (sameDay(d, NOW)) return "ma";
  if (sameDay(d, yesterday)) return "tegnap";
  return HU_DAYS[(d.getDay() + 6) % 7].toLowerCase();
}
function entryDateTimeLabel(d) {
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}. ${pad(d.getHours())}:${pad(d.getMinutes())} · ${relLabel(d)}`;
}
function entryDetail(h) {
  if (h.type === "feed") {
    const sideLabel = h.side === "left" ? "Bal mell" : h.side === "right" ? "Jobb mell" : "Mindkét mell";
    let s = sideLabel;
    if (h.cantMeasure) {
      s += " · nem mérhető";
    } else if (h.wStart && h.wEnd) {
      const est = Math.max(0, Math.round(parseFloat(h.wEnd) - parseFloat(h.wStart)));
      s += ` · ${h.wStart}→${h.wEnd} g (≈${est} g)`;
    }
    if (h.extraMilk) s += ` · +${h.extraMilk} ml anyatej`;
    if (h.extraFormula) s += ` · +${h.extraFormula} ml tápszer`;
    return s;
  }
  if (h.type === "diaper") {
    let s = h.diaperType === "pisi" ? "Pisi" : h.diaperType === "kaki" ? "Kaki" : "Pisi + kaki";
    if (h.diaperType !== "pisi") s += ` · ${h.poopColor}, ${h.poopTexture}`;
    if (h.note) s += ` · ${h.note}`;
    return s;
  }
  return h.note || "";
}

export default function AnyanoteszDemo() {
  const [role, setRole] = useState("owner");
  const [view, setView] = useState("dashboard");
  const [activeBaby, setActiveBaby] = useState(BABIES[0].id);
  const [babyPickerOpen, setBabyPickerOpen] = useState(false);

  const [feedWhen, setFeedWhen] = useState(new Date(NOW));
  const [feedEndWhen, setFeedEndWhen] = useState(new Date(NOW));
  const [diaperWhen, setDiaperWhen] = useState(new Date(NOW));

  const [side, setSide] = useState("left");
  const [cantMeasure, setCantMeasure] = useState(false);
  const [wStart, setWStart] = useState("4720");
  const [wEnd, setWEnd] = useState("4780");
  const [extraMilk, setExtraMilk] = useState("");
  const [extraFormula, setExtraFormula] = useState("");
  const estimated = useMemo(() => {
    if (cantMeasure) return null;
    const s = parseFloat(wStart), e = parseFloat(wEnd);
    if (isNaN(s) || isNaN(e)) return null;
    return Math.max(0, Math.round(e - s));
  }, [wStart, wEnd, cantMeasure]);

  const [diaperType, setDiaperType] = useState("kaki");
  const [poopColor, setPoopColor] = useState("sárga");
  const [poopTexture, setPoopTexture] = useState("pépes");
  const [umbilicalDone, setUmbilicalDone] = useState(false);
  const [meds, setMeds] = useState([
    { name: "D-vitamin csepp", freq: "daily", doneToday: true },
    { name: "K-vitamin csepp", freq: "monthly", lastGiven: new Date(2026, 6, 18) },
  ]);
  const [questions, setQuestions] = useState([
    { id: 1, text: "Mikortól ajánlott a csecsemőmasszázs?", recipient: "vedono", answered: false, answer: "" },
    { id: 2, text: "Mikor kezdődhet a szilárd táplálás bevezetése?", recipient: "orvos", answered: true, answer: "Kb. 6 hónapos kortól, egyéni fejlettségtől függően." },
  ]);
  const [newQuestion, setNewQuestion] = useState("");
  const [newQRecipient, setNewQRecipient] = useState("vedono");
  const [expandedQ, setExpandedQ] = useState(null);
  const [questionsOpen, setQuestionsOpen] = useState(true);
  const [qFilterRecipient, setQFilterRecipient] = useState("all");
  const [qFilterStatus, setQFilterStatus] = useState("all");
  const [filters, setFilters] = useState({ feed: true, diaper: true, other: true });
  const [showGraphs, setShowGraphs] = useState(false);
  const [graphPeriod, setGraphPeriod] = useState("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [historyEntries, setHistoryEntries] = useState(HISTORY);
  const [editingId, setEditingId] = useState(null);
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const nextIdRef = useRef(1000);
  function logHistory(note) {
    const id = nextIdRef.current++;
    setHistoryEntries((prev) => [...prev, { id, type: "other", when: new Date(NOW), note }]);
  }
  const [feedOpen, setFeedOpen] = useState(true);
  const [diaperOpen, setDiaperOpen] = useState(true);
  const [otherOpen, setOtherOpen] = useState(true);
  const [weightOpen, setWeightOpen] = useState(true);
  const [weightWhen, setWeightWhen] = useState(new Date(NOW));
  const [nakedWeight, setNakedWeight] = useState("4820");

  const status = gainStatus(BABY_INFO.weeklyTarget, BABY_INFO.weeklyActual);
  const activeBabyName = BABIES.find((b) => b.id === activeBaby)?.name;
  const filteredHistory = historyEntries.filter((h) => filters[h.type]).sort((a, b) => b.when - a.when);
  const editingEntry = historyEntries.find((h) => h.id === editingId) || null;

  const chartData = useMemo(() => graphPeriod === "week" ? genWeekData(weekOffset) : genMonthData(monthOffset), [graphPeriod, weekOffset, monthOffset]);
  const chartLabel = useMemo(() => {
    if (graphPeriod === "week") {
      const start = startOfWeek(NOW); start.setDate(start.getDate() + weekOffset * 7);
      return weekRangeLabel(start);
    }
    const m = new Date(NOW.getFullYear(), NOW.getMonth() + monthOffset, 1);
    return `${m.getFullYear()}. ${HU_MONTHS_FULL[m.getMonth()]}`;
  }, [graphPeriod, weekOffset, monthOffset]);
  const atPresent = graphPeriod === "week" ? weekOffset === 0 : monthOffset === 0;

  return (
    <div className="min-h-screen" style={{ background: `radial-gradient(1200px 600px at 100% -10%, rgba(58,110,165,.12), transparent 60%), ${T.bg}`, color: T.ink, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap');
        .no-scrollbar::-webkit-scrollbar{display:none}
        .no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}
      `}</style>

      <div className="mx-auto" style={{ maxWidth: 460 }}>
        <div className="flex items-center justify-between px-3 pt-3 pb-1" style={{ fontSize: 11, color: T.faint }}>
          <span>Demó nézet — szerepkör váltás:</span>
          <div className="flex gap-1">
            <button onClick={() => setRole("user")} className="rounded-full px-2.5 py-1" style={{ background: role === "user" ? T.accent : T.panel2, color: role === "user" ? "#fff" : T.faint, fontWeight: 600 }}>user</button>
            <button onClick={() => setRole("owner")} className="rounded-full px-2.5 py-1" style={{ background: role === "owner" ? T.accent : T.panel2, color: role === "owner" ? "#fff" : T.faint, fontWeight: 600 }}>owner</button>
          </div>
        </div>

        <header className="sticky top-0 z-20 px-3 pt-2 pb-2" style={{ background: `linear-gradient(180deg, ${T.bg} 72%, rgba(15,18,32,.85))`, backdropFilter: "blur(8px)" }}>
          <div className="flex items-center gap-2 mb-2">
            <h1 style={{ ...display, fontSize: 19, fontWeight: 700, flex: 1, margin: 0 }}>Anyanotesz</h1>
            <IconBtn icon={Wrench} label="Karbant." onClick={() => setMaintenanceModalOpen(true)} />
            <IconBtn icon={HelpCircle} label="Súgó" />
            {role === "owner" && <IconBtn icon={Users} label="Userek" emphColor={T.pink} />}
            <IconBtn icon={LogOut} label="Kilépés" />
          </div>

          {role === "owner" ? (
            <div className="relative">
              <button onClick={() => setBabyPickerOpen((v) => !v)} className="w-full flex items-center justify-between rounded-xl px-4 py-2.5" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
                <span style={{ ...display, fontSize: 17, fontWeight: 700 }}>{activeBabyName}</span>
                <span className="flex items-center gap-1" style={{ color: T.muted, fontSize: 12 }}>{BABIES.length} gyerek <ChevronDown size={16} /></span>
              </button>
              {babyPickerOpen && (
                <div className="absolute left-0 right-0 mt-1 rounded-xl overflow-hidden z-30" style={{ background: T.panel2, border: `1px solid ${T.line}` }}>
                  {BABIES.map((b) => (
                    <button key={b.id} onClick={() => { setActiveBaby(b.id); setBabyPickerOpen(false); }} className="w-full text-left px-4 py-2.5"
                      style={{ background: b.id === activeBaby ? `color-mix(in srgb, ${T.accent} 30%, ${T.panel2})` : "transparent", color: T.ink, fontSize: 14 }}>
                      {b.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl px-4 py-2.5" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
              <span style={{ ...display, fontSize: 17, fontWeight: 700 }}>{activeBabyName}</span>
            </div>
          )}
        </header>

        {maintenanceModalOpen && (
          <InfoModal
            title="Fejlesztés alatt"
            message="A Karbantartás jelenleg nem elérhető funkció, ez egy későbbi fejlesztés része lesz."
            onClose={() => setMaintenanceModalOpen(false)}
          />
        )}

        <main className="px-3 pb-8">
          {view === "dashboard" ? (
            <>
              <Card style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${T.accent} 14%, ${T.panel}), ${T.panel})` }}>
                <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: T.accent, filter: "brightness(1.3)", fontWeight: 700 }}>Született {BABY_INFO.bornAt}</div>
                <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>{BABY_INFO.place}</div>
                <div className="flex gap-4 mt-2" style={{ fontSize: 12.5, color: T.muted }}>
                  <span>Sz. súly: <b style={{ color: T.ink }}>{BABY_INFO.birthWeight}</b></span>
                  <span>Sz. hossz: <b style={{ color: T.ink }}>{BABY_INFO.birthLength}</b></span>
                </div>
                <div className="flex items-end gap-3 mt-4">
                  <div style={{ ...display, fontSize: 40, fontWeight: 700, lineHeight: 1 }}>{BABY_INFO.currentWeight.toLocaleString("hu-HU")} g</div>
                  <div style={{ fontSize: 12, color: T.faint, marginBottom: 6 }}>aktuális súly</div>
                </div>
                <div className="mt-2">
                  <StatusBadge status={status}>{status === "green" ? "✓ Az elvárt ütemen belül" : status === "amber" ? "△ Eltér, de behozható" : "! Jelentős eltérés"}</StatusBadge>
                  <span className="ml-2" style={{ fontSize: 12.5, color: T.muted }}>+{BABY_INFO.weeklyActual} g / hét (cél: {BABY_INFO.weeklyTarget} g)</span>
                </div>
              </Card>

              <CollapsibleCard icon={<Scale size={16} />} color={T.green} title="Ruhátlan testsúlymérés" open={weightOpen} onToggle={() => setWeightOpen((v) => !v)}>
                <div className="rounded-lg px-3 py-2 mb-3" style={{ background: T.panel2, border: `1px solid ${T.line}`, fontSize: 12, color: T.muted }}>
                  Ez az érték adja az aktuális súly és a heti gyarapodás számításának alapját a gyerek-dobozban.
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <DateField label="Dátum" value={weightWhen} onChange={setWeightWhen} />
                  <TimeField label="Idő" value={weightWhen} onChange={setWeightWhen} />
                </div>
                <NumberField label="Súly" value={nakedWeight} onChange={setNakedWeight} unit="g" />
                <button className="w-full rounded-xl py-2.5 mt-1" style={{ ...display, background: T.accent, color: "#fff", fontWeight: 700, fontSize: 14 }}>Mentés</button>
              </CollapsibleCard>

              <CollapsibleCard icon={<Droplets size={16} />} color={T.pink} title="Szoptatás" open={feedOpen} onToggle={() => setFeedOpen((v) => !v)}>
                <DateField label="Dátum" value={feedWhen} onChange={setFeedWhen} />
                <div className="grid grid-cols-2 gap-2">
                  <TimeField label="Idő (kezdet)" value={feedWhen} onChange={setFeedWhen} />
                  <TimeField label="Idő (befejezés)" value={feedEndWhen} onChange={setFeedEndWhen} />
                </div>
                <Field label="Melyik oldalról">
                  <div className="flex gap-2">
                    <ToggleChip active={side === "left"} onClick={() => setSide("left")} color={T.pink}>🤱 Bal</ToggleChip>
                    <ToggleChip active={side === "right"} onClick={() => setSide("right")} color={T.pink}>Jobb 🤱</ToggleChip>
                    <ToggleChip active={side === "both"} onClick={() => setSide("both")} color={T.pink}>Mindkettő</ToggleChip>
                  </div>
                </Field>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontSize: 12, color: T.muted }}>Súly méréséhez</span>
                  <button onClick={() => setCantMeasure((v) => !v)} className="rounded-full px-3 py-1" style={{ fontSize: 11.5, fontWeight: 600, background: cantMeasure ? T.panel2 : "transparent", border: `1px solid ${T.line}`, color: cantMeasure ? T.amber : T.faint }}>
                    {cantMeasure ? "✓ Nem mérhető most" : "Nem mérhető most"}
                  </button>
                </div>
                {!cantMeasure && (
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField label="Súly – elején" value={wStart} onChange={setWStart} unit="g" />
                    <NumberField label="Súly – végén" value={wEnd} onChange={setWEnd} unit="g" />
                  </div>
                )}
                {estimated !== null && (
                  <div className="rounded-lg px-3 py-2 mb-2" style={{ background: T.greenD, border: `1px solid ${T.green}`, fontSize: 13, color: "#8ee9ad" }}>
                    Becsült elfogyasztott mennyiség: <b>≈ {estimated} g</b>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <NumberField label="+ Anyatej" value={extraMilk} onChange={setExtraMilk} unit="ml" />
                  <NumberField label="+ Tápszer" value={extraFormula} onChange={setExtraFormula} unit="ml" />
                </div>
                <button className="w-full rounded-xl py-2.5 mt-1" style={{ ...display, background: T.accent, color: "#fff", fontWeight: 700, fontSize: 14 }}>Mentés</button>
              </CollapsibleCard>

              <CollapsibleCard icon={<Baby size={16} />} color={T.amber} title="Pelenkacsere" open={diaperOpen} onToggle={() => setDiaperOpen((v) => !v)}>
                <div className="grid grid-cols-2 gap-2">
                  <DateField label="Dátum" value={diaperWhen} onChange={setDiaperWhen} />
                  <TimeField label="Idő" value={diaperWhen} onChange={setDiaperWhen} />
                </div>
                <Field label="Típus">
                  <div className="flex gap-2">
                    <ToggleChip active={diaperType === "pisi"} onClick={() => setDiaperType("pisi")} color={T.amber}>Pisi</ToggleChip>
                    <ToggleChip active={diaperType === "kaki"} onClick={() => setDiaperType("kaki")} color={T.amber}>Kaki</ToggleChip>
                    <ToggleChip active={diaperType === "mindketto"} onClick={() => setDiaperType("mindketto")} color={T.amber}>Mindkettő</ToggleChip>
                  </div>
                </Field>
                {(diaperType === "kaki" || diaperType === "mindketto") && (
                  <>
                    <Field label="Szín">
                      <div className="flex gap-1.5 flex-wrap">
                        {["sárga", "zöld", "barna", "fekete", "vörös", "fehér-szürke"].map((c) => (
                          <button key={c} onClick={() => setPoopColor(c)} className="rounded-full px-2.5 py-1.5"
                            style={{ fontSize: 11.5, fontWeight: 600, border: `1px solid ${poopColor === c ? T.amber : T.line}`, background: poopColor === c ? `color-mix(in srgb, ${T.amber} 40%, ${T.panel})` : T.panel2, color: poopColor === c ? "#fff" : T.muted }}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Állag">
                      <div className="flex gap-1.5 flex-wrap">
                        {["pépes", "szilárd", "híg-vizes", "nyákos"].map((c) => (
                          <button key={c} onClick={() => setPoopTexture(c)} className="rounded-full px-2.5 py-1.5"
                            style={{ fontSize: 11.5, fontWeight: 600, border: `1px solid ${poopTexture === c ? T.amber : T.line}`, background: poopTexture === c ? `color-mix(in srgb, ${T.amber} 40%, ${T.panel})` : T.panel2, color: poopTexture === c ? "#fff" : T.muted }}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </Field>
                  </>
                )}
                <Field label="Jegyzet (opcionális)"><input style={inputStyle} placeholder="pl. szokatlan szag..." /></Field>
                <button className="w-full rounded-xl py-2.5 mt-1" style={{ ...display, background: T.accent, color: "#fff", fontWeight: 700, fontSize: 14 }}>Mentés</button>
              </CollapsibleCard>

              <CollapsibleCard icon={<HeartPulse size={16} />} color={T.accent} title="Egyéb" open={otherOpen} onToggle={() => setOtherOpen((v) => !v)}>
                <div className="flex items-center justify-between rounded-xl px-3 py-3 mb-2" style={{ background: T.panel2, border: `1px solid ${umbilicalDone ? T.line : T.red}` }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>Köldökápolás</div>
                    {!umbilicalDone && <div className="flex items-center gap-1 mt-0.5" style={{ fontSize: 11.5, color: T.red }}><AlertTriangle size={12} /> Ma még nem történt meg</div>}
                  </div>
                  <button onClick={() => setUmbilicalDone((v) => { const nv = !v; if (nv) logHistory("Köldökápolás megtörtént"); return nv; })} className="rounded-lg px-3 py-2 flex items-center gap-1"
                    style={{ background: umbilicalDone ? T.greenD : T.panel, border: `1px solid ${umbilicalDone ? T.green : T.line}`, color: umbilicalDone ? "#8ee9ad" : T.muted, fontSize: 12.5, fontWeight: 600 }}>
                    <Check size={14} /> {umbilicalDone ? "Megtörtént" : "Jelölöm"}
                  </button>
                </div>
                {meds.map((m, i) => {
                  if (m.freq === "daily") {
                    return (
                      <div key={i} className="flex items-center justify-between rounded-xl px-3 py-3 mb-2" style={{ background: T.panel2, border: `1px solid ${m.doneToday ? T.line : T.amber}` }}>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.name}</div>
                          <div style={{ fontSize: 11, color: T.faint, marginTop: 1 }}>naponta</div>
                          {!m.doneToday && <div className="flex items-center gap-1 mt-0.5" style={{ fontSize: 11.5, color: T.amber }}><AlertTriangle size={12} /> Ma még nem adva</div>}
                        </div>
                        <button
                          onClick={() => setMeds((prev) => prev.map((x, xi) => {
                            if (xi !== i) return x;
                            const nv = !x.doneToday;
                            if (nv) logHistory(`${x.name} beadva`);
                            return { ...x, doneToday: nv };
                          }))}
                          className="rounded-lg px-3 py-2 flex items-center gap-1"
                          style={{ background: m.doneToday ? T.greenD : T.panel, border: `1px solid ${m.doneToday ? T.green : T.line}`, color: m.doneToday ? "#8ee9ad" : T.muted, fontSize: 12.5, fontWeight: 600 }}>
                          <Check size={14} /> {m.doneToday ? "Beadva" : "Jelölöm"}
                        </button>
                      </div>
                    );
                  }
                  // havi gyakoriságú (pl. K-vitamin)
                  const nextDue = new Date(m.lastGiven.getFullYear(), m.lastGiven.getMonth() + 1, m.lastGiven.getDate());
                  const daysLeft = Math.ceil((nextDue - NOW) / 86400000);
                  const due = daysLeft <= 0;
                  return (
                    <div key={i} className="flex items-center justify-between rounded-xl px-3 py-3 mb-2" style={{ background: T.panel2, border: `1px solid ${due ? T.amber : T.line}` }}>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: T.faint, marginTop: 1 }}>
                          havonta · legutóbb {m.lastGiven.getFullYear()}.{pad(m.lastGiven.getMonth() + 1)}.{pad(m.lastGiven.getDate())}.
                        </div>
                        {due ? (
                          <div className="flex items-center gap-1 mt-0.5" style={{ fontSize: 11.5, color: T.amber }}><AlertTriangle size={12} /> Esedékes, eltelt egy hónap</div>
                        ) : (
                          <div className="flex items-center gap-1 mt-0.5" style={{ fontSize: 11.5, color: T.green }}>
                            <Check size={12} /> Beadva · következő: {nextDue.getFullYear()}.{pad(nextDue.getMonth() + 1)}.{pad(nextDue.getDate())}. (még {daysLeft} nap)
                          </div>
                        )}
                      </div>
                      {due && (
                        <button
                          onClick={() => setMeds((prev) => prev.map((x, xi) => xi === i ? { ...x, lastGiven: new Date(NOW) } : x))}
                          className="rounded-lg px-3 py-2 flex items-center gap-1 shrink-0"
                          style={{ background: T.panel, border: `1px solid ${T.line}`, color: T.muted, fontSize: 12.5, fontWeight: 600 }}
                          onClickCapture={() => logHistory(`${m.name} beadva`)}
                        >
                          <Check size={14} /> Beadva ma
                        </button>
                      )}
                    </div>
                  );
                })}
              </CollapsibleCard>

              <CollapsibleCard icon={<MessageCircleQuestion size={16} />} color={T.faint} title="Kérdések a védőnőnek / orvosnak" open={questionsOpen} onToggle={() => setQuestionsOpen((v) => !v)}>
                <div className="flex flex-col gap-1.5 mb-3">
                  <div className="flex gap-1.5">
                    {[["all", "Mind"], ["vedono", "Védőnő"], ["orvos", "Orvos"]].map(([key, lbl]) => (
                      <button key={key} onClick={() => setQFilterRecipient(key)} className="rounded-full px-2.5 py-1"
                        style={{ fontSize: 11.5, fontWeight: 600, border: `1px solid ${qFilterRecipient === key ? T.faint : T.line}`, background: qFilterRecipient === key ? `color-mix(in srgb, ${T.faint} 30%, ${T.panel})` : T.panel2, color: qFilterRecipient === key ? "#fff" : T.faint }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    {[["all", "Mind"], ["open", "Még nem válaszolt"], ["answered", "Megválaszolt"]].map(([key, lbl]) => (
                      <button key={key} onClick={() => setQFilterStatus(key)} className="rounded-full px-2.5 py-1"
                        style={{ fontSize: 11.5, fontWeight: 600, border: `1px solid ${qFilterStatus === key ? T.faint : T.line}`, background: qFilterStatus === key ? `color-mix(in srgb, ${T.faint} 30%, ${T.panel})` : T.panel2, color: qFilterStatus === key ? "#fff" : T.faint }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 mb-3">
                  {questions
                    .filter((q) => qFilterRecipient === "all" || q.recipient === qFilterRecipient)
                    .filter((q) => qFilterStatus === "all" || (qFilterStatus === "answered" ? q.answered : !q.answered))
                    .map((q) => {
                    const isOpen = expandedQ === q.id;
                    const recLabel = q.recipient === "vedono" ? "Védőnő" : "Orvos";
                    const recColor = q.recipient === "vedono" ? T.pink : T.accent;
                    return (
                      <div key={q.id} className="rounded-lg" style={{ background: T.panel2, border: `1px solid ${T.line}` }}>
                        <button onClick={() => setExpandedQ(isOpen ? null : q.id)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
                          <div className="rounded-full shrink-0" style={{ width: 9, height: 9, background: q.answered ? T.green : T.amber }} />
                          <span className="rounded-full px-2 py-0.5 shrink-0" style={{ fontSize: 10, fontWeight: 700, background: `color-mix(in srgb, ${recColor} 25%, ${T.panel})`, color: recColor }}>{recLabel}</span>
                          <span className="flex-1 min-w-0" style={{ fontSize: 13, color: q.answered ? T.faint : T.ink, textDecoration: q.answered ? "line-through" : "none" }}>{q.text}</span>
                          <ChevronDown size={15} color={T.faint} style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .15s", flexShrink: 0 }} />
                        </button>
                        {isOpen && (
                          <div className="px-3 pb-3">
                            <Field label="Kinek szól">
                              <div className="flex gap-2">
                                <ToggleChip active={q.recipient === "vedono"} onClick={() => setQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, recipient: "vedono" } : x))} color={T.pink}>Védőnő</ToggleChip>
                                <ToggleChip active={q.recipient === "orvos"} onClick={() => setQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, recipient: "orvos" } : x))} color={T.accent}>Orvos</ToggleChip>
                              </div>
                            </Field>
                            <Field label="Válasz">
                              <textarea
                                value={q.answer}
                                onChange={(e) => setQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, answer: e.target.value } : x))}
                                placeholder="Ide írható a kapott válasz..."
                                rows={3}
                                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                              />
                            </Field>
                            <Field label="Állapot">
                              <div className="flex gap-2">
                                <ToggleChip active={!q.answered} onClick={() => setQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, answered: false } : x))} color={T.amber}>Még aktuális</ToggleChip>
                                <ToggleChip active={q.answered} onClick={() => setQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, answered: true } : x))} color={T.green}>Megválaszolva</ToggleChip>
                              </div>
                            </Field>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <Field label="Kinek szól az új kérdés">
                  <div className="flex gap-2">
                    <ToggleChip active={newQRecipient === "vedono"} onClick={() => setNewQRecipient("vedono")} color={T.pink}>Védőnő</ToggleChip>
                    <ToggleChip active={newQRecipient === "orvos"} onClick={() => setNewQRecipient("orvos")} color={T.accent}>Orvos</ToggleChip>
                  </div>
                </Field>
                <div className="flex gap-2">
                  <input style={inputStyle} placeholder="Új kérdés..." value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} />
                  <button
                    onClick={() => { if (newQuestion.trim()) { setQuestions((p) => [...p, { id: Date.now(), text: newQuestion, recipient: newQRecipient, answered: false, answer: "" }]); setNewQuestion(""); } }}
                    className="rounded-xl px-3 flex items-center justify-center shrink-0" style={{ background: T.accent, color: "#fff" }}>
                    <Plus size={18} />
                  </button>
                </div>
              </CollapsibleCard>

              <button onClick={() => setView("history")} className="w-full rounded-xl py-3 flex items-center justify-center gap-2 mt-1"
                style={{ ...display, background: T.panel, border: `1px solid ${T.line}`, color: T.ink, fontWeight: 700, fontSize: 14.5 }}>
                <ListChecks size={17} /> Historikus adatok
              </button>
            </>
          ) : view === "history" ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setView("dashboard")} className="flex items-center gap-1.5 rounded-xl px-4 py-3" style={{ background: T.panel, border: `1px solid ${T.line}`, color: T.ink, fontSize: 15, fontWeight: 700 }}>
                  <ArrowLeft size={20} /> Vissza
                </button>
                <h2 style={{ ...display, fontSize: 16, fontWeight: 700, flex: 1 }}>Historikus adatok</h2>
              </div>
              <div className="flex gap-2 mb-2">
                <button onClick={() => setView("graphs")} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5" style={{ background: T.panel, border: `1px solid ${T.line}`, color: T.muted, fontSize: 13, fontWeight: 600 }}>
                  <BarChart3 size={15} /> Grafikonok
                </button>
                <button onClick={() => setExcelModalOpen(true)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5" style={{ background: T.panel, border: `1px solid ${T.line}`, color: T.muted, fontSize: 13, fontWeight: 600 }}>
                  <Download size={15} /> Excel export
                </button>
              </div>

              {excelModalOpen && (
                <InfoModal
                  title="Fejlesztés alatt"
                  message="Az Excel export jelenleg nem elérhető funkció, ez egy későbbi fejlesztés része lesz."
                  onClose={() => setExcelModalOpen(false)}
                />
              )}
              <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
                {Object.entries(TYPE_META).map(([key, m]) => (
                  <button key={key} onClick={() => setFilters((f) => ({ ...f, [key]: !f[key] }))} className="rounded-full px-3 py-1.5 shrink-0"
                    style={{ fontSize: 12.5, fontWeight: 600, border: `1px solid ${filters[key] ? m.color : T.line}`, background: filters[key] ? `color-mix(in srgb, ${m.color} 30%, ${T.panel})` : T.panel2, color: filters[key] ? "#fff" : T.faint }}>
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {filteredHistory.map((h) => {
                  const meta = TYPE_META[h.type];
                  return (
                    <div key={h.id} className="flex items-center gap-3 rounded-xl px-3 py-3" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
                      <div className="flex items-center justify-center rounded-lg shrink-0" style={{ width: 32, height: 32, background: `color-mix(in srgb, ${meta.color} 22%, ${T.panel})`, color: meta.color }}>
                        <meta.icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div style={{ fontSize: 11.5, color: T.faint, marginBottom: 2 }}>{entryDateTimeLabel(h.when)}</div>
                        <div style={{ fontSize: 13, color: T.ink }}>{entryDetail(h)}</div>
                      </div>
                      <button onClick={() => setEditingId(h.id)} className="flex flex-col items-center gap-0.5 shrink-0 px-1" style={{ color: T.accent }}>
                        <Pencil size={16} />
                        <span style={{ fontSize: 9.5, fontWeight: 600 }}>Módosítás</span>
                      </button>
                    </div>
                  );
                })}
                {filteredHistory.length === 0 && <div className="text-center py-8" style={{ color: T.faint, fontSize: 13 }}>Nincs a szűrésnek megfelelő bejegyzés.</div>}
              </div>

              {editingEntry && (
                <EditEntryModal
                  entry={editingEntry}
                  onCancel={() => setEditingId(null)}
                  onSave={(updated) => { setHistoryEntries((prev) => prev.map((e) => e.id === updated.id ? updated : e)); setEditingId(null); }}
                  onDelete={(id) => { setHistoryEntries((prev) => prev.filter((e) => e.id !== id)); setEditingId(null); }}
                />
              )}
            </>
          ) : (
            // ---- Grafikonok nézet ----
            <>
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setView("history")} className="flex items-center gap-1.5 rounded-xl px-4 py-3" style={{ background: T.panel, border: `1px solid ${T.line}`, color: T.ink, fontSize: 15, fontWeight: 700 }}>
                  <ArrowLeft size={20} /> Vissza
                </button>
                <h2 style={{ ...display, fontSize: 16, fontWeight: 700, flex: 1 }}>Grafikonok</h2>
              </div>

              <Card>
                <div className="flex items-center justify-between mb-3">
                  <SectionTitle icon={BarChart3} color={T.accent}>Súlygörbe</SectionTitle>
                  <div className="flex gap-1">
                    <button onClick={() => setGraphPeriod("week")} className="rounded-full px-2.5 py-1" style={{ fontSize: 11, background: graphPeriod === "week" ? T.accent : T.panel2, color: graphPeriod === "week" ? "#fff" : T.faint, fontWeight: 600 }}>Heti</button>
                    <button onClick={() => setGraphPeriod("month")} className="rounded-full px-2.5 py-1" style={{ fontSize: 11, background: graphPeriod === "month" ? T.accent : T.panel2, color: graphPeriod === "month" ? "#fff" : T.faint, fontWeight: 600 }}>Havi</button>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => graphPeriod === "week" ? setWeekOffset((o) => o - 1) : setMonthOffset((o) => o - 1)}
                    className="rounded-lg p-1.5" style={{ background: T.panel2, border: `1px solid ${T.line}`, color: T.muted }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ ...display, fontSize: 13, fontWeight: 700, color: T.ink }}>{chartLabel}</span>
                  <button
                    onClick={() => { if (!atPresent) { graphPeriod === "week" ? setWeekOffset((o) => o + 1) : setMonthOffset((o) => o + 1); } }}
                    disabled={atPresent}
                    className="rounded-lg p-1.5" style={{ background: T.panel2, border: `1px solid ${T.line}`, color: atPresent ? T.line : T.muted, opacity: atPresent ? 0.5 : 1 }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div style={{ width: "100%", height: 200 }}>
                  <ResponsiveContainer>
                    <LineChart data={chartData} margin={{ left: -20, right: 8 }}>
                      <CartesianGrid stroke={T.line} strokeDasharray="3 3" />
                      <XAxis dataKey="nap" stroke={T.faint} fontSize={11} interval={graphPeriod === "month" ? Math.max(0, Math.floor(chartData.length / 6)) : 0} />
                      <YAxis stroke={T.faint} fontSize={11} domain={["dataMin - 30", "dataMax + 30"]} />
                      <Tooltip contentStyle={{ background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="cel" name="Cél" stroke={T.faint} strokeDasharray="4 3" dot={false} />
                      <Line type="monotone" dataKey="teny" name="Tényleges" stroke={T.green} strokeWidth={2.5} dot={graphPeriod === "week"} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <PeriodChart
                title="Szoptatások" icon={Droplets} color={T.pink}
                series={[{ key: "count", name: "Szoptatások száma", color: T.pink }]}
                genDay={genFeedDayData} genWeek={genFeedWeekData} genMonth={genFeedMonthData}
              />

              <PeriodChart
                title="Pelenkacserék" icon={Baby} color={T.amber}
                series={[{ key: "pisi", name: "Pisi", color: T.amber }, { key: "kaki", name: "Kaki", color: T.red }]}
                genDay={genDiaperDayData} genWeek={genDiaperWeekData} genMonth={genDiaperMonthData}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
