"use strict";

function rebuild() {
  pickedPlayers.clear();
  pickAnchor = null;
  snapshot = datasetKey(base);
  refreshProfileFilters();
  rows = new Map(base.results.map(row => [playerKey(row), row]));
  selection = selection.filter(key => rows.has(key) && !hiddenPlayers.has(rows.get(key).player.id));
  const clubs = new Map(base.results.map(row => [String(row.team.id), row.team.name]));
  const priorClub = $("team").value;
  $("team").innerHTML = '<option value="">Todos os clubes</option>' +
    [...clubs.entries()].sort((a,b) => a[1].localeCompare(b[1],"pt-BR")).map(([id,name]) =>
      '<option value="' + h(id) + '">' + h(name) + '</option>').join("");
  $("team").value = clubs.has(priorClub) ? priorClub : "";
  renderControls();
  $("source").textContent = activeBaseId ? (base.original ? "Base original" : "Base importada") : "Nenhuma base ativa";
  $("kpis").innerHTML = [
    [new Set(base.results.map(row => row.player.id)).size,"jogadores"],
    [clubs.size,"clubes"],
    [base.results.filter(row => row.minutesPlayed >= 900).length,"registros com ≥ 900 min"]
  ].map(([value,label]) => "<div><strong>" + number.format(value) + "</strong><span>" + h(label) + "</span></div>").join("");
  render();
}

function xgCoverage() {
  if (!base.results.length) return "";
  const defined = base.results.filter(row=>Number.isFinite(row.expectedGoals)).length;
  return defined ? "xG disponível em " + number.format(defined) + " de " + number.format(base.results.length) + " registros da base." :
    "Esta base veio sem xG.";
}

function renderControls() {
  $("profiles").innerHTML = Object.entries(profiles).map(([key,value]) =>
    '<button type="button" data-profile="' + key + '" aria-pressed="' + (key === profile) + '">' + h(value.label) + '</button>').join("");
  $("unit").innerHTML = Object.entries({rate:"Por 90",count:"Totais"}).map(([key,value]) =>
    '<button type="button" data-unit="' + key + '" aria-pressed="' + (key === unit) + '">' + value + '</button>').join("");
  const coverage = profile === "finishing" ? xgCoverage() : "";
  $("profile-note").textContent = [profiles[profile].note,coverage].filter(Boolean).join(" ");
  $("budget-filter").hidden = profile !== "finance";
}

function filtered() {
  const club = $("team").value;
  const position = $("position").value;
  const minimum = Math.max(0, Number($("minutes").value) || 0);
  const query = normalized($("search").value.trim());
  const matchesProfile = profilePredicates();
  benchmark = base.results.filter(row => !hiddenPlayers.has(row.player.id) && row.minutesPlayed >= minimum &&
    (!club || String(row.team.id) === club) && (!position || scout(row).position === position) && profileMatch(row) && matchesProfile(row));
  return benchmark.filter(row => !query || normalized(row.player.name).includes(query) || String(row.player.id).includes(query))
    .sort((first, second) => {
      const a = measurement(first, order.key);
      const b = measurement(second, order.key);
      if (a === null && b !== null) return 1;
      if (a !== null && b === null) return -1;
      if (a !== null && fields[order.key][1] === "valuation" && a.currency !== b.currency) {
        return a.currency.localeCompare(b.currency);
      }
      const diff = a === null ? 0 : fields[order.key][1] === "valuation" ? a.value - b.value :
        typeof a === "string" ? a.localeCompare(b,"pt-BR") : a - b;
      return (order.asc ? diff : -diff) || second.minutesPlayed - first.minutesPlayed ||
        first.player.name.localeCompare(second.player.name,"pt-BR") || first.player.id - second.player.id;
    });
}

function playerButton(row) {
  return flag(athlete(row).nationality) + '<button class="player" type="button" data-player="' + playerKey(row) + '">' + h(row.player.name) + '</button>';
}

function toggleButton(row, action) {
  const key = playerKey(row);
  const saved = action === "watch";
  const pressed = saved ? Boolean(info.shortlist[row.player.id]) : selection.includes(key);
  const label = (pressed ? "Remover da " : "Adicionar à ") + (saved ? "observação" : "comparação") + ": " + row.player.name;
  const icon = saved ? (pressed ? "★" : "☆") : (pressed ? "✓" : "+");
  return '<button type="button" class="icon-btn" aria-pressed="' + pressed + '" title="' + h(label) +
    '" aria-label="' + h(label) + '" data-' + action + '="' + key + '">' + icon + '</button>';
}

function sortHead(key) {
  const active = order.key === key;
  const direction = active ? (order.asc ? "ascending" : "descending") : "";
  return '<th scope="col" class="num"' + (active ? ' aria-sort="' + direction + '"' : "") +
    '><button type="button" data-sort="' + key + '">' + h(metricLabel(key)) + (active ? (order.asc ? " ↑" : " ↓") : "") + '</button></th>';
}

function heatScales(columns, mode = unit) {
  if (!$("heat-toggle").checked) return new Map();
  const scales = new Map();
  for (const key of columns) {
    const values = benchmark.map(row => measurement(row,key,mode)).filter(Number.isFinite).sort((a,b) => a-b);
    if (values.length < 2 || values[0] === values.at(-1)) continue;
    let low = values[Math.floor((values.length - 1) * .05)];
    let high = values[Math.ceil((values.length - 1) * .95)];
    if (low === high) [low,high] = [values[0],values.at(-1)];
    scales.set(key,{low,high});
  }
  return scales;
}

function statAttributes(row,key,scales,classes,mode = unit) {
  const scale = scales.get(key);
  const value = measurement(row,key,mode);
  if (!scale || !Number.isFinite(value)) return ' class="' + classes.trim() + '"';
  const hue = Math.round(5 + 127 * Math.min(1,Math.max(0,(value-scale.low)/(scale.high-scale.low))));
  return ' class="' + (classes + " heat").trim() + '" style="--heat:' + hue + '"';
}

function statCell(row,key,scales) {
  return "<td" + statAttributes(row,key,scales,order.key === key ? "num highlight" : "num") + ">" +
    h(cell(row,key)) + "</td>";
}

function renderRanking() {
  lastResults = filtered();
  const total = lastResults.length;
  const columns = ["min", ...activeColumns()];
  const scales = heatScales(columns);
  const header = '<thead><tr><th scope="col" class="identity"><div class="bulk-header"><input type="checkbox" class="pick-player" id="pick-all" aria-label="Selecionar todos os jogadores do filtro" title="Selecionar todos os jogadores do filtro">Jogador e ações</div></th>' +
    columns.map(sortHead).join("") + '</tr></thead>';
  const content = lastResults.map((row,index) => {
    const position = scout(row).position;
    const label = "Ocultar " + row.player.name;
    return '<tr><td class="identity"><div class="identity-line"><input type="checkbox" class="pick-player" data-pick-player="' +
      row.player.id + '" data-pick-row="' + playerKey(row) + '" aria-label="Selecionar ' + h(row.player.name + " · " + row.team.name) + '"' +
      (pickedPlayers.has(row.player.id) ? " checked" : "") + '><div style="flex:1"><div class="identity-name"><span class="rank">' +
      (index + 1) + '</span>' + playerButton(row) + '</div><span class="sub">' + h(row.team.name) +
      (position ? " · " + h(position) : "") + '</span></div><div class="actions">' + toggleButton(row,"compare") +
      toggleButton(row,"watch") + '<button type="button" class="icon-btn" data-hide-player="' + row.player.id +
      '" title="' + h(label) + '" aria-label="' + h(label) + '">×</button></div></div></td>' +
      columns.map(key => statCell(row,key,scales)).join("") + '</tr>';
  }).join("");
  const empty = profile === "finance" ? "Nenhum jogador com dados financeiros para estes filtros. Cadastre valores pela ficha no ranking." :
    "Nenhum jogador para estes filtros.";
  $("ranking-table").innerHTML = header + "<tbody>" + (content || '<tr><td class="empty" colspan="' + (columns.length + 1) + '">' +
    h(empty) + '</td></tr>') + "</tbody>";
  $("result-count").textContent = number.format(total) + (total === 1 ? " resultado" : " resultados");
  $("export-ranking").disabled = !total;
  renderPicked();
}

function renderPicked() {
  const visible = new Set(lastResults.map(row => row.player.id));
  const visiblePicked = [...visible].filter(id => pickedPlayers.has(id)).length;
  const total = pickedPlayers.size;
  const outside = total - visiblePicked;
  const all = $("pick-all");
  all.disabled = !visible.size;
  all.checked = visible.size > 0 && visiblePicked === visible.size;
  all.indeterminate = visiblePicked > 0 && !all.checked;
  $("batch-count").textContent = number.format(total) + (total === 1 ? " selecionado" : " selecionados") +
    (outside ? " · " + number.format(outside) + " fora do filtro atual" : "");
  $("hide-picked").disabled = !total;
  $("clear-picked").hidden = !total;
}

function hidePlayers(ids) {
  for (const id of ids) {
    hiddenPlayers.add(id);
    pickedPlayers.delete(id);
  }
  selection = selection.filter(key => !hiddenPlayers.has(rows.get(key)?.player.id));
  if (persist(hiddenKey,[...hiddenPlayers])) {
    notice(ids.length === 1 ? "Jogador ocultado." : number.format(ids.length) + " jogadores ocultados.");
  }
  render();
  $("open-hidden").focus();
}

function activeHidden() {
  return [...new Map(base.results.filter(row => hiddenPlayers.has(row.player.id)).map(row => [row.player.id,row])).values()]
    .sort((a,b) => a.player.name.localeCompare(b.player.name,"pt-BR"));
}

function renderHidden() {
  const hidden = activeHidden();
  $("open-hidden").textContent = "Ocultos (" + hidden.length + ")";
  if (!$("hidden-dialog").open) return;
  $("hidden-list").innerHTML = hidden.map(row => '<li><span>' + h(row.player.name) + ' <span class="muted">· ' +
    h(row.team.name) + '</span></span><button type="button" class="btn" data-unhide-player="' +
    row.player.id + '" aria-label="Restaurar ' + h(row.player.name) + '">Restaurar</button></li>').join("") ||
    '<li class="muted">Nenhum jogador oculto nesta base.</li>';
  $("restore-hidden").disabled = !hidden.length;
}

function compareMetric(row, key) {
  const value = measurement(row, key, "rate");
  if (value === null || ["money","date","text","valuation"].includes(fields[key][1]) || !benchmark.includes(row)) return null;
  const values = benchmark.map(item => measurement(item, key, "rate")).filter(item => item !== null);
  if (values.length < 2) return null;
  const below = values.filter(item => item < value).length;
  const equal = values.filter(item => item === value).length;
  return {p:Math.round((below + (equal - 1) / 2) / (values.length - 1) * 100), n:values.length};
}

function renderCompare() {
  const players = selection.map(key => rows.get(key)).filter(Boolean);
  const sorted = base.results.filter(row => !hiddenPlayers.has(row.player.id)).sort((a,b) => a.player.name.localeCompare(b.player.name,"pt-BR"));
  $("compare-select").innerHTML = Array.from({length:4}, (_, index) => {
    const chosen = selection[index];
    return '<label>Jogador ' + (index + 1) + '<select data-compare-slot="' + index + '"><option value="">Selecionar</option>' +
      sorted.map(row => {
        const key = playerKey(row);
        const text = row.player.name + " · " + row.team.name + " (" + row.player.id + ")";
        return '<option value="' + key + '"' + (key === chosen ? " selected" : "") + '>' + h(text) + '</option>';
      }).join("") + '</select></label>';
  }).join("");
  $("clear-compare").disabled = !players.length;
  $("compare-card").hidden = !players.length;
  $("compare-note").textContent = "Referência dos percentis: " + profiles[profile].label + " · " +
    benchmark.length + " registros que atendem aos filtros do ranking. Cada métrica indica seu n válido.";
  renderCharts(players);
  if (!players.length) return;
  const columns = [...new Set(["min", "appearances", ...activeColumns(), "rating"])];
  const scales = heatScales(columns,"rate");
  const header = "<thead><tr><th scope='col'>Métrica</th>" + players.map(row => '<th scope="col"><div class="compare-player">' + portrait(row) + '<div>' + playerButton(row) +
    '<span class="sub">' + h(row.team.name) + '</span><button type="button" class="btn compare-similar" data-similar-reference="' +
    playerKey(row) + '" aria-label="Encontrar semelhantes a ' + h(row.player.name) +
    '">Semelhantes</button></div></div></th>').join("") + "</tr></thead>";
  const content = columns.map(key => "<tr><th scope='row'>" + h(metricLabel(key, "rate")) + "</th>" + players.map(row => {
    const both = fields[key][1] === "rate" && raw(row, key) !== null ? " · " + h(cell(row, key, "count")) + " total" : "";
    const pct = key === "min" ? null : compareMetric(row, key);
    return "<td" + statAttributes(row,key,scales,"","rate") + ">" + h(cell(row, key, "rate")) + both + (pct ? '<span class="percentile"><span class="bar" aria-hidden="true"><i style="width:' +
      pct.p + '%"></i></span>P' + pct.p + ' · n=' + pct.n + '</span>' : "") + "</td>";
  }).join("") + "</tr>").join("");
  $("compare-table").innerHTML = header + "<tbody>" + content + "</tbody>";
}

function watchEntries() {
  return Object.entries(info.shortlist).sort((a,b) => a[1].name.localeCompare(b[1].name,"pt-BR"));
}

function renderShortlist() {
  const entries = watchEntries();
  $("export-shortlist").disabled = !entries.length;
  $("shortlist-body").innerHTML = entries.map(([id, entry]) => {
    const row = rows.get(entry.key) || base.results.find(item => String(item.player.id) === id);
    const name = row ? playerButton(row) : h(entry.name);
    const subtitle = row ? row.team.name + " · " + number.format(row.minutesPlayed) + " min" : entry.team + " · Fora da base ativa";
    return '<article class="panel"><h3>' + name + '</h3><p class="sub">' + h(subtitle) + '</p>' +
      '<label>Anotações<textarea data-watch-note="' + h(id) + '" maxlength="4000">' + h(info.scouts[id]?.note) +
      '</textarea></label><div class="actions"><button type="button" class="btn" data-remove-watch="' + h(id) +
      '">Remover da lista</button>' + (row && !hiddenPlayers.has(row.player.id) ? toggleButton(row, "compare") : "") + '</div></article>';
  }).join("") || '<p class="hint">Use a estrela no ranking para adicionar jogadores.</p>';
}

function render() {
  $("compare-counter").textContent = selection.length || "";
  $("shortlist-counter").textContent = Object.keys(info.shortlist).length || "";
  renderHidden();
  $("open-charts").hidden = !selection.length;
  if (view === "ranking" || view === "compare") renderRanking();
  if (view === "compare") renderCompare();
  if (view === "shortlist") renderShortlist();
  if (view === "similar") renderSimilarity();
}

function setView(next) {
  view = next;
  document.querySelectorAll("nav [data-view]").forEach(button => {
    const current = button.dataset.view === view;
    $(button.dataset.view).hidden = !current;
    if (current) button.setAttribute("aria-current","page");
    else button.removeAttribute("aria-current");
  });
  render();
}

function selectProfile(key) {
  profile = key;
  order = {key:key === "overview" ? "min" : activeColumns()[0] || "min",asc:key === "finance"};
  renderControls();
  render();
}

function fillDetail(row) {
  activePlayer = row;
  const personal = scout(row);
  const money = financial(row);
  $("detail-name").textContent = row.player.name;
  profileDetail(row);
  $("detail-team").textContent = row.team.name + " · ID " + row.player.id + " · " + number.format(row.minutesPlayed) + " min";
  $("detail-position").value = personal.position || "";
  $("detail-note").value = personal.note || "";
  $("detail-salary").value = money.salary ?? "";
  $("detail-value").value = money.value ?? "";
  $("detail-contract").value = money.contract ?? "";
  $("detail-period-cost").value = periodCost(row) ?? "";
  detailActions();
  $("player-dialog").showModal();
}

function detailActions() {
  if (!activePlayer) return;
  $("detail-save").textContent = info.shortlist[activePlayer.player.id] ? "Remover da observação" : "Adicionar à observação";
  $("detail-compare").disabled = hiddenPlayers.has(activePlayer.player.id);
  $("detail-similar").disabled = hiddenPlayers.has(activePlayer.player.id);
  $("detail-compare").textContent = selection.includes(playerKey(activePlayer)) ? "Remover da comparação" : "Adicionar à comparação";
}

function toggleWatch(row) {
  const id = row.player.id;
  const watching = Boolean(info.shortlist[id]);
  if (watching) delete info.shortlist[id];
  else info.shortlist[id] = {name:row.player.name,team:row.team.name,key:playerKey(row)};
  if (persist(metaKey, info)) notice(watching ? "Jogador removido da lista." : "Jogador adicionado à observação.");
  detailActions();
  render();
}

function toggleCompare(key) {
  if (hiddenPlayers.has(rows.get(key)?.player.id)) return;
  if (selection.includes(key)) selection = selection.filter(item => item !== key);
  else if (selection.length < 4) selection.push(key);
  else { notice("A comparação comporta até quatro jogadores."); return; }
  detailActions();
  render();
}

function renderColumns() {
  $("column-options").innerHTML = Object.entries(fields).filter(([key]) => key !== "min").map(([key,value]) =>
    '<label><input type="checkbox" data-column="' + key + '"' + (activeColumns().includes(key) ? " checked" : "") +
    '>' + h(value[0]) + '</label>').join("");
}

function csvValue(value) {
  let plain = value == null ? "" : String(value);
  if (typeof value === "string" && /^\s*[=+\-@\t\r\n]/.test(plain)) plain = "'" + plain;
  return '"' + plain.replaceAll('"','""') + '"';
}

function writeCsv(name, headers, lines) {
  const text = [headers, ...lines].map(line => line.map(csvValue).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", text], {type:"text/csv;charset=utf-8"}));
  const link = Object.assign(document.createElement("a"), {href:url,download:name});
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvMetric(row, key) {
  const value = measurement(row, key);
  if (value === null) return "";
  if (fields[key][1] === "valuation") return value.currency + " " + String(value.value).replace(".",",");
  return typeof value === "number" ? String(Math.round(value * 10000) / 10000).replace(".",",") : value;
}

function exportRanking() {
  const columns = ["min", ...activeColumns()];
  writeCsv("scout90-ranking.csv", ["ID jogador","Jogador","ID clube","Clube","Posição", ...columns.map(key => metricLabel(key))],
    lastResults.map(row => [row.player.id,row.player.name,row.team.id,row.team.name,scout(row).position,
      ...columns.map(key => csvMetric(row, key))]));
}

function exportWatch() {
  writeCsv("scout90-observacao.csv", ["ID jogador","Jogador","Clube","Posição","Minutos","Salário mensal (R$)","Valor estimado (R$)","Fim de contrato","Anotações"],
    watchEntries().map(([id, entry]) => {
      const row = rows.get(entry.key) || base.results.find(item => String(item.player.id) === id);
      const money = row ? financial(row) : info.finance[entry.key] || {};
      return [id,row?.player.name ?? entry.name,row?.team.name ?? entry.team,info.scouts[id]?.position,row?.minutesPlayed,
        money.salary == null ? "" : String(money.salary).replace(".",","),money.value == null ? "" : String(money.value).replace(".",","),
        money.contract,info.scouts[id]?.note];
    }));
}

document.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  const data = button.dataset;
  if (data.view) setView(data.view);
  if (data.profile) {
    selectProfile(data.profile);
    $("profiles").querySelector('[aria-pressed="true"]').focus();
  }
  if (data.unit) {
    unit = data.unit;
    renderControls();
    render();
    $("unit").querySelector('[aria-pressed="true"]').focus();
  }
  if (data.sort) {
    order = {key:data.sort,asc:order.key === data.sort ? !order.asc : ["money","date","valuation"].includes(fields[data.sort][1])};
    render();
    $("ranking-table").querySelector('[aria-sort] button').focus();
  }
  if (data.player) fillDetail(rows.get(data.player));
  if (data.similarReference) startSimilarity(rows.get(data.similarReference));
  if (data.watch) {
    toggleWatch(rows.get(data.watch));
    document.querySelector('[data-watch="' + data.watch + '"]')?.focus();
  }
  if (data.compare) {
    toggleCompare(data.compare);
    const section = $(view);
    section.querySelector('[data-compare="' + data.compare + '"]')?.focus();
  }
  if (data.removeWatch) {
    delete info.shortlist[data.removeWatch];
    if (persist(metaKey,info)) notice("Jogador removido da lista.");
    render();
  }
  if (data.hidePlayer) hidePlayers([Number(data.hidePlayer)]);
  if (data.unhidePlayer) {
    hiddenPlayers.delete(Number(data.unhidePlayer));
    persist(hiddenKey,[...hiddenPlayers]);
    render();
    ($("hidden-list").querySelector("button") || $("hidden-dialog").querySelector("[data-close]")).focus();
  }
  if (data.close) $(data.close).close();
});

$("position").innerHTML = positionsOptions("Todas as posições");
$("detail-position").innerHTML = positionsOptions("Sem posição cadastrada");
for (const id of ["search","minutes","budget"]) $(id).addEventListener("input", render);
for (const id of ["team","position"]) $(id).addEventListener("change", render);
for (const id of personalInputs) $(id).addEventListener("input",render);

$("clear-filters").addEventListener("click", () => {
  for (const id of ["search","team","position","budget",...personalInputs]) $(id).value = "";
  $("minutes").value = 900;
  render();
});
function applyPicked(records, checked) {
  for (const row of records) {
    if (checked) pickedPlayers.add(row.player.id);
    else pickedPlayers.delete(row.player.id);
  }
  for (const input of $("ranking-table").querySelectorAll("[data-pick-player]")) {
    input.checked = pickedPlayers.has(Number(input.dataset.pickPlayer));
  }
  renderPicked();
}

$("ranking-table").addEventListener("change", event => {
  if (event.target.id !== "pick-all") return;
  pickAnchor = null;
  applyPicked(lastResults,event.target.checked);
});

$("ranking-table").addEventListener("click", event => {
  const key = event.target.dataset.pickRow;
  if (!key) return;
  const index = lastResults.findIndex(row => playerKey(row) === key);
  if (index === -1) return;
  const from = event.shiftKey && pickAnchor
    ? lastResults.findIndex(row => playerKey(row) === pickAnchor.key) : -1;
  if (from === -1) {
    pickAnchor = {key,checked:event.target.checked};
    applyPicked([lastResults[index]],pickAnchor.checked);
    return;
  }
  const start = Math.min(from,index);
  const end = Math.max(from,index);
  applyPicked(lastResults.slice(start,end + 1),pickAnchor.checked);
});

$("hide-picked").addEventListener("click",() => {
  if (pickedPlayers.size) hidePlayers([...pickedPlayers]);
});
$("clear-picked").addEventListener("click",() => {
  pickedPlayers.clear();
  pickAnchor = null;
  renderRanking();
  $("pick-all").focus();
});
$("heat-toggle").addEventListener("change",renderRanking);
$("open-charts").addEventListener("click",() => setView("compare"));
$("open-hidden").addEventListener("click",() => {
  $("hidden-dialog").showModal();
  renderHidden();
});
$("restore-hidden").addEventListener("click",() => {
  for (const row of activeHidden()) hiddenPlayers.delete(row.player.id);
  persist(hiddenKey,[...hiddenPlayers]);
  render();
  $("hidden-dialog").querySelector("[data-close]").focus();
});

$("clear-compare").addEventListener("click", () => { selection = []; render(); });
$("compare-select").addEventListener("change", event => {
  const slot = Number(event.target.dataset.compareSlot);
  const next = event.target.value;
  if (next && selection.includes(next)) {
    notice("Esse registro já está no comparador.");
    renderCompare();
  } else {
    if (next) selection[Math.min(slot,selection.length)] = next;
    else selection.splice(slot,1);
    render();
  }
  $("compare-select").querySelector('[data-compare-slot="' + slot + '"]').focus();
});
$("shortlist-body").addEventListener("input", event => {
  const id = event.target.dataset.watchNote;
  if (!id) return;
  info.scouts[id] = {...info.scouts[id],note:event.target.value};
  persist(metaKey,info);
});
$("detail-save").addEventListener("click", () => toggleWatch(activePlayer));
$("detail-compare").addEventListener("click", () => toggleCompare(playerKey(activePlayer)));
$("detail-similar").addEventListener("click", () => startSimilarity(activePlayer));
$("player-form").addEventListener("submit", event => {
  event.preventDefault();
  const parseInput = id => $(id).value === "" ? null : $(id).valueAsNumber;
  info.scouts[activePlayer.player.id] = {position:$("detail-position").value,note:$("detail-note").value};
  const periodCosts = {...financial(activePlayer).periodCosts};
  const cost = parseInput("detail-period-cost");
  if (cost === null) delete periodCosts[snapshot];
  else periodCosts[snapshot] = cost;
  info.finance[playerKey(activePlayer)] = {salary:parseInput("detail-salary"),
    value:parseInput("detail-value"),contract:$("detail-contract").value,periodCosts};
  if (persist(metaKey,info)) notice("Ficha atualizada.");
  $("player-dialog").close();
  render();
});

$("open-columns").addEventListener("click", () => {
  renderColumns();
  $("columns-dialog").showModal();
});
$("column-options").addEventListener("change", event => {
  const key = event.target.dataset.column;
  const current = activeColumns();
  const columns = event.target.checked ? [...current,key] : current.filter(column => column !== key);
  custom.set(profile, columns);
  if (order.key !== "min" && !columns.includes(order.key)) order = {key:"min",asc:false};
  render();
});
$("restore-columns").addEventListener("click", () => {
  custom.delete(profile);
  selectProfile(profile);
  renderColumns();
});
$("export-ranking").addEventListener("click", exportRanking);
$("export-shortlist").addEventListener("click", exportWatch);
