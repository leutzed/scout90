"use strict";

const numericMetrics = [...new Set([...legacyMetrics, ...Object.values(fields).map(field => field[2]).filter(Boolean)])];

function normalizeRow(row, fileName, index) {
  const validIdentity = item => Number.isSafeInteger(item?.id) && item.id > 0 &&
    typeof item.name === "string" && item.name.trim().length > 0;
  const context = fileName + ", registro " + (index + 1);
  if (!validIdentity(row?.player) || !validIdentity(row?.team) || !Number.isSafeInteger(row.minutesPlayed) || row.minutesPlayed < 0) {
    throw new Error(context + ": ID, nome ou minutos inválidos.");
  }
  const result = {...row,player:{...row.player,name:row.player.name.trim()},team:{...row.team,name:row.team.name.trim()}};
  for (const key of numericMetrics) {
    const value = row[key];
    if (value == null) continue;
    const upper = (key.endsWith("Percentage") || key.endsWith("Conversion")) ? 100 : key === "rating" ? 10 : Infinity;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > upper) {
      throw new Error(context + ": valor inválido em " + key + ".");
    }
  }
  if (result.penaltyGoals > result.goals) throw new Error(context + ": gols de pênalti excedem os gols totais.");
  return result;
}

function orderedJson(value) {
  if (Array.isArray(value)) return "[" + value.map(orderedJson).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort()
    .map(key => JSON.stringify(key) + ":" + orderedJson(value[key])).join(",") + "}";
  return JSON.stringify(value);
}

async function loadFiles(files) {
  if (!files.length) throw new Error("Selecione pelo menos um arquivo.");
  const parts = await Promise.all(files.map(async file => {
    let data;
    try { data = JSON.parse((await file.text()).replace(/^\uFEFF/,"")); }
    catch { throw new Error(file.name + ": JSON inválido."); }
    if (!Array.isArray(data?.results) || !data.results.length) {
      throw new Error(file.name + ": é necessário um vetor results com pelo menos um jogador.");
    }
    return {file:file.name, page:data.page, pages:data.pages, metadata:data.format === "scout90-competition" ? data : null,
      results:data.results.map((row,index) => normalizeRow(row,file.name,index))};
  }));
  const consolidated = parts.filter(part => part.metadata);
  if (consolidated.length && (parts.length !== 1 || consolidated[0].metadata.version !== 1)) {
    throw new Error("Importe um JSON consolidado por vez e confira se ele é da versão 1 do Scout90.");
  }
  const paginated = parts.some(part => part.page != null || part.pages != null);
  if (paginated) {
    const expected = parts[0].pages;
    const pageNumbers = new Set(parts.map(part => part.page));
    if (!Number.isInteger(expected) || expected <= 0 || parts.length !== expected || pageNumbers.size !== expected ||
        parts.some(part => part.pages !== expected || !Number.isInteger(part.page) || part.page < 1 || part.page > expected)) {
      throw new Error("Selecione todas as páginas da mesma exportação, uma vez cada.");
    }
    parts.sort((a,b) => a.page - b.page);
  }
  const results = new Map();
  const duplicatePlayers = new Set();
  for (const part of parts) {
    for (const row of part.results) {
      const key = playerKey(row);
      if (results.has(key)) {
        if (orderedJson(results.get(key)) !== orderedJson(row)) {
          throw new Error(part.file + ": registros conflitantes para jogador/clube " + key + ".");
        }
        duplicatePlayers.add(key);
      }
      results.set(key,row);
    }
  }
  return {results:[...results.values()],duplicates:duplicatePlayers.size,metadata:parts[0].metadata,parts:parts.length};
}

const githubRepo = "leutzed/scout90";
const canPublish = location.origin === "https://leutzed.github.io" && location.pathname.startsWith("/scout90/");
const catalogFile = "campeonatos.json";

const baseLabelKey = value => normalized(value.trim()).replace(/\s+/g," ");

function baseId(competition,season) {
  return JSON.stringify([competition,season].map(baseLabelKey));
}

function openLibrary() {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open("scout90-competitions",1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("competitions")) database.createObjectStore("competitions",{keyPath:"id"});

    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Feche outras abas do Scout90 e recarregue."));
  });
}

function savedBases() {
  return new Promise((resolve,reject) => {
    const request = db.transaction("competitions").objectStore("competitions").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function storeBase(record,replace = false) {
  return new Promise((resolve,reject) => {
    const transaction = db.transaction("competitions","readwrite");
    const store = transaction.objectStore("competitions");
    if (replace) store.put(record);
    else store.add(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function seasonsFor(competition) {
  return [...library.values()]
    .filter(record => baseLabelKey(record.competition) === competition)
    .sort((a,b) => b.season.localeCompare(a.season,"pt-BR",{numeric:true,sensitivity:"base"}));
}

function refreshLibrary() {
  const competitions = new Map([...library.values()].map(record =>
    [baseLabelKey(record.competition),record.competition]));
  const choices = [...competitions].sort((a,b) => a[1].localeCompare(b[1],"pt-BR",{sensitivity:"base"}));
  const competition = activeBaseId ? baseLabelKey(base.competition) : "";
  const seasons = seasonsFor(competition);
  $("competition-select").innerHTML = choices.map(([key,label]) =>
    '<option value="' + h(key) + '">' + h(label) + '</option>').join("") ||
    "<option>Nenhuma competição disponível</option>";
  if (competition) $("competition-select").value = competition;
  $("dataset").innerHTML = seasons.map(record =>
    '<option value="' + h(record.id) + '">' + h(record.season) + '</option>').join("") ||
    "<option>—</option>";
  if (activeBaseId) $("dataset").value = activeBaseId;
  $("competition-select").disabled = libraryBusy || !choices.length;
  $("dataset").disabled = libraryBusy || !seasons.length;
  $("open-import").disabled = libraryBusy;
  $("open-player-import").disabled = libraryBusy;
  $("export-dataset").disabled = libraryBusy || !activeBaseId;
}

function activateBase(id) {
  const record = library.get(id);
  if (!record) return;
  if (activeBaseId !== id) {
    selection = [];
    for (const filter of ["search","team","position","budget",...personalInputs]) $(filter).value = "";
  }
  activeBaseId = id;
  base = record;
  hiddenKey = id === originalBaseId || base.legacyLabels ? originalHiddenKey : originalHiddenKey + "." + id;
  hiddenPlayers = new Set(readLocal(hiddenKey,[]));
  persist(activeBaseKey,id);
  refreshLibrary();
  rebuild();
}

function portableBase(record) {
  return {
    format:"scout90-competition",
    version:1,
    competition:record.competition,
    season:record.season,
    sourceParts:record.sourceParts ?? null,
    results:record.results
  };
}

function downloadDataset() {
  const filename = normalized(base.competition + "-" + base.season).replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  const blob = new Blob([JSON.stringify(portableBase(base),null,2) + "\n"],{type:"application/json;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"),{href:url,download:(filename || "scout90-base") + ".json"}).click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}

async function defaultDataset() {
  if (globalThis.scout90OfflineBase) return globalThis.scout90OfflineBase;
  const response = await fetch("./brasileirao-serie-a-2026.json");
  if (!response.ok) throw new Error("Base original indisponível.");
  const data = await response.json();
  if (data.format !== "scout90-competition" || data.version !== 1 || !Array.isArray(data.results) || !data.results.length) {
    throw new Error("Formato da base original inválido.");
  }
  return data;
}

async function initializeLibrary() {
  libraryBusy = true;
  const [original,storage,catalog,profileStorage] = await Promise.allSettled([defaultDataset(),openLibrary(),readPublishedCatalog(),openPlayerLibrary()]);

  if (original.status === "fulfilled") {
    const record = original.value;
    originalBaseId = baseId(record.competition,record.season);
    library.set(originalBaseId,{...record,id:originalBaseId,original:true});
  }
  let storageFailed = storage.status === "rejected";
  if (!storageFailed) {
    try {
      db = storage.value;
      for (const record of await savedBases()) library.set(record.id,record);

    } catch {
      storageFailed = true;
      db = null;
    }
  }
  if (profileStorage.status === "fulfilled") {
    try {
      profileDb = profileStorage.value;
      for (const {id,profile} of await savedPlayerProfiles()) storedProfiles.set(id,profile);
    } catch { profileDb = null; }
  }
  if (catalog.status === "fulfilled") {
    for (const entry of catalog.value) {
      const id = baseId(entry.competition,entry.season);
      const stored = library.get(id);
      if (stored?.original && entry.path === "brasileirao-serie-a-2026.json") continue;
      if (!stored || stored.original || stored.published) library.set(id,{...entry,id,remote:true});
    }
  }
  const legacy = readLocal(baseKey,null);
  let legacyId;
  if (Array.isArray(legacy?.results) && legacy.results.length) {
    const competition = legacy.competition || "Importação anterior";
    const season = legacy.season || "Não informada";
    legacyId = baseId(competition,season);
    if (!library.has(legacyId) || library.get(legacyId).original) {
      const record = {...legacy,id:legacyId,competition,season,legacyLabels:[legacy.competition || "",legacy.season || ""]};
      library.set(legacyId,record);
      if (db) {
        try { await storeBase(record); }
        catch { storageFailed = true; }
      }
    }
  }
  libraryBusy = false;
  const preferred = readLocal(activeBaseKey,legacyId);
  const initial = library.has(preferred) ? preferred : library.has(originalBaseId) ? originalBaseId : library.keys().next().value;
  if (initial) await selectBase(initial);
  else {
    refreshLibrary();
    rebuild();
  }
  const warnings = [];
  if (original.status === "rejected") warnings.push("A base original não carregou. Você pode importar um JSON para continuar.");
  if (catalog.status === "rejected") warnings.push("O catálogo público está indisponível no momento.");
  if (storageFailed) warnings.push("O armazenamento do navegador está indisponível. Baixe o JSON para guardar suas bases.");
  if (warnings.length) $("library-status").textContent = [warnings.join(" "),$("library-status").textContent].filter(Boolean).join(" ");
}

function clearReplacement() {
  $("replace-label").hidden = true;
  $("replace-dataset").checked = false;
}

async function selectBase(id) {
  const entry = library.get(id);
  if (!entry?.remote) {
    activateBase(id);
    return;
  }
  libraryBusy = true;
  refreshLibrary();
  try {
    const data = await downloadPublished(entry);
    library.set(id,{...data,id,published:true});
    activateBase(id);
  } catch (error) {
    $("library-status").textContent = error.message;
    if (!activeBaseId && originalBaseId && originalBaseId !== id) activateBase(originalBaseId);
    else if (!activeBaseId) rebuild();
  } finally {
    libraryBusy = false;
    refreshLibrary();
  }
}

$("competition-select").addEventListener("change",event => {
  const [latest] = seasonsFor(event.target.value);
  if (latest) selectBase(latest.id);
});
$("dataset").addEventListener("change",event => selectBase(event.target.value));
$("publish-option").hidden = !canPublish;
$("publish-github").addEventListener("change",event => {
  $("publish-fields").hidden = !event.target.checked;
  $("github-token").required = event.target.checked;
  if (!event.target.checked) $("github-token").value = "";
});
$("import-dialog").addEventListener("close",() => { $("github-token").value = ""; });
$("export-dataset").addEventListener("click",downloadDataset);
$("open-import").addEventListener("click",() => {
  $("import-form").reset();
  $("publish-fields").hidden = true;
  $("github-token").required = false;
  clearReplacement();
  $("import-status").textContent = "";
  $("import-dialog").showModal();
});
for (const id of ["files","competition","season"]) $(id).addEventListener("input",clearReplacement);
$("import-form").addEventListener("submit",async event => {
  event.preventDefault();
  const button = $("run-import");
  if (button.disabled) return;
  button.disabled = true;
  const close = $("import-dialog").querySelector("[data-close]");
  close.disabled = true;
  $("import-status").textContent = "Validando arquivos…";
  try {
    const originals = [...$("files").files];
    const batch = await loadFiles(originals);
    const label = (id,limit) => {
      const value = $(id).value.trim() || batch.metadata?.[id];
      return typeof value === "string" ? value.trim().slice(0,limit) : "";
    };
    const competition = label("competition",100);
    const season = label("season",50);
    if (!competition || !season) throw new Error("Informe o campeonato e a temporada.");
    const id = baseId(competition,season);
    const replacing = $("replace-dataset").checked;
    if (library.has(id) && !replacing) {
      $("replace-label").hidden = false;
      $("replace-dataset").focus();
      throw new Error("Já existe uma base para este campeonato e temporada. Confirme a substituição ou altere os dados.");
    }
    const originalParts = batch.metadata?.sourceParts;
    const sourceParts = batch.metadata ? (Number.isSafeInteger(originalParts) && originalParts > 0 ? originalParts : null) : batch.parts;
    const record = {id,competition,season,sourceParts,results:batch.results};
    let published;
    if (canPublish && $("publish-github").checked) {
      if (batch.metadata) throw new Error("Selecione os arquivos originais da exportação para publicar o conjunto completo.");
      const token = $("github-token").value.trim();
      if (!/^github_pat_[a-zA-Z0-9_]+$/.test(token)) throw new Error("Informe um token fine-grained do GitHub.");
      try {
        published = await publishCompetition(record,originals,token,replacing,status => $("import-status").textContent = status);
        record.published = true;
        $("github-token").value = "";
      } catch (error) {
        if (error instanceof ExistingRemoteBase) {
          $("replace-label").hidden = false;
          $("replace-dataset").focus();
        }
        throw error;
      }
    }
    let saved = false;
    if (db) {
      try {
        await storeBase(record,replacing || Boolean(published));
        saved = true;
      } catch (error) {
        if (error?.name === "ConstraintError") {
          const other = (await savedBases()).find(item => item.id === id);
          if (other) library.set(id,other);
          refreshLibrary();
          $("replace-label").hidden = false;
          throw new Error("Uma base para este campeonato e temporada já foi salva em outra aba. Confirme a substituição.");
        }
      }
    }
    library.set(id,record);
    activateBase(id);
    $("import-dialog").close();
    if (published) {
      const link = Object.assign(document.createElement("a"),{
        href:"https://github.com/" + githubRepo + "/commit/" + published.sha,
        textContent:"Ver commit no GitHub",target:"_blank",rel:"noopener noreferrer"
      });
      $("publish-result").replaceChildren(
        "Publicados " + originals.length + " originais e um consolidado. O catálogo público será atualizado pelo GitHub Pages. ",link
      );
    }
    const duplicates = batch.duplicates ? " Duplicatas idênticas descartadas: " + batch.duplicates + "." : "";
    notice(number.format(record.results.length) + " registros importados." + duplicates +
      (saved || published ? "" : " A base vale nesta sessão. Use Baixar JSON para guardar uma cópia."));
  } catch (error) {
    $("import-status").textContent = error.message;
  } finally {
    button.disabled = false;
    close.disabled = false;
  }
});
