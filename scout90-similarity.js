"use strict";

const similarityProfiles = {
  overview:{label:"Equilibrado",metrics:["nonPen","assists","key","dribbles","finalThird","tackles","intercept","duelsPct"]},
  finishing:{label:"Finalização",metrics:["nonPen","xg","shots","shotAccuracy","bigMiss","assists","key"]},
  creation:{label:"Criação",metrics:["key","chances","assists","finalThird","oppHalf","passPct","dribbles"]},
  wings:{label:"Jogo pelos lados",metrics:["cross","crossPct","dribbles","chances","key","finalThird","tackles"]},
  recovery:{label:"Defesa",metrics:["tackles","intercept","clearances","blocks","aerial","aerialPct","passPct"]},
  aerial:{label:"Defesa aérea",metrics:["aerial","aerialPct","clearances","intercept","ground","duelsPct"]},
  goalkeeper:{label:"Goleiros",metrics:["saves","inside","saveRate","claims","punches","passPct","longBalls","cleanRate"]}
};
const manualPositionGroups = {
  Goleiro:"G",Zagueiro:"D",Lateral:"D",Volante:"M","Box-to-Box":"M",Armador:"M",Ponta:"F",Avançado:"F"
};
const positionLabels = {G:"Goleiro",D:"Defesa",M:"Meio-campo",F:"Ataque"};
let similarityReference = "";
let similarityComparison;

function similarityPosition(row) {
  const manual = manualPositionGroups[scout(row).position];
  if (manual) return manual;
  const group = athlete(row).position?.toUpperCase();
  if (["GK","G"].includes(group) || (!group && row.saves > 0)) return "G";
  return Object.hasOwn(positionLabels,group) ? group : null;
}

function searchBound(values,value,inclusive) {
  let left = 0;
  let right = values.length;
  while (left < right) {
    const middle = Math.floor((left + right) / 2);
    if (values[middle] < value || (inclusive && values[middle] === value)) left = middle + 1;
    else right = middle;
  }
  return left;
}

function percentile(values,value) {
  const below = searchBound(values,value,false);
  const through = searchBound(values,value,true);
  return (below + through - 1) / (2*(values.length - 1));
}

function similarityRanking(reference,candidates,metricKeys) {
  const axes = metricKeys.flatMap(key=>{
    const target = measurement(reference,key,"rate");
    if (!Number.isFinite(target)) return [];
    const values = candidates.map(row=>measurement(row,key,"rate")).filter(Number.isFinite);
    if (values.length < 2) return [];
    values.push(target);
    values.sort((a,b)=>a-b);
    if (values[0] === values.at(-1)) return [];
    return [{key,values,target:percentile(values,target)}];
  });
  const minimum = Math.max(3,Math.ceil(axes.length*.75));
  if (axes.length < minimum) return {axes,results:[]};

  const bestByPlayer = new Map();
  for (const row of candidates) {
    let squared = 0;
    let shared = 0;
    for (const {key,values,target} of axes) {
      const value = measurement(row,key,"rate");
      if (!Number.isFinite(value)) continue;
      const difference = percentile(values,value) - target;
      squared += difference*difference;
      shared++;
    }
    if (shared < minimum) continue;
    const score = 100*(1-Math.sqrt(squared/shared))*(shared/axes.length);
    const prior = bestByPlayer.get(row.player.id);
    if (!prior || score > prior.score || (score === prior.score && row.minutesPlayed > prior.row.minutesPlayed)) {
      bestByPlayer.set(row.player.id,{row,shared,score});
    }
  }
  const results = [...bestByPlayer.values()].sort((a,b)=>b.score-a.score ||
    b.shared-a.shared || b.row.minutesPlayed-a.row.minutesPlayed || a.row.player.name.localeCompare(b.row.player.name,"pt-BR"));
  return {axes,results};
}

function similarityPlayers() {
  return base.results.filter(row=>!hiddenPlayers.has(row.player.id));
}

function renderSimilarityChoices(players,reference) {
  const query = normalized($("similar-search").value.trim());
  const options = players.filter(row=>!query || (normalized(row.player.name+" "+row.team.name).includes(query) ||
    String(row.player.id).includes(query)) || row === reference);
  options.sort((a,b)=>a.player.name.localeCompare(b.player.name,"pt-BR") || a.team.name.localeCompare(b.team.name,"pt-BR"));
  $("similar-player").innerHTML = '<option value="">Escolha um jogador</option>' + options.map(row=>
    '<option value="' + playerKey(row) + '">' + h(row.player.name + " · " + row.team.name) + '</option>').join("");
  $("similar-player").value = reference ? playerKey(reference) : "";
}

function renderSimilarity() {
  const players = similarityPlayers();
  const reference = players.find(row=>playerKey(row) === similarityReference);
  renderSimilarityChoices(players,reference);
  $("similar-reference").hidden = !reference;
  $("similar-metrics").textContent = "";
  $("similar-chart").innerHTML = "";
  $("similar-breakdown").hidden = true;
  const samePosition = $("similar-position");
  const group = reference && similarityPosition(reference);
  samePosition.disabled = !group;
  $("similar-position-label").textContent = group ? "Mesmo grupo de posição · " + positionLabels[group] : "Mesmo grupo de posição";
  if (!reference) {
    $("similar-message").textContent = "Escolha o jogador de referência para ver os mais próximos.";
    return;
  }
  $("similar-reference").innerHTML = '<div class="similar-reference">' + portrait(reference) + '<div><strong>' +
    playerButton(reference) + '</strong><span class="sub">' + h(reference.team.name) + ' · ' +
    number.format(reference.minutesPlayed) + ' min</span></div></div>';
  const minimum = Math.max(0,$("similar-minutes").valueAsNumber || 0);
  const lens = $("similar-profile").value;
  const pool = players.filter(row=>row.player.id !== reference.player.id && row.minutesPlayed >= minimum &&
    (!(group && samePosition.checked) || similarityPosition(row) === group) &&
    (lens === "goalkeeper" ? similarityPosition(row) === "G" : similarityPosition(row) !== "G"));
  const {axes,results} = similarityRanking(reference,pool,similarityProfiles[lens].metrics);
  if (!results.length) {
    $("similar-message").textContent = pool.length ? "A amostra não tem métricas suficientes em comum para este perfil." :
      "Nenhum candidato atende a estes filtros.";
    return;
  }
  const shown = Math.min(10,results.length);
  $("similar-message").textContent = "Exibindo " + shown + " de " + number.format(results.length) + " jogadores com dados suficientes.";
  $("similar-metrics").textContent = "Métricas usadas: " + axes.map(axis=>metricLabel(axis.key,"rate")).join(", ") + ".";
  $("similar-chart").innerHTML = results.slice(0,shown).map(({row,shared,score},index)=>
    '<li class="similar-result"><span class="similar-rank">' + (index+1) + '</span><div class="similar-person">' +
    playerButton(row) + '<span class="sub">' + h(row.team.name) + ' · ' + number.format(row.minutesPlayed) + ' min</span></div>' +
    '<div class="similar-score"><div class="similar-track" aria-hidden="true"><span style="--score:' + Math.max(0,score).toFixed(2) +
    '%"></span></div><span class="sub">' + shared + '/' + axes.length + ' métricas</span></div><strong class="similar-value">' +
    decimal.format(score) + '<small>/100</small></strong><button type="button" class="btn" data-similar-compare="' + playerKey(row) +
    '" aria-label="Comparar com ' + h(row.player.name) + '">Comparar</button></li>').join("");
  const candidates = results.slice(0,shown).map(result=>result.row);
  const select = $("similar-candidate");
  const previous = similarityComparison?.reference === reference ? select.value : "";
  similarityComparison = {reference,axes,candidates};
  select.innerHTML = candidates.map(row=>'<option value="' + playerKey(row) + '">' +
    h(row.player.name + " · " + row.team.name) + "</option>").join("");
  if (candidates.some(row=>playerKey(row) === previous)) select.value = previous;
  $("similar-breakdown").hidden = false;
  renderSimilarityBreakdown();
}

function renderSimilarityBreakdown() {
  const {reference,axes,candidates} = similarityComparison;
  const candidate = candidates.find(row=>playerKey(row) === $("similar-candidate").value);
  if (!candidate) return;
  const markers = (row, style) => '<span class="similar-key ' + style + '">' + h(row.player.name) + '</span>';
  const metrics = axes.map(({key,values,target})=>{
    const a = Math.round(target * 100);
    const value = measurement(candidate,key,"rate");
    const b = Number.isFinite(value) ? Math.round(percentile(values,value) * 100) : null;
    const line = b === null ? "" : '<i class="similar-gap" style="left:' + Math.min(a,b) +
      '%;width:' + Math.abs(a-b) + '%"></i><i class="similar-point candidate" style="left:' + b + '%"></i>';
    return '<li><div><strong>' + h(metricLabel(key,"rate")) + '</strong><small>n=' + values.length +
      '</small></div><div class="similar-axis" aria-hidden="true">' + line +
      '<i class="similar-point reference" style="left:' + a + '%"></i></div><div><span>' +
      h(formatted(measurement(reference,key,"rate"),key,"rate")) + ' · P' + a + '</span><span>' +
      (b === null ? "Sem dado" : h(formatted(value,key,"rate")) + ' · P' + b) + '</span></div></li>';
  }).join("");
  $("similar-dumbbell").innerHTML = '<p class="similar-keys">' + markers(reference,"reference") +
    markers(candidate,"candidate") + '</p><div class="similar-ticks" aria-hidden="true">' +
    '<span>P0</span><span>P25</span><span>P50</span><span>P75</span><span>P100</span></div>' +
    '<ul class="similar-axes" aria-label="Valores e percentis na ordem da legenda">' + metrics + '</ul>';
}

function startSimilarity(row) {
  if (!row || hiddenPlayers.has(row.player.id)) return;
  similarityReference = playerKey(row);
  $("similar-search").value = "";
  $("similar-position").checked = false;
  const group = similarityPosition(row);
  $("similar-profile").value = group === "G" ? "goalkeeper" :
    Object.hasOwn(similarityProfiles,profile) && profile !== "goalkeeper" ? profile : "overview";
  $("player-dialog").close();
  setView("similar");
  $("similar-title").focus();
}

$("similar-profile").innerHTML = Object.entries(similarityProfiles)
  .map(([key,value])=>'<option value="' + key + '">' + h(value.label) + '</option>').join("");
$("similar-player").addEventListener("change",event=>{
  similarityReference = event.target.value;
  const row = rows.get(similarityReference);
  if (row) {
    if (similarityPosition(row) === "G") $("similar-profile").value = "goalkeeper";
    else if ($("similar-profile").value === "goalkeeper") $("similar-profile").value = "overview";
  }
  renderSimilarity();
});
$("similar-search").addEventListener("input",renderSimilarity);
for (const id of ["similar-profile","similar-minutes","similar-position"]) $(id).addEventListener("input",renderSimilarity);
$("similar-candidate").addEventListener("change",renderSimilarityBreakdown);

$("similar-chart").addEventListener("click",event=>{
  const candidate = event.target.closest("button[data-similar-compare]")?.dataset.similarCompare;
  if (!candidate || !rows.has(candidate) || !rows.has(similarityReference)) return;
  selection = [similarityReference,candidate,...selection.filter(key=>key !== candidate && key !== similarityReference)].slice(0,4);
  const lens = $("similar-profile").value;
  if (profile !== lens) selectProfile(lens);
  setView("compare");
  $("compare").querySelector("h2").focus();
});
