// ── Boot ──
loadCatOrder();
loadManualOrder();
loadSubcatOrder();
loadUIState();

// ── Global Error Boundaries ──
window.addEventListener("error", (e) => {
  if (e.message?.includes("ResizeObserver")) return; // Ignorar warning benigno comum em extensões/chrome
  console.error("Global Error Caught:", e.error || e.message);
  if (typeof toast === "function") toast("Ocorreu um erro inesperado ❌");
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled Promise Rejection:", e.reason);
  if (typeof toast === "function") toast("Falha temporal na comunicação ⚠️");
});

window.addEventListener("beforeunload", e => {
  if (editorHasChanges()) {
    e.preventDefault();
    e.returnValue = "";
  }
  // Always flush pending data to localStorage before unload
  clearTimeout(_lsTimer);
  try {
    localStorage.setItem(LS_KEY_V3, JSON.stringify(data));
  } catch (err) {
    console.warn("Falha ao persistir antes de sair:", err);
  }
});

// Deep Linking intercept
function handleHash(isBoot = false) {
  const hash = window.location.hash.substring(1);
  if (hash) {
    const p = allPrompts().find(x => x.id === hash);
    if (p) {
      S.cat = (p.status === "arquivado" || p.categoria === "arquivados") ? "arquivados" : (EDITABLE_CATS.some(c => c.id === p.categoria) ? p.categoria : "analise");
      if (p.subcategoria) S.subcat = p.subcategoria;
      syncPromptSortForCurrentCat();
      saveUIState();
      if (!isBoot) render();
      setTimeout(() => openDrawer(hash), 50);
      return true;
    } else {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }
  return false;
}
window.addEventListener("hashchange", () => handleHash(false));

handleHash(true);
render();