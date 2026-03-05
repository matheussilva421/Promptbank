// ── Boot ──
loadCatOrder();
loadManualOrder();
loadSubcatOrder();
loadUIState();

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