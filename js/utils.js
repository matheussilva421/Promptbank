// ── Utils ──
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
const nowISO = () => new Date().toISOString();
const esc = s => String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const normalizeTag = t => (t || "").trim().toLowerCase();
function lsSet(key, val) { try { localStorage.setItem(key, val); } catch (e) { console.warn("localStorage quota exceeded:", key); } }
const parseTags = s => [...new Set((s || "").split(",").map(normalizeTag).filter(Boolean))];
const fmt = iso => { try { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); } catch (e) { return "—"; } };
const norm = t => { if (!t) return ""; return t.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim(); };
const debounce = (fn, ms = 120) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };
const parseSimpleMarkdown = (text) => {
  if (!text) return "";
  let html = esc(text);
  // Headings
  html = html.replace(/^###\s+(.+)$/gm, '<h3 style="margin-top:1em;margin-bottom:.5em;">$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2 style="margin-top:1em;margin-bottom:.5em;">$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1 style="margin-top:1em;margin-bottom:.5em;">$1</h1>');
  // Bold (using lookbehind check for standard escaped tags so it won't trigger html injection if user uses **)
  html = html.replace(/\*\*(?!&[a-z#0-9]{1,6};)([^<]+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/\*(?!&[a-z#0-9]{1,6};)([^<]+?)\*/g, "<em>$1</em>");
  html = html.replace(/_([^\n_]+)_/g, '<em>$1</em>');
  // Code inline
  html = html.replace(/`([^`\n]+)`/g, '<code style="background:var(--bg3);padding:2px 4px;border-radius:4px;">$1</code>');
  return html;
};

function toast(msg, dur = 2600) {
  const el = document.createElement("div"); el.className = "toast-item"; el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => el.style.opacity = "0", dur - 300);
  setTimeout(() => el.remove(), dur);
  return el;
}

// Custom Modals to replace alert/confirm
function customConfirm(title, message) {
  return new Promise(resolve => {
    $("#customAlertTitle").textContent = title;
    $("#customAlertMessage").textContent = message;
    $("#btnCustomAlertCancel").style.display = "inline-flex";
    $("#customAlertOverlay").classList.add("show");

    const cleanup = () => {
      $("#btnCustomAlertConfirm").onclick = null;
      $("#btnCustomAlertCancel").onclick = null;
      $("#customAlertOverlay").classList.remove("show");
    };
    $("#btnCustomAlertConfirm").onclick = () => { cleanup(); resolve(true); };
    $("#btnCustomAlertCancel").onclick = () => { cleanup(); resolve(false); };
  });
}

function customAlert(title, message) {
  return new Promise(resolve => {
    $("#customAlertTitle").textContent = title;
    $("#customAlertMessage").textContent = message;
    $("#btnCustomAlertCancel").style.display = "none";
    $("#customAlertOverlay").classList.add("show");

    const cleanup = () => {
      $("#btnCustomAlertConfirm").onclick = null;
      $("#customAlertOverlay").classList.remove("show");
    };
    $("#btnCustomAlertConfirm").onclick = () => { cleanup(); resolve(true); };
  });
}

// ── Migration: v2 → v3 ──
function inferMeta(matrixName = "", promptTitle = "") {
  const text = (matrixName + " " + promptTitle).toLowerCase();
  let categoria = "analise", subcategoria = "";

  if (/diligên|pós.diligên|pos.diligen|reanáli|pós.juntada|pos.juntada/i.test(text)) { categoria = "diligencias"; }
  else if (/triagem|compacto|rápida|contextualiz|visão geral|leitura/i.test(text)) { categoria = "triagem"; }
  else if (/eixo.?1|qualidade de segurado/i.test(text)) { categoria = "analise"; subcategoria = "eixo1"; }
  else if (/eixo.?3|requisito|tempo de contribu|compensaç|aposentadoria vol|compulsória|invalidez/i.test(text)) { categoria = "analise"; subcategoria = "eixo3"; }
  else if (/eixo.?4|composiç|cálculo|integralidade|média.*10\.887|10\.887|vantagem transit|incorporaç/i.test(text)) { categoria = "analise"; subcategoria = "eixo4"; }
  else if (/eixo.?5|implantaç/i.test(text)) { categoria = "analise"; subcategoria = "eixo5"; }

  let formato = "";
  if (/compacto/i.test(text)) formato = "compacto";
  else if (/mestre/i.test(text)) formato = "mestre";
  else if (/pente.fino/i.test(text)) formato = "pente-fino";
  else if (/parágrafo|3 parágrafos/i.test(text)) formato = "paragrafo";
  else if (/redaç/i.test(text)) formato = "redacao-final";
  else if (/checklist/i.test(text)) formato = "checklist";

  return { categoria, subcategoria, formato };
}

function migrateV2toV3(v2) {
  const prompts = [];
  const seen = new Set();
  for (const cat of (v2.categories || [])) {
    const ais = Array.isArray(cat.ais) && cat.ais.length ? cat.ais : ["gpt"];
    if (cat.type === "work") {
      for (const mx of (cat.matrices || [])) {
        for (const ai of ais) {
          for (const p of (mx.prompts?.[ai] || [])) {
            if (!seen.has(p.id)) {
              seen.add(p.id);
              const meta = inferMeta(mx.name, p.title);
              prompts.push({
                id: p.id || uid(),
                title: p.title || "Sem título",
                text: p.text || "",
                tags: Array.isArray(p.tags) ? p.tags : [],
                note: p.note || "",
                ai: ai,
                categoria: meta.categoria,
                subcategoria: meta.subcategoria,
                formato: meta.formato,
                status: "teste",
                quandoUsar: "",
                naoUsarQuando: "",
                saidaEsperada: "",
                createdAt: p.updatedAt || nowISO(),
                updatedAt: p.updatedAt || nowISO(),
              });
            }
          }
        }
      }
    } else {
      for (const ai of ais) {
        for (const p of (cat.prompts?.[ai] || [])) {
          if (!seen.has(p.id)) {
            seen.add(p.id);
            const meta = inferMeta(cat.name, p.title);
            prompts.push({
              id: p.id || uid(),
              title: p.title || "Sem título",
              text: p.text || "",
              tags: Array.isArray(p.tags) ? p.tags : [],
              note: p.note || "",
              ai: ai,
              categoria: meta.categoria,
              subcategoria: meta.subcategoria,
              formato: meta.formato,
              status: "teste",
              quandoUsar: "",
              naoUsarQuando: "",
              saidaEsperada: "",
              createdAt: p.updatedAt || nowISO(),
              updatedAt: p.updatedAt || nowISO(),
            });
          }
        }
      }
    }
  }
  return { version: 3, createdAt: v2.createdAt || nowISO(), updatedAt: nowISO(), prompts };
}

function defaultData() {
  return { version: 3, createdAt: nowISO(), updatedAt: new Date(0).toISOString(), prompts: [] };
}

function coerceIsoDate(value, fallback) {
  const fallbackIso = fallback || nowISO();
  const t = new Date(value || "").getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : fallbackIso;
}

function sanitizePrompt(p, fallbackNow = nowISO()) {
  const createdAt = coerceIsoDate(p?.createdAt, fallbackNow);
  const updatedAt = coerceIsoDate(p?.updatedAt, createdAt);
  const deletedAt = p?.deletedAt ? coerceIsoDate(p.deletedAt, updatedAt) : null;
  const result = {
    id: (typeof p?.id === "string" && p.id.trim()) ? p.id.trim() : uid(),
    title: typeof p?.title === "string" ? p.title : "Sem título",
    text: typeof p?.text === "string" ? p.text : "",
    categoria: typeof p?.categoria === "string" && p.categoria.trim() ? p.categoria : "analise",
    subcategoria: typeof p?.subcategoria === "string" ? p.subcategoria : "",
    formato: typeof p?.formato === "string" ? p.formato : "",
    status: typeof p?.status === "string" && p.status.trim() ? p.status : "teste",
    ai: (typeof p?.ai === "string" ? p.ai : "").trim().toLowerCase(),
    tags: [...new Set((Array.isArray(p?.tags) ? p.tags : []).map(normalizeTag).filter(Boolean))],
    quandoUsar: typeof p?.quandoUsar === "string" ? p.quandoUsar : "",
    naoUsarQuando: typeof p?.naoUsarQuando === "string" ? p.naoUsarQuando : "",
    saidaEsperada: typeof p?.saidaEsperada === "string" ? p.saidaEsperada : "",
    note: typeof p?.note === "string" ? p.note : "",
    pinned: !!p?.pinned,
    createdAt,
    updatedAt,
    ...(deletedAt ? { deletedAt } : {}),
    ...(p?.lastCopiedAt ? { lastCopiedAt: coerceIsoDate(p.lastCopiedAt, null) } : {}),
  };
  return result;
}

function normalizePromptPayload(d) {
  if (!d?.prompts || !Array.isArray(d.prompts)) return defaultData();

  const fallbackNow = nowISO();
  let changed = false;
  const seenIds = new Set();

  const newPrompts = d.prompts.map(rawPrompt => {
    const rawObj = (rawPrompt && typeof rawPrompt === "object") ? rawPrompt : null;
    const np = sanitizePrompt(rawObj, fallbackNow);

    if (!rawObj) changed = true;

    // Keep IDs unique in-memory to avoid collisions in merge/render.
    while (seenIds.has(np.id)) {
      np.id = uid();
      changed = true;
    }
    seenIds.add(np.id);

    // Fast structural checks (avoid expensive JSON.stringify on large prompt texts).
    if (rawObj) {
      const rawAi = (typeof rawObj.ai === "string" ? rawObj.ai : "").trim().toLowerCase();
      const rawTags = [...new Set((Array.isArray(rawObj.tags) ? rawObj.tags : []).map(normalizeTag).filter(Boolean))];
      if (
        np.id !== (typeof rawObj.id === "string" && rawObj.id.trim() ? rawObj.id.trim() : np.id) ||
        np.title !== (typeof rawObj.title === "string" ? rawObj.title : "Sem título") ||
        np.text !== (typeof rawObj.text === "string" ? rawObj.text : "") ||
        np.categoria !== (typeof rawObj.categoria === "string" && rawObj.categoria.trim() ? rawObj.categoria : "analise") ||
        np.subcategoria !== (typeof rawObj.subcategoria === "string" ? rawObj.subcategoria : "") ||
        np.formato !== (typeof rawObj.formato === "string" ? rawObj.formato : "") ||
        np.status !== (typeof rawObj.status === "string" && rawObj.status.trim() ? rawObj.status : "teste") ||
        np.ai !== rawAi ||
        np.tags.length !== rawTags.length || np.tags.some((t, i) => t !== rawTags[i]) ||
        np.quandoUsar !== (typeof rawObj.quandoUsar === "string" ? rawObj.quandoUsar : "") ||
        np.naoUsarQuando !== (typeof rawObj.naoUsarQuando === "string" ? rawObj.naoUsarQuando : "") ||
        np.saidaEsperada !== (typeof rawObj.saidaEsperada === "string" ? rawObj.saidaEsperada : "") ||
        np.note !== (typeof rawObj.note === "string" ? rawObj.note : "") ||
        np.pinned !== !!rawObj.pinned ||
        np.createdAt !== coerceIsoDate(rawObj.createdAt, fallbackNow) ||
        np.updatedAt !== coerceIsoDate(rawObj.updatedAt, np.createdAt) ||
        (np.deletedAt || null) !== (rawObj.deletedAt ? coerceIsoDate(rawObj.deletedAt, np.updatedAt) : null) ||
        (np.lastCopiedAt || null) !== (rawObj.lastCopiedAt ? coerceIsoDate(rawObj.lastCopiedAt, null) : null)
      ) changed = true;
    }

    return np;
  });

  const normalized = {
    version: 3,
    createdAt: coerceIsoDate(d.createdAt, fallbackNow),
    updatedAt: coerceIsoDate(d.updatedAt, fallbackNow),
    prompts: newPrompts,
  };
  if (changed) normalized.updatedAt = fallbackNow;
  return normalized;
}

function mergeData(local, remote) {
  if (!remote?.prompts || !Array.isArray(remote.prompts)) return local;
  if (!local?.prompts || !Array.isArray(local.prompts)) return remote;

  const localMap = new Map(local.prompts.map(p => [p.id, p]));
  const remoteMap = new Map(remote.prompts.map(p => [p.id, p]));
  const mergedPrompts = [];
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  for (const id of allIds) {
    const lp = localMap.get(id);
    const rp = remoteMap.get(id);

    if (lp && !rp) {
      mergedPrompts.push(lp);
    } else if (!lp && rp) {
      mergedPrompts.push(rp);
    } else {
      // Both exist, check tombstone first.
      const lDel = lp.deletedAt ? new Date(lp.deletedAt).getTime() : 0;
      const rDel = rp.deletedAt ? new Date(rp.deletedAt).getTime() : 0;
      const lTime = Math.max(new Date(lp.updatedAt || 0).getTime(), lDel);
      const rTime = Math.max(new Date(rp.updatedAt || 0).getTime(), rDel);

      mergedPrompts.push(rTime > lTime ? rp : lp);
    }
  }
  const maxLocal = local.prompts.reduce((m, p) => Math.max(m, new Date(p.updatedAt || 0).getTime()), 0);
  const maxRemote = remote.prompts.reduce((m, p) => Math.max(m, new Date(p.updatedAt || 0).getTime()), 0);
  const mergedUpdatedAt = new Date(Math.max(maxLocal, maxRemote, new Date(local.updatedAt || 0).getTime(), new Date(remote.updatedAt || 0).getTime())).toISOString();
  return { ...local, version: 3, prompts: mergedPrompts, updatedAt: mergedUpdatedAt };
}

function load() {
  // Try v3
  try {
    const r = localStorage.getItem(LS_KEY_V3);
    if (r) { const d = JSON.parse(r); if (d?.version === 3 && Array.isArray(d.prompts)) return normalizePromptPayload(d); }
  } catch (e) { customAlert("Aviso", "Falha ao carregar dados locais (localStorage corrompido). Usando banco vazio."); }
  // Try v2 → migrate
  try {
    const r = localStorage.getItem(LS_KEY_V2);
    if (r) { const d = JSON.parse(r); if (d?.version === 2 && Array.isArray(d.categories)) { toast("Dados migrados para v3 ✅"); return migrateV2toV3(d); } }
  } catch (e) { }
  return defaultData();
}

let _lsTimer = null;
function save(d, bumpTime = true, syncFlush = false) {
  if (bumpTime) d.updatedAt = nowISO();

  const doSave = () => {
    try {
      localStorage.setItem(LS_KEY_V3, JSON.stringify(d, null, 2));
      window.dispatchEvent(new Event("localDataSaved"));
    } catch (err) {
      console.error("Erro localStorage", err);
      toast("Erro ao salvar! Armazenamento cheio?");
    }
  };

  if (syncFlush) {
    clearTimeout(_lsTimer);
    doSave();
  } else {
    clearTimeout(_lsTimer);
    _lsTimer = setTimeout(doSave, 400);
  }
}

let data = load();
// try { save(data); } catch (e) { } // Removed immediate save to prevent bumping the initial timestamp
