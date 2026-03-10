
const data = {
  prompts: []
};

// Generate 10,000 mock prompts
for (let i = 0; i < 10000; i++) {
  data.prompts.push({
    id: `id-${i}`,
    title: `Prompt Title ${i}`,
    text: `Some long text for prompt ${i} that might contain search words.`,
    categoria: i % 2 === 0 ? "analise" : "triagem",
    subcategoria: `eixo${(i % 4) + 1}`,
    formato: i % 3 === 0 ? "paragrafo" : "pente-fino",
    status: i % 5 === 0 ? "homologado" : "teste",
    ai: i % 2 === 0 ? "gpt" : "claude",
    tags: [`tag${i % 10}`, `tag${(i + 1) % 10}`],
    quandoUsar: "Some usage info",
    note: "Some internal note",
    deletedAt: null
  });
}

function allPrompts() { return (data.prompts || []).filter(p => !p.deletedAt); }

function promptsForCat(cat, S) {
  if (cat === "todos") return allPrompts();
  if (cat === "arquivados") return allPrompts().filter(p => p.status === "arquivado" || p.categoria === "arquivados");
  return allPrompts().filter(p => {
    if (p.status === "arquivado" && p.categoria !== "arquivados") return false;
    if (cat === "analise") return p.categoria === "analise";
    return p.categoria === cat;
  });
}

function filteredPromptsBaseOriginal(S) {
  let ps = promptsForCat(S.cat, S);
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
  if (S.filterTags.length) ps = ps.filter(p => S.filterTags.every(ft => (p.tags || []).includes(ft)));
  if (S.filterAis.length) ps = ps.filter(p => S.filterAis.includes((p.ai || "").toLowerCase()));
  return ps;
}

function filteredPromptsBaseOptimized(S) {
  let ps = promptsForCat(S.cat, S);

  const q = (S.search || S.sideSearch).trim().toLowerCase();
  const words = q ? q.split(/\s+/).filter(Boolean) : null;

  const hasSubcat = S.cat === "analise" && S.subcat;
  const hasFormato = !!S.filterFormato;
  const hasStatus = !!S.filterStatus;
  const hasTags = S.filterTags.length > 0;
  const hasAis = S.filterAis.length > 0;

  if (!hasSubcat && !words && !hasFormato && !hasStatus && !hasTags && !hasAis) {
    return ps;
  }

  return ps.filter(p => {
    if (hasSubcat && p.subcategoria !== S.subcat) return false;

    if (words) {
      const content = [p.title, p.text, ...(p.tags || []), p.quandoUsar, p.note].filter(Boolean).join(" ").toLowerCase();
      if (!words.every(w => content.includes(w))) return false;
    }

    if (hasFormato && p.formato !== S.filterFormato) return false;
    if (hasStatus && p.status !== S.filterStatus) return false;

    if (hasTags) {
      if (!S.filterTags.every(ft => (p.tags || []).includes(ft))) return false;
    }

    if (hasAis) {
      if (!S.filterAis.includes((p.ai || "").toLowerCase())) return false;
    }

    return true;
  });
}

const states = [
  { cat: "todos", subcat: "", search: "", sideSearch: "", filterFormato: "", filterStatus: "", filterTags: [], filterAis: [] },
  { cat: "analise", subcat: "eixo1", search: "prompt", sideSearch: "", filterFormato: "paragrafo", filterStatus: "homologado", filterTags: ["tag1"], filterAis: ["gpt"] },
  { cat: "triagem", subcat: "", search: "", sideSearch: "search", filterFormato: "", filterStatus: "teste", filterTags: ["tag2", "tag3"], filterAis: [] },
];

function runBenchmark() {
  console.log("Starting benchmark...");

  for (const S of states) {
    console.log(`\nTesting state: ${JSON.stringify(S)}`);

    const resOrig = filteredPromptsBaseOriginal(S);
    const resOpt = filteredPromptsBaseOptimized(S);

    if (resOrig.length !== resOpt.length) {
      throw new Error(`Length mismatch: ${resOrig.length} vs ${resOpt.length}`);
    }
    for (let i = 0; i < resOrig.length; i++) {
      if (resOrig[i].id !== resOpt[i].id) {
        throw new Error(`ID mismatch at index ${i}: ${resOrig[i].id} vs ${resOpt[i].id}`);
      }
    }
    console.log("Behavioral parity verified.");

    const iterations = 1000;

    let start = Date.now();
    for (let i = 0; i < iterations; i++) {
      filteredPromptsBaseOriginal(S);
    }
    const timeOrig = Date.now() - start;
    console.log(`Original: ${timeOrig}ms for ${iterations} iterations`);

    start = Date.now();
    for (let i = 0; i < iterations; i++) {
      filteredPromptsBaseOptimized(S);
    }
    const timeOpt = Date.now() - start;
    console.log(`Optimized: ${timeOpt}ms for ${iterations} iterations`);

    const improvement = ((timeOrig - timeOpt) / timeOrig * 100).toFixed(2);
    console.log(`Improvement: ${improvement}%`);
  }
}

runBenchmark();
