"use strict";

const explorePresets = {
  creation:{label:"Criação", x:"key", y:"chances", metrics:["key","chances","assists","finalThird","passPct","dribbles"]},
  wings:{label:"Jogo pelos lados", x:"dribbles", y:"cross", metrics:["dribbles","cross","crossPct","key","chances","assists"]},
  defense:{label:"Defesa", x:"tackles", y:"intercept", metrics:["tackles","intercept","clearances","aerial","aerialPct","passPct"]},
  finishing:{label:"Finalização", x:"shots", y:"shotsOn", metrics:["goals","nonPen","shots","shotsOn","shotAccuracy","xg"]},
  xg:{label:"Gols e xG", x:"xg", y:"goals", metrics:["goals","xg","shots","shotsOn","goalPct"], requires:"xg"},
  goalkeeper:{label:"Goleiros", x:"saves", y:"saveRate", metrics:["saves","saveRate","inside","claims","passPct","cleanRate"]},
  age:{label:"Idade e produção", x:"age", y:"contributions", metrics:["contributions","goals","assists","dribbles","key"], requires:"age"},
  market:{label:"Valor de mercado e produção", x:"market", y:"contributions", metrics:["contributions","goals","assists","dribbles","key"], requires:"market"}
};
const exploreRoles = {GK:"Goleiro",DC:"Zagueiro",DL:"Lateral esquerdo",DR:"Lateral direito",
  CB:"Zagueiro",LB:"Lateral esquerdo",RB:"Lateral direito",DM:"Volante",MC:"Meia central",ML:"Meia pela esquerda",
  MR:"Meia pela direita",CM:"Meia central",AM:"Meia-atacante",LM:"Meia pela esquerda",RM:"Meia pela direita",LW:"Ponta esquerda",
  RW:"Ponta direita",ST:"Centroavante"};
const exploreMetrics = [...new Set(Object.values(explorePresets).flatMap(preset=>preset.metrics))];
const exploreCompact = new Intl.NumberFormat("pt-BR",{notation:"compact",maximumFractionDigits:2});
let exploreModel;
let exploreBase;
let exploreHighlighted = "";

function exploreOptions(id,options,fallback) {
  const select = $(id);
  const previous = select.value;
  const markup = options.map(([key,label])=>'<option value="' + h(key) + '">' + h(label) + '</option>').join("");
  if (select.exploreMarkup !== markup) {
    select.innerHTML = markup;
    select.exploreMarkup = markup;
  }
  select.value = options.some(([key])=>key === previous) ? previous :
    options.some(([key])=>key === fallback) ? fallback : options[0]?.[0] ?? "";
  select.disabled = !options.length;
}

function exploreSeasonDate(season) {
  const match = /^(\d{4})(?:\s*[-/]\s*(\d{2}|\d{4}))?$/.exec(String(season).trim());
  if (!match) return null;
  const year = Number(match[1]);
  if (!match[2]) return year + "-12-31";
  return [String(year+1),String(year+1).slice(-2)].includes(match[2]) ? (year+1) + "-06-30" : null;
}

function exploreAge(row,date) {
  return ageAtDate(athlete(row).birthDate,date);
}

function exploreLabel(key) {
  if (key === "age") return "Idade na temporada (anos)";
  if (key === "market") return "Valor de mercado estimado";
  return metricLabel(key,"rate");
}

function exploreValue(row,key,date,marketCurrency) {
  if (key === "age") return exploreAge(row,date);
  if (key === "market") {
    const value = athlete(row).marketValue;
    return value?.currency === marketCurrency ? value.value : null;
  }
  return measurement(row,key,"rate");
}

function exploreQuantile(sorted,fraction) {
  const index = (sorted.length-1)*fraction;
  const lower = Math.floor(index);
  return sorted[lower]+(sorted[Math.ceil(index)]-sorted[lower])*(index-lower);
}

function exploreRowLabel(row) {
  return row.player.name + " · " + row.team.name;
}

function exploreSortedPlayers(records) {
  return records.slice().sort((a,b)=>exploreRowLabel(a).localeCompare(exploreRowLabel(b),"pt-BR"));
}

function renderExplore(resetAxes = false) {
  if (exploreBase !== activeBaseId) {
    exploreBase = activeBaseId;
    exploreHighlighted = "";
  }
  const date = exploreSeasonDate(base.season);
  const available = base.results.filter(row=>!hiddenPlayers.has(row.player.id));
  const groups = new Set(available.map(similarityPosition));
  const roles = new Set(available.flatMap(row=>athlete(row).positionsDetailed || []).map(role=>role.toUpperCase()));
  const positionOptions = [["","Todas"],...Object.entries(positionLabels).filter(([key])=>groups.has(key)),
    ...[...roles].sort().map(role=>["role:"+role,exploreRoles[role] ? exploreRoles[role]+" ("+role+")" : role])];
  exploreOptions("explore-position",positionOptions);
  const position = $("explore-position").value;
  const minutes = Math.max(0,$("explore-minutes").valueAsNumber || 0);
  const cohort = available.filter(row=>row.minutesPlayed >= minutes && (!position ||
    (position.startsWith("role:") ? athlete(row).positionsDetailed?.some(role=>role.toUpperCase() === position.slice(5)) :
      similarityPosition(row) === position)));

  const supported = new Set(exploreMetrics.filter(key=>available.some(row=>Number.isFinite(measurement(row,key,"rate")))));
  if (available.some(row=>exploreAge(row,date) !== null)) supported.add("age");
  if (available.some(row=>athlete(row).marketValue)) supported.add("market");
  const presetOptions = Object.entries(explorePresets).filter(([,preset])=>!preset.requires || supported.has(preset.requires));
  const oldPreset = $("explore-preset").value;
  exploreOptions("explore-preset",presetOptions.map(([key,preset])=>[key,preset.label]));
  const preset = explorePresets[$("explore-preset").value];
  const metrics = exploreMetrics.filter(key=>supported.has(key)).map(key=>[key,exploreLabel(key)]);
  const additionalAxes = ["age","market"].filter(key=>supported.has(key)).map(key=>[key,exploreLabel(key)]);
  if (resetAxes || oldPreset !== $("explore-preset").value) {
    for (const id of ["explore-x","explore-y","explore-distribution-metric"]) $(id).value = "";
  }
  exploreOptions("explore-x",[...metrics,...additionalAxes],preset.x);
  exploreOptions("explore-y",metrics,preset.y);
  exploreOptions("explore-distribution-metric",metrics,preset.y);
  const xKey = $("explore-x").value;
  const yKey = $("explore-y").value;
  const distKey = $("explore-distribution-metric").value;
  const currencies = [...new Set(cohort.map(row=>athlete(row).marketValue?.currency).filter(Boolean))].sort();
  exploreOptions("explore-currency",currencies.map(code=>[code,code]));
  $("explore-currency-label").hidden = xKey !== "market";
  const marketCurrency = $("explore-currency").value;
  const points = xKey && yKey ? cohort.flatMap(row=>{
    const x = exploreValue(row,xKey,date,marketCurrency);
    const y = measurement(row,yKey,"rate");
    return Number.isFinite(x) && Number.isFinite(y) ? [{row,x,y}] : [];
  }) : [];
  const distribution = distKey ? cohort.flatMap(row=>{
    const value = measurement(row,distKey,"rate");
    return Number.isFinite(value) ? [{row,value}] : [];
  }) : [];
  const picked = new Set(pickedPlayers);
  const candidates = [];
  // Use the ranking order to pick one club record for each checkbox selection.
  for (const row of [...lastResults,...available]) {
    if (rows.get(playerKey(row)) === row && picked.delete(row.player.id)) candidates.push(row);
  }
  const highlights = [...new Set([...selection,exploreHighlighted])].filter(Boolean);
  exploreModel = {points,distribution,highlights,xKey,yKey,distKey,date,marketCurrency};
  $("explore-cohort").textContent = activeBaseId ?
    [base.competition,base.season,$("explore-position").selectedOptions[0].textContent,
      number.format(minutes) + " min ou mais",number.format(cohort.length) + " registros de jogador por clube"].join(" · ") :
    "Selecione uma competição e temporada para explorar os dados.";
  $("explore-player").value = exploreHighlighted;
  exploreOptions("explore-player",[["","Selecione ou clique no gráfico"],...exploreSortedPlayers(points.map(point=>point.row))
    .map(row=>[playerKey(row),exploreRowLabel(row)])]);
  $("explore-player").value = points.some(point=>playerKey(point.row) === exploreHighlighted) ? exploreHighlighted : "";
  $("explore-player").disabled = !points.length;
  renderExploreScatter();
  renderExploreDistribution();
  renderExploreHeatmap(cohort,candidates,preset.metrics.filter(key=>supported.has(key)));
}

function exploreRange(values,minimumSpan) {
  const min = values[0];
  const max = values.at(-1);
  const pad = Math.max((max-min)*.035,minimumSpan);
  return [min >= 0 ? Math.max(0,min-pad) : min-pad,max+pad];
}

function exploreScale(domain,from,to) {
  return value=>from+(to-from)*(value-domain[0])/(domain[1]-domain[0]);
}

function explorePlot(id,height,description,draw) {
  const container = $(id);
  const width = Math.max(250,container.clientWidth);
  const left = 53, right = width-16, top = 16, bottom = height-32;
  container.innerHTML = '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' +
    h(description) + '">' + draw({left,right,top,bottom,width}) + '</svg>';
}

function exploreGrid(frame,xLabel,yLabel,yDomain) {
  const {left,right,top,bottom,width} = frame;
  const divisions = width < 450 ? 3 : 5;
  const xTicks = Array.from({length:divisions+1},(_,index)=>{
    const t = index/divisions;
    return '<text x="' + (left+(right-left)*t) + '" y="' + (bottom+19) + '" text-anchor="middle">' + h(xLabel(t)) + '</text>';
  });
  const yTicks = Array.from({length:4},(_,index)=>{
    const t = index/3;
    const y = bottom-(bottom-top)*t;
    return '<line class="explore-grid-line" x1="' + left + '" x2="' + right + '" y1="' + y + '" y2="' + y +
      '"/><text x="' + (left-7) + '" y="' + (y+4) + '" text-anchor="end">' +
      h(yLabel(yDomain[0]+t*(yDomain[1]-yDomain[0]))) + '</text>';
  });
  return xTicks.join("")+yTicks.join("");
}

function explorePointValue(value,key) {
  if (key === "age") return number.format(value) + " anos";
  if (key === "market") return formatted({value,currency:exploreModel.marketCurrency},"profileMarketValue","rate");
  return formatted(value,key,"rate");
}

function renderExploreScatter() {
  const {points,xKey,yKey,date,marketCurrency} = exploreModel;
  const note = $("explore-scatter-note");
  const summary = $("explore-player-summary");
  const axes = xKey && yKey ? exploreLabel(xKey) + (xKey === "market" && marketCurrency ? " ("+marketCurrency+")" : "") +
    " × " + exploreLabel(yKey) : "";
  const ageNote = xKey === "age" && date ? " · Idade em " + date.split("-").reverse().join("/") : "";
  note.textContent = [axes,number.format(points.length) + " com dados nos dois eixos"].filter(Boolean).join(" · ") +
    ageNote + (points.length ? " · Linhas indicam as medianas." : "");
  const active = points.find(point=>playerKey(point.row) === exploreHighlighted);
  summary.innerHTML = active ? '<div><strong>' + playerButton(active.row) + '</strong><span class="sub">' +
    h(active.row.team.name) + ' · ' + number.format(active.row.minutesPlayed) + ' min · ' +
    h(exploreLabel(xKey) + " "+explorePointValue(active.x,xKey) + " · " + exploreLabel(yKey) + " "+
      explorePointValue(active.y,yKey)) + '</span></div>' + toggleButton(active.row,"compare") :
    (points.length ? '<p class="hint">Selecione um jogador para abrir a ficha ou adicionar ao Comparador.</p>' : "");
  if (!points.length) {
    $("explore-scatter").innerHTML = '<p class="empty">Nenhum registro com os dados necessários para este recorte.</p>';
    return;
  }
  const xs = points.map(point=>point.x).sort((a,b)=>a-b);
  const ys = points.map(point=>point.y).sort((a,b)=>a-b);
  const xDomain = exploreRange(xs,xKey === "age" ? .5 : xKey === "market" ? 1 : .005);
  const yDomain = exploreRange(ys,.005);
  explorePlot("explore-scatter",310,axes + ". " + points.length + " registros. Use o seletor para consultar um jogador.",frame=>{
    const {left,right,top,bottom} = frame;
    const x = exploreScale(xDomain,left,right);
    const y = exploreScale(yDomain,bottom,top);
    const mx = x(exploreQuantile(xs,.5));
    const my = y(exploreQuantile(ys,.5));
    const floatLabel = (domain,t)=>exploreCompact.format(domain[0]+t*(domain[1]-domain[0]));
    const grid = exploreGrid(frame,t=>xKey === "age" ? number.format(xDomain[0]+t*(xDomain[1]-xDomain[0])) :
      floatLabel(xDomain,t),value=>exploreCompact.format(value),yDomain);
    const drawPoint = point=>{
      const key = playerKey(point.row);
      return '<circle class="explore-point' + (point === active ? ' is-active' : '') + '" cx="' + x(point.x) +
        '" cy="' + y(point.y) + '" r="' + (point === active ? 5 : 3.6) + '" data-explore-point="' + h(key) +
        '"><title>' + h(exploreRowLabel(point.row) + " · " + explorePointValue(point.x,xKey) + " × " +
          explorePointValue(point.y,yKey)) + '</title></circle>';
    };
    return grid + '<path class="explore-median" d="M' + mx + ' ' + top + 'V' + bottom + 'M' + left + ' ' + my + 'H' + right +
      '"/>' + points.filter(point=>point !== active).map(drawPoint).join("") + (active ? drawPoint(active) : "");
  });
}

function renderExploreDistribution() {
  const {distribution,distKey,highlights} = exploreModel;
  const note = $("explore-distribution-note");
  const list = $("explore-distribution-players");
  list.innerHTML = "";
  if (!distribution.length) {
    note.textContent = "";
    $("explore-distribution").innerHTML = '<p class="empty">Sem valores para a métrica neste recorte.</p>';
    return;
  }
  const sorted = distribution.map(entry=>entry.value).sort((a,b)=>a-b);
  const [p25,median,p75] = [.25,.5,.75].map(fraction=>exploreQuantile(sorted,fraction));
  const pretty = value=>formatted(value,distKey,"rate");
  note.textContent = metricLabel(distKey,"rate") + " · " + number.format(sorted.length) + " valores · Mediana " + pretty(median) +
    " · P25–P75 " + pretty(p25) + " a " + pretty(p75);
  const min = sorted[0], max = sorted.at(-1);
  const domain = min === max ? exploreRange(sorted,Math.max(.5,Math.abs(min)*.05)) : [min,max];
  const count = min === max ? 1 : Math.max(4,Math.min(20,Math.ceil(Math.sqrt(sorted.length))));
  const size = (domain[1]-domain[0])/count;
  const bins = Array(count).fill(0);
  for (const value of sorted) bins[Math.min(count-1,Math.floor((value-domain[0])/size))]++;
  const peak = Math.ceil(Math.max(...bins)/3)*3;
  const distributionPlayers = new Map(distribution.map(entry=>[playerKey(entry.row),entry]));
  const markers = highlights.map((key,index)=>({row:rows.get(key),item:distributionPlayers.get(key),index})).filter(marker=>marker.row);
  list.innerHTML = markers.map(({row,item,index})=>'<li><i style="--series:' + chartColors[index % chartColors.length] +
    '" aria-hidden="true">' + (index+1) + '</i>' + h(exploreRowLabel(row)) + ' · ' +
    (item ? h(pretty(item.value)) : "fora do recorte ou sem dado") + '</li>').join("");
  explorePlot("explore-distribution",238,"Histograma de " + metricLabel(distKey,"rate") + ". Eixo vertical em número de registros.",frame=>{
    const {left,right,top,bottom} = frame;
    const x = exploreScale(domain,left,right);
    const y = exploreScale([0,peak],bottom,top);
    const grid = exploreGrid(frame,t=>exploreCompact.format(domain[0]+t*(domain[1]-domain[0])),n=>number.format(n),[0,peak]);
    const bars = bins.map((total,index)=>{
      const start = domain[0]+size*index;
      return '<rect class="explore-bin" x="' + (x(start)+1) + '" y="' + y(total) + '" width="' +
        Math.max(0,(right-left)/count-2) + '" height="' + (bottom-y(total)) + '"><title>' +
        h(pretty(start) + " a " + pretty(start+size) + " · " + total + " registros") + '</title></rect>';
    }).join("");
    const band = '<rect class="explore-band" x="' + x(p25) + '" y="' + top + '" width="' + (x(p75)-x(p25)) +
      '" height="' + (bottom-top) + '"/>';
    const lines = markers.filter(marker=>marker.item).map(({item,index})=>{
      const xPos = x(item.value);
      return '<g style="--series:' + chartColors[index % chartColors.length] + '"><line class="explore-marker" x1="' +
        xPos + '" x2="' + xPos + '" y1="' + (top+index*18) + '" y2="' + bottom + '"/><text class="explore-marker-id" x="' +
        xPos + '" y="' + (top+10+index*18) + '" text-anchor="middle">' + (index+1) + '</text></g>';
    }).join("");
    return band + grid + bars + '<path class="explore-median" d="M' + x(median) + ' ' + top + 'V' + bottom + '"/>' + lines;
  });
}

function renderExploreHeatmap(cohort,candidates,metrics) {
  const scroll = $("explore-heatmap-scroll");
  const note = $("explore-heatmap-note");
  scroll.hidden = !candidates.length || !metrics.length;
  if (scroll.hidden) {
    $("explore-heatmap").innerHTML = "";
    note.textContent = candidates.length ? "Este perfil não tem métricas disponíveis na base." :
      "Marque jogadores com as caixas de seleção da aba Jogadores.";
    return;
  }
  note.textContent = number.format(candidates.length) + " candidatos · Vermelho a verde indica percentil baixo a alto do valor. " +
    "Cinza indica dado ausente ou percentil indisponível (fora do recorte ou amostra insuficiente).";
  const reference = new Set(cohort);
  const metricValues = metrics.map(key=>cohort.map(row=>measurement(row,key,"rate")).filter(Number.isFinite).sort((a,b)=>a-b));
  const body = candidates.map(row=>'<tr><th scope="row">' + playerButton(row) + '<span class="sub">' + h(row.team.name) +
    '</span></th>' + metrics.map((key,index)=>{
    const value = measurement(row,key,"rate");
    const values = metricValues[index];
    const hasValue = Number.isFinite(value);
    const p = hasValue && reference.has(row) && values.length > 1 ? Math.round(100*percentile(values,value)) : null;
    const attrs = p === null ? 'class="heat-missing num"' : 'class="heat num" style="--heat:' + Math.round(5+p*1.27) + '"';
    return '<td ' + attrs + '>' + (hasValue ? h(formatted(value,key,"rate")) : "Sem dado") +
      (p === null ? "" : '<span class="sub">P' + p + ' · n=' + values.length + '</span>') + '</td>';
  }).join("") + '</tr>').join("");
  $("explore-heatmap").innerHTML = '<thead><tr><th scope="col">Jogador</th>' + metrics.map(key=>
    '<th scope="col" class="num">' + h(metricLabel(key,"rate")) + '</th>').join("") + '</tr></thead><tbody>' + body + '</tbody>';
}

function selectExplorePoint(key) {
  exploreHighlighted = key;
  $("explore-player").value = key;
  exploreModel.highlights = [...new Set([...selection,key])].filter(Boolean);
  renderExploreScatter();
  renderExploreDistribution();
}

for (const id of ["explore-position","explore-minutes","explore-x","explore-y","explore-currency","explore-distribution-metric"]) {
  $(id).addEventListener("input",()=>renderExplore());
}
$("explore-preset").addEventListener("change",()=>renderExplore(true));
$("explore-player").addEventListener("change",event=>selectExplorePoint(event.target.value));
$("explore-scatter").addEventListener("click",event=>{
  const key = event.target.closest("[data-explore-point]")?.dataset.explorePoint;
  if (key) selectExplorePoint(key);
});
const exploreResize = new ResizeObserver(entries=>{
  if (view !== "explore" || !exploreModel || !entries.some(entry=>entry.contentRect.width)) return;
  const width = $("explore-scatter").clientWidth;
  if (width === exploreResize.width) return;
  exploreResize.width = width;
  renderExploreScatter();
  renderExploreDistribution();
});
exploreResize.observe($("explore-scatter"));
