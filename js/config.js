// ── Config ──
const LS_KEY_V3 = "bancoPrompts_v3";
const LS_KEY_V2 = "bancoPrompts_v2";

const LS_CUSTOM_CATS = "bancoPrompts_customCats";
const LS_CUSTOM_SUBCATS = "bancoPrompts_customSubcats";
const LS_CUSTOM_FORMATOS = "bancoPrompts_customFormatos";
const LS_CUSTOM_STATUS = "bancoPrompts_customStatus";
const LS_CUSTOM_AIS = "bancoPrompts_customAis";
const LS_UI_VERSION = "bancoPrompts_uiVersion";

// ── UI rollout flag (legacy → redesign) ──
const UI_VERSIONS = {
  legacy: "legacy",
  redesign: "redesign",
};

const DEFAULT_UI_VERSION = UI_VERSIONS.legacy;

function readUIVersion() {
  try {
    const saved = localStorage.getItem(LS_UI_VERSION);
    return Object.values(UI_VERSIONS).includes(saved) ? saved : DEFAULT_UI_VERSION;
  } catch (e) {
    return DEFAULT_UI_VERSION;
  }
}

let uiVersion = readUIVersion(); // 'legacy' | 'redesign'

function setUIVersion(nextVersion) {
  if (!Object.values(UI_VERSIONS).includes(nextVersion)) return;
  uiVersion = nextVersion;
  try { localStorage.setItem(LS_UI_VERSION, nextVersion); } catch (e) { }
}

// Plano de rollout controlado por fases do redesign
const UI_ROLLOUT_PHASES = [
  "1. shell + tokens",
  "2. filtros + toolbar",
  "3. cards + KPIs",
  "4. polimento/responsividade/acessibilidade",
];

// Checklist de regressão manual para cada fase
const MANUAL_REGRESSION_CHECKLIST = [
  "criar/editar/excluir prompt",
  "copiar/duplicar",
  "importar/exportar",
  "sincronização",
  "busca/filtros/ordenação",
  "tema claro/escuro",
];

// ── Default values (fallback) ──
const DEFAULT_CATS = [
  { id: "todos", name: "Todos os Prompts", icon: "🗂️", desc: "Todos os prompts em um lugar" },
  { id: "analise", name: "Análise por Eixo", icon: "⚡", desc: "Análise detalhada por eixo" },
  { id: "triagem", name: "Triagem", icon: "🧭", desc: "Prompts para triagem e leitura inicial" },
  { id: "diligencias", name: "Diligências", icon: "📬", desc: "Reanálises e pós-diligência" },
  { id: "geral", name: "Análise", icon: "🏛️", desc: "Análise geral de processos" },
  { id: "informacao", name: "Informação Técnica", icon: "📝", desc: "Templates e prompts para redação de IT" },
  { id: "especiais", name: "Casos Especiais", icon: "🚨", desc: "Cenários específicos e exceções" },
  { id: "arquivados", name: "Arquivados", icon: "🗃️", desc: "Prompts antigos ou substituídos" },
];

const DEFAULT_SUBCATS = [
  { id: "eixo1", name: "Eixo 1", desc: "Qualidade de Segurado do RPPS" },
  { id: "eixo3", name: "Eixo 3", desc: "Requisitos / Tempo / Compensação" },
  { id: "eixo4", name: "Eixo 4", desc: "Composição e Cálculo do Benefício" },
  { id: "eixo5", name: "Eixo 5", desc: "Implantação do Benefício" },
];

const DEFAULT_FORMATO_LIST = [
  { id: "compacto", label: "⚡ Compacto" },
  { id: "mestre", label: "🧠 Mestre" },
  { id: "paragrafo", label: "✍️ Parágrafo" },
  { id: "pente-fino", label: "🔬 Pente-fino" },
  { id: "redacao-final", label: "📄 Redação Final" },
  { id: "checklist", label: "☑️ Checklist" },
];

const DEFAULT_STATUS_LIST = [
  { id: "teste", label: "🧪 Em teste" },
  { id: "homologado", label: "✅ Homologado" },
  { id: "variante", label: "🔁 Variante" },
  { id: "arquivado", label: "🗃️ Arquivado" },
];

const DEFAULT_AI_LIST = [
  { id: "gpt", label: "GPT" },
  { id: "gemini", label: "Gemini" },
  { id: "claude", label: "Claude" },
];

// ── Live mutable arrays (modified at runtime) ──
let CATS = DEFAULT_CATS.map(x => ({ ...x }));
let SUBCATS = DEFAULT_SUBCATS.map(x => ({ ...x }));
let FORMATO_LIST = DEFAULT_FORMATO_LIST.map(x => ({ ...x }));
let STATUS_LIST = DEFAULT_STATUS_LIST.map(x => ({ ...x }));
let AI_LIST = DEFAULT_AI_LIST.map(x => ({ ...x }));

// Computed lookups (rebuilt after load)
let FORMATO_LABELS = {};
let STATUS_LABELS = {};

function rebuildLabelMaps() {
  FORMATO_LABELS = {};
  FORMATO_LIST.forEach(f => { FORMATO_LABELS[f.id] = f.label; });
  STATUS_LABELS = {};
  STATUS_LIST.forEach(s => { STATUS_LABELS[s.id] = s.label; });
}
rebuildLabelMaps();

let EDITABLE_CATS = CATS.filter(c => c.id !== "todos" && c.id !== "arquivados");

function rebuildEditableCats() {
  EDITABLE_CATS = CATS.filter(c => c.id !== "todos" && c.id !== "arquivados");
}

// ── Persistence helpers ──
function loadCustomMeta() {
  try {
    const raw = localStorage.getItem(LS_CUSTOM_CATS);
    if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) CATS.splice(0, CATS.length, ...arr); }
  } catch (e) { }
  try {
    const raw = localStorage.getItem(LS_CUSTOM_SUBCATS);
    if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) SUBCATS.splice(0, SUBCATS.length, ...arr); }
  } catch (e) { }
  try {
    const raw = localStorage.getItem(LS_CUSTOM_FORMATOS);
    if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) FORMATO_LIST.splice(0, FORMATO_LIST.length, ...arr); }
  } catch (e) { }
  try {
    const raw = localStorage.getItem(LS_CUSTOM_STATUS);
    if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) STATUS_LIST.splice(0, STATUS_LIST.length, ...arr); }
  } catch (e) { }
  try {
    const raw = localStorage.getItem(LS_CUSTOM_AIS);
    if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) AI_LIST.splice(0, AI_LIST.length, ...arr); }
  } catch (e) { }
  rebuildLabelMaps();
  rebuildEditableCats();
}

function saveCustomMeta() {
  lsSet(LS_CUSTOM_CATS, JSON.stringify(CATS));
  lsSet(LS_CUSTOM_SUBCATS, JSON.stringify(SUBCATS));
  lsSet(LS_CUSTOM_FORMATOS, JSON.stringify(FORMATO_LIST));
  lsSet(LS_CUSTOM_STATUS, JSON.stringify(STATUS_LIST));
  lsSet(LS_CUSTOM_AIS, JSON.stringify(AI_LIST));
  rebuildLabelMaps();
  rebuildEditableCats();
  if (typeof data !== "undefined" && typeof save === "function") save(data);
}
