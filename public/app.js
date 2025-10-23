const { useState, useMemo, useEffect } = React;

// === Telegram WebApp авторизация ===
let tg = window.Telegram?.WebApp || null;
let CURRENT_USER_ID = 0;
let CURRENT_USER_NAME = "Гость";
let CURRENT_USERNAME = "";
const ADMIN_USERNAMES = ["tutenhaman", "brgmnstrr"];
const ADMIN_IDS = [504348666, 2015942051];

try {
  if (tg?.initDataUnsafe?.user) {
    const u = tg.initDataUnsafe.user;
    CURRENT_USER_ID = u.id || 0;
    CURRENT_USERNAME = (u.username || "").toLowerCase();
    CURRENT_USER_NAME = [u.first_name, u.last_name].filter(Boolean).join(" ") || "Гость";
  }
} catch (e) {
  console.warn("Ошибка чтения Telegram WebApp данных:", e);
}

const IS_ADMIN =
  (CURRENT_USERNAME && ADMIN_USERNAMES.includes(CURRENT_USERNAME)) ||
  ADMIN_IDS.includes(CURRENT_USER_ID);

// === Утилиты ===
const load = (k, f) => {
  try {
    const r = localStorage.getItem(k);
    return r ? JSON.parse(r) : f;
  } catch {
    return f;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};
const slug = (s) =>
  s
    .toLowerCase()
    .trim()
    .split(" ")
    .filter(Boolean)
    .join("-")
    .normalize("NFKD")
    .replace(/[^a-zа-я0-9-]/gi, "");
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const calcAvg = (ps) =>
  Math.round(ps.reduce((a, b) => a + b.percent * b.strength, 0) / ps.reduce((a, b) => a + b.percent, 0));

function smartDesc(parts) {
  if (!parts.length) return "";
  const s = [...parts].sort((a, b) => b.percent - a.percent);
  const base = s
    .slice(0, 2)
    .map((t) => t.taste.split(",").map((x) => x.trim()).join(" + "))
    .join(" и ");
  const acc = s.slice(2, 4);
  const accStr = acc.length
    ? " с оттенками " +
      acc.map((t) => t.taste.split(",").map((x) => x.trim()).join(" + ")).join(" и ")
    : "";
  const avg = Math.round(
    s.reduce((a, x) => a + x.strength * x.percent, 0) /
      s.reduce((a, x) => a + x.percent, 0)
  );
  const tone =
    avg >= 7 ? "насыщенный" : avg >= 5 ? "выразительный" : avg >= 3 ? "мягкий" : "лёгкий";
  return `${tone} микс: ${base}${accStr}`;
}

// === Основное приложение ===
function App() {
  const [tab, setTab] = useState("community");

  const seed = [
    {
      id: "alfakher",
      name: "Al Fakher",
      hidden: false,
      flavors: [
        { id: "mint", name: "Mint", strength: 2, taste: "свежий, мятный", hidden: false },
        { id: "grape", name: "Grape", strength: 2, taste: "фруктовый, виноградный", hidden: false },
        { id: "double-apple", name: "Double Apple", strength: 3, taste: "анисовый, яблочный", hidden: false },
      ],
    },
    {
      id: "musthave",
      name: "Must Have",
      hidden: false,
      flavors: [
        { id: "raspberry", name: "Raspberry", strength: 3, taste: "ягодный, кисловатый", hidden: false },
        { id: "cheesecake", name: "Cheesecake", strength: 4, taste: "десертный, сливочный", hidden: false },
        { id: "whiskey-cola", name: "Whiskey Cola", strength: 5, taste: "алкогольный, кола", hidden: false },
      ],
    },
  ];

  const [brands, setBrands] = useState(() => load("h.brands.v3", seed));
  const [banned, setBanned] = useState(() => load("h.banned", []));
  const [mixes, setMixes] = useState([]);

  useEffect(() => {
    fetch("https://hookah-miniapp-production.up.railway.app/api/mix")
      .then((r) => r.json())
      .then(setMixes)
      .catch((err) => console.error("Ошибка загрузки миксов:", err));
  }, []);

  useEffect(() => save("h.brands.v3", brands), [brands]);
  useEffect(() => save("h.banned", banned), [banned]);
  useEffect(() => save("h.mixes.v3", mixes), [mixes]);

  // === COMMUNITY ===
  const DIR = ["десертный", "кислый", "травяной", "пряный", "чайный", "сладкий", "свежий", "алкогольный"];
  const [pref, setPref] = useState("all");
  const [strength, setStrength] = useState(5);
  const [likes, setLikes] = useState({});
  const rec = mixes
    .filter((m) => pref === "all" || m.parts?.some((p) => p.taste?.toLowerCase().includes(pref)))
    .filter((m) => Math.abs(m.avgStrength - strength) <= 1);
  const toggleLike = (id) => {
    setMixes((ms) => ms.map((m) => (m.id === id ? { ...m, likes: m.likes + (likes[id] ? -1 : 1) } : m)));
    setLikes((s) => {
      const n = { ...s };
      if (n[id]) delete n[id];
      else n[id] = 1;
      return n;
    });
  };

  // === BUILDER ===
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [parts, setParts] = useState([]);
  const selectedBrand = useMemo(() => brands.find((b) => b.id === selected) || null, [selected, brands]);
  const total = parts.reduce((a, b) => a + b.percent, 0);
  const avg = parts.length && total > 0 ? Math.round(parts.reduce((a, p) => a + p.percent * p.strength, 0) / total) : 0;

  const filtered = selectedBrand
    ? selectedBrand.flavors.filter((f) => !f.hidden).filter((f) => {
        const q = search.toLowerCase();
        return f.name.toLowerCase().includes(q) || f.taste.toLowerCase().includes(q);
      })
    : [];

  const addFlavor = (brandId, fl) => {
    if (total >= 100) return;
    const key = `${brandId}:${fl.id}`;
    setParts((prev) => {
      if (prev.some((p) => p.key === key)) return prev;
      const remaining = 100 - prev.reduce((a, b) => a + b.percent, 0);
      const defPct = Math.min(20, remaining);
      return [...prev, { key, brandId, flavorId: fl.id, name: fl.name, taste: fl.taste, strength: fl.strength, percent: defPct }];
    });
  };

  const updatePct = (key, val) => {
    setParts((prev) => {
      const sumOthers = prev.reduce((a, b) => a + (b.key === key ? 0 : b.percent), 0);
      const allowed = Math.max(0, 100 - sumOthers);
      const clamped = clamp(Math.round(val), 0, allowed);
      return prev.map((x) => (x.key === key ? { ...x, percent: clamped } : x));
    });
  };

  const removePart = (key) => setParts((prev) => prev.filter((x) => x.key !== key));

  const saveMix = async () => {
    if (total !== 100) return alert("Сумма должна быть 100%");
    const title = prompt("Введите название вашего микса:");
    if (!title) return;
    const bad = banned.find((w) => title.toLowerCase().includes(w.toLowerCase()));
    if (bad) return alert(`❌ В названии найдено запрещённое слово: "${bad}"`);

    const newMix = {
      name: title.trim(),
      author: CURRENT_USER_NAME,
      flavors: parts,
      avgStrength: avg,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch("https://hookah-miniapp-production.up.railway.app/api/mixes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMix),
      });
      const result = await res.json();
      if (result?.success) {
        alert("✅ Микс сохранён");
        setParts([]);
        const r = await fetch("https://hookah-miniapp-production.up.railway.app/api/mix");
        const data = await r.json();
        setMixes(data);
      } else alert("❌ Ошибка при сохранении микса");
    } catch (err) {
      console.error("Ошибка сохранения микса:", err);
      alert("❌ Не удалось сохранить микс");
    }
  };

  // === ADMIN ===
  const [brandName, setBrandName] = useState("");
  const [brandForFlavor, setBrandForFlavor] = useState(brands[0]?.id || "");
  const [flavorName, setFlavorName] = useState("");
  const [flavorStrength, setFlavorStrength] = useState(5);
  const [flavorTaste, setFlavorTaste] = useState("");
  const [banInput, setBanInput] = useState("");

  const addBrand = () => {
    const name = brandName.trim();
    if (!name) return;
    const id = slug(name);
    if (brands.some((b) => b.id === id)) return;
    const next = [...brands, { id, name, hidden: false, flavors: [] }];
    setBrands(next);
    setBrandName("");
    if (!brandForFlavor) setBrandForFlavor(id);
  };

  const addFlavorAdmin = () => {
    const b = brands.find((x) => x.id === brandForFlavor);
    if (!b) return;
    const name = flavorName.trim();
    if (!name) return;
    const id = slug(name);
    if (b.flavors.some((f) => f.id === id)) return;
    const st = clamp(Math.round(flavorStrength), 1, 10);
    const fl = { id, name, strength: st, taste: flavorTaste.trim(), hidden: false };
    setBrands(brands.map((x) => (x.id === b.id ? { ...x, flavors: [...x.flavors, fl] } : x)));
    setFlavorName("");
    setFlavorTaste("");
  };

  const toggleBrandHidden = (id) => setBrands((prev) => prev.map((b) => (b.id === id ? { ...b, hidden: !b.hidden } : b)));
  const toggleFlavorHidden = (bid, fid) =>
    setBrands((prev) =>
      prev.map((b) =>
        b.id === bid ? { ...b, flavors: b.flavors.map((f) => (f.id === fid ? { ...f, hidden: !f.hidden } : f)) } : b
      )
    );

  const delBrand = (id) => setBrands(brands.filter((b) => b.id !== id));
  const delFlavor = (bid, fid) =>
    setBrands((prev) =>
      prev.map((b) => (b.id !== bid ? b : { ...b, flavors: b.flavors.filter((f) => f.id !== fid) }))
    );

  const addBan = () => {
    const w = banInput.trim().toLowerCase();
    if (!w || banned.includes(w)) return;
    setBanned([...banned, w]);
    setBanInput("");
  };
  const delBan = (w) => setBanned(banned.filter((x) => x !== w));

  // === Интерфейс ===
  return (
    <div className="container">
      <header className="title">Кальянный Миксер</header>

      <div className="tabs">
        <button className={"tab-btn" + (tab === "community" ? " active" : "")} onClick={() => setTab("community")}>
          Миксы
        </button>
        <button className={"tab-btn" + (tab === "builder" ? " active" : "")} onClick={() => setTab("builder")}>
          Конструктор
        </button>
        {IS_ADMIN && (
          <button className={"tab-btn" + (tab === "admin" ? " active" : "")} onClick={() => setTab("admin")}>
            Админ
          </button>
        )}
      </div>

      {tab === "community" && (
        <div>
          <h3>Рекомендации</h3>
          <p>Выберите настроение и крепость</p>
          <div>
            <button onClick={() => setPref("all")}>Все</button>
            {DIR.map((t) => (
              <button key={t} onClick={() => setPref(t)}>{t}</button>
            ))}
          </div>
          <div>Крепость: {strength}</div>
          <input type="range" min="1" max="10" value={strength} onChange={(e) => setStrength(+e.target.value)} />
          <div>
            {rec.map((m) => (
              <div key={m.id} className="mix-card">
                <div><b>{m.title}</b> — {m.author}</div>
                <div>Крепость: {m.avgStrength}</div>
                <div>{smartDesc(m.parts)}</div>
                <button onClick={() => toggleLike(m.id)}>❤ {m.likes}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "builder" && (
        <div>
          <h3>Конструктор</h3>
          <div>
            {brands.filter((b) => !b.hidden).map((b) => (
              <button key={b.id} onClick={() => setSelected(b.id)}>{b.name}</button>
            ))}
          </div>
          {selectedBrand && (
            <>
              <input placeholder="Поиск..." value={search} onChange={(e) => setSearch(e.target.value)} />
              {filtered.map((f) => (
                <div key={f.id}>
                  <span>{f.name}</span>
                  <button onClick={() => addFlavor(selectedBrand.id, f)}>➕</button>
                </div>
              ))}
            </>
          )}

          {parts.length > 0 && (
            <div>
              <h4>Ваш микс ({total}%)</h4>
              {parts.map((p) => (
                <div key={p.key}>
                  {p.name}: <input type="number" min="0" max="100" value={p.percent}
                    onChange={(e) => updatePct(p.key, +e.target.value)} />%
                  <button onClick={() => removePart(p.key)}>❌</button>
                </div>
              ))}
              <p>Средняя крепость: {avg}</p>
              <button onClick={saveMix}>💾 Сохранить</button>
            </div>
          )}
        </div>
      )}

      {tab === "admin" && IS_ADMIN && (
        <div>
          <h3>Админ-панель</h3>

          <div>
            <h4>Добавить бренд</h4>
            <input placeholder="Название бренда" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
            <button onClick={addBrand}>Добавить</button>
          </div>

          <div>
            <h4>Добавить вкус</h4>
            <select value={brandForFlavor} onChange={(e) => setBrandForFlavor(e.target.value)}>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input placeholder="Название вкуса" value={flavorName} onChange={(e) => setFlavorName(e.target.value)} />
            <input placeholder="Описание вкуса" value={flavorTaste} onChange={(e) => setFlavorTaste(e.target.value)} />
            <input type="number" min="1" max="10" value={flavorStrength} onChange={(e) => setFlavorStrength(+e.target.value)} />
            <button onClick={addFlavorAdmin}>Добавить вкус</button>
          </div>

          <div>
            <h4>Бренды</h4>
            {brands.map((b) => (
              <div key={b.id}>
                <b>{b.name}</b>
                <button onClick={() => toggleBrandHidden(b.id)}>{b.hidden ? "👁️‍🗨️" : "🙈"}</button>
                <button onClick={() => delBrand(b.id)}>❌</button>
                {b.flavors.map((f) => (
                  <div key={f.id} style={{ marginLeft: "15px" }}>
                    {f.name} ({f.strength}) — {f.taste}
                    <button onClick={() => toggleFlavorHidden(b.id, f.id)}>{f.hidden ? "👁️‍🗨️" : "🙈"}</button>
                    <button onClick={() => delFlavor(b.id, f.id)}>❌</button>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div>
            <h4>Запрещённые слова</h4>
            <input placeholder="Слово" value={banInput} onChange={(e) => setBanInput(e.target.value)} />
            <button onClick={addBan}>Добавить</button>
            <ul>
              {banned.map((w) => (
                <li key={w}>{w} <button onClick={() => delBan(w)}>❌</button></li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
