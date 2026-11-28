"use strict";

const globalIndexCache = new WeakMap();
const globalFullCache = new Map();
const globalPicked = new Set();
const globalHiddenKey = "scout90.global-hidden.v1";
const globalHidden = new Set(readLocal(globalHiddenKey,[]));
const globalRowHeight = 60;
const globalFilterIds = ["global-query","global-competition","global-season","global-position","global-minutes",
  "global-club","global-country","global-foot","global-min-age","global-max-age","global-birth-from","global-birth-to",
  "global-min-height","global-max-height","global-metric","global-threshold","global-order"];
const globalSort = new Intl.Collator("pt-BR",{numeric:true,sensitivity:"base"});
const globalDetailedMetrics = Object.keys(fields).filter(key=>["count","rate","decimal","percent"].includes(fields[key][1]) &&
  key !== "heightCm");
let globalInputs = [];
let globalLoad = 0;
let globalLoading = false;
let globalFailed = [];
let globalRecords = [];
let globalByKey = new Map();
let globalByPlayer = new Map();
let globalFiltered = [];
let globalRange = "";
let globalColumns = [];
let globalAnchor;
let globalDetailKey = "";
let globalComparison = [];
let globalCompareRequest = 0;
let globalScrollFrame;

function globalOptionList(id,options,fallback = options[0]?.[0] ?? "") {
  const select = $(id);
  const previous = select.value;
  const markup = options.map(([key,label])=>'<option value="' + h(key) + '">' + h(label) + '</option>').join("");
  if (select.globalMarkup !== markup) {
    select.innerHTML = markup;
    select.globalMarkup = markup;
  }
  select.value = options.some(([key])=>key === previous) ? previous : fallback;
  return select.value;
}

function globalEntryLabel(entry) {
  return entry.competition + " · " + entry.season;
}

function decodeGlobalIndex(index,entry) {
  if (index?.version !== 1 || baseId(index.competition ?? "",index.season ?? "") !== entry.id ||
      !Array.isArray(index.lines) || !index.players || !index.teams) {
    throw new Error("Índice incompatível com a competição.");
  }
  const profiles = new Map();
  const records = [];
  for (const line of index.lines) {
    const [id,club,...values] = line;
    const identity = index.players[id];
    const clubName = index.teams[club];
    if (!Number.isSafeInteger(id) || !Number.isSafeInteger(club) || typeof identity?.[0] !== "string" ||
        typeof clubName !== "string" || values.length !== searchSourceFields.length) {
      throw new Error("Registro inválido no índice.");
    }
    const [name,nationality,birthDate,dateOfBirthTimestamp,preferredFoot,heightCm,position,positionsDetailed] = identity;
    if (!profiles.has(id)) {
      profiles.set(id,normalizePlayerProfile({nationality,birthDate,dateOfBirthTimestamp,preferredFoot,heightCm,
        position,positionsDetailed},id));
    }
    const row = {player:{id,name},team:{id:club,name:clubName}};
    searchSourceFields.forEach((field,i)=>row[field] = values[i]);
    records.push({row,entry,key:JSON.stringify([entry.id,id,club]),bio:profiles.get(id),name:normalized(name),
      date:exploreSeasonDate(entry.season)});
  }
  return records;
}

function loadGlobalIndex(entry) {
  if (globalIndexCache.has(entry)) return globalIndexCache.get(entry);
  const request = (async()=>{
    if (entry.results) return decodeGlobalIndex(buildSearchIndex(entry),entry);
    if (entry.search) {
      try {
        const response = await fetch("./" + entry.search,{cache:"no-cache"});
        if (response.ok) return decodeGlobalIndex(await response.json(),entry);
      } catch {
        // Older deployments and new catalog entries can use their individual consolidated file.
      }
    }
    return decodeGlobalIndex(buildSearchIndex(await downloadPublished(entry)),entry);
  })();
  globalIndexCache.set(entry,request);
  return request;
}

function indexGlobalRecords(results,entries) {
  globalFailed = entries.filter((_,index)=>results[index]?.status === "rejected");
  globalRecords = results.flatMap(result=>result.status === "fulfilled" ? result.value : []);
  globalByKey = new Map(globalRecords.map(record=>[record.key,record]));
  globalByPlayer = new Map();
  for (const record of globalRecords) {
    const id = record.row.player.id;
    if (!globalByPlayer.has(id)) globalByPlayer.set(id,[]);
    globalByPlayer.get(id).push(record);
  }
  for (const history of globalByPlayer.values()) {
    history.sort((a,b)=>globalSort.compare(b.entry.season,a.entry.season) ||
      globalSort.compare(a.entry.competition,b.entry.competition));
  }
  for (const key of globalPicked) if (!globalByKey.has(key)) globalPicked.delete(key);
}

function renderGlobalSearch() {
  const entries = [...library.values()];
  if (entries.length === globalInputs.length && entries.every((entry,index)=>entry === globalInputs[index])) {
    if (!globalLoading) applyGlobalFilters(false);
    return;
  }
  globalInputs = entries;
  globalLoading = true;
  const request = ++globalLoad;
  $("global-status").textContent = "Carregando índices de busca…";
  $("global-retry").hidden = true;
  $("global-table").setAttribute("aria-busy","true");
  refreshGlobalActions();
  Promise.allSettled(entries.map(loadGlobalIndex)).then(results=>{
    if (request !== globalLoad) return;
    globalLoading = false;
    $("global-table").removeAttribute("aria-busy");
    indexGlobalRecords(results,entries);
    if (view === "global-search") applyGlobalFilters();
  });
}

function globalBiography(record) {
  const id = record.row.player.id;
  const bio = {...record.bio};
  const fields = ["nationality","birthDate","preferredFoot","heightCm"];
  for (const alternative of globalByPlayer.get(id) || []) {
    for (const key of fields) bio[key] ??= alternative.bio[key];
    if (fields.every(key=>bio[key] != null)) break;
  }
  return {...bio,...storedProfiles.get(id)};
}

function globalPosition(record,bio) {
  const manual = scout(record.row).position;
  const source = bio.position?.toUpperCase();
  const group = manualPositionGroups[manual] || (source === "GK" || (!source && record.row.saves > 0) ? "G" : source);
  const roles = (bio.positionsDetailed || []).map(role=>role.toUpperCase());
  return {group,roles,manual,label:manual || roles.map(role=>exploreRoles[role] || role).join(" / ") || positionLabels[group] || "—"};
}

function applyGlobalFilters(resetScroll = true) {
  if (globalLoading) return;
  const byCompetition = new Map();
  for (const entry of globalInputs) {
    const key = baseLabelKey(entry.competition);
    const prior = byCompetition.get(key);
    if (!prior || globalSort.compare(entry.season,prior.season) > 0) byCompetition.set(key,entry);
  }
  const competition = globalOptionList("global-competition",[["","Todas as competições"],...[...byCompetition]
    .map(([key,entry])=>[key,entry.competition]).sort((a,b)=>globalSort.compare(a[1],b[1]))]);
  const available = globalRecords.filter(record=>!competition || baseLabelKey(record.entry.competition) === competition);
  const seasonLabels = [...new Set(available.map(record=>record.entry.season))].sort((a,b)=>globalSort.compare(b,a));
  const season = globalOptionList("global-season",[["latest","Mais recente de cada liga"],["all","Todas as temporadas"],
    ...seasonLabels.map(label=>["season:"+label,label])]);
  const clubOptions = new Map();
  const countries = new Set();
  const positions = new Map();
  const candidates = [];
  const hiddenByBase = new Map();
  const keep = (value,threshold,test) => !Number.isFinite(threshold) || (value != null && test(value,threshold));
  const atLeast = (value,min) => value >= min;
  const atMost = (value,max) => value <= max;
  for (const record of available) {
    const {entry,row} = record;
    if (season === "latest" && byCompetition.get(baseLabelKey(entry.competition)) !== entry) continue;
    if (season.startsWith("season:") && entry.season !== season.slice(7)) continue;
    if (globalHidden.has(row.player.id)) continue;
    if (!hiddenByBase.has(entry.id)) {
      const storageKey = entry.id === originalBaseId || entry.legacyLabels ? originalHiddenKey : originalHiddenKey + "." + entry.id;
      hiddenByBase.set(entry.id,new Set(readLocal(storageKey,[])));
    }
    if (hiddenByBase.get(entry.id).has(row.player.id)) continue;
    const bio = globalBiography(record);
    const position = globalPosition(record,bio);
    if (bio.nationality) countries.add(bio.nationality);
    if (position.group && positionLabels[position.group]) positions.set("group:"+position.group,positionLabels[position.group]);
    for (const role of position.roles) positions.set("role:"+role,(exploreRoles[role] || role) + " (" + role + ")");
    if (position.manual) positions.set("manual:"+position.manual,position.manual + " (cadastrada)");
    clubOptions.set(String(row.team.id),row.team.name);
    candidates.push({record,bio,position});
  }
  const club = globalOptionList("global-club",[["","Todos os clubes"],...[...clubOptions].sort((a,b)=>globalSort.compare(a[1],b[1]))]);
  const country = globalOptionList("global-country",[["","Todas"],...[...countries].map(code=>[code,countryName(code)])
    .sort((a,b)=>globalSort.compare(a[1],b[1])),["unknown","Sem dado"]]);
  const position = globalOptionList("global-position",[["","Todas"],...[...positions].sort((a,b)=>globalSort.compare(a[1],b[1]))]);
  const metric = $("global-metric").value;
  const query = normalized($("global-query").value.trim());
  const foot = $("global-foot").value;
  const from = $("global-birth-from").value, to = $("global-birth-to").value;
  const val = id => $(id).valueAsNumber;
  const minAge = val("global-min-age"), maxAge = val("global-max-age");
  const minHeight = val("global-min-height"), maxHeight = val("global-max-height");
  const minutes = Math.max(0,val("global-minutes") || 0);
  const threshold = val("global-threshold");
  const direction = $("global-order").value === "asc" ? 1 : -1;
  const matches = [];
  for (const item of candidates) {
    const {record,bio,position:role} = item;
    const {row,name,date} = record;
    if (row.minutesPlayed < minutes || (club && String(row.team.id) !== club) ||
        (query && !name.includes(query) && !String(row.player.id).includes(query))) continue;
    if ((country && country !== (bio.nationality || "unknown")) || (foot && foot !== (bio.preferredFoot || "unknown")) ||
        (from && !(bio.birthDate >= from)) || (to && !(bio.birthDate && bio.birthDate <= to))) continue;
    if (position && !["group:"+role.group,"manual:"+role.manual,...role.roles.map(code=>"role:"+code)].includes(position)) continue;
    const age = ageAtDate(bio.birthDate,date);
    if (!keep(age,minAge,atLeast) || !keep(age,maxAge,atMost) ||
        !keep(bio.heightCm,minHeight,atLeast) || !keep(bio.heightCm,maxHeight,atMost)) continue;
    const measured = measurement(row,metric,"rate");
    const value = Number.isFinite(measured) ? measured : null;
    if (!keep(value,threshold,atLeast)) continue;
    matches.push({...item,age,value});
  }
  globalFiltered = matches.sort((a,b)=>(a.value === null)-(b.value === null) || direction*((a.value ?? 0)-(b.value ?? 0)) ||
    b.record.row.minutesPlayed-a.record.row.minutesPlayed || globalSort.compare(a.record.row.player.name,b.record.row.player.name) ||
    globalSort.compare(a.record.key,b.record.key));
  const unique = new Set(matches.map(({record})=>record.row.player.id)).size;
  $("global-status").textContent = globalInputs.length ? number.format(unique) + " jogadores · " +
    number.format(matches.length) + " registros" + (globalFailed.length ? " · " + globalFailed.length + " bases indisponíveis" : "") :
    (libraryBusy ? "Carregando catálogo…" : "Nenhuma base disponível.");
  $("global-retry").hidden = !globalFailed.length;
  globalAnchor = null;
  if (resetScroll) $("global-scroll").scrollTop = 0;
  renderGlobalHeader();
  renderGlobalRows();
  refreshGlobalActions();
}

function renderGlobalHeader() {
  const metric = $("global-metric").value;
  globalColumns = [...new Set(["min","goals","assists","key",metric])];
  globalRange = "";
  $("global-table").setAttribute("aria-rowcount",globalFiltered.length + 1);
  $("global-table").innerHTML = '<colgroup><col class="global-col-player"><col class="global-col-league"><col class="global-col-bio">' +
    '<col span="' + globalColumns.length + '"></colgroup><thead><tr aria-rowindex="1"><th scope="col">' +
    '<div class="bulk-header"><input type="checkbox" class="pick-player" id="global-select-all" aria-label="Selecionar todos os resultados">Jogador</div>' +
    '</th><th scope="col">Liga e temporada</th><th scope="col">Posição e idade</th>' + globalColumns.map(key=>{
      const current = key === metric;
      const direction = $("global-order").value === "asc" ? "ascending" : "descending";
      return '<th scope="col" class="num"' + (current ? ' aria-sort="' + direction + '"' : "") +
        '><button type="button" data-global-sort="' + key + '">' + h(metricLabel(key,"rate")) +
        (current ? (direction === "ascending" ? " ↑" : " ↓") : "") + '</button></th>';
    }).join("") + '</tr></thead><tbody></tbody>';
}

function renderGlobalRows() {
  if (view !== "global-search" || !$("global-table").tBodies.length) return;
  const viewport = $("global-scroll");
  const first = Math.max(0,Math.floor(viewport.scrollTop/globalRowHeight)-6);
  const last = Math.min(globalFiltered.length,first+Math.ceil(viewport.clientHeight/globalRowHeight)+14);
  const range = first + "/" + last;
  if (range === globalRange) return;
  globalRange = range;
  const columns = globalColumns.length + 3;
  const spacer = size => size > 0 ? '<tr class="global-spacer" aria-hidden="true"><td colspan="' + columns +
    '" style="height:' + size + 'px"></td></tr>' : "";
  const active = document.activeElement;
  const activeType = active?.hasAttribute("data-global-pick") ? "globalPick" : "globalDetail";
  const restore = active?.dataset[activeType];
  const body = globalFiltered.slice(first,last).map(({record,bio,age,position},index)=>{
    const {row,entry} = record;
    const key = h(record.key);
    const recorte = globalEntryLabel(entry);
    return '<tr aria-rowindex="' + (first+index+2) + '" class="global-row"><th scope="row"><div class="identity-line">' +
      '<input type="checkbox" class="pick-player" data-global-pick="' + key + '" aria-label="Selecionar ' +
      h(row.player.name + " · " + recorte + " · " + row.team.name) + '"' + (globalPicked.has(record.key) ? " checked" : "") + '>' +
      '<div class="global-text">' + flag(bio.nationality) + '<button type="button" class="player" data-global-detail="' +
      key + '" title="' + h(row.player.name) + '">' + h(row.player.name) + '</button><span class="sub">' +
      h(row.team.name) + '</span></div></div></th><td title="' + h(recorte) + '">' + h(entry.competition) +
      '<span class="sub">' + h(entry.season) + '</span></td><td title="' + h(position.label) + '">' + h(position.label) +
      '<span class="sub">' + (age === null ? "—" : number.format(age) + " anos") + '</span></td>' +
      globalColumns.map(metric=>'<td class="num">' + h(cell(row,metric,"rate")) + '</td>').join("") + '</tr>';
  }).join("");
  $("global-table").tBodies[0].innerHTML = body ? spacer(first*globalRowHeight) + body +
    spacer((globalFiltered.length-last)*globalRowHeight) : '<tr><td class="empty" colspan="' + columns +
    '">Nenhum jogador corresponde aos filtros.</td></tr>';
  if (restore) {
    [...$("global-table").querySelectorAll(activeType === "globalPick" ? "[data-global-pick]" : "[data-global-detail]")]
      .find(element=>element.dataset[activeType] === restore)?.focus({preventScroll:true});
  }
}

function refreshGlobalActions() {
  const visible = globalFiltered.reduce((count,{record})=>count+Number(globalPicked.has(record.key)),0);
  const all = $("global-select-all");
  if (all) {
    all.disabled = globalLoading || !globalFiltered.length;
    all.checked = globalFiltered.length > 0 && visible === globalFiltered.length;
    all.indeterminate = visible > 0 && !all.checked;
  }
  $("global-marked").textContent = number.format(globalPicked.size) + " registros selecionados · " +
    (globalPicked.size > 4 ? "Marque até 4 para comparar" : "Shift + clique para marcar um intervalo");
  $("global-hide").disabled = globalLoading || !globalPicked.size;
  $("global-clear").hidden = !globalPicked.size;
  $("global-restore").hidden = !globalHidden.size;
  $("global-restore").textContent = "Restaurar ocultos (" + number.format(globalHidden.size) + ")";
  $("global-compare-button").disabled = globalLoading || globalPicked.size < 2 || globalPicked.size > 4;
  $("global-compare-button").title = "Selecione de 2 a 4 registros";
}

function setGlobalPicked(records,checked) {
  for (const {record} of records) {
    if (checked) globalPicked.add(record.key);
    else globalPicked.delete(record.key);
  }
  for (const input of $("global-table").querySelectorAll("[data-global-pick]")) {
    input.checked = globalPicked.has(input.dataset.globalPick);
  }
  refreshGlobalActions();
}

function loadGlobalRecord(record) {
  const {entry,row} = record;
  if (entry.results) return Promise.resolve(entry.results.find(item=>playerKey(item) === playerKey(row)));
  const prior = globalFullCache.get(entry);
  const load = prior || downloadPublished(entry).catch(error=>{
    globalFullCache.delete(entry);
    throw error;
  });
  globalFullCache.delete(entry);
  globalFullCache.set(entry,load);
  if (globalFullCache.size > 6) globalFullCache.delete(globalFullCache.keys().next().value);
  return load.then(data=>{
    const match = data.results.find(item=>playerKey(item) === playerKey(row));
    if (!match) throw new Error("O registro não está mais disponível na base publicada.");
    return match;
  });
}

async function showGlobalDetail(key,openDialog = false) {
  const record = globalByKey.get(key);
  if (!record || globalLoading) return;
  globalDetailKey = key;
  const id = record.row.player.id;
  const dialog = $("global-detail-dialog");
  $("global-detail-name").textContent = record.row.player.name;
  globalOptionList("global-history",globalByPlayer.get(id).map(item=>[item.key,globalEntryLabel(item.entry)+" · "+item.row.team.name]));
  $("global-history").value = key;
  $("global-detail-body").innerHTML = '<p class="hint">Carregando a ficha do recorte…</p>';
  $("global-open-league").disabled = true;
  if (openDialog && !dialog.open) dialog.showModal();
  try {
    const full = await loadGlobalRecord(record);
    if (globalDetailKey !== key || !dialog.open) return;
    if (!full) throw new Error("Registro indisponível.");
    const bio = {...globalBiography(record),...normalizePlayerProfile(full.player,id),
      ...normalizePlayerProfile(full.player.profile,id),...storedProfiles.get(id)};
    const metrics = globalDetailedMetrics.filter(metric=>Number.isFinite(measurement(full,metric,"rate")));
    $("global-detail-body").innerHTML = '<div class="global-player-detail">' + portrait(full,bio) + '<div>' +
      flag(bio.nationality) + '<strong>' + h(full.team.name) + '</strong><span class="sub">' +
      h(globalEntryLabel(record.entry)) + ' · ID ' + id + '</span></div></div><dl class="bio-grid">' + playerBiography(bio) +
      '</dl><details class="global-extra" open><summary>Estatísticas do recorte</summary><dl class="bio-grid">' + metrics.map(metric=>
        '<div><dt>' + h(metricLabel(metric,"rate")) + '</dt><dd>' + h(cell(full,metric,"rate")) + '</dd></div>').join("") + '</dl></details>';
    $("global-open-league").disabled = false;
  } catch {
    if (globalDetailKey === key && dialog.open) $("global-detail-body").innerHTML =
      '<p class="hint">A ficha detalhada deste recorte não carregou. Feche e tente novamente.</p>';
  }
}

function drawGlobalBars() {
  if ($("global-compare-dialog").open && globalComparison.length) {
    drawBars(globalComparison.map(item=>item.row),{canvas:"global-bars",metric:"global-chart-metric",mode:"rate"});
  }
}

async function showGlobalComparison() {
  if ($("global-compare-button").disabled) return;
  const chosen = [...globalPicked].map(key=>globalByKey.get(key));
  const dialog = $("global-compare-dialog");
  const request = ++globalCompareRequest;
  const status = $("global-compare-status");
  globalComparison = [];
  $("global-compare-charts").hidden = true;
  status.textContent = "Carregando as estatísticas dos recortes selecionados…";
  dialog.showModal();
  const results = await Promise.allSettled(chosen.map(async record=>({record,row:await loadGlobalRecord(record)})));
  if (request !== globalCompareRequest || !dialog.open) return;
  globalComparison = results.flatMap(result=>result.status === "fulfilled" && result.value.row ? [result.value] : []);
  if (globalComparison.length < 2) {
    status.textContent = "Não foi possível carregar pelo menos dois recortes para comparar.";
    return;
  }
  const metrics = globalDetailedMetrics.filter(key=>globalComparison.some(({row})=>Number.isFinite(measurement(row,key,"rate"))));
  status.textContent = "Cada coluna representa um clube, competição e temporada. Contagens de ações são exibidas por 90 minutos." +
    (globalComparison.length < chosen.length ? " Alguns recortes não carregaram." : "");
  globalOptionList("global-chart-metric",metrics.map(key=>[key,metricLabel(key,"rate")]),metrics.includes("goals") ? "goals" : metrics[0]);
  const header = '<thead><tr><th scope="col">Métrica</th>' + globalComparison.map(({record,row})=>'<th scope="col">' +
    h(row.player.name) + '<span class="sub">' + h(row.team.name + " · " + globalEntryLabel(record.entry)) + '</span></th>').join("") +
    '</tr></thead>';
  $("global-compare-table").innerHTML = header + '<tbody>' + metrics.map(key=>'<tr><th scope="row">' +
    h(metricLabel(key,"rate")) + '</th>' + globalComparison.map(({row})=>'<td>' + h(cell(row,key,"rate")) + '</td>').join("") +
    '</tr>').join("") + '</tbody>';
  $("global-compare-charts").hidden = false;
  drawGlobalBars();
}

globalOptionList("global-metric",searchMetrics.map(key=>[key,metricLabel(key,"rate")]));
for (const id of globalFilterIds) {
  $(id).addEventListener("input",()=>{
    if (id === "global-metric") $("global-threshold").value = "";
    if (id === "global-competition") $("global-club").value = "";
    applyGlobalFilters();
  });
}
$("global-reset").addEventListener("click",()=>{
  for (const id of globalFilterIds) $(id).value = "";
  $("global-minutes").value = "900";
  $("global-order").value = "desc";
  $("global-metric").value = "min";
  applyGlobalFilters();
});
$("global-retry").addEventListener("click",()=>{
  for (const entry of globalFailed) globalIndexCache.delete(entry);
  globalInputs = [];
  renderGlobalSearch();
});
$("global-scroll").addEventListener("scroll",()=>{
  if (globalScrollFrame) return;
  globalScrollFrame = requestAnimationFrame(()=>{
    globalScrollFrame = null;
    renderGlobalRows();
  });
},{passive:true});
new ResizeObserver(renderGlobalRows).observe($("global-scroll"));
$("global-table").addEventListener("click",event=>{
  if (globalLoading) return;
  const detail = event.target.closest("[data-global-detail]")?.dataset.globalDetail;
  if (detail) showGlobalDetail(detail,true);
  const sort = event.target.closest("[data-global-sort]")?.dataset.globalSort;
  if (sort) {
    if ($("global-metric").value === sort) $("global-order").value = $("global-order").value === "asc" ? "desc" : "asc";
    else {
      $("global-metric").value = sort;
      $("global-order").value = "desc";
      $("global-threshold").value = "";
    }
    applyGlobalFilters();
    $("global-table").querySelector('[data-global-sort="' + sort + '"]')?.focus({preventScroll:true});
  }
  const key = event.target.dataset.globalPick;
  if (!key) return;
  const to = globalFiltered.findIndex(({record})=>record.key === key);
  if (to < 0) return;
  const from = event.shiftKey && globalAnchor ? globalFiltered.findIndex(({record})=>record.key === globalAnchor.key) : -1;
  if (from < 0) globalAnchor = {key,checked:event.target.checked};
  const start = from < 0 ? to : Math.min(from,to);
  setGlobalPicked(globalFiltered.slice(start,(from < 0 ? to : Math.max(from,to))+1),globalAnchor.checked);
});
$("global-table").addEventListener("change",event=>{
  if (event.target.id !== "global-select-all" || globalLoading) return;
  globalAnchor = null;
  setGlobalPicked(globalFiltered,event.target.checked);
});
$("global-clear").addEventListener("click",()=>{
  globalPicked.clear();
  globalAnchor = null;
  setGlobalPicked([],false);
});
$("global-hide").addEventListener("click",()=>{
  for (const key of globalPicked) {
    const record = globalByKey.get(key);
    if (record) globalHidden.add(record.row.player.id);
  }
  globalPicked.clear();
  persist(globalHiddenKey,[...globalHidden]);
  applyGlobalFilters();
  $("global-restore").focus();
});
$("global-restore").addEventListener("click",()=>{
  globalHidden.clear();
  persist(globalHiddenKey,[]);
  applyGlobalFilters();
  $("global-scroll").focus();
});
$("global-history").addEventListener("change",event=>showGlobalDetail(event.target.value));
$("global-open-league").addEventListener("click",async()=>{
  const record = globalByKey.get(globalDetailKey);
  if (!record) return;
  const button = $("global-open-league");
  button.disabled = true;
  await selectBase(record.entry.id);
  const row = activeBaseId === record.entry.id && rows.get(playerKey(record.row));
  if (row) {
    $("global-detail-dialog").close();
    setView("ranking");
    fillDetail(row);
  } else {
    button.disabled = false;
    notice("A base deste recorte não carregou.");
  }
});
$("global-compare-button").addEventListener("click",showGlobalComparison);
$("global-chart-metric").addEventListener("change",drawGlobalBars);
new ResizeObserver(drawGlobalBars).observe($("global-bars"));
