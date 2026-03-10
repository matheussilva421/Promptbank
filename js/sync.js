const GDRIVE_LS_KEY = "bancoPrompts_driveClientId";
const GDRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GDRIVE_FNAME = "banco_prompts.json";
const CFSYNC_URL_KEY = "bancoPrompts_cfSyncUrl";
const CFSYNC_TOKEN_KEY = "bancoPrompts_cfSyncToken";

function getSyncPayload(content) {
  const payload = { ...content };
  payload.customMeta = {
    CATS: typeof CATS !== "undefined" ? CATS : [],
    SUBCATS: typeof SUBCATS !== "undefined" ? SUBCATS : [],
    FORMATO_LIST: typeof FORMATO_LIST !== "undefined" ? FORMATO_LIST : [],
    STATUS_LIST: typeof STATUS_LIST !== "undefined" ? STATUS_LIST : [],
    AI_LIST: typeof AI_LIST !== "undefined" ? AI_LIST : []
  };
  payload.uiOrders = {
    catOrder: typeof S !== "undefined" ? S.catOrder : [],
    manualOrder: typeof S !== "undefined" ? S.manualOrder : {},
    subcatOrder: localStorage.getItem("bancoPrompts_subcatOrder_v1") || "[]"
  };
  return payload;
}

function applySyncPayload(remote) {
  if (remote.customMeta) {
    const rm = remote.customMeta;
    if (Array.isArray(rm.CATS)) CATS.splice(0, CATS.length, ...rm.CATS);
    if (Array.isArray(rm.SUBCATS)) SUBCATS.splice(0, SUBCATS.length, ...rm.SUBCATS);
    if (Array.isArray(rm.FORMATO_LIST)) FORMATO_LIST.splice(0, FORMATO_LIST.length, ...rm.FORMATO_LIST);
    if (Array.isArray(rm.STATUS_LIST)) STATUS_LIST.splice(0, STATUS_LIST.length, ...rm.STATUS_LIST);
    if (Array.isArray(rm.AI_LIST)) AI_LIST.splice(0, AI_LIST.length, ...rm.AI_LIST);
    if (typeof saveCustomMeta === "function") saveCustomMeta();
  }
  if (remote.uiOrders && typeof S !== "undefined") {
    const ru = remote.uiOrders;
    if (Array.isArray(ru.catOrder)) { S.catOrder = ru.catOrder; if (typeof saveCatOrder === "function") saveCatOrder(); }
    if (ru.manualOrder && typeof ru.manualOrder === "object") { S.manualOrder = ru.manualOrder; if (typeof saveManualOrder === "function") saveManualOrder(); }
    if (typeof ru.subcatOrder === "string") { lsSet("bancoPrompts_subcatOrder_v1", ru.subcatOrder); if (typeof loadSubcatOrder === "function") loadSubcatOrder(); }
  }
}

let driveState = {
  clientId: localStorage.getItem(GDRIVE_LS_KEY) || "",
  token: null,
  fileId: null,
  tokenClient: null,
  syncTimer: null,
};
let cfState = {
  url: localStorage.getItem(CFSYNC_URL_KEY) || "",
  token: localStorage.getItem(CFSYNC_TOKEN_KEY) || "",
  syncTimer: null,
};
let suppressAutoSync = false;

function hasGoogleConfigured() { return !!driveState.clientId; }
function hasCloudflareConfigured() { return !!cfState.url; }
function hasAnyRemoteConfigured() { return hasGoogleConfigured() || hasCloudflareConfigured(); }

function driveSyncBtn(state, tip) {
  const btn = document.getElementById("btnDriveSync");
  const bar = document.getElementById("driveStatusBar");
  btn.dataset.state = state;
  btn.style.pointerEvents = state === "syncing" ? "none" : "";
  if (tip) document.getElementById("driveSyncTooltip").textContent = tip;
  if (state === "syncing") bar.textContent = "⟳";
  else if (state === "ok") bar.textContent = "✔";
  else if (state === "error") bar.textContent = "✗";
  else bar.textContent = "";
}
function refreshSyncIdleState() {
  driveSyncBtn(hasAnyRemoteConfigured() ? "idle" : "off", hasAnyRemoteConfigured() ? "Sincronizar agora" : "Configurar / Sincronizar");
}

async function driveFetch(url, init = {}) {
  if (!driveState.token) throw new Error("Google Drive não autenticado");
  const headers = { ...(init.headers || {}), "Authorization": "Bearer " + driveState.token };
  const response = await fetch(url, { ...init, headers });
  if (response.status === 401 || response.status === 403) {
    driveState.token = null;
    refreshSyncIdleState();
    customAlert("Autenticação Falhou", "Sessão do Google Drive expirada. Faça login novamente.").then(() => { if (typeof openDriveSetupModal === "function") openDriveSetupModal(); else $("#btnSettings").click(); });
    throw new Error("HTTP 401: Google Drive Sessão Expirada");
  }
  return response;
}

async function driveFindFile() {
  const q = encodeURIComponent(`name='${GDRIVE_FNAME}' and trashed=false`);
  const r = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,modifiedTime)`);
  const js = await r.json(); return js.files?.[0] || null;
}
async function driveDownload(fileId) {
  const r = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
  return await r.json();
}
async function driveUpload(content, fileId) {
  const payload = getSyncPayload(content);
  const body = JSON.stringify(payload, null, 2);
  const meta = JSON.stringify({ name: GDRIVE_FNAME, mimeType: "application/json" });
  const boundary = "bprompts_bnd";
  const multipart = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
  const url = fileId ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart` : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
  const r = await driveFetch(url, { method: fileId ? "PATCH" : "POST", headers: { "Content-Type": `multipart/related; boundary="${boundary}"` }, body: multipart });
  return await r.json();
}
async function driveSyncNow() {
  if (!driveState.token) return;
  if (!driveState.fileId) { const f = await driveFindFile(); driveState.fileId = f?.id || null; }
  const res = await driveUpload(data, driveState.fileId);
  if (res.id) driveState.fileId = res.id;
}
function driveSyncDebounced() {
  clearTimeout(driveState.syncTimer);
  driveSyncBtn("syncing", "Salvando...");
  driveState.syncTimer = setTimeout(async () => {
    try {
      if (!driveState.token) {
        await ensureGoogleReadyAndSync(false);
      } else {
        await driveSyncNow();
      }
      lsSet("bancoPrompts_lastSyncTime", nowISO());
      driveSyncBtn("ok", "Salvo ✔");
      setTimeout(refreshSyncIdleState, 2500);
    } catch (e) {
      console.error("[Drive]", e);
      driveSyncBtn("error", "Erro automático");
    }
  }, 2000);
}
async function driveInitialSync() {
  if (!driveState.token) return;
  const f = await driveFindFile();
  if (f) {
    driveState.fileId = f.id;
    const remote = await driveDownload(f.id);
    const localTime = new Date(data.updatedAt || 0);
    const remoteTime = new Date(remote.updatedAt || 0);
    if (remoteTime >= localTime) {
      if (remote.prompts?.length === 0 && data.prompts?.length > 0) {
        const deleteConfirm = await customConfirm(
          "AVISO CRÍTICO",
          "O Google Drive está ZERADO, mas localmente você tem dados.\nDeseja DELETAR seus dados locais e importar o estado vazio do Drive?\n\n(Clique em Cancelar para manter seus dados locais e uni-los ao Drive)"
        );
        if (!deleteConfirm) {
          await driveUpload(data, f.id);
          return;
        }
      }
      suppressAutoSync = true;
      try {
        const remoteCandidate = remote.version === 3 ? remote : (remote.version === 2 ? migrateV2toV3(remote) : data);
        const remoteNormalized = normalizePromptPayload(remoteCandidate);
        data = normalizePromptPayload(mergeData(data, remoteNormalized));
        applySyncPayload(remote);
        save(data, false); render(); toast("Dados sincronizados no Drive ☁️");

        const mergedTime = new Date(data.updatedAt || 0).getTime();
        if (mergedTime > remoteTime) {
          await driveUpload(data, f.id);
        }
      } finally {
        suppressAutoSync = false;
      }
    } else {
      // Só sobe pro Drive se a gente já tem dados locais válidos ou confirmamos a sobrescrita
      if (data.prompts && data.prompts.length > 0) {
        await driveUpload(data, f.id);
      }
    }
  } else {
    if (data.prompts && data.prompts.length > 0) {
      const res = await driveUpload(data, null);
      driveState.fileId = res.id;
    }
  }
}
function driveInitTokenClient(clientId) {
  try { driveState.tokenClient = google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: GDRIVE_SCOPE, callback: () => { } }); return true; }
  catch (e) { console.error("[Drive]", e); return false; }
}
async function ensureGoogleReadyAndSync(initial = false) {
  if (!hasGoogleConfigured()) return;
  if (typeof google === "undefined" || !google.accounts) { throw new Error("Google indisponível"); }
  if (!driveState.tokenClient) driveInitTokenClient(driveState.clientId);
  if (!driveState.tokenClient) throw new Error("Falha ao inicializar cliente OAuth do Google");
  if (driveState.token) { if (initial) await driveInitialSync(); else await driveSyncNow(); return; }
  await new Promise((resolve, reject) => {
    let didFallback = false;
    driveState.tokenClient.callback = async (resp) => {
      if (resp.error) {
        if (!initial && !didFallback && ["interaction_required", "login_required", "consent_required"].includes(resp.error)) {
          didFallback = true;
          driveState.tokenClient.requestAccessToken({ prompt: "consent" });
          return;
        }
        reject(new Error(initial ? "Google requer interação do usuário para autorizar" : resp.error)); return;
      }
      driveState.token = resp.access_token;
      setTimeout(() => { driveState.token = null; refreshSyncIdleState(); }, ((resp.expires_in || 3600) - 60) * 1000);
      try { if (initial) await driveInitialSync(); else await driveSyncNow(); resolve(); } catch (e) { reject(e); }
    };
    driveState.tokenClient.requestAccessToken({ prompt: initial ? "none" : "" });
  });
}

async function cfFetch(method, body) {
  if (!cfState.url || !cfState.url.startsWith("http")) throw new Error("Cloudflare URL não configurada ou inválida");
  const headers = {
    ...(cfState.token ? { "Authorization": "Bearer " + cfState.token } : {}),
    ...(body ? { "Content-Type": "application/json" } : {}),
  };
  const r = await fetch(cfState.url, { method, headers, body: body ? JSON.stringify(body, null, 2) : undefined });
  if (r.status === 401 || r.status === 403) {
    if (cfState.token) {
      cfState.token = "";
      localStorage.removeItem(CFSYNC_TOKEN_KEY);
      customAlert("Autenticação Falhou", "Token do Cloudflare inválido ou sessão expirada.").then(() => $("#btnSettings").click());
      throw new Error("HTTP 401: Cloudflare Token inválido");
    }
    throw new Error("HTTP 401: Cloudflare rejeitou a requisição sem autorização válida");
  }
  return r;
}
async function cfSyncNow() {
  if (!hasCloudflareConfigured()) return;
  const payload = getSyncPayload(data);
  const r = await cfFetch("POST", payload);
  if (!r.ok) throw new Error(`Cloudflare POST falhou (${r.status})`);
}
function cfSyncDebounced() {
  clearTimeout(cfState.syncTimer);
  driveSyncBtn("syncing", "Salvando...");
  cfState.syncTimer = setTimeout(async () => {
    try {
      await cfSyncNow();
      lsSet("bancoPrompts_lastSyncTime", nowISO());
      driveSyncBtn("ok", "Salvo ✔");
      setTimeout(refreshSyncIdleState, 2500);
    } catch (e) {
      console.error("[Cloudflare]", e);
      driveSyncBtn("error", "Erro automático");
    }
  }, 2000);
}
async function cfInitialSync() {
  if (!hasCloudflareConfigured()) return;
  const r = await cfFetch("GET");
  if (r.status === 404) {
    if (data.prompts && data.prompts.length > 0) {
      await cfSyncNow();
    }
    return;
  }
  if (!r.ok) throw new Error(`Cloudflare GET falhou (${r.status})`);

  let remote;
  try {
    remote = await r.json();
  } catch (e) {
    throw new Error("Cloudflare retornou um formato inválido");
  }
  if (!(remote?.version === 3 || remote?.version === 2)) return;

  const localTime = new Date(data.updatedAt || 0);
  const remoteTime = new Date(remote.updatedAt || 0);
  if (remoteTime >= localTime) {
    if (remote.prompts?.length === 0 && data.prompts?.length > 0) {
      const cfConfirm = await customConfirm(
        "AVISO CRÍTICO",
        "O Cloudflare está ZERADO (0 prompts), mas seu PC local tem dados.\nDeseja APAGAR seus dados locais e importar o estado vazio do Cloudflare?\n\n(Clique em Cancelar para manter seus dados locais e uni-los ao Cloudflare)"
      );
      if (!cfConfirm) {
        await cfSyncNow();
        return;
      }
    }
    suppressAutoSync = true;
    try {
      const remoteCandidate = remote.version === 3 ? remote : migrateV2toV3(remote);
      const remoteNormalized = normalizePromptPayload(remoteCandidate);
      data = normalizePromptPayload(mergeData(data, remoteNormalized));
      applySyncPayload(remote);
      save(data, false); render(); toast("Dados sincronizados no Cloudflare ☁️");

      const mergedTime = new Date(data.updatedAt || 0).getTime();
      if (mergedTime > remoteTime) {
        await cfSyncNow();
      }
    } finally {
      suppressAutoSync = false;
    }
  } else {
    if (data.prompts && data.prompts.length > 0) {
      await cfSyncNow();
    }
  }
}

function isGoogleInteractionRequiredError(err) {
  const msg = (err?.message || String(err)).toLowerCase();
  return msg.includes("google requer interação") || msg.includes("interaction_required") || msg.includes("login_required") || msg.includes("consent_required");
}

async function runAllSyncNow() {
  if (!hasAnyRemoteConfigured()) { openDriveSetupModal(); return; }
  driveSyncBtn("syncing", "Sincronizando Google/Cloudflare…");
  let okCount = 0, failCount = 0;
  if (hasGoogleConfigured()) {
    try { await ensureGoogleReadyAndSync(false); okCount++; }
    catch (e) { failCount++; console.error("[Sync][Google]", e); }
  }
  if (hasCloudflareConfigured()) {
    try { await cfSyncNow(); okCount++; }
    catch (e) { failCount++; console.error("[Sync][Cloudflare]", e); }
  }
  if (okCount > 0 && failCount === 0) {
    driveSyncBtn("ok", "Sincronizado ✔");
    setTimeout(refreshSyncIdleState, 2500);
  } else if (okCount > 0) {
    driveSyncBtn("error", "Sync parcial (ver console)");
  } else {
    driveSyncBtn("error", "Erro — clique para tentar");
  }
}

async function runInitialSyncs() {
  driveSyncBtn("syncing", "Conectando sincronizações…");
  let okCount = 0, failCount = 0;
  if (hasGoogleConfigured()) {
    try { await ensureGoogleReadyAndSync(true); okCount++; }
    catch (e) {
      if (isGoogleInteractionRequiredError(e)) {
        console.warn("[Sync inicial][Google] interação do usuário necessária.");
      } else {
        failCount++;
        console.error("[Sync inicial][Google]", e);
      }
    }
  }
  if (hasCloudflareConfigured()) {
    try { await cfInitialSync(); okCount++; }
    catch (e) { failCount++; console.error("[Sync inicial][Cloudflare]", e); }
  }
  if (okCount > 0 && failCount === 0) refreshSyncIdleState();
  else if (okCount > 0) driveSyncBtn("error", "Sync inicial parcial");
  else driveSyncBtn("error", "Erro na sincronização");
}

document.getElementById("btnDriveSync").addEventListener("click", runAllSyncNow);

function openDriveSetupModal() {
  document.getElementById("driveSetupError").textContent = "";
  document.getElementById("driveClientIdInput").value = driveState.clientId || "";
  document.getElementById("cfSyncUrlInput").value = cfState.url || "";
  document.getElementById("cfSyncTokenInput").value = cfState.token || "";
  document.getElementById("btnDriveSetupDisconnect").style.display = hasGoogleConfigured() ? "inline-flex" : "none";
  document.getElementById("btnCfSetupDisconnect").style.display = hasCloudflareConfigured() ? "inline-flex" : "none";
  document.getElementById("driveSetupModal").classList.add("show");
  setTimeout(() => document.getElementById("cfSyncUrlInput").focus(), 50);
}

function closeDriveSetupModal() { document.getElementById("driveSetupModal").classList.remove("show"); }
document.getElementById("btnDriveSetupClose").addEventListener("click", closeDriveSetupModal);
document.getElementById("driveSetupModal").addEventListener("click", e => { if (e.target === e.currentTarget) closeDriveSetupModal(); });

document.getElementById("btnDriveSetupDisconnect").addEventListener("click", async () => {
  const ok = await customConfirm("Desconectar", "Desconectar Google Drive?");
  if (!ok) return;
  driveState = { ...driveState, clientId: "", token: null, fileId: null, tokenClient: null };
  localStorage.removeItem(GDRIVE_LS_KEY);
  document.getElementById("driveClientIdInput").value = "";
  openDriveSetupModal();
  refreshSyncIdleState();
});
document.getElementById("btnCfSetupDisconnect").addEventListener("click", async () => {
  const ok = await customConfirm("Desconectar", "Desconectar Cloudflare?");
  if (!ok) return;
  cfState = { ...cfState, url: "", token: "" };
  localStorage.removeItem(CFSYNC_URL_KEY); localStorage.removeItem(CFSYNC_TOKEN_KEY);
  document.getElementById("cfSyncUrlInput").value = "";
  document.getElementById("cfSyncTokenInput").value = "";
  openDriveSetupModal();
  refreshSyncIdleState();
});

document.getElementById("btnDriveSetupSave").addEventListener("click", async () => {
  const clientId = document.getElementById("driveClientIdInput").value.trim();
  const cfUrl = document.getElementById("cfSyncUrlInput").value.trim();
  const cfToken = document.getElementById("cfSyncTokenInput").value.trim();
  const err = document.getElementById("driveSetupError");

  if (clientId && !clientId.includes(".apps.googleusercontent.com")) { err.textContent = "Client ID Google inválido."; return; }
  if (cfUrl && !/^https:\/\//i.test(cfUrl)) { err.textContent = "URL Cloudflare deve iniciar com https://"; return; }
  if (cfToken && !cfUrl) { err.textContent = "Informe URL do Cloudflare."; return; }

  err.textContent = "";
  driveState.clientId = clientId;
  if (clientId) lsSet(GDRIVE_LS_KEY, clientId); else localStorage.removeItem(GDRIVE_LS_KEY);

  cfState.url = cfUrl; cfState.token = cfToken;
  if (cfUrl) lsSet(CFSYNC_URL_KEY, cfUrl); else localStorage.removeItem(CFSYNC_URL_KEY);
  if (cfToken) lsSet(CFSYNC_TOKEN_KEY, cfToken); else localStorage.removeItem(CFSYNC_TOKEN_KEY);

  closeDriveSetupModal();
  refreshSyncIdleState();
  if (hasAnyRemoteConfigured()) await runInitialSyncs();
});

window.addEventListener("localDataSaved", () => {
  if (suppressAutoSync) return;
  if (hasGoogleConfigured()) driveSyncDebounced();
  if (hasCloudflareConfigured()) cfSyncDebounced();
});

refreshSyncIdleState();
if (hasAnyRemoteConfigured()) window.addEventListener("load", () => setTimeout(runInitialSyncs, 800));