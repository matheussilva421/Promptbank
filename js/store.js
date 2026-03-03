// ── State ──
let S = {
  cat: "todos",
  subcat: "",         // for analise
  filterFormato: "",
  filterStatus: "",
  filterTags: [],
  filterAis: [],
  search: "",
  sideSearch: "",
  openPromptId: null,
  editingId: null,
  promptSort: "updated-desc",
  catOrder: CATS.map(c => c.id),
  manualOrder: {},
  draggingPromptId: null,
  suppressNextCardClick: false,
  lastDeletedPrompt: null,
  undoTimeout: null
};

// ── Render-time context (set once per renderMain cycle, read by buildCard) ──
let _renderCtx = { lastSync: "0", hasRemote: false };
let _highlightRegexes = [];

const UI_STATE_KEY = "bancoPrompts_uiState_v2";
const CAT_ORDER_KEY = "bancoPrompts_catOrder_v1";
const MANUAL_ORDER_KEY = "bancoPrompts_manualOrder_v1";
const SUBCAT_ORDER_KEY = "bancoPrompts_subcatOrder_v1";

function lsSet(key, val) { try { localStorage.setItem(key, val); } catch (e) { console.warn("localStorage quota exceeded:", key); } }

// Load custom metadata early (before anything uses CATS/SUBCATS/etc.)
loadCustomMeta();

function saveSubcatOrder() { lsSet(SUBCAT_ORDER_KEY, JSON.stringify(SUBCATS.map(sc => sc.id))); }
function loadSubcatOrder() {
  try {
    const raw = localStorage.getItem(SUBCAT_ORDER_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const validIds = SUBCATS.map(c => c.id);
    const filtered = parsed.filter(id => validIds.includes(id));
    validIds.forEach(id => { if (!filtered.includes(id)) filtered.push(id); });

    const sorted = [];
    const map = new Map(SUBCATS.map(sc => [sc.id, sc]));
    filtered.forEach(id => { if (map.has(id)) sorted.push(map.get(id)); });
    SUBCATS.splice(0, SUBCATS.length, ...sorted);
  } catch (e) { }
}

function saveUIState() {
  lsSet(UI_STATE_KEY, JSON.stringify({
    cat: S.cat,
    subcat: S.cat === "analise" ? S.subcat : "",
    promptSort: S.promptSort
  }));
}

function loadUIState() {
  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    if (!raw) return;
    const st = JSON.parse(raw);
    if (st?.cat && CATS.some(c => c.id === st.cat)) S.cat = st.cat;
    if (st?.promptSort && ["updated-desc", "title-asc", "manual"].includes(st.promptSort)) S.promptSort = st.promptSort;
    if (S.cat !== "analise") { S.subcat = ""; return; }
    if (st?.subcat && SUBCATS.some(sc => sc.id === st.subcat)) S.subcat = st.subcat;
  } catch (e) { }
}

function saveCatOrder() { lsSet(CAT_ORDER_KEY, JSON.stringify(S.catOrder)); }
function loadCatOrder() {
  try {
    const raw = localStorage.getItem(CAT_ORDER_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const validIds = CATS.map(c => c.id);
    const filtered = parsed.filter(id => validIds.includes(id));
    validIds.forEach(id => { if (!filtered.includes(id)) filtered.push(id); });
    S.catOrder = filtered;
  } catch (e) { }
}
function saveManualOrder() { lsSet(MANUAL_ORDER_KEY, JSON.stringify(S.manualOrder || {})); }
function loadManualOrder() {
  try {
    const raw = localStorage.getItem(MANUAL_ORDER_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") S.manualOrder = parsed;
  } catch (e) { }
}
function currentManualKey() { return S.cat === "analise" && S.subcat ? `${S.cat}:${S.subcat}` : S.cat; }
function getManualIdsForCurrent() {
  const key = currentManualKey();
  const ids = S.manualOrder[key] || [];
  const exists = new Set(filteredPromptsBase().map(p => p.id));
  return ids.filter(id => exists.has(id));
}
function setManualIdsForCurrent(ids) {
  S.manualOrder[currentManualKey()] = ids.slice();
  saveManualOrder();
}