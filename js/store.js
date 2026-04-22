// ── State ──
let S = {
  cat: "todos",
  subcat: "",         // for analise
  filterFormato: "",
  filterStatus: "",
  filterPinned: false,
  filterTags: [],
  filterAis: [],
  search: "",
  sideSearch: "",
  openPromptId: null,
  editingId: null,
  promptSort: "updated-desc",
  promptSortByCat: {},
  catOrder: CATS.map(c => c.id),
  manualOrder: {},
  draggingPromptId: null,
  suppressNextCardClick: false,
  bulkSelectMode: false,
  selectedPromptIds: [],
  bulkMoveTarget: "",
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

// lsSet() is defined in utils.js (loaded before this file)

// Load custom metadata early (before anything uses CATS/SUBCATS/etc.)
loadCustomMeta();

function saveSubcatOrder() {
  lsSet(SUBCAT_ORDER_KEY, JSON.stringify(SUBCATS.map(sc => sc.id)));
  if (typeof data !== "undefined" && typeof save === "function") save(data);
}
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

function isValidPromptSort(sort) {
  return ["updated-desc", "uses-desc", "title-asc", "title-desc", "manual"].includes(sort);
}

function currentPromptSortKey() {
  return S.cat || "todos";
}

function getPromptSortForCurrentCat() {
  const fromMap = S.promptSortByCat[currentPromptSortKey()];
  return isValidPromptSort(fromMap) ? fromMap : "updated-desc";
}

function syncPromptSortForCurrentCat() {
  S.promptSort = getPromptSortForCurrentCat();
}

function setPromptSortForCurrentCat(sort) {
  if (!isValidPromptSort(sort)) return;
  S.promptSort = sort;
  S.promptSortByCat[currentPromptSortKey()] = sort;
}

function saveUIState() {
  setPromptSortForCurrentCat(S.promptSort);
  lsSet(UI_STATE_KEY, JSON.stringify({
    cat: S.cat,
    subcat: S.cat === "analise" ? S.subcat : "",
    promptSort: S.promptSort,
    promptSortByCat: S.promptSortByCat,
    search: S.search || "",
    sideSearch: S.sideSearch || "",
    filterFormato: Array.isArray(S.filterFormato) ? S.filterFormato : (S.filterFormato ? [S.filterFormato] : []),
    filterStatus: Array.isArray(S.filterStatus) ? S.filterStatus : (S.filterStatus ? [S.filterStatus] : []),
    filterTags: Array.isArray(S.filterTags) ? S.filterTags : [],
    filterAis: Array.isArray(S.filterAis) ? S.filterAis : []
  }));
}

function loadUIState() {
  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    if (!raw) return;
    const st = JSON.parse(raw);
    if (st?.cat && CATS.some(c => c.id === st.cat)) S.cat = st.cat;

    if (st?.promptSortByCat && typeof st.promptSortByCat === "object") {
      const cleaned = {};
      Object.entries(st.promptSortByCat).forEach(([catId, sort]) => {
        if (CATS.some(c => c.id === catId) && isValidPromptSort(sort)) cleaned[catId] = sort;
      });
      S.promptSortByCat = cleaned;
    }

    if (st?.promptSort && isValidPromptSort(st.promptSort)) {
      if (!S.promptSortByCat[currentPromptSortKey()]) S.promptSortByCat[currentPromptSortKey()] = st.promptSort;
    }

    S.search = typeof st?.search === "string" ? st.search : "";
    S.sideSearch = typeof st?.sideSearch === "string" ? st.sideSearch : "";
    S.filterFormato = Array.isArray(st?.filterFormato) ? st.filterFormato.filter(Boolean) : (st?.filterFormato ? [st.filterFormato] : []);
    S.filterStatus = Array.isArray(st?.filterStatus) ? st.filterStatus.filter(Boolean) : (st?.filterStatus ? [st.filterStatus] : []);
    S.filterTags = Array.isArray(st?.filterTags) ? st.filterTags.filter(Boolean) : [];
    S.filterAis = Array.isArray(st?.filterAis) ? st.filterAis.map(a => String(a).toLowerCase()).filter(Boolean) : [];

    syncPromptSortForCurrentCat();

    if (S.cat !== "analise") { S.subcat = ""; return; }
    if (st?.subcat && SUBCATS.some(sc => sc.id === st.subcat)) S.subcat = st.subcat;
  } catch (e) { }
}

function saveCatOrder() {
  lsSet(CAT_ORDER_KEY, JSON.stringify(S.catOrder));
  if (typeof data !== "undefined" && typeof save === "function") save(data);
}
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
function saveManualOrder() {
  lsSet(MANUAL_ORDER_KEY, JSON.stringify(S.manualOrder || {}));
  if (typeof data !== "undefined" && typeof save === "function") save(data);
}
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
