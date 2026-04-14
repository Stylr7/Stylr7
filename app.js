const state = {
  loading: false,
  rows: [],
  filtered: [],
  selected: null,
  controls: {
    search: "",
    game: "all",
    region: "all",
    sortBy: "region",
    sortDir: "desc",
  },
  view: {
    textScale: 1,
    uiScale: 1,
  },
};

const fmt = new Intl.NumberFormat("en-US");

const els = {
  root: document.documentElement,
  statsGrid: document.getElementById("statsGrid"),
  tableBody: document.getElementById("tableBody"),
  tableState: document.getElementById("tableState"),
  regionFilter: document.getElementById("regionFilter"),
  gameFilter: document.getElementById("gameFilter"),
  sortBy: document.getElementById("sortBy"),
  sortDir: document.getElementById("sortDir"),
  search: document.getElementById("search"),
  drawer: document.getElementById("detailsDrawer"),
  drawerBody: document.getElementById("drawerBody"),
  drawerTitle: document.getElementById("drawerTitle"),
  backdrop: document.getElementById("backdrop"),
  baseUrl: document.getElementById("baseUrl"),
  workerConfig: document.getElementById("workerConfig"),
  closeDrawer: document.getElementById("closeDrawer"),
  textDown: document.getElementById("textDown"),
  textUp: document.getElementById("textUp"),
  textReset: document.getElementById("textReset"),
  zoomDown: document.getElementById("zoomDown"),
  zoomUp: document.getElementById("zoomUp"),
  zoomReset: document.getElementById("zoomReset"),
  textValue: document.getElementById("textValue"),
  zoomValue: document.getElementById("zoomValue"),
};

const STORAGE_KEYS = {
  worker: "xlab_worker_url",
  textScale: "xlab_text_scale",
  uiScale: "xlab_ui_scale",
};

const MOCK = {
  jarox: [
    { player_id: "p1", player_name: "Ari Vox", best_score: 9120, region_id: "Azura", region_name: "Blake Sea", total_games: 14 },
    { player_id: "p2", player_name: "Nova Grid", best_score: 7840, region_id: "Azura", region_name: "Blake Sea", total_games: 8 },
    { player_id: "p3", player_name: "Kuro Lane", best_score: 6320, region_id: "Zenith", region_name: "Nautilus", total_games: 6 },
  ],
  olyx: [
    { player_id: "p4", player_name: "Sora Flux", best_score: 10240, region_id: "Zenith", region_name: "Nautilus", total_games: 10 },
    { player_id: "p5", player_name: "Mina Loop", best_score: 7260, region_id: "Orion", region_name: "Bay City", total_games: 7 },
    { player_id: "p6", player_name: "Rex Io", best_score: 6930, region_id: "Orion", region_name: "Bay City", total_games: 4 },
  ],
};

function clamp(num, min, max) {
  return Math.min(max, Math.max(min, num));
}

function resolveWorkerUrl() {
  const fromStorage = localStorage.getItem(STORAGE_KEYS.worker);
  if (fromStorage) return fromStorage;

  const params = new URLSearchParams(window.location.search);
  const direct = params.get("worker_url");
  if (direct) return direct;

  const encoded = params.get("worker_key");
  if (encoded) {
    try {
      return atob(encoded);
    } catch {
      return "";
    }
  }

  return "http://127.0.0.1:8787";
}

function applyViewScale() {
  els.root.style.setProperty("--text-scale", String(state.view.textScale));
  els.root.style.setProperty("--ui-scale", String(state.view.uiScale));
  els.textValue.textContent = `${Math.round(state.view.textScale * 100)}%`;
  els.zoomValue.textContent = `${Math.round(state.view.uiScale * 100)}%`;
}

function updateTextScale(next) {
  state.view.textScale = clamp(next, 0.85, 1.4);
  localStorage.setItem(STORAGE_KEYS.textScale, String(state.view.textScale));
  applyViewScale();
}

function updateUiScale(next) {
  state.view.uiScale = clamp(next, 0.85, 1.2);
  localStorage.setItem(STORAGE_KEYS.uiScale, String(state.view.uiScale));
  applyViewScale();
}

async function fetchNamespace(baseUrl, namespace) {
  const prefix = namespace === "olyx" ? "/olyx" : "";
  const url = `${baseUrl.replace(/\/$/, "")}${prefix}/leaderboard?mode=global&limit=100&page=1`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.rows) ? data.rows : [];
  } catch {
    return namespace === "olyx" ? MOCK.olyx : MOCK.jarox;
  }
}

function normalizeRows(jaroxRows, olyxRows) {
  const regionMap = new Map();

  const merge = (row, gameType) => {
    const region = row.region_id || "UNKNOWN_REGION";
    const location = row.region_name || "Unknown Location";
    const key = `${gameType}:${region}`;

    if (!regionMap.has(key)) {
      regionMap.set(key, {
        key,
        region,
        location,
        gameType,
        totalPlays: 0,
        highestScore: 0,
        players: [],
      });
    }

    const target = regionMap.get(key);
    const plays = Number(row.total_games || 0);
    const score = Number(row.best_score || 0);
    const name = row.player_name || "Unknown Player";

    target.totalPlays += plays;
    target.highestScore = Math.max(target.highestScore, score);
    target.players.push({
      name,
      score,
      plays,
      playerId: row.player_id || "",
      updatedAt: row.updated_at || null,
    });
  };

  jaroxRows.forEach((row) => merge(row, "jarox"));
  olyxRows.forEach((row) => merge(row, "olyx"));

  return [...regionMap.values()].map((region) => {
    region.players.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return region;
  });
}

function computeStats(rows) {
  const olyx = rows.filter((r) => r.gameType === "olyx").reduce((acc, r) => acc + r.totalPlays, 0);
  const jarox = rows.filter((r) => r.gameType === "jarox").reduce((acc, r) => acc + r.totalPlays, 0);
  const regions = new Set(rows.map((r) => r.region)).size;
  const players = new Set(rows.flatMap((r) => r.players.map((p) => p.name))).size;

  return {
    olyx,
    jarox,
    total: olyx + jarox,
    regions,
    players,
  };
}

function renderStats(stats) {
  const cards = [
    ["Olyx Total Plays", stats.olyx],
    ["JaroX Total Plays", stats.jarox],
    ["Combined Plays", stats.total],
    ["Active Regions", stats.regions],
    ["Players Tracked", stats.players],
  ];

  els.statsGrid.innerHTML = cards
    .map(
      ([label, value]) => `
      <article class="stat-card">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${fmt.format(value)}</div>
      </article>
    `
    )
    .join("");
}

function applyFilters() {
  const { search, game, region, sortBy, sortDir } = state.controls;
  const needle = search.trim().toLowerCase();

  let rows = [...state.rows].filter((row) => {
    const byGame = game === "all" || row.gameType === game;
    const byRegion = region === "all" || row.region === region;
    const inSearch =
      !needle ||
      row.region.toLowerCase().includes(needle) ||
      row.location.toLowerCase().includes(needle) ||
      row.players.some((p) => p.name.toLowerCase().includes(needle));

    return byGame && byRegion && inSearch;
  });

  const dir = sortDir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    if (sortBy === "score") return dir * (a.highestScore - b.highestScore);
    if (sortBy === "plays") return dir * (a.totalPlays - b.totalPlays);
    if (sortBy === "player") return dir * (a.players[0]?.name || "").localeCompare(b.players[0]?.name || "");
    return dir * a.region.localeCompare(b.region);
  });

  state.filtered = rows;
}

function renderTable() {
  applyFilters();

  if (state.loading) {
    els.tableBody.innerHTML = "";
    els.tableState.textContent = "Loading gameplay feed...";
    els.tableState.style.display = "block";
    return;
  }

  if (!state.rows.length) {
    els.tableBody.innerHTML = "";
    els.tableState.textContent = "No worker data yet. Connect your worker URL to begin.";
    els.tableState.style.display = "block";
    return;
  }

  if (!state.filtered.length) {
    els.tableBody.innerHTML = "";
    els.tableState.textContent = "No regions match your filters.";
    els.tableState.style.display = "block";
    return;
  }

  els.tableState.style.display = "none";
  els.tableBody.innerHTML = state.filtered
    .map(
      (region) => `
      <tr data-key="${region.key}">
        <td><strong>${region.region}</strong></td>
        <td>${region.location}</td>
        <td><span class="badge ${region.gameType}">${region.gameType === "olyx" ? "Olyx" : "JaroX"}</span></td>
        <td>${fmt.format(region.totalPlays)}</td>
        <td class="muted">${region.players.slice(0, 3).map((p) => p.name).join(", ") || "—"}</td>
        <td>${fmt.format(region.highestScore)}</td>
        <td><button class="action-btn" data-action="view" data-key="${region.key}">View Details</button></td>
      </tr>
    `
    )
    .join("");
}

function renderDetails(key) {
  const region = state.rows.find((r) => r.key === key);
  if (!region) return;

  state.selected = region;
  els.drawerTitle.textContent = `${region.region} · ${region.gameType === "olyx" ? "Olyx" : "JaroX"}`;

  const meta = [
    ["Region", region.region],
    ["Location", region.location],
    ["Game Type", region.gameType === "olyx" ? "Olyx" : "JaroX"],
    ["Total Plays", fmt.format(region.totalPlays)],
    ["Highest Score", fmt.format(region.highestScore)],
  ];

  const players = region.players
    .map(
      (p, idx) => `
      <div class="player-item">
        <div class="rank-dot">${idx + 1}</div>
        <div>
          <strong>${p.name}</strong>
          <div class="muted">Plays: ${fmt.format(p.plays)}</div>
        </div>
        <strong>${fmt.format(p.score)}</strong>
      </div>
    `
    )
    .join("");

  els.drawerBody.innerHTML = `
    <section class="detail-card">
      ${meta
        .map(
          ([k, v]) =>
            `<div class="meta-row"><span class="muted">${k}</span><strong>${v || "—"}</strong></div>`
        )
        .join("")}
    </section>
    <section class="detail-card">
      <h3 class="section-title">Player Rankings</h3>
      <div class="player-list">${players || '<div class="player-item"><span class="muted">No players available.</span></div>'}</div>
    </section>
  `;

  els.backdrop.hidden = false;
  els.drawer.classList.add("open");
  els.drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  els.drawer.classList.remove("open");
  els.drawer.setAttribute("aria-hidden", "true");
  els.backdrop.hidden = true;
}

function populateRegionFilter(rows) {
  const options = ['<option value="all">All Regions</option>'];
  [...new Set(rows.map((r) => r.region))]
    .sort((a, b) => a.localeCompare(b))
    .forEach((region) => options.push(`<option value="${region}">${region}</option>`));

  els.regionFilter.innerHTML = options.join("");
}

async function loadData(baseUrl) {
  state.loading = true;
  renderTable();

  const [jaroxRows, olyxRows] = await Promise.all([fetchNamespace(baseUrl, "jarox"), fetchNamespace(baseUrl, "olyx")]);

  state.rows = normalizeRows(jaroxRows, olyxRows);
  state.loading = false;
  renderStats(computeStats(state.rows));
  populateRegionFilter(state.rows);
  renderTable();
}

function bindControls() {
  const update = () => {
    state.controls.search = els.search.value;
    state.controls.game = els.gameFilter.value;
    state.controls.region = els.regionFilter.value;
    state.controls.sortBy = els.sortBy.value;
    state.controls.sortDir = els.sortDir.value;
    renderTable();
  };

  [els.search, els.gameFilter, els.regionFilter, els.sortBy, els.sortDir].forEach((el) => {
    el.addEventListener("input", update);
    el.addEventListener("change", update);
  });

  els.tableBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action='view']");
    const row = event.target.closest("tr[data-key]");
    const key = button?.dataset.key || row?.dataset.key;
    if (key) renderDetails(key);
  });

  els.closeDrawer.addEventListener("click", closeDrawer);
  els.backdrop.addEventListener("click", closeDrawer);

  els.workerConfig.addEventListener("submit", (event) => {
    event.preventDefault();
    const url = els.baseUrl.value.trim();
    if (!url) return;
    localStorage.setItem(STORAGE_KEYS.worker, url);
    loadData(url);
  });

  els.textDown.addEventListener("click", () => updateTextScale(state.view.textScale - 0.05));
  els.textUp.addEventListener("click", () => updateTextScale(state.view.textScale + 0.05));
  els.textReset.addEventListener("click", () => updateTextScale(1));

  els.zoomDown.addEventListener("click", () => updateUiScale(state.view.uiScale - 0.05));
  els.zoomUp.addEventListener("click", () => updateUiScale(state.view.uiScale + 0.05));
  els.zoomReset.addEventListener("click", () => updateUiScale(1));
}

function init() {
  bindControls();

  const storedTextScale = Number(localStorage.getItem(STORAGE_KEYS.textScale));
  const storedUiScale = Number(localStorage.getItem(STORAGE_KEYS.uiScale));

  state.view.textScale = Number.isFinite(storedTextScale) && storedTextScale > 0 ? clamp(storedTextScale, 0.85, 1.4) : 1;
  state.view.uiScale = Number.isFinite(storedUiScale) && storedUiScale > 0 ? clamp(storedUiScale, 0.85, 1.2) : 1;

  applyViewScale();

  const workerUrl = resolveWorkerUrl();
  els.baseUrl.value = workerUrl;

  renderStats({ olyx: 0, jarox: 0, total: 0, regions: 0, players: 0 });
  renderTable();
  loadData(workerUrl);
}

init();
