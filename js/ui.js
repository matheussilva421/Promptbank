// ── Theme & Colors ──
const getTheme = () => localStorage.getItem("bpTheme") === "light" ? "light" : "dark";
const setTheme = t => { lsSet("bpTheme", t); document.documentElement.setAttribute("data-theme", t); };
document.documentElement.setAttribute("data-theme", getTheme());

const COLORS = [
  { hex: "#14B2E4", name: "Azul Nativo" },
  { hex: "#8A2BE2", name: "Roxo" },
  { hex: "#FF4D5E", name: "Rosa" },
  { hex: "#34d399", name: "Verde" },
  { hex: "#F5A623", name: "Laranja" }
];
let currentColorIndex = parseInt(localStorage.getItem("bpColorIdx") || "0", 10);
if (isNaN(currentColorIndex) || currentColorIndex >= COLORS.length) currentColorIndex = 0;

function applyColor(idx) {
  currentColorIndex = idx;
  lsSet("bpColorIdx", idx);
  const c = COLORS[idx].hex;
  document.documentElement.style.setProperty("--blue", c);

  // Calculate a slightly darker version for hover state manually (simplified)
  let r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
  document.documentElement.style.setProperty("--blue2", `rgb(${Math.max(0, r - 20)}, ${Math.max(0, g - 20)}, ${Math.max(0, b - 20)})`);

  const theme = getTheme();
  const opacity = theme === 'light' ? '0.1' : '0.15';
  document.documentElement.style.setProperty("--blue-g", `rgba(${r}, ${g}, ${b}, ${opacity})`);
}
applyColor(currentColorIndex);

$("#btnThemePrimary").addEventListener("click", () => {
  let nIdx = (currentColorIndex + 1) % COLORS.length;
  applyColor(nIdx);
  toast("Cor: " + COLORS[nIdx].name + " 🎨");
});

// ── Selectors ──
function allPrompts() { return (data.prompts || []).filter(p => !p.deletedAt); }
function promptsForCat(cat) {
  if (cat === "todos") return allPrompts();
  if (cat === "arquivados") return allPrompts().filter(p => p.status === "arquivado" || p.categoria === "arquivados");
  return allPrompts().filter(p => {
    if (p.status === "arquivado" && p.categoria !== "arquivados") return false;
    if (cat === "analise") return p.categoria === "analise";
    return p.categoria === cat;
  });
}
function filteredPromptsBase() {
  let ps = promptsForCat(S.cat);
  if (S.cat === "analise" && S.subcat) ps = ps.filter(p => p.subcategoria === S.subcat);
  const q = (S.search || S.sideSearch).trim().toLowerCase();
  if (q) {
    const words = q.split(/\s+/).filter(Boolean);
    ps = ps.filter(p => {
      const content = [p.title, p.text, ...(p.tags || []), p.quandoUsar, p.note].filter(Boolean).join(" ").toLowerCase();
      return words.every(w => content.includes(w));
    });
  }
  if (S.filterFormato) ps = ps.filter(p => p.formato === S.filterFormato);
  if (S.filterStatus) ps = ps.filter(p => p.status === S.filterStatus);
  if (S.filterTags.length) ps = ps.filter(p => S.filterTags.every(ft => (p.tags || []).map(t => t.toLowerCase()).includes(ft.toLowerCase())));
  if (S.filterAis.length) ps = ps.filter(p => S.filterAis.includes((p.ai || "").toLowerCase()));
  return ps;
}
function filteredPrompts() {
  const ps = filteredPromptsBase().slice();
  let sorted;

  if (S.promptSort === "title-asc") {
    sorted = ps.sort((a, b) => (a.title || "").localeCompare((b.title || ""), "pt-BR"));
  } else if (S.promptSort === "manual") {
    const manualIds = getManualIdsForCurrent();
    const byId = new Map(ps.map(p => [p.id, p]));
    const ordered = [];
    manualIds.forEach(id => { if (byId.has(id)) { ordered.push(byId.get(id)); byId.delete(id); } });
    const rest = [...byId.values()].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    sorted = [...ordered, ...rest];
  } else {
    sorted = ps.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }

  // Always float pinned items to top unless manual sort
  if (S.promptSort !== "manual") {
    sorted.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  }
  return sorted;
}
function hasActiveFilters() {
  return S.search || S.sideSearch || S.filterFormato || S.filterStatus || S.filterTags.length || S.filterAis.length;
}

// ── Render ──
function render() { renderDock(); renderSidePanel(); renderMain(); }

function renderDock() {
  const el = $("#dockCats"); el.innerHTML = "";
  const catById = new Map(CATS.map(c => [c.id, c]));
  const orderedCats = (S.catOrder || []).map(id => catById.get(id)).filter(Boolean);
  orderedCats.forEach(cat => {
    const d = document.createElement("div");
    d.className = "dock-item" + (S.cat === cat.id ? " active" : "");
    d.draggable = true;
    d.dataset.catId = cat.id;
    const count = promptsForCat(cat.id).length;
    d.innerHTML = `${cat.icon}<div class="tooltip">${esc(cat.name)} (${count})</div>`;
    d.addEventListener("click", () => {
      S.cat = cat.id; S.subcat = ""; S.sideSearch = ""; S.search = "";
      S.filterFormato = ""; S.filterStatus = ""; S.filterTags = []; S.filterAis = [];
      $("#sideSearch").value = ""; $("#globalSearch").value = "";
      saveUIState();
      render();
    });
    d.addEventListener("dragstart", () => d.classList.add("dragging"));
    d.addEventListener("dragend", () => d.classList.remove("dragging"));
    d.addEventListener("dragover", e => {
      e.preventDefault();
      const dragging = el.querySelector('.dock-item.dragging');
      if (!dragging || dragging === d) return;
      const rect = d.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      if (before) {
        if (dragging.nextSibling !== d) el.insertBefore(dragging, d);
      } else {
        if (dragging.previousSibling !== d) el.insertBefore(dragging, d.nextSibling);
      }
    });
    d.addEventListener("drop", e => {
      e.preventDefault();
      S.catOrder = [...el.querySelectorAll('.dock-item')].map(x => x.dataset.catId);
      saveCatOrder();
      render();
    });
    el.appendChild(d);
  });
}

function renderSidePanel() {
  const cat = CATS.find(c => c.id === S.cat) || CATS[0];
  $("#panelCatIcon").textContent = cat.icon;
  $("#panelCatName").textContent = cat.name;
  const catPrompts = promptsForCat(S.cat); // cached — avoids 5+ redundant scans
  const total = catPrompts.length;
  $("#panelCatCount").textContent = total;

  const body = $("#panelBody");
  body.innerHTML = "";

  // Subcategory nav for analise
  if (S.cat === "analise") {
    const nav = document.createElement("div"); nav.className = "subcat-nav";
    // "All" option
    const allItem = document.createElement("div");
    allItem.className = "subcat-item" + (S.subcat === "" ? " active" : "");
    const allCount = catPrompts.length;
    allItem.innerHTML = `<span class="subcat-item-name">🏛️ Todos os Eixos</span><span class="subcat-count">${allCount}</span>`;
    allItem.addEventListener("click", () => { S.subcat = ""; saveUIState(); renderSidePanel(); renderMain(); });
    nav.appendChild(allItem);

    SUBCATS.forEach(sc => {
      const count = catPrompts.filter(p => p.subcategoria === sc.id).length;
      const item = document.createElement("div");
      item.className = "subcat-item" + (S.subcat === sc.id ? " active" : "");
      item.draggable = true;
      item.dataset.subcatId = sc.id;
      item.innerHTML = `<span class="subcat-item-name">${esc(sc.name)}</span><span class="subcat-count">${count}</span>`;
      item.addEventListener("click", () => { S.subcat = sc.id; saveUIState(); renderSidePanel(); renderMain(); });
      item.addEventListener("dragstart", () => item.classList.add("dragging"));
      item.addEventListener("dragend", () => item.classList.remove("dragging"));
      item.addEventListener("dragover", e => {
        e.preventDefault();
        const dragging = nav.querySelector('.subcat-item.dragging');
        if (!dragging || dragging === item || !dragging.dataset.subcatId) return;
        const rect = item.getBoundingClientRect();
        const before = e.clientY < rect.top + rect.height / 2;
        if (before) {
          if (dragging.nextSibling !== item) nav.insertBefore(dragging, item);
        } else {
          if (dragging.previousSibling !== item) nav.insertBefore(dragging, item.nextSibling);
        }
      });
      item.addEventListener("drop", e => {
        e.preventDefault();
        const ordered = [...nav.querySelectorAll('.subcat-item[data-subcat-id]')].map(x => x.dataset.subcatId);
        if (ordered.length === SUBCATS.length) {
          const map = new Map(SUBCATS.map(sc => [sc.id, sc]));
          SUBCATS.splice(0, SUBCATS.length, ...ordered.map(id => map.get(id)).filter(Boolean));
          saveSubcatOrder();
          renderSidePanel();
        }
      });
      nav.appendChild(item);
    });
    body.appendChild(nav);

    const sep = document.createElement("div"); sep.style.cssText = "height:1px;background:var(--line);margin:10px 0;";
    body.appendChild(sep);
  }

  // Formato filter
  const formatosUsed = [...new Set(catPrompts.map(p => p.formato).filter(Boolean))];
  if (formatosUsed.length) {
    const fl = document.createElement("div"); fl.className = "filter-section";
    fl.innerHTML = `<div class="filter-label">Formato</div><div class="filter-chips" id="formatoChips"></div>`;
    body.appendChild(fl);
    const chips = fl.querySelector("#formatoChips");
    formatosUsed.forEach(f => {
      const c = document.createElement("span");
      c.className = "chip" + (S.filterFormato === f ? " active" : "");
      c.textContent = FORMATO_LABELS[f] || f;
      c.addEventListener("click", () => { S.filterFormato = S.filterFormato === f ? "" : f; renderSidePanel(); renderMain(); });
      chips.appendChild(c);
    });
  }

  // Status filter
  const fl2 = document.createElement("div"); fl2.className = "filter-section";
  fl2.innerHTML = `<div class="filter-label">Status</div><div class="filter-chips" id="statusChips"></div>`;
  body.appendChild(fl2);
  const statusUsed = [...new Set(catPrompts.map(p => p.status || "teste").filter(Boolean))];
  const chips2 = fl2.querySelector("#statusChips");
  statusUsed.forEach(st => {
    const c = document.createElement("span");
    c.className = "chip" + (S.filterStatus === st ? " active" : "");
    c.textContent = STATUS_LABELS[st] || st;
    c.addEventListener("click", () => { S.filterStatus = S.filterStatus === st ? "" : st; renderSidePanel(); renderMain(); });
    chips2.appendChild(c);
  });

  // AI filter
  const aisUsed = [...new Set(catPrompts.map(p => p.ai).filter(Boolean))];
  if (aisUsed.length > 1) {
    const fl3 = document.createElement("div"); fl3.className = "filter-section";
    fl3.innerHTML = `<div class="filter-label">IA</div><div class="filter-chips" id="aiChips"></div>`;
    body.appendChild(fl3);
    const chips3 = fl3.querySelector("#aiChips");
    aisUsed.forEach(ai => {
      const c = document.createElement("span");
      const aiKey = ai.toLowerCase();
      c.className = "chip" + (S.filterAis.includes(aiKey) ? " active" : "");
      c.textContent = ai.charAt(0).toUpperCase() + ai.slice(1);
      c.addEventListener("click", () => {
        S.filterAis = S.filterAis.includes(aiKey) ? S.filterAis.filter(t => t !== aiKey) : [...S.filterAis, aiKey];
        renderSidePanel(); renderMain();
      });
      chips3.appendChild(c);
    });
  }

  // Popular tags
  const tagCounts = {};
  catPrompts.forEach(p => (p.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
  if (topTags.length) {
    const fl4 = document.createElement("div"); fl4.className = "filter-section";
    fl4.innerHTML = `<div class="filter-label">Tags</div><div class="filter-chips" id="tagChips"></div>`;
    body.appendChild(fl4);
    const chips4 = fl4.querySelector("#tagChips");
    topTags.forEach(tag => {
      const c = document.createElement("span");
      c.className = "chip" + (S.filterTags.includes(tag) ? " active" : "");
      c.textContent = "#" + tag;
      c.addEventListener("click", () => {
        S.filterTags = S.filterTags.includes(tag) ? S.filterTags.filter(t => t !== tag) : [...S.filterTags, tag];
        renderSidePanel(); renderMain();
      });
      chips4.appendChild(c);
    });
  }

  if (S.sideSearch && !formatosUsed.length && !statusUsed.length && !topTags.length && !aisUsed.length) {
    const noRes = document.createElement("div");
    noRes.style.cssText = "padding:20px;text-align:center;color:var(--t3);font-size:12px;font-style:italic;";
    noRes.textContent = "Nenhum resultado...";
    body.appendChild(noRes);
  }
}

function renderSortBar() {
  const bar = $("#sortBar");
  const opts = [
    { id: "updated-desc", label: "🕒 Última edição" },
    { id: "title-asc", label: "🔤 Título" },
    { id: "manual", label: "✋ Manual (arrastar cards)" },
  ];
  bar.innerHTML = '<span class="sort-label">Ordenar por</span>';
  opts.forEach(o => {
    const b = document.createElement("button");
    b.className = "sort-chip" + (S.promptSort === o.id ? " active" : "");
    b.textContent = o.label;
    b.addEventListener("click", () => { S.promptSort = o.id; saveUIState(); renderMain(); });
    bar.appendChild(b);
  });

  const counter = document.createElement("div");
  counter.className = "result-counter";
  const total = promptsForCat(S.cat).length;
  const current = filteredPromptsBase().length;
  counter.textContent = `Mostrando ${current} de ${total} prompts`;
  bar.appendChild(counter);
}

function renderMain() {
  renderSortBar();
  // Active filter bar
  const bar = $("#activeFilterBar"); bar.innerHTML = "";
  const addChip = (label, onRemove) => {
    const c = document.createElement("div"); c.className = "active-filter-chip";
    c.innerHTML = `${esc(label)}<button title="Remover">×</button>`;
    c.querySelector("button").addEventListener("click", onRemove);
    bar.appendChild(c);
  };
  if (S.search) addChip(`"${S.search}"`, () => { S.search = ""; $("#globalSearch").value = ""; renderMain(); });
  if (S.filterFormato) addChip(FORMATO_LABELS[S.filterFormato] || S.filterFormato, () => { S.filterFormato = ""; renderSidePanel(); renderMain(); });
  if (S.filterStatus) addChip(STATUS_LABELS[S.filterStatus] || S.filterStatus, () => { S.filterStatus = ""; renderSidePanel(); renderMain(); });
  S.filterTags.forEach(t => addChip("#" + t, () => { S.filterTags = S.filterTags.filter(ft => ft !== t); renderSidePanel(); renderMain(); }));
  S.filterAis.forEach(ai => addChip("IA:" + ai.toUpperCase(), () => { S.filterAis = S.filterAis.filter(a => a !== ai); renderSidePanel(); renderMain(); }));

  // Clear button visibility
  $("#btnClearFilters").style.display = hasActiveFilters() ? "" : "none";

  // Grid
  const grid = $("#promptGrid");
  grid.innerHTML = "";
  grid.ondragover = null;
  grid.ondrop = null;
  if (!grid.dataset.delegated) {
    grid.dataset.delegated = "true";
    grid.addEventListener("click", e => {
      const card = e.target.closest(".prompt-card");
      if (!card) return;
      const id = card.dataset.promptId;
      if (!id) return;

      const actionBtn = e.target.closest("[data-action]");
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        if (action === "copy") { e.stopPropagation(); copyPrompt(id); }
        else if (action === "edit") { e.stopPropagation(); openEditor(id); }
        else if (action === "dupe") { e.stopPropagation(); duplicatePrompt(id); }
        else if (action === "pin") {
          e.stopPropagation();
          const p = data.prompts.find(x => x.id === id);
          if (p) {
            p.pinned = !p.pinned;
            p.updatedAt = nowISO();
            save(data); renderMain();
          }
        }
        else if (action === "tag-filter" && e.target.classList.contains("tag")) {
          e.stopPropagation();
          const t = e.target.dataset.tag;
          if (t && !S.filterTags.includes(t)) {
            S.filterTags.push(t);
            saveUIState();
            renderSidePanel(); renderMain();
          }
        }
        return;
      }
      if (S.suppressNextCardClick) return;
      openDrawer(id);
    });
  }
  // Pre-compute render context once per cycle (avoids per-card localStorage reads & regex creation)
  _renderCtx.hasRemote = typeof hasAnyRemoteConfigured !== "undefined" && hasAnyRemoteConfigured();
  _renderCtx.lastSync = _renderCtx.hasRemote ? (localStorage.getItem("bancoPrompts_lastSyncTime") || "0") : "0";
  _highlightRegexes = [];
  const _renderQuery = (S.search || S.sideSearch).trim();
  if (_renderQuery) {
    _renderQuery.toLowerCase().split(/\s+/).filter(Boolean).forEach(w => {
      try {
        const safeW = esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        _highlightRegexes.push(new RegExp(`(?<!&[a-z]{1,5};)(${safeW})(?![^<]*>|[^&]*;)`, "gi"));
      } catch (e) { console.warn("[highlight] Invalid regex for word:", w, e); }
    });
  }

  const ps = filteredPrompts();

  if (!ps.length) {
    const e = document.createElement("div"); e.className = "empty-state";
    const catObj = CATS.find(c => c.id === S.cat);
    const btnHtml = hasActiveFilters() ? `<button class="btn ghost sm" onclick="$('#btnClearFilters').click()" style="margin-top:10px;">Limpar Filtros</button>` : `<button class="btn primary sm" onclick="openEditor()" style="margin-top:10px;">+ Criar Novo Prompt</button>`;
    e.innerHTML = `<div class="empty-icon">${catObj?.icon || "📂"}</div><div class="empty-title">${hasActiveFilters() ? "Nenhum resultado" : "Nenhum prompt aqui ainda"}</div><div class="empty-sub">${hasActiveFilters() ? "Tente limpar os filtros" : "Clique abaixo para começar"}</div>${btnHtml}`;
    grid.appendChild(e);
    return;
  }

  if (S.cat === "analise" && !S.subcat && S.promptSort !== "manual" && !S.search && !S.sideSearch && S.filterTags.length === 0 && !S.filterFormato && !S.filterStatus && S.filterAis.length === 0) {
    const grouped = {};
    ps.forEach(p => {
      const sc = p.subcategoria || "outros";
      if (!grouped[sc]) grouped[sc] = [];
      grouped[sc].push(p);
    });

    SUBCATS.forEach(sc => {
      if (grouped[sc.id] && grouped[sc.id].length) {
        const sep = document.createElement("div");
        sep.style.cssText = "grid-column: 1 / -1; padding-bottom: 4px; border-bottom: 1px dashed var(--line2); margin-top: 12px; font-size: 13px; font-weight: 700; color: var(--blue); letter-spacing: 0.5px; text-transform: uppercase;";
        sep.textContent = "— " + sc.name + " —";
        grid.appendChild(sep);
        grouped[sc.id].forEach(p => grid.appendChild(buildCard(p)));
      }
    });
    if (grouped["outros"] && grouped["outros"].length) {
      const sep = document.createElement("div");
      sep.style.cssText = "grid-column: 1 / -1; padding-bottom: 4px; border-bottom: 1px dashed var(--line2); margin-top: 12px; font-size: 13px; font-weight: 700; color: var(--t3); letter-spacing: 0.5px; text-transform: uppercase;";
      sep.textContent = "— Outros / Sem Eixo —";
      grid.appendChild(sep);
      grouped["outros"].forEach(p => grid.appendChild(buildCard(p)));
    }
  } else {
    ps.forEach(p => grid.appendChild(buildCard(p)));
  }

  if (S.promptSort === "manual") {
    grid.ondragover = e => {
      e.preventDefault();
      const dragging = S.draggingPromptId ? grid.querySelector(`.prompt-card[data-prompt-id="${S.draggingPromptId}"]`) : null;
      if (!dragging) return;

      const targetCard = e.target.closest('.prompt-card');
      if (targetCard && targetCard !== dragging && !targetCard.classList.contains('dragging')) {
        const rect = targetCard.getBoundingClientRect();
        const cy = rect.top + rect.height / 2;
        const cx = rect.left + rect.width / 2;
        let before = false;

        if (Math.abs(e.clientY - cy) > 12) {
          before = e.clientY < cy;
        } else {
          before = e.clientX < cx;
        }

        if (before) {
          if (dragging.nextSibling !== targetCard) grid.insertBefore(dragging, targetCard);
        } else {
          if (dragging.previousSibling !== targetCard) grid.insertBefore(dragging, targetCard.nextSibling);
        }
      } else if (!targetCard && e.target === grid) {
        const cards = grid.querySelectorAll('.prompt-card:not(.dragging)');
        if (cards.length > 0) {
          const lastCard = cards[cards.length - 1];
          const rect = lastCard.getBoundingClientRect();
          if (e.clientY > rect.bottom || (e.clientY >= rect.top && e.clientX > rect.right)) {
            if (dragging.previousSibling !== lastCard) grid.appendChild(dragging);
          }
        } else {
          grid.appendChild(dragging);
        }
      }
    };

    grid.ondrop = e => {
      e.preventDefault();
      if (S.draggingPromptId) {
        setManualIdsForCurrent([...grid.querySelectorAll(".prompt-card")].map(c => c.dataset.promptId));
        S.draggingPromptId = null;
        renderMain();
      }
    };
  }
}

function buildCard(p) {
  const card = document.createElement("div");
  card.className = "prompt-card" + (S.promptSort === "manual" ? " manual-sort" : "");
  card.dataset.promptId = p.id;
  const statusClass = "badge-" + (p.status || "teste");
  const statusLabel = STATUS_LABELS[p.status || "teste"] || p.status;
  const formatoLabel = FORMATO_LABELS[p.formato] || "";
  const visibleTags = (p.tags || []).slice(0, 4);
  const cat = CATS.find(c => c.id === p.categoria);
  const subcat = SUBCATS.find(s => s.id === p.subcategoria);

  let syncStatusHtml = "";
  if (_renderCtx.hasRemote && _renderCtx.lastSync !== "0") {
    const needsSync = !p.deletedAt && new Date(p.updatedAt) > new Date(_renderCtx.lastSync);
    syncStatusHtml = needsSync ? `<span title="Alterações locais pendentes de sincronização" style="font-size:10px;margin-left:auto;">🟡</span>` : `<span title="Sincronizado" style="font-size:10px;margin-left:auto;opacity:0.5;">🟢</span>`;
  }

  let cardTitle = esc(p.title);
  for (const r of _highlightRegexes) {
    cardTitle = cardTitle.replace(r, "<mark>$1</mark>");
  }

  card.innerHTML = `
    <div class="card-top">
      <div class="card-title-wrap">
        <span class="card-drag-handle" title="Arrastar card" draggable="true" data-action="drag-handle">⋮⋮</span>
        <div class="card-title">${cardTitle}</div>
      </div>
      <div style="display:flex; gap:4px; align-items:center;">
        ${p.ai ? `<div class="card-ai">${esc(p.ai.toUpperCase())}</div>` : ""}
        <button class="card-pin-quick ${p.pinned ? 'is-pinned' : ''}" data-action="pin" title="Fixar prompt">${p.pinned ? '⭐' : '☆'}</button>
        <button class="card-copy-quick" data-action="copy" title="Copiar prompt">📋</button>
      </div>
    </div>
    <div class="card-badges">
      <span class="badge ${statusClass}">${esc(statusLabel)}</span>
      ${formatoLabel ? `<span class="badge badge-formato">${esc(formatoLabel)}</span>` : ""}
      ${subcat ? `<span class="badge badge-formato">${esc(subcat.name)}</span>` : ""}
      ${syncStatusHtml}
    </div>
    ${p.quandoUsar ? `<div class="card-when" style="color:var(--t3);font-size:11.5px;">Quando usar: ${esc(p.quandoUsar)}</div>` : ""}
    ${visibleTags.length ? `<div class="card-tags" data-action="tag-filter">${visibleTags.map(t => `<span class="tag" data-tag="${esc(t)}">#${esc(t)}</span>`).join("")}${(p.tags || []).length > 4 ? `<span class="tag">+${(p.tags || []).length - 4}</span>` : ""}</div>` : ""}
    <div class="card-actions">
      <button class="card-btn" data-action="edit">✏️ Editar</button>
      <button class="card-btn" data-action="dupe">🔁 Duplicar</button>
    </div>`;

  if (S.promptSort === "manual") {
    const handle = card.querySelector('[data-action="drag-handle"]');
    handle.addEventListener("dragstart", e => {
      card.classList.add("dragging");
      S.draggingPromptId = p.id;
      S.suppressNextCardClick = true;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", p.id);
      }
    });
    handle.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      S.draggingPromptId = null;
      setTimeout(() => { S.suppressNextCardClick = false; }, 80);
    });
  }
  return card;
}

// ── Drawer ──
function openDrawer(id) {
  const p = allPrompts().find(x => x.id === id); if (!p) return;
  S.openPromptId = id;
  const cat = CATS.find(c => c.id === p.categoria);
  const subcat = SUBCATS.find(s => s.id === p.subcategoria);
  const statusLabel = STATUS_LABELS[p.status || "teste"] || p.status;
  const formatoLabel = FORMATO_LABELS[p.formato] || "";

  $("#drawerTitle").textContent = p.title;
  const meta = $("#drawerMeta"); meta.innerHTML = "";
  const addBadge = (label, cls) => { const b = document.createElement("span"); b.className = `badge ${cls}`; b.textContent = label; meta.appendChild(b); };
  if (p.pinned) addBadge("⭐", "badge-teste");
  addBadge(statusLabel, "badge-" + (p.status || "teste"));
  if (formatoLabel) addBadge(formatoLabel, "badge-formato");
  if (cat) addBadge(cat.icon + " " + cat.name, "badge-formato");
  if (subcat) addBadge(subcat.name, "badge-formato");
  if (p.ai) addBadge(p.ai.toUpperCase(), "badge-formato");

  const body = $("#drawerBody"); body.innerHTML = "";

  // Text
  const tl = document.createElement("div"); tl.className = "drawer-section-label"; tl.textContent = "Texto do Prompt";
  const tx = document.createElement("div"); tx.className = "drawer-text"; tx.innerHTML = parseSimpleMarkdown(p.text || "");
  body.appendChild(tl); body.appendChild(tx);

  // Meta rows
  const metaSection = document.createElement("div");
  const rows = [
    ["Quando usar", p.quandoUsar],
    ["Não usar quando", p.naoUsarQuando],
    ["Saída esperada", p.saidaEsperada],
    ["Tags", (p.tags || []).map(t => "#" + t).join(", ")],
    ["Nota interna", p.note],
    ["Atualizado em", fmt(p.updatedAt)],
  ].filter(([, v]) => v);
  if (rows.length) {
    const sl = document.createElement("div"); sl.className = "drawer-section-label"; sl.textContent = "Metadados";
    body.appendChild(sl);
    rows.forEach(([l, v]) => {
      const row = document.createElement("div"); row.className = "drawer-info-row";
      row.innerHTML = `<span class="drawer-info-label">${esc(l)}</span><span class="drawer-info-val">${esc(v)}</span>`;
      body.appendChild(row);
    });
  }

  const footer = $("#drawerFooter"); footer.innerHTML = "";
  const btnCopy = document.createElement("button"); btnCopy.className = "btn primary"; btnCopy.textContent = "📋 Copiar"; btnCopy.addEventListener("click", () => copyPrompt(id));
  const btnEdit = document.createElement("button"); btnEdit.className = "btn ghost"; btnEdit.textContent = "✏️ Editar"; btnEdit.addEventListener("click", () => { closeDrawer(); setTimeout(() => openEditor(id), 10); });
  const btnDupe = document.createElement("button"); btnDupe.className = "btn ghost"; btnDupe.textContent = "🔁 Duplicar"; btnDupe.addEventListener("click", () => { duplicatePrompt(id); closeDrawer(); });
  const btnExportSingle = document.createElement("button"); btnExportSingle.className = "btn ghost"; btnExportSingle.textContent = "⬇️ Exportar"; btnExportSingle.addEventListener("click", () => exportSinglePrompt(id));
  footer.appendChild(btnCopy); footer.appendChild(btnEdit); footer.appendChild(btnDupe); footer.appendChild(btnExportSingle);

  $("#drawerOverlay").classList.add("open");
  window.history.replaceState(null, "", `#${id}`);
}
function closeDrawer() {
  $("#drawerOverlay").classList.remove("open");
  S.openPromptId = null;
  window.history.replaceState(null, "", window.location.pathname);
  $("#promptDrawer").classList.remove("expanded");
}
$("#btnCloseDrawer").addEventListener("click", closeDrawer);
$("#btnExpandDrawer").addEventListener("click", () => {
  $("#promptDrawer").classList.toggle("expanded");
});
$("#drawerOverlay").addEventListener("click", e => { if (e.target === e.currentTarget) closeDrawer(); });

// ── Editor ──
let _editorPinned = false;
function openEditor(id) {
  const p = id ? allPrompts().find(x => x.id === id) : null;
  S.editingId = id || null;
  _editorPinned = p?.pinned || false;

  $("#editorTitle").textContent = p ? "Editar Prompt" : "Novo Prompt";
  const btnPin = $("#btnPinEditor");
  if (btnPin) {
    btnPin.textContent = _editorPinned ? "⭐" : "☆";
    btnPin.style.color = _editorPinned ? "var(--amber)" : "";
  }
  $("#btnDeletePrompt").style.display = p ? "" : "none";

  // Populate categoria select
  const sel = $("#e_categoria"); sel.innerHTML = "";
  EDITABLE_CATS.forEach(c => { const o = document.createElement("option"); o.value = c.id; o.textContent = c.icon + " " + c.name; sel.appendChild(o); });

  // Populate dynamic selects
  populateSubcatSelect();
  populateFormatoSelect();
  populateStatusSelect();
  populateAiSelect();

  const fallbackCat = EDITABLE_CATS.some(c => c.id === S.cat) ? S.cat : "analise";
  const promptCat = p?.categoria;
  const initialCat = EDITABLE_CATS.some(c => c.id === promptCat) ? promptCat : fallbackCat;

  $("#e_title").value = p?.title || "";
  $("#e_text").value = p?.text || "";
  $("#e_categoria").value = initialCat;
  $("#e_subcategoria").value = (initialCat === "analise" ? (p?.subcategoria || S.subcat || "") : "");
  $("#e_formato").value = p?.formato || "";
  $("#e_status").value = p?.status || "teste";
  $("#e_ai").value = p?.ai || "";
  $("#e_tags").value = (p?.tags || []).join(", ");
  $("#e_quando").value = p?.quandoUsar || "";
  $("#e_nao_quando").value = p?.naoUsarQuando || "";
  $("#e_saida").value = p?.saidaEsperada || "";
  $("#e_note").value = p?.note || "";
  toggleSubcatField();
  snapshotEditorInitialValues();
  $("#editorOverlay").classList.add("show");
  updateTextCounter();

  const eBody = $("#modalEditorBody");
  if (eBody) {
    let _editorScrollRaf = null;
    eBody.onscroll = () => {
      if (_editorScrollRaf) return;
      _editorScrollRaf = requestAnimationFrame(() => {
        eBody.style.boxShadow = eBody.scrollTop > 10 ? "inset 0 10px 10px -10px rgba(0,0,0,0.5)" : "none";
        _editorScrollRaf = null;
      });
    };
  }

  setTimeout(() => $("#e_title").focus(), 150);
}

function updateTextCounter() {
  const len = ($("#e_text").value || "").length;
  $("#e_text_counter").textContent = `${len} chars | ~${Math.ceil(len / 3.4)} tokens`;
}
$("#e_text").addEventListener("input", updateTextCounter);
function editorHasChanges() {
  if (!$("#editorOverlay").classList.contains("show")) return false;
  if (_editorPinned !== (S.editingId ? !!allPrompts().find(x => x.id === S.editingId)?.pinned : false)) return true;
  const fields = ["#e_title", "#e_text", "#e_categoria", "#e_subcategoria", "#e_formato", "#e_status", "#e_ai", "#e_tags", "#e_quando", "#e_nao_quando", "#e_saida", "#e_note"];
  return fields.some(sel => {
    const el = $(sel);
    return (el?.value || "") !== (el?.dataset.initial || "");
  });
}
async function closeEditor(force = false) {
  if (!force && editorHasChanges()) {
    const discard = await customConfirm("Atenção", "Existem alterações não salvas. Deseja descartar as mudanças?");
    if (!discard) return;
  }
  $("#editorOverlay").classList.remove("show");
  S.editingId = null;
  _editorPinned = false; // Reset pin state
  const btnPin = $("#btnPinEditor");
  if (btnPin) {
    btnPin.textContent = "☆";
    btnPin.style.color = "";
  }
}
$("#btnCloseEditor").addEventListener("click", closeEditor);
$("#btnCancelEditor").addEventListener("click", closeEditor);
$("#editorOverlay").addEventListener("click", e => { if (e.target === e.currentTarget) closeEditor(); });

// ── Command Palette ──
let _paletteIdx = 0;
function openPalette() {
  $("#paletteInput").value = "";
  renderPalette("");
  $("#paletteOverlay").classList.add("show");
  setTimeout(() => $("#paletteInput").focus(), 10);
}
function closePalette() {
  $("#paletteOverlay").classList.remove("show");
  $("#paletteInput").value = "";
  _paletteIdx = 0;
  $("#paletteResults").innerHTML = "";
}
$("#paletteOverlay").addEventListener("click", e => { if (e.target === e.currentTarget) closePalette(); });

function renderPalette(q = "") {
  const results = $("#paletteResults"); results.innerHTML = "";
  const query = q.toLowerCase().trim();
  const items = [];

  // Static Commands
  items.push({ icon: "⚡", label: "Novo Prompt", action: () => openEditor() });
  items.push({ icon: "📊", label: "Estatísticas", action: () => $("#btnStats").click() });
  items.push({ icon: "⚙️", label: "Configurações", action: () => openDriveSetupModal() });

  // Prompts
  allPrompts().forEach(p => {
    if (!query || p.title.toLowerCase().includes(query) || (p.tags || []).some(t => t.toLowerCase().includes(query)) || (p.text || "").toLowerCase().includes(query) || (p.quandoUsar || "").toLowerCase().includes(query)) {
      items.push({ icon: "📄", label: p.title, sub: p.categoria, action: () => openDrawer(p.id) });
    }
  });

  const filtered = items.slice(0, 50);
  _paletteIdx = Math.min(_paletteIdx, filtered.length - 1);
  if (_paletteIdx < 0) _paletteIdx = 0;

  if (!filtered.length) {
    results.innerHTML = `<div style="padding:40px;text-align:center;color:var(--t3);">Nenhum resultado...</div>`;
    return;
  }

  filtered.forEach((it, i) => {
    const d = document.createElement("div");
    d.className = "palette-item" + (i === _paletteIdx ? " active" : "");
    d.style.cssText = "display:flex;align-items:center;gap:12px;padding:10px 12px;cursor:pointer;border-radius:8px;margin-bottom:2px;";
    if (i === _paletteIdx) d.style.background = "var(--blue-g)";
    d.innerHTML = `<span style="font-size:18px;">${it.icon}</span><div style="flex:1;"><div style="font-weight:600;font-size:14px;">${esc(it.label)}</div>${it.sub ? `<div style="font-size:11px;color:var(--t3);">${esc(it.sub)}</div>` : ""}</div>`;
    d.addEventListener("click", () => { closePalette(); it.action(); });
    results.appendChild(d);
  });
  const activeEl = results.querySelector(".palette-item.active");
  if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
}

const renderPaletteDebounced = debounce(q => renderPalette(q), 80);
$("#paletteInput").addEventListener("input", e => { _paletteIdx = 0; renderPaletteDebounced(e.target.value); });
$("#paletteInput").addEventListener("keydown", e => {
  const items = $("#paletteResults").children;
  if ((e.key === "ArrowDown" || e.key === "ArrowUp") && items.length === 0) return;
  if (e.key === "ArrowDown") {
    e.preventDefault(); _paletteIdx = (_paletteIdx + 1) % items.length; renderPalette($("#paletteInput").value);
  } else if (e.key === "ArrowUp") {
    e.preventDefault(); _paletteIdx = (_paletteIdx - 1 + items.length) % items.length; renderPalette($("#paletteInput").value);
  } else if (e.key === "Enter") {
    e.preventDefault();
    const active = $("#paletteResults").querySelector(".palette-item.active");
    if (active) active.click();
  } else if (e.key === "Escape") {
    closePalette();
  }
});
$("#e_categoria").addEventListener("change", toggleSubcatField);

$("#btnPinEditor").addEventListener("click", () => {
  _editorPinned = !_editorPinned;
  const btnPin = $("#btnPinEditor");
  btnPin.textContent = _editorPinned ? "⭐" : "☆";
  btnPin.style.color = _editorPinned ? "var(--amber)" : "";
});

// ── Dynamic select population ──
function populateSubcatSelect() {
  const sel = $("#e_subcategoria"); if (!sel) return;
  sel.innerHTML = '<option value="">— Nenhuma —</option>';
  SUBCATS.forEach(sc => { const o = document.createElement("option"); o.value = sc.id; o.textContent = sc.name + " – " + sc.desc; sel.appendChild(o); });
}
function populateFormatoSelect() {
  const sel = $("#e_formato"); if (!sel) return;
  sel.innerHTML = '<option value="">— Sem formato —</option>';
  FORMATO_LIST.forEach(f => { const o = document.createElement("option"); o.value = f.id; o.textContent = f.label; sel.appendChild(o); });
}
function populateStatusSelect() {
  const sel = $("#e_status"); if (!sel) return;
  sel.innerHTML = '';
  STATUS_LIST.forEach(s => { const o = document.createElement("option"); o.value = s.id; o.textContent = s.label; sel.appendChild(o); });
}
function populateAiSelect() {
  const sel = $("#e_ai"); if (!sel) return;
  sel.innerHTML = '<option value="">— Todos —</option>';
  AI_LIST.forEach(a => { const o = document.createElement("option"); o.value = a.id; o.textContent = a.label; sel.appendChild(o); });
}

function toggleSubcatField() {
  const subcatEl = $("#e_subcategoria");
  const field = subcatEl?.closest(".field");
  const isAnalise = $("#e_categoria")?.value === "analise";
  if (field) field.style.display = isAnalise ? "" : "none";
  if (!isAnalise && subcatEl) subcatEl.value = "";
}

function snapshotEditorInitialValues() {
  ["#e_title", "#e_text", "#e_categoria", "#e_subcategoria", "#e_formato", "#e_status", "#e_ai", "#e_tags", "#e_quando", "#e_nao_quando", "#e_saida", "#e_note"].forEach(sel => {
    const el = $(sel);
    if (el) el.dataset.initial = el.value || "";
  });
}

$("#btnSavePrompt").addEventListener("click", () => {
  const title = $("#e_title").value.trim();
  const text = norm($("#e_text").value);
  if (!title) { toast("Título é obrigatório 🙂"); return; }
  if (!text) { toast("Texto é obrigatório 🙂"); return; }

  const categoria = $("#e_categoria").value || "analise";
  const status = $("#e_status").value || "teste";

  const p = {
    id: S.editingId || uid(),
    title,
    text,
    categoria,
    subcategoria: $("#e_subcategoria").value || "",
    formato: $("#e_formato").value || "",
    status,
    ai: $("#e_ai").value || "",
    tags: parseTags($("#e_tags").value),
    quandoUsar: $("#e_quando").value.trim(),
    naoUsarQuando: $("#e_nao_quando").value.trim(),
    saidaEsperada: $("#e_saida").value.trim(),
    note: $("#e_note").value.trim(),
    pinned: _editorPinned,
    updatedAt: nowISO(),
    createdAt: S.editingId ? (allPrompts().find(x => x.id === S.editingId)?.createdAt || nowISO()) : nowISO(),
  };

  if (S.editingId) {
    const idx = data.prompts.findIndex(x => x.id === S.editingId);
    if (idx >= 0) data.prompts[idx] = p;
    toast("Prompt atualizado ✅");
  } else {
    data.prompts.push(p);
    toast("Prompt criado ✅");
  }
  S.cat = p.status === "arquivado" ? "arquivados" : (EDITABLE_CATS.some(c => c.id === p.categoria) ? p.categoria : "analise");
  saveUIState();
  save(data); closeEditor(true); render();
});

$("#btnDeletePrompt").addEventListener("click", () => {
  $("#deleteModal").classList.add("show");
});
$("#btnCancelDelete").addEventListener("click", () => {
  $("#deleteModal").classList.remove("show");
});
$("#deleteModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) $("#deleteModal").classList.remove("show");
});
$("#btnConfirmDelete").addEventListener("click", () => {
  const idx = data.prompts.findIndex(x => x.id === S.editingId);
  if (idx >= 0) {
    S.lastDeletedPrompt = { ...data.prompts[idx] };
    data.prompts[idx].deletedAt = nowISO();
    data.prompts[idx].updatedAt = nowISO();

    clearTimeout(S.undoTimeout);
    S.undoTimeout = setTimeout(() => { S.lastDeletedPrompt = null; }, 30000);
  }
  save(data); closeEditor(true); render();
  const deletedToast = toast("Prompt excluído 🗑️");

  if (S.lastDeletedPrompt) {
    const t = deletedToast;
    const undoId = S.lastDeletedPrompt.id; // capture by value, not reference
    if (t) {
      const btnUndo = document.createElement("button");
      btnUndo.textContent = "Desfazer";
      btnUndo.style.cssText = "margin-left:8px;background:none;border:none;color:var(--blue);cursor:pointer;font-weight:600;text-decoration:underline;";
      btnUndo.onclick = () => {
        const rIdx = data.prompts.findIndex(x => x.id === undoId);
        if (rIdx >= 0) {
          data.prompts[rIdx].deletedAt = null;
          data.prompts[rIdx].updatedAt = nowISO();
        }
        save(data); render();
        t.remove();
        S.lastDeletedPrompt = null;
        toast("Exclusão desfeita ↩️");
      };
      t.appendChild(btnUndo);
    }
  }

  $("#deleteModal").classList.remove("show");
});

$("#btnShortcuts").addEventListener("click", () => $("#shortcutsModal").classList.add("show"));
$("#btnCloseShortcuts").addEventListener("click", () => $("#shortcutsModal").classList.remove("show"));
$("#shortcutsModal").addEventListener("click", e => { if (e.target === e.currentTarget) $("#shortcutsModal").classList.remove("show"); });

// ── STATS DASHBOARD ──
function computeStats() {
  const ps = allPrompts();
  const total = ps.length;
  let totalCopied = 0;
  let mostUsedAi = {};
  let tagsCount = {};
  let catCount = {};
  ps.forEach(p => {
    if (p.lastCopiedAt) totalCopied++;
    if (p.ai) mostUsedAi[p.ai] = (mostUsedAi[p.ai] || 0) + 1;
    if (p.categoria) catCount[p.categoria] = (catCount[p.categoria] || 0) + 1;
    (p.tags || []).forEach(t => tagsCount[t] = (tagsCount[t] || 0) + 1);
  });
  const topAi = Object.entries(mostUsedAi).sort((a, b) => b[1] - a[1])[0] || ["Nenhuma", 0];
  const topCatObj = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
  const topCat = topCatObj ? (CATS.find(c => c.id === topCatObj[0])?.name || "Outros") : "Nenhum";
  const topTag = Object.entries(tagsCount).sort((a, b) => b[1] - a[1])[0] || ["Nenhuma", 0];

  const statBox = (label, val) => `<div style="background:var(--bg3);padding:12px;border-radius:var(--r1);text-align:center;">
          <div style="font-size:24px;font-weight:700;color:var(--t1);margin-bottom:4px;">${val}</div>
          <div style="font-size:12px;color:var(--t2);text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
        </div>`;

  $("#statsContent").innerHTML = `
        ${statBox("Total Prompts", total)}
        ${statBox("Eixo Produtivo", topCat)}
        ${statBox("IA Favorita", topAi[0].toUpperCase())}
        ${statBox("Tag Popular", topTag[0] !== "Nenhuma" ? "#" + topTag[0] : "-")}
        <div style="grid-column:1/-1;margin-top:8px;font-size:13px;text-align:center;color:var(--t3);">
          ⭐ Fixados: ${ps.filter(x => x.pinned).length} &nbsp;|&nbsp; 📋 Copiados: ${totalCopied}
        </div>
      `;
}
$("#btnStats").addEventListener("click", () => {
  computeStats();
  $("#statsModal").classList.add("show");
});
const closeStats = () => $("#statsModal").classList.remove("show");
$("#btnCloseStats").addEventListener("click", closeStats);
$("#btnStatsOk").addEventListener("click", closeStats);
$("#statsModal").addEventListener("click", e => { if (e.target === e.currentTarget) closeStats(); });

// ── Actions ──
let pendingCopyText = "";
let pendingCopyId = null;

function copyPrompt(id) {
  const p = allPrompts().find(x => x.id === id); if (!p) return;
  const text = p.text || "";
  const matches = [...text.matchAll(/\{\{([^}]+)\}\}/g)];

  if (matches.length > 0) {
    const uniqueVars = [...new Set(matches.map(m => m[1]))];
    const container = $("#varFieldsContainer");
    container.innerHTML = "";

    uniqueVars.forEach(v => {
      const field = document.createElement("div");
      field.className = "field";
      field.innerHTML = `<label>${esc(v)}</label><input type="text" data-var="${esc(v)}" placeholder="Valor para ${esc(v)}">`;
      container.appendChild(field);
    });

    pendingCopyText = text;
    pendingCopyId = id;
    $("#varModal").classList.add("show");
    setTimeout(() => container.querySelector("input")?.focus(), 100);
  } else {
    doCopy(text, id);
  }
}

function doCopy(text, sourceId = null) {
  if (sourceId) {
    const p = allPrompts().find(x => x.id === sourceId);
    if (p) { p.lastCopiedAt = nowISO(); save(data, false); }
  }
  navigator.clipboard.writeText(text).then(() => toast("Copiado ✅")).catch(() => toast("Erro ao copiar ❌"));
}

$("#btnCancelVarModal").addEventListener("click", () => { pendingCopyText = ""; $("#varModal").classList.remove("show"); });
$("#varModal").addEventListener("click", e => { if (e.target === e.currentTarget) { pendingCopyText = ""; $("#varModal").classList.remove("show"); } });
$("#btnConfirmVarModal").addEventListener("click", () => {
  if (!pendingCopyText) { $("#varModal").classList.remove("show"); return; }
  let finalTxt = pendingCopyText;
  const inputs = document.querySelectorAll("#varFieldsContainer input");
  inputs.forEach(inp => {
    const v = inp.dataset.var;
    const val = inp.value || `{{${v}}}`;
    finalTxt = finalTxt.replaceAll(`{{${v}}}`, val);
  });
  doCopy(finalTxt, pendingCopyId);
  $("#varModal").classList.remove("show");
});
function duplicatePrompt(id) {
  const p = allPrompts().find(x => x.id === id); if (!p) return;
  const copy = { ...p, id: uid(), title: "[Cópia] " + p.title, status: "teste", pinned: false, createdAt: nowISO(), updatedAt: nowISO() };
  data.prompts.push(copy); save(data); render();
  toast("Prompt duplicado 🔁");
  openEditor(copy.id);
}

function exportSinglePrompt(id) {
  const p = allPrompts().find(x => x.id === id); if (!p) return;
  const wrapped = { version: 3, createdAt: p.createdAt, updatedAt: p.updatedAt, prompts: [p] };
  dl(`prompt_${p.id}.json`, JSON.stringify(wrapped, null, 2));
  toast("Prompt exportado ⬇️");
}

// ── New prompt button ──
$("#btnNewPrompt").addEventListener("click", () => openEditor(null));

// ── Search ──
const renderMainDebounced = debounce(() => renderMain(), 140);
function updateClearBtnVisibility() {
  const gs = $("#globalSearch"); const ss = $("#sideSearch");
  $("#btnClearGlobalSearch")?.classList.toggle("visible", !!(gs && gs.value));
  $("#btnClearSideSearch")?.classList.toggle("visible", !!(ss && ss.value));
}
$("#globalSearch").addEventListener("input", e => {
  S.search = e.target.value; S.sideSearch = "";
  const side = $("#sideSearch"); if (side) side.value = "";
  updateClearBtnVisibility();
  renderMainDebounced();
});
document.addEventListener("input", e => {
  if (e.target.id === "sideSearch") {
    S.sideSearch = e.target.value; S.search = "";
    $("#globalSearch").value = "";
    updateClearBtnVisibility();
    renderMainDebounced();
  }
});
$("#btnClearGlobalSearch").addEventListener("click", () => {
  S.search = ""; $("#globalSearch").value = "";
  updateClearBtnVisibility(); renderMain();
});
document.addEventListener("click", e => {
  if (e.target.id === "btnClearSideSearch") {
    S.sideSearch = ""; const ss = $("#sideSearch"); if (ss) ss.value = "";
    updateClearBtnVisibility(); renderMain();
  }
});
$("#btnClearFilters").addEventListener("click", () => {
  S.search = ""; S.sideSearch = ""; S.filterFormato = ""; S.filterStatus = ""; S.filterTags = []; S.filterAis = [];
  $("#globalSearch").value = ""; const side = $("#sideSearch"); if (side) side.value = "";
  renderSidePanel(); renderMain();
});

// ── Theme ──
$("#btnTheme").addEventListener("click", () => { const n = getTheme() === "light" ? "dark" : "light"; setTheme(n); toast(n === "light" ? "Tema claro ☀️" : "Tema escuro 🌙"); });

// ── Settings / Data actions ──
function dl(name, content, type = "application/json") {
  const b = new Blob([content], { type }); const u = URL.createObjectURL(b);
  const a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
}
$("#btnSettings").addEventListener("click", () => { if (typeof openDriveSetupModal === "function") openDriveSetupModal(); });
$("#btnExport").addEventListener("click", () => { dl("banco-prompts.json", JSON.stringify(data, null, 2)); toast("Exportado ⬇️"); });
$("#btnImport").addEventListener("click", () => $("#importFile").click());
$("#importFile").addEventListener("change", async e => {
  const f = e.target.files?.[0]; if (!f) return;
  if (f.size > 5 * 1024 * 1024) { await customAlert("Erro", "Arquivo muito grande (max 5MB)."); e.target.value = ""; return; }
  try {
    const d = JSON.parse(await f.text());
    if (d?.version === 3 && Array.isArray(d.prompts)) {
      const proceed = await customConfirm("Atenção", "Importar vai substituir os dados atuais. Deseja continuar?");
      if (!proceed) return;
      data = normalizePromptPayload(d); save(data, false); render(); toast("Importado ✅");
    } else if (d?.version === 2 && Array.isArray(d.categories)) {
      const migrate = await customConfirm("Migração v2", "Arquivo v2 detectado. Migrar e combinar com os dados atuais?");
      if (!migrate) return;
      const mig = migrateV2toV3(d); data = mergeData(data, mig); save(data); render(); toast("Migrado e combinado ✅");
    } else { await customAlert("Atenção", "Formato de arquivo não reconhecido."); }
  } catch (err) { await customAlert("Falha ao Importar", "Erro: " + err.message); } finally { e.target.value = ""; }
});

// ── Keyboard ──
document.addEventListener("keydown", async e => {
  const cmd = e.ctrlKey || e.metaKey; const k = e.key.toLowerCase();
  const isInput = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
  if (k === "escape") {
    if ($("#customAlertOverlay").classList.contains("show")) {
      $("#btnCustomAlertCancel")?.click();
    } else if ($("#paletteOverlay").classList.contains("show")) {
      closePalette();
    } else if ($("#editorOverlay").classList.contains("show")) {
      if (!isInput) await closeEditor();
    } else if (!isInput) {
      closeDrawer();
    }
  }
  if (cmd && k === "enter") { if ($("#editorOverlay").classList.contains("show")) { e.preventDefault(); $("#btnSavePrompt").click(); } }
  if (cmd && k === "k") {
    e.preventDefault();
    openPalette();
  }
  if (cmd && k === "n") {
    const tag = (document.activeElement?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || document.activeElement?.isContentEditable) return;
    e.preventDefault(); openEditor(null);
  }
  if (cmd && k === "/") {
    e.preventDefault();
    $("#shortcutsModal").classList.add("show");
  }
  if (cmd && k === "d") {
    if (S.openPromptId && !$("#editorOverlay").classList.contains("show")) {
      e.preventDefault();
      duplicatePrompt(S.openPromptId);
    }
  }
});

// ── Mobile panel toggle ──
(function () {
  const panel = $("#sidePanel");
  const btn = $("#btnMobilePanelToggle");
  if (!panel || !btn) return;
  const PANEL_COLLAPSED_KEY = "bpMobilePanelCollapsed";
  if (localStorage.getItem(PANEL_COLLAPSED_KEY) === "1") panel.classList.add("collapsed");
  btn.addEventListener("click", () => {
    panel.classList.toggle("collapsed");
    lsSet(PANEL_COLLAPSED_KEY, panel.classList.contains("collapsed") ? "1" : "0");
  });
})();

// ── Metadata Manager ──
let _metaTab = "categorias";

function openMetaManager() {
  _metaTab = "categorias";
  renderMetaManager();
  $("#metaManagerModal").classList.add("show");
}
function closeMetaManager() { $("#metaManagerModal").classList.remove("show"); }

$("#btnMetaManager").addEventListener("click", openMetaManager);
$("#btnCloseMetaManager").addEventListener("click", closeMetaManager);
$("#btnCloseMetaManager2").addEventListener("click", closeMetaManager);
$("#metaManagerModal").addEventListener("click", e => { if (e.target === e.currentTarget) closeMetaManager(); });

$("#btnResetMeta").addEventListener("click", async () => {
  const yes = await customConfirm("Restaurar Padrão", "Isso vai restaurar todos os metadados para os valores originais. Os prompts existentes não serão alterados, mas podem perder a referência a itens customizados. Continuar?");
  if (!yes) return;
  CATS.splice(0, CATS.length, ...DEFAULT_CATS);
  SUBCATS.splice(0, SUBCATS.length, ...DEFAULT_SUBCATS);
  FORMATO_LIST.splice(0, FORMATO_LIST.length, ...DEFAULT_FORMATO_LIST);
  STATUS_LIST.splice(0, STATUS_LIST.length, ...DEFAULT_STATUS_LIST);
  AI_LIST.splice(0, AI_LIST.length, ...DEFAULT_AI_LIST);
  saveCustomMeta();
  renderMetaManager();
  render();
  toast("Metadados restaurados ↩️");
});

const META_TABS_CONFIG = [
  { id: "categorias", label: "📂 Categorias", icon: "📂" },
  { id: "subcategorias", label: "📁 Subcategorias", icon: "📁" },
  { id: "formatos", label: "📝 Formatos", icon: "📝" },
  { id: "status", label: "🏷️ Status", icon: "🏷️" },
  { id: "ias", label: "🤖 IAs", icon: "🤖" },
];

function renderMetaManager() {
  // Tabs
  const tabs = $("#metaTabs"); tabs.innerHTML = "";
  META_TABS_CONFIG.forEach(t => {
    const btn = document.createElement("button");
    btn.className = "sort-chip" + (_metaTab === t.id ? " active" : "");
    btn.textContent = t.label;
    btn.addEventListener("click", () => { _metaTab = t.id; renderMetaManager(); });
    tabs.appendChild(btn);
  });

  // Content
  const content = $("#metaContent"); content.innerHTML = "";
  switch (_metaTab) {
    case "categorias": renderMetaList(content, CATS, "categorias", ["id", "name", "icon", "desc"], ["todos", "arquivados"]); break;
    case "subcategorias": renderMetaList(content, SUBCATS, "subcategorias", ["id", "name", "desc"], []); break;
    case "formatos": renderMetaList(content, FORMATO_LIST, "formatos", ["id", "label"], []); break;
    case "status": renderMetaList(content, STATUS_LIST, "status", ["id", "label"], []); break;
    case "ias": renderMetaList(content, AI_LIST, "ias", ["id", "label"], []); break;
  }
}

const FIELD_LABELS = {
  id: "ID (slug)", name: "Nome", icon: "Ícone/Emoji", desc: "Descrição", label: "Label (com emoji)"
};

function renderMetaList(container, arr, type, fields, protectedIds) {
  // Item list
  arr.forEach((item, idx) => {
    const isProtected = protectedIds.includes(item.id);
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:var(--bg3);margin-bottom:6px;";

    const info = document.createElement("div"); info.style.cssText = "flex:1;min-width:0;";
    if (type === "categorias") {
      info.innerHTML = `<span style="font-size:16px;">${esc(item.icon || "")}</span> <strong>${esc(item.name || item.id)}</strong> <span style="font-size:11px;color:var(--t3);">(${esc(item.id)})</span> <span style="font-size:11px;color:var(--t3);display:block;margin-top:2px;">${esc(item.desc || "")}</span>`;
    } else if (fields.includes("label")) {
      info.innerHTML = `<strong>${esc(item.label || item.id)}</strong> <span style="font-size:11px;color:var(--t3);">(${esc(item.id)})</span>`;
    } else {
      info.innerHTML = `<strong>${esc(item.name || item.id)}</strong> <span style="font-size:11px;color:var(--t3);">(${esc(item.id)})</span>${item.desc ? `<span style="font-size:11px;color:var(--t3);display:block;margin-top:2px;">${esc(item.desc)}</span>` : ""}`;
    }
    row.appendChild(info);

    if (!isProtected) {
      const btnEdit = document.createElement("button"); btnEdit.className = "btn ghost icon"; btnEdit.textContent = "✏️"; btnEdit.title = "Editar";
      btnEdit.addEventListener("click", () => openMetaEditForm(container, arr, type, fields, protectedIds, idx));
      row.appendChild(btnEdit);
      const btnDel = document.createElement("button"); btnDel.className = "btn ghost icon"; btnDel.textContent = "🗑️"; btnDel.title = "Excluir";
      btnDel.addEventListener("click", async () => {
        const yes = await customConfirm("Excluir", `Excluir "${item.name || item.label || item.id}"? Prompts existentes com esse valor permanecerão, mas sem label.`);
        if (!yes) return;
        arr.splice(idx, 1);
        saveCustomMeta();
        renderMetaManager();
        render();
        toast("Item excluído 🗑️");
      });
      row.appendChild(btnDel);
    } else {
      const lock = document.createElement("span"); lock.style.cssText = "font-size:11px;color:var(--t3);padding:0 8px;"; lock.textContent = "🔒 Protegido";
      row.appendChild(lock);
    }

    container.appendChild(row);
  });

  // Add new form
  const addSection = document.createElement("div");
  addSection.style.cssText = "margin-top:14px;padding:12px;border-radius:10px;border:1px dashed var(--line2);";
  addSection.innerHTML = `<div style="font-weight:600;margin-bottom:8px;">+ Adicionar novo</div>`;
  const formGrid = document.createElement("div"); formGrid.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;";

  const inputs = {};
  const visibleFields = fields.filter(f => f !== "id"); // hide ID field
  visibleFields.forEach(f => {
    const wrap = document.createElement("div"); wrap.style.cssText = "flex:1;min-width:100px;";
    wrap.innerHTML = `<label style="font-size:11px;color:var(--t2);display:block;margin-bottom:3px;">${esc(FIELD_LABELS[f] || f)}</label>`;
    const inp = document.createElement("input"); inp.type = "text"; inp.placeholder = FIELD_LABELS[f] || f;
    inp.style.cssText = "width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--line2);background:var(--bg2);color:var(--t1);font-size:13px;";
    inputs[f] = inp;
    wrap.appendChild(inp);
    formGrid.appendChild(wrap);
  });

  function _slugify(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  const btnAdd = document.createElement("button"); btnAdd.className = "btn primary sm"; btnAdd.textContent = "Adicionar"; btnAdd.style.height = "32px";
  btnAdd.addEventListener("click", () => {
    const nameVal = (inputs.name?.value || inputs.label?.value || "").trim();
    if (!nameVal) { toast("Preencha o nome/label"); return; }
    const id = _slugify(nameVal);
    if (!id) { toast("Nome inválido para gerar ID"); return; }
    if (arr.some(x => x.id === id)) { toast("Já existe um item com esse ID: " + id); return; }
    const newItem = { id };
    visibleFields.forEach(f => { newItem[f] = (inputs[f]?.value || "").trim(); });
    arr.push(newItem);
    saveCustomMeta();
    renderMetaManager();
    render();
    toast("Item adicionado ✅");
  });
  formGrid.appendChild(btnAdd);
  addSection.appendChild(formGrid);
  container.appendChild(addSection);
}

function openMetaEditForm(container, arr, type, fields, protectedIds, idx) {
  const item = arr[idx];
  container.innerHTML = "";

  const heading = document.createElement("div"); heading.style.cssText = "font-weight:700;margin-bottom:12px;font-size:15px;";
  heading.textContent = `✏️ Editar: ${item.name || item.label || item.id}`;
  container.appendChild(heading);

  const formGrid = document.createElement("div"); formGrid.style.cssText = "display:flex;flex-direction:column;gap:10px;";
  const inputs = {};
  fields.forEach(f => {
    const wrap = document.createElement("div");
    wrap.innerHTML = `<label style="font-size:12px;color:var(--t2);display:block;margin-bottom:3px;font-weight:500;">${esc(FIELD_LABELS[f] || f)}</label>`;
    const inp = document.createElement("input"); inp.type = "text"; inp.value = item[f] || "";
    if (f === "id") inp.disabled = true;
    inp.style.cssText = "width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line2);background:var(--bg2);color:var(--t1);font-size:13px;";
    inputs[f] = inp;
    wrap.appendChild(inp);
    formGrid.appendChild(wrap);
  });
  container.appendChild(formGrid);

  const actions = document.createElement("div"); actions.style.cssText = "display:flex;gap:8px;margin-top:14px;";
  const btnCancel = document.createElement("button"); btnCancel.className = "btn ghost"; btnCancel.textContent = "Cancelar";
  btnCancel.addEventListener("click", () => renderMetaManager());
  const btnSave = document.createElement("button"); btnSave.className = "btn primary"; btnSave.textContent = "Salvar";
  btnSave.addEventListener("click", () => {
    fields.forEach(f => { if (f !== "id") item[f] = (inputs[f]?.value || "").trim(); });
    saveCustomMeta();
    renderMetaManager();
    render();
    toast("Item atualizado ✅");
  });
  actions.appendChild(btnCancel); actions.appendChild(btnSave);
  container.appendChild(actions);
}