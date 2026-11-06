/* Skies — a three-location weather app.
 * Data: Open-Meteo (https://open-meteo.com), no API key required.
 */
(() => {
  "use strict";

  // ---------------------------------------------------------------------------
  // Settings & storage
  // ---------------------------------------------------------------------------
  const SETTINGS_KEY = "skies.settings.v2";
  const OLD_SETTINGS_KEY = "skies.settings.v1"; // pre-WA defaults; only units are carried over
  const CACHE_PREFIX = "skies.wx.v1.";
  const STALE_MS = 10 * 60 * 1000; // refresh data older than 10 minutes

  const DEFAULT_LOCATIONS = [
    { name: "Dandaragan", admin: "Western Australia", country: "Australia", lat: -30.6833, lon: 115.7 },
    { name: "Peedamulla", admin: "Western Australia", country: "Australia", lat: -21.845, lon: 115.627 },
    { name: "Perth", admin: "Western Australia", country: "Australia", lat: -31.9523, lon: 115.8613 },
  ];

  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
    },
  };

  function loadSettings() {
    const s = store.get(SETTINGS_KEY, null) ?? { units: store.get(OLD_SETTINGS_KEY, null)?.units };
    const locations = Array.isArray(s?.locations) && s.locations.length === 3 ? s.locations : DEFAULT_LOCATIONS.slice();
    const units = s?.units === "imperial" ? "imperial" : "metric";
    return { locations, units };
  }
  let settings = loadSettings();
  const saveSettings = () => store.set(SETTINGS_KEY, settings);

  // ---------------------------------------------------------------------------
  // Weather codes → text, icon and colour theme
  // ---------------------------------------------------------------------------
  const WMO = {
    0: ["Clear", "clear"], 1: ["Mostly clear", "clear"], 2: ["Partly cloudy", "partly"], 3: ["Overcast", "cloudy"],
    45: ["Fog", "fog"], 48: ["Freezing fog", "fog"],
    51: ["Light drizzle", "drizzle"], 53: ["Drizzle", "drizzle"], 55: ["Heavy drizzle", "drizzle"],
    56: ["Freezing drizzle", "drizzle"], 57: ["Freezing drizzle", "drizzle"],
    61: ["Light rain", "rain"], 63: ["Rain", "rain"], 65: ["Heavy rain", "rain"],
    66: ["Freezing rain", "rain"], 67: ["Freezing rain", "rain"],
    71: ["Light snow", "snow"], 73: ["Snow", "snow"], 75: ["Heavy snow", "snow"], 77: ["Snow grains", "snow"],
    80: ["Light showers", "rain"], 81: ["Showers", "rain"], 82: ["Heavy showers", "rain"],
    85: ["Snow showers", "snow"], 86: ["Heavy snow showers", "snow"],
    95: ["Thunderstorm", "thunder"], 96: ["Thunderstorm, hail", "thunder"], 99: ["Thunderstorm, hail", "thunder"],
  };
  const describe = (code) => WMO[code] || ["—", "cloudy"];

  const THEMES = {
    clear:   { day: ["#2f7cf6", "#62b8ff"], night: ["#0b1434", "#2a3570"] },
    partly:  { day: ["#3c6fcf", "#83aee6"], night: ["#131b3c", "#38426f"] },
    cloudy:  { day: ["#56667f", "#8c9ab0"], night: ["#1b2131", "#3b4458"] },
    fog:     { day: ["#6c7684", "#a3acb8"], night: ["#22272f", "#4a525e"] },
    drizzle: { day: ["#3a5677", "#6886a8"], night: ["#141c2c", "#2f3e58"] },
    rain:    { day: ["#2c4566", "#557396"], night: ["#0f1626", "#2a3850"] },
    snow:    { day: ["#6f8db4", "#b9cbe4"], night: ["#25304a", "#55627f"] },
    thunder: { day: ["#2c2846", "#544a78"], night: ["#16132a", "#3a3258"] },
  };
  const themeFor = (code, isDay) => THEMES[describe(code)[1]][isDay ? "day" : "night"];

  // ---------------------------------------------------------------------------
  // Icons (inline SVG, gradients defined once in index.html)
  // ---------------------------------------------------------------------------
  function sun(cx, cy, r) {
    let rays = "";
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const c = Math.cos(a), s = Math.sin(a);
      rays += `<line x1="${(cx + c * (r + 4)).toFixed(1)}" y1="${(cy + s * (r + 4)).toFixed(1)}" x2="${(cx + c * (r + 8.5)).toFixed(1)}" y2="${(cy + s * (r + 8.5)).toFixed(1)}"/>`;
    }
    return `<g stroke="#ffc93c" stroke-width="3" stroke-linecap="round">${rays}</g><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#gSun)"/>`;
  }
  const MOON = `<path d="M39 16.4A18 18 0 1 0 39 47.6A18 18 0 0 1 39 16.4z" fill="url(#gMoon)"/>`;
  const cloud = (dark, t = "") =>
    `<path transform="${t}" d="M20 46h26a10 10 0 0 0 1-19.95A14 14 0 0 0 20.5 24 11 11 0 0 0 20 46z" fill="url(#${dark ? "gCloudDark" : "gCloud"})"/>`;
  const drops = (len) =>
    `<g stroke="#5ec8ff" stroke-width="3" stroke-linecap="round">` +
    [22, 32, 42].map((x) => `<line x1="${x}" y1="48" x2="${x - len / 2.5}" y2="${48 + len}"/>`).join("") +
    `</g>`;

  function icon(code, isDay = 1) {
    const type = describe(code)[1];
    let body;
    switch (type) {
      case "clear":
        body = isDay ? sun(32, 32, 12) : `<g transform="translate(4 0)">${MOON}</g>`;
        break;
      case "partly":
        body = (isDay ? sun(22, 22, 9) : `<g transform="translate(-6 -6) scale(0.7)">${MOON}</g>`) +
          cloud(false, "translate(8 10) scale(0.85)");
        break;
      case "cloudy":
        body = cloud(true, "translate(-2 -2) scale(0.9)") + cloud(false, "translate(6 6) scale(0.85)");
        break;
      case "fog":
        body = cloud(false, "translate(0 -6)") +
          `<g stroke="#e4e9f1" stroke-width="3" stroke-linecap="round"><line x1="14" y1="49" x2="50" y2="49"/><line x1="20" y1="56" x2="44" y2="56"/></g>`;
        break;
      case "drizzle":
        body = cloud(false, "translate(0 -4)") + drops(5);
        break;
      case "rain":
        body = cloud(true, "translate(0 -4)") + drops(10);
        break;
      case "snow":
        body = cloud(false, "translate(0 -4)") +
          `<g fill="#fff">${[[22, 51], [32, 56], [42, 51], [27, 60], [37, 60]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6"/>`).join("")}</g>`;
        break;
      case "thunder":
        body = cloud(true, "translate(0 -6)") + `<polygon points="34,38 24,52 31,52 27,62 41,46 34,46 38,38" fill="#ffd23f"/>`;
        break;
    }
    return `<svg viewBox="0 0 64 64" aria-hidden="true">${body}</svg>`;
  }

  const DROP_SVG = `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1C6 1 2 5.6 2 8a4 4 0 0 0 8 0C10 5.6 6 1 6 1z" fill="currentColor"/></svg>`;
  const PANEL_ICONS = {
    rain: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2s-7 7.9-7 12.5a7 7 0 0 0 14 0C19 9.9 12 2 12 2z"/></svg>`,
    clock: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 10.6 3.5 2.1-.8 1.3L11 13V7h2v5.6z"/></svg>`,
    cal: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14v11z"/></svg>`,
  };

  // ---------------------------------------------------------------------------
  // Formatting helpers. Open-Meteo returns local wall-clock times for each place
  // (timezone=auto), so we treat them as UTC to format them without shifting.
  // ---------------------------------------------------------------------------
  const asUTC = (s) => {
    const [d, t = "00:00"] = s.split("T");
    const [y, m, day] = d.split("-").map(Number);
    const [hh, mm] = t.split(":").map(Number);
    return new Date(Date.UTC(y, m - 1, day, hh, mm));
  };
  const fmtHour = new Intl.DateTimeFormat(undefined, { hour: "numeric", timeZone: "UTC" });
  const fmtTime = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  const fmtDay = new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" });
  const fmtToday = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });
  const hourLabel = (s) => fmtHour.format(asUTC(s)).replace(/\s?(AM|PM)/i, (m) => m.trim()[0].toLowerCase());
  const localNow = (data) => fmtTime.format(new Date(Date.now() + data.utc_offset_seconds * 1000));
  const deg = (v) => (v == null ? "–" : `${Math.round(v)}°`);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const unitLabels = () =>
    settings.units === "imperial" ? { wind: "mph", rain: "in", rainDp: 2 } : { wind: "km/h", rain: "mm", rainDp: 1 };
  const fmtRain = (v) => {
    const { rain, rainDp } = unitLabels();
    if (!v) return `0 ${rain}`;
    return `${Number(v).toFixed(rainDp).replace(/\.?0+$/, "") || "<0.1"} ${rain}`;
  };
  const toC = (t) => (settings.units === "imperial" ? ((t - 32) * 5) / 9 : t);
  const tempColor = (t) => {
    const c = Math.max(-10, Math.min(38, toC(t)));
    const hue = 210 - ((c + 10) / 48) * 200; // blue → orange/red
    return `hsl(${hue.toFixed(0)} 90% 66%)`;
  };
  const compass = (d) => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(d / 45) % 8];
  const uvLabel = (u) => (u < 3 ? "Low" : u < 6 ? "Moderate" : u < 8 ? "High" : u < 11 ? "Very high" : "Extreme");

  // ---------------------------------------------------------------------------
  // Data fetching with a local cache (stale-while-revalidate)
  // ---------------------------------------------------------------------------
  const weather = [null, null, null]; // { t, data } per slot
  const inflight = new Map();

  const cacheKey = (loc) => `${CACHE_PREFIX}${loc.lat.toFixed(3)},${loc.lon.toFixed(3)},${settings.units}`;

  function forecastURL(loc) {
    const p = new URLSearchParams({
      latitude: loc.lat,
      longitude: loc.lon,
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
      hourly: "temperature_2m,precipitation_probability,precipitation,weather_code,is_day",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,uv_index_max",
      timezone: "auto",
      forecast_days: "5",
    });
    if (settings.units === "imperial") {
      p.set("temperature_unit", "fahrenheit");
      p.set("wind_speed_unit", "mph");
      p.set("precipitation_unit", "inch");
    }
    return `https://api.open-meteo.com/v1/forecast?${p}`;
  }

  function loadCached(i) {
    const loc = settings.locations[i];
    weather[i] = store.get(cacheKey(loc), null);
    return weather[i];
  }

  function fetchWeather(i, { force = false } = {}) {
    const loc = settings.locations[i];
    const key = cacheKey(loc);
    const cached = weather[i];
    if (!force && cached && Date.now() - cached.t < STALE_MS) return Promise.resolve(cached);
    if (inflight.has(key)) return inflight.get(key);

    const p = fetch(forecastURL(loc))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const entry = { t: Date.now(), data };
        store.set(key, entry);
        // Only apply if the slot still points at the same place/units.
        if (cacheKey(settings.locations[i]) === key) weather[i] = entry;
        return entry;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }

  function refreshAll({ force = false } = {}) {
    return Promise.allSettled(
      settings.locations.map((_, i) =>
        fetchWeather(i, { force }).then(
          () => render(i),
          (err) => {
            console.warn("Weather fetch failed", err);
            if (!weather[i]) render(i, { error: true });
            return Promise.reject(err);
          },
        ),
      ),
    ).then((res) => {
      if (res.some((r) => r.status === "rejected")) {
        toast(navigator.onLine === false ? "You're offline — showing saved weather" : "Couldn't update some places");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------
  function currentHourIndex(data) {
    const key = data.current.time.slice(0, 13);
    const idx = data.hourly.time.findIndex((t) => t.slice(0, 13) === key);
    return idx < 0 ? 0 : idx;
  }

  function rainOutlook(data) {
    const h = data.hourly;
    const start = currentHourIndex(data);
    const end = Math.min(start + 12, h.time.length);
    const wetAt = (k) => (h.precipitation[k] ?? 0) >= 0.1 * (settings.units === "imperial" ? 0.04 : 1) || (h.precipitation_probability[k] ?? 0) >= 50;
    const snowy = [start, start + 1, start + 2].some((k) => describe(h.weather_code[k])[1] === "snow");
    const word = snowy ? "Snow" : "Rain";

    let first = -1;
    for (let k = start; k < end; k++) if (wetAt(k)) { first = k; break; }
    const nowWet = (data.current.precipitation ?? 0) > 0 || first === start;

    if (nowWet) {
      let stop = -1;
      for (let k = start + 1; k < end; k++) if (!wetAt(k)) { stop = k; break; }
      return {
        headline: `${snowy ? "Snowing" : "Raining"} now`,
        detail: stop > 0 ? `Easing around ${fmtTime.format(asUTC(h.time[stop]))}` : "Expected to continue for the next few hours",
      };
    }
    if (first !== -1) {
      return {
        headline: `${word} likely from ${fmtTime.format(asUTC(h.time[first]))}`,
        detail: `${h.precipitation_probability[first] ?? 0}% chance at that time`,
      };
    }
    let max = 0;
    for (let k = start; k < end; k++) max = Math.max(max, h.precipitation_probability[k] ?? 0);
    if (max >= 20) return { headline: "A few showers possible", detail: `Up to ${max}% chance in the next 12 hours` };
    return { headline: `No ${word.toLowerCase()} expected`, detail: "Dry for at least the next 12 hours" };
  }

  // ---------------------------------------------------------------------------
  // HOME
  // ---------------------------------------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  const cardsEl = $("#cards");

  function buildHome() {
    $("#today-label").textContent = fmtToday.format(new Date());
    cardsEl.innerHTML = "";
    settings.locations.forEach((_, i) => {
      const card = document.createElement("button");
      card.className = "card";
      card.dataset.index = i;
      card.addEventListener("click", () => openDetail(i, { push: true }));
      cardsEl.appendChild(card);
      renderCard(i);
    });
  }

  function renderCard(i, { error = false } = {}) {
    const card = cardsEl.children[i];
    if (!card) return;
    const loc = settings.locations[i];
    const entry = weather[i];
    card.setAttribute("aria-label", `${loc.name} weather`);

    if (!entry) {
      card.classList.add("loading");
      card.style.setProperty("--c-a", "#2a3a6e");
      card.style.setProperty("--c-b", "#46578f");
      card.innerHTML = `
        <div class="card-top">
          <div><div class="card-name">${esc(loc.name)}</div><div class="card-sub">${esc(loc.country || "")}</div></div>
        </div>
        <div class="card-mid">
          ${error ? `<div class="card-cond">Couldn't load weather — tap to retry</div>` : `<span class="skeleton" style="width:110px;height:56px"></span>`}
        </div>
        <div class="card-days">${error ? "" : '<span class="skeleton" style="height:26px"></span>'.repeat(3)}</div>`;
      return;
    }

    card.classList.remove("loading");
    const d = entry.data;
    const c = d.current;
    const [cond] = describe(c.weather_code);
    const [a, b] = themeFor(c.weather_code, c.is_day);
    card.style.setProperty("--c-a", a);
    card.style.setProperty("--c-b", b);
    const rainToday = d.daily.precipitation_probability_max[0] ?? 0;

    const days = [1, 2, 3]
      .map((k) => `
        <div class="mini-day">
          ${icon(d.daily.weather_code[k], 1)}
          <div><b>${fmtDay.format(asUTC(d.daily.time[k]))}</b><span>${deg(d.daily.temperature_2m_max[k])} / ${deg(d.daily.temperature_2m_min[k])}</span></div>
        </div>`)
      .join("");

    card.innerHTML = `
      <div class="card-top">
        <div>
          <div class="card-name">${esc(loc.name)}</div>
          <div class="card-sub">${localNow(d)} · ${esc(loc.country || loc.admin || "")}</div>
        </div>
        <div class="card-icon">${icon(c.weather_code, c.is_day)}</div>
      </div>
      <div class="card-mid">
        <div class="card-now">
          <div class="card-temp">${deg(c.temperature_2m)}</div>
          <div>
            <div class="card-cond">${cond}</div>
            <div class="card-hl">H ${deg(d.daily.temperature_2m_max[0])} · L ${deg(d.daily.temperature_2m_min[0])}</div>
          </div>
        </div>
        <span class="rain-chip" style="color:${rainToday >= 50 ? "#bfe9ff" : "#fff"}">${DROP_SVG}${rainToday}% today</span>
      </div>
      <div class="card-days">${days}</div>`;
  }

  // ---------------------------------------------------------------------------
  // DETAIL
  // ---------------------------------------------------------------------------
  let current = -1; // index shown in detail, -1 = home
  const detailEl = $("#detail");
  const bodyEl = $("#detail-body");

  function renderTabs() {
    $("#tabs").innerHTML = settings.locations
      .map((l, i) => `<button class="tab" data-index="${i}" ${i === current ? 'aria-current="true"' : ""}>${esc(l.name)}</button>`)
      .join("");
  }

  function setBackground(code, isDay) {
    const [a, b] = code == null ? ["#142046", "#2e3f7a"] : themeFor(code, isDay);
    document.documentElement.style.setProperty("--bg-a", a);
    document.documentElement.style.setProperty("--bg-b", b);
    document.querySelector('meta[name="theme-color"]').setAttribute("content", a);
  }

  function renderDetail({ error = false, anim = "" } = {}) {
    const i = current;
    const loc = settings.locations[i];
    const entry = weather[i];
    renderTabs();

    if (!entry) {
      setBackground(null);
      bodyEl.innerHTML = error
        ? `<div class="error-box"><p>Couldn't load the weather for ${esc(loc.name)}.</p><button id="retry">Try again</button></div>`
        : `<div class="hero"><div class="hero-name">${esc(loc.name)}</div><div class="hero-main"><span class="skeleton" style="width:180px;height:96px"></span></div></div>
           <div class="panel"><span class="skeleton" style="width:60%;height:20px"></span></div>
           <div class="panel"><span class="skeleton" style="width:100%;height:120px"></span></div>`;
      $("#retry")?.addEventListener("click", () => refreshCurrent(true));
      return;
    }

    const d = entry.data;
    const c = d.current;
    const h = d.hourly;
    const dy = d.daily;
    const u = unitLabels();
    setBackground(c.weather_code, c.is_day);
    const start = currentHourIndex(d);

    // Rain chart: next 12 hours
    const rain = rainOutlook(d);
    let bars = "";
    for (let k = start; k < Math.min(start + 12, h.time.length); k++) {
      const prob = h.precipitation_probability[k] ?? 0;
      const wet = (h.precipitation[k] ?? 0) > 0;
      bars += `
        <div class="rain-bar" title="${fmtTime.format(asUTC(h.time[k]))}: ${prob}% · ${fmtRain(h.precipitation[k])}">
          <em>${prob >= 10 ? prob + "%" : ""}</em>
          <div class="bar-track"><div class="bar-fill ${wet ? "wet" : ""}" style="height:${Math.max(prob, 3)}%"></div></div>
          <small>${k === start ? "Now" : hourLabel(h.time[k])}</small>
        </div>`;
    }

    // Hourly strip: next 24 hours
    let hours = "";
    for (let k = start; k < Math.min(start + 24, h.time.length); k++) {
      const prob = h.precipitation_probability[k] ?? 0;
      hours += `
        <div class="hour ${k === start ? "now" : ""}">
          <span class="h-time">${k === start ? "Now" : hourLabel(h.time[k])}</span>
          ${icon(h.weather_code[k], h.is_day[k])}
          <span class="h-temp">${deg(k === start ? c.temperature_2m : h.temperature_2m[k])}</span>
          <span class="h-rain">${prob >= 10 ? prob + "%" : ""}</span>
        </div>`;
    }

    // Daily: today + next 3 days
    const N = 4;
    const lo = Math.min(...dy.temperature_2m_min.slice(0, N));
    const hi = Math.max(...dy.temperature_2m_max.slice(0, N));
    const span = Math.max(1, hi - lo);
    const days = dy.time.slice(0, N).map((t, k) => {
      const min = dy.temperature_2m_min[k], max = dy.temperature_2m_max[k];
      const left = ((min - lo) / span) * 100;
      const width = Math.max(4, ((max - min) / span) * 100);
      const nowDot = k === 0 ? `<i style="left:${Math.min(100, Math.max(0, ((c.temperature_2m - lo) / span) * 100))}%"></i>` : "";
      return `
        <div class="day-row">
          <span class="day-name">${k === 0 ? "Today" : fmtDay.format(asUTC(t))}</span>
          ${icon(dy.weather_code[k], 1)}
          <span class="day-rain">${dy.precipitation_probability_max[k] ?? 0}%<small>${fmtRain(dy.precipitation_sum[k])}</small></span>
          <span class="day-min">${deg(min)}</span>
          <div class="range"><span style="left:${left}%;width:${width}%;background:linear-gradient(90deg,${tempColor(min)},${tempColor(max)})"></span>${nowDot}</div>
          <span class="day-max">${deg(max)}</span>
        </div>`;
    }).join("");

    const uv = dy.uv_index_max[0] ?? 0;
    const updated = new Date(entry.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    bodyEl.className = "detail-body";
    if (anim) { void bodyEl.offsetWidth; bodyEl.classList.add(anim); } // restart the slide animation
    bodyEl.innerHTML = `
      <section class="hero">
        <div class="hero-name">${esc(loc.name)}</div>
        <div class="hero-sub">${esc([loc.admin, loc.country].filter(Boolean).join(", "))} · ${localNow(d)}</div>
        <div class="hero-main">
          <div class="hero-icon">${icon(c.weather_code, c.is_day)}</div>
          <div class="hero-temp">${deg(c.temperature_2m)}</div>
        </div>
        <div class="hero-cond">${describe(c.weather_code)[0]}</div>
        <div class="hero-hl">H ${deg(dy.temperature_2m_max[0])} · L ${deg(dy.temperature_2m_min[0])} · Feels like ${deg(c.apparent_temperature)}</div>
      </section>

      <section class="panel">
        <h3 class="panel-title">${PANEL_ICONS.rain} Rain · next 12 hours</h3>
        <div class="rain-summary">${rain.headline}</div>
        <div class="rain-sub">${rain.detail} · ${fmtRain(dy.precipitation_sum[0])} today</div>
        <div class="rain-chart">${bars}</div>
      </section>

      <section class="panel">
        <h3 class="panel-title">${PANEL_ICONS.clock} Hourly</h3>
        <div class="hourly">${hours}</div>
      </section>

      <section class="panel">
        <h3 class="panel-title">${PANEL_ICONS.cal} Next 3 days</h3>
        ${days}
      </section>

      <section class="stats">
        <div class="panel">
          <h3 class="panel-title">Wind</h3>
          <div class="stat-value">${Math.round(c.wind_speed_10m)}<small>${u.wind}</small>
            <svg class="wind-arrow" viewBox="0 0 24 24" style="transform:rotate(${(c.wind_direction_10m + 180) % 360}deg)"><path fill="currentColor" d="M12 2 5 20l7-4 7 4z"/></svg>
          </div>
          <div class="stat-note">From the ${compass(c.wind_direction_10m)} · gusts ${Math.round(c.wind_gusts_10m ?? 0)} ${u.wind}</div>
        </div>
        <div class="panel">
          <h3 class="panel-title">Humidity</h3>
          <div class="stat-value">${Math.round(c.relative_humidity_2m)}<small>%</small></div>
          <div class="stat-note">Feels like ${deg(c.apparent_temperature)}</div>
        </div>
        <div class="panel">
          <h3 class="panel-title">UV index</h3>
          <div class="stat-value">${Math.round(uv)}</div>
          <div class="stat-note">${uvLabel(uv)} today</div>
        </div>
        <div class="panel">
          <h3 class="panel-title">Sun</h3>
          <div class="stat-value" style="font-size:20px">↑ ${fmtTime.format(asUTC(dy.sunrise[0]))}</div>
          <div class="stat-note" style="font-size:14px">↓ ${fmtTime.format(asUTC(dy.sunset[0]))}</div>
        </div>
      </section>

      <p class="updated">Updated ${updated} · Swipe to switch places</p>`;
  }

  function render(i, opts = {}) {
    if (current === -1) renderCard(i, opts);
    else if (i === current) renderDetail(opts);
  }

  function openDetail(i, { push = false, anim = "" } = {}) {
    const fromHome = push || Boolean(history.state?.fromHome);
    const state = { detail: i, fromHome };
    if (push) history.pushState(state, "", `#/place/${i}`);
    else history.replaceState(state, "", `#/place/${i}`);
    showDetail(i, anim);
  }

  function showDetail(i, anim = "") {
    current = i;
    $("#home").hidden = true;
    detailEl.hidden = false;
    renderDetail({ anim });
    if (!anim) window.scrollTo(0, 0);
    refreshCurrent(false);
  }

  function showHome() {
    current = -1;
    detailEl.hidden = true;
    $("#home").hidden = false;
    setBackground(null);
    buildHome();
  }

  function refreshCurrent(force) {
    const i = current;
    const btn = $("#refresh-btn");
    btn.classList.add("spinning");
    return fetchWeather(i, { force })
      .then(() => { if (current === i) renderDetail(); })
      .catch(() => {
        if (current !== i) return;
        if (!weather[i]) renderDetail({ error: true });
        else toast(navigator.onLine === false ? "You're offline — showing saved weather" : "Couldn't refresh right now");
      })
      .finally(() => btn.classList.remove("spinning"));
  }

  function switchTo(i, dir) {
    if (i === current || i < 0 || i > 2) return;
    openDetail(i, { anim: dir > 0 ? "slide-left" : "slide-right" });
  }

  // Header interactions
  $("#back-btn").addEventListener("click", () => {
    if (history.state?.fromHome) history.back();
    else { history.replaceState(null, "", location.pathname + location.search); showHome(); }
  });
  $("#refresh-btn").addEventListener("click", () => refreshCurrent(true));
  $("#tabs").addEventListener("click", (e) => {
    const t = e.target.closest(".tab");
    if (t) switchTo(Number(t.dataset.index), Number(t.dataset.index) - current);
  });
  window.addEventListener("scroll", () => {
    document.querySelector(".detail-header").classList.toggle("scrolled", window.scrollY > 8);
  }, { passive: true });

  // Swipe left/right between places
  let touch = null;
  detailEl.addEventListener("touchstart", (e) => {
    if (e.target.closest(".hourly")) return; // let the hourly strip scroll
    const t = e.touches[0];
    touch = { x: t.clientX, y: t.clientY, time: Date.now() };
  }, { passive: true });
  detailEl.addEventListener("touchend", (e) => {
    if (!touch) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) switchTo(current + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  }, { passive: true });

  // Routing (hash keeps Android back button working)
  function route() {
    const m = location.hash.match(/^#\/place\/([0-2])$/);
    if (m) showDetail(Number(m[1]));
    else showHome();
  }
  window.addEventListener("popstate", route);

  // ---------------------------------------------------------------------------
  // EDITOR sheet
  // ---------------------------------------------------------------------------
  const sheet = $("#sheet");
  const backdrop = $("#sheet-backdrop");
  const searchPanel = $("#search-panel");
  const searchInput = $("#search-input");
  const results = $("#search-results");
  let editingSlot = -1;
  let settingsDirty = false;

  function openSheet() {
    renderSlots();
    renderUnits();
    sheet.hidden = false;
    backdrop.hidden = false;
  }
  function closeSheet() {
    sheet.hidden = true;
    backdrop.hidden = true;
    closeSearch();
    if (settingsDirty) {
      settingsDirty = false;
      saveSettings();
      settings.locations.forEach((_, i) => loadCached(i));
      showHome();
      refreshAll();
    }
  }
  function renderSlots() {
    $("#sheet-slots").innerHTML = settings.locations
      .map((l, i) => `
        <button class="slot ${i === editingSlot ? "active" : ""}" data-index="${i}">
          <span class="slot-num">${i + 1}</span>
          <span class="slot-text"><b>${esc(l.name)}</b><span>${esc([l.admin, l.country].filter(Boolean).join(", "))}</span></span>
          <span class="slot-change">Change</span>
        </button>`)
      .join("");
  }
  function renderUnits() {
    document.querySelectorAll("#units-toggle button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.units === settings.units)));
  }
  function openSearch(i) {
    editingSlot = i;
    renderSlots();
    searchPanel.hidden = false;
    searchInput.value = "";
    results.innerHTML = "";
    searchInput.focus();
  }
  function closeSearch() {
    editingSlot = -1;
    searchPanel.hidden = true;
    renderSlots();
  }
  function setSlot(loc) {
    settings.locations[editingSlot] = loc;
    settingsDirty = true;
    toast(`Slot ${editingSlot + 1} is now ${loc.name}`);
    closeSearch();
  }

  $("#edit-btn").addEventListener("click", openSheet);
  $("#sheet-done").addEventListener("click", closeSheet);
  backdrop.addEventListener("click", closeSheet);
  $("#search-cancel").addEventListener("click", closeSearch);
  $("#sheet-slots").addEventListener("click", (e) => {
    const s = e.target.closest(".slot");
    if (s) openSearch(Number(s.dataset.index));
  });
  $("#units-toggle").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || b.dataset.units === settings.units) return;
    settings.units = b.dataset.units;
    settingsDirty = true;
    renderUnits();
  });

  let searchTimer = 0;
  let searchSeq = 0;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) { results.innerHTML = ""; return; }
    searchTimer = setTimeout(() => runSearch(q), 250);
  });
  function runSearch(q) {
    const seq = ++searchSeq;
    const url = `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: q, count: "8", language: "en", format: "json" })}`;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (seq !== searchSeq) return;
        const list = j.results || [];
        if (!list.length) { results.innerHTML = `<li class="empty">No places found for “${esc(q)}”</li>`; return; }
        results.innerHTML = list
          .map((r, k) => `<li><button data-k="${k}"><b>${esc(r.name)}</b><span>${esc([r.admin1, r.country].filter(Boolean).join(", "))}</span></button></li>`)
          .join("");
        results.onclick = (e) => {
          const b = e.target.closest("button");
          if (!b) return;
          const r = list[Number(b.dataset.k)];
          setSlot({ name: r.name, admin: r.admin1 || "", country: r.country || "", lat: r.latitude, lon: r.longitude });
        };
      })
      .catch(() => { if (seq === searchSeq) results.innerHTML = `<li class="empty">Search is unavailable — check your connection</li>`; });
  }

  $("#geo-btn").addEventListener("click", () => {
    if (!navigator.geolocation) return toast("Location isn't available on this device");
    toast("Finding you…");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = +pos.coords.latitude.toFixed(4), lon = +pos.coords.longitude.toFixed(4);
        let loc = { name: "My location", admin: "", country: "", lat, lon };
        try {
          const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
          const j = await r.json();
          const name = j.city || j.locality;
          if (name) loc = { name, admin: j.principalSubdivision || "", country: j.countryName || "", lat, lon };
        } catch { /* keep generic name */ }
        if (editingSlot >= 0) setSlot(loc);
      },
      () => toast("Couldn't get your location — check permissions"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });

  // ---------------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------------
  let toastTimer = 0;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  settings.locations.forEach((_, i) => loadCached(i));
  route();
  refreshAll();

  // Refresh when the app comes back to the foreground; tick local clocks.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshAll();
  });
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (current === -1) settings.locations.forEach((_, i) => weather[i] && renderCard(i));
  }, 60 * 1000);

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
