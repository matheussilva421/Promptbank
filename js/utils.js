// ── Utils ──
    const $ = (s, r = document) => r.querySelector(s);
    const uid = () => Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
    const nowISO = () => new Date().toISOString();
    const esc = s => String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
    const normalizeTag = t => (t || "").trim().toLowerCase();
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
      html = html.replace(/\*\*(?!&[a-z]{1,5};)([^<]+?)\*\*/g, "<strong>$1</strong>");
      // Italic
      html = html.replace(/\*(?!&[a-z]{1,5};)([^<]+?)\*/g, "<em>$1</em>");
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

    function normalizePromptPayload(d) {
      if (!d?.prompts || !Array.isArray(d.prompts)) return d;
      let changed = false;
      const newPrompts = d.prompts.map(p => {
        const tags = [...new Set((Array.isArray(p.tags) ? p.tags : []).map(normalizeTag).filter(Boolean))];
        const ai = (p.ai || "").trim().toLowerCase();
        // Preserva o deletedAt caso exista
        const isDeleted = !!p.deletedAt;
        if (JSON.stringify(tags) !== JSON.stringify(p.tags || []) || ai !== (p.ai || "")) changed = true;
        const np = { ...p, tags, ai };
        if (isDeleted) np.deletedAt = p.deletedAt;
        return np;
      });
      if (changed) return { ...d, prompts: newPrompts, updatedAt: nowISO() };
      return { ...d, prompts: newPrompts };
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
        if (r) { const d = JSON.parse(r); if (d?.version === 2 && Array.isArray(d.categories)) { toast("Dados migrados para v5 ✅"); return migrateV2toV3(d); } }
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