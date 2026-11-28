"use strict";

function chartSurface(id) {
  const canvas = $(id);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return null;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio,ratio);
  ctx.font = "12px Segoe UI, sans-serif";
  ctx.textBaseline = "middle";
  return {ctx,width,height};
}

function plotMessage(ctx,width,height,text) {
  ctx.fillStyle = "#a4b8ae";
  ctx.textAlign = "center";
  ctx.fillText(text,width/2,height/2,width-16);
}

function drawRadar(players) {
  const surface = chartSurface("radar");
  if (!surface) return;
  const {ctx,width,height} = surface;
  const keys = profiles[profile].cols.filter(key =>
    players.every(row => compareMetric(row,key)) &&
    new Set(benchmark.map(row => measurement(row,key,"rate")).filter(Number.isFinite)).size > 1
  ).slice(0,6);
  $("radar-note").textContent = "Escala de P0 a P100 · métricas por 90 quando aplicável.";
  if (keys.length < 3) {
    plotMessage(ctx,width,height,"São necessárias três métricas com percentis para todos.");
    return;
  }
  const radius = Math.min(height*.31,width*.22);
  const cx = width/2;
  const cy = height/2;
  const point = (axis,ratio) => {
    const angle = axis * (Math.PI * 2 / keys.length) - Math.PI/2;
    return [cx + Math.cos(angle)*radius*ratio,cy + Math.sin(angle)*radius*ratio];
  };
  function polygon(points) {
    ctx.beginPath();
    points.forEach(([x,y],index) => index ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    ctx.closePath();
  }
  ctx.strokeStyle = "#385047";
  for (const level of [.25,.5,.75,1]) {
    polygon(keys.map((_,index) => point(index,level)));
    ctx.stroke();
  }
  keys.forEach((key,index) => {
    const [x,y] = point(index,1);
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.lineTo(x,y);
    ctx.stroke();
    const [lx,ly] = point(index,1.18);
    ctx.fillStyle = "#b5cabf";
    const side = lx - cx;
    ctx.textAlign = Math.abs(side) <= 5 ? "center" : side > 0 ? "left" : "right";
    const labelWidth = Math.abs(side) <= 5 ? width*.54 : Math.min(lx,width-lx)-4;
    ctx.fillText(metricLabel(key,"rate"),lx,ly,labelWidth);
  });
  players.forEach((row,index) => {
    polygon(keys.map((key,axis) => point(axis,compareMetric(row,key).p/100)));
    ctx.fillStyle = chartColors[index] + "27";
    ctx.strokeStyle = chartColors[index];
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
  });
}

function drawBars(players,{canvas = "bars",metric = "bar-metric",mode = unit} = {}) {
  const surface = chartSurface(canvas);
  if (!surface) return;
  const {ctx,width,height} = surface;
  const key = $(metric).value;
  const values = players.map(row => measurement(row,key,mode));
  const available = values.filter(Number.isFinite);
  if (!available.length) {
    plotMessage(ctx,width,height,"Sem dados para esta métrica na seleção.");
    return;
  }
  const [low,high] = chartDomain(available);
  const left = Math.min(width*.40,152);
  const room = Math.max(15,width-left-89);
  const barX = value => left + room*(value-low)/(high-low);
  const origin = barX(0);
  const step = Math.min(60,(height-28)/players.length);
  players.forEach((row,index) => {
    const y = (height - step*players.length)/2 + step*(index+.5);
    ctx.textAlign = "right";
    ctx.fillStyle = "#d9e7df";
    ctx.fillText(row.player.name,left-9,y,left-12);
    ctx.fillStyle = "#263b33";
    ctx.fillRect(left,y-8,room,16);
    ctx.fillStyle = chartColors[index];
    if (Number.isFinite(values[index]) && values[index] !== 0) {
      const endpoint = barX(values[index]);
      ctx.fillRect(Math.min(endpoint,origin),y-8,Math.max(1,Math.abs(endpoint-origin)),16);
    }
    ctx.textAlign = "left";
    ctx.fillText(formatted(values[index],key,mode),left+room+8,y,76);
  });
}

function chartDomain(values) {
  const low = Math.min(0,...values)*1.06;
  const high = Math.max(0,...values)*1.06;
  return low === high ? [0,1] : [low,high];
}

function drawScatter(players) {
  const surface = chartSurface("scatter");
  if (!surface) return;
  const {ctx,width,height} = surface;
  const xKey = $("scatter-x").value;
  const yKey = $("scatter-y").value;
  const pair = row => [measurement(row,xKey),measurement(row,yKey)];
  const valid = coords => coords.every(Number.isFinite);
  const cloud = benchmark.map(pair).filter(valid);
  const featured = players.map(pair);
  if (!featured.some(valid) && !cloud.length) {
    plotMessage(ctx,width,height,"Sem dados para este par de métricas.");
    return;
  }
  const points = [...cloud,...featured.filter(valid)];
  const [xMin,xMax] = chartDomain(points.map(([x])=>x));
  const [yMin,yMax] = chartDomain(points.map(([,y])=>y));
  const left = 93;
  const right = width-18;
  const top = 16;
  const bottom = height-52;
  const xPos = value => left + (value-xMin)/(xMax-xMin)*(right-left);
  const yPos = value => bottom - (value-yMin)/(yMax-yMin)*(bottom-top);
  const axisValue = (value,key) => fields[key][1] === "count" || (fields[key][1] === "rate" && unit === "count" && !decimalRates.has(key))
    ? decimal.format(value).replace(/,00$/,"") : formatted(value,key);
  for (let index=0;index<=4;index++) {
    const xTick = xMin + (xMax-xMin)*index/4;
    const yTick = yMin + (yMax-yMin)*index/4;
    const x = xPos(xTick);
    const y = yPos(yTick);
    ctx.beginPath();
    ctx.strokeStyle = "#334b41";
    ctx.moveTo(left,y); ctx.lineTo(right,y);
    ctx.moveTo(x,bottom); ctx.lineTo(x,top);
    ctx.stroke();
    ctx.fillStyle = "#a4b8ae";
    ctx.textAlign = "right"; ctx.fillText(axisValue(yTick,yKey),left-6,y,65);
    ctx.textAlign = index === 4 ? "right" : "center";
    ctx.fillText(axisValue(xTick,xKey),x,bottom+15,Math.max(26,(right-left)/4));
  }
  ctx.strokeStyle = "#6c9685";
  ctx.beginPath();
  ctx.moveTo(xPos(0),top); ctx.lineTo(xPos(0),bottom);
  ctx.moveTo(left,yPos(0)); ctx.lineTo(right,yPos(0));
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillText(metricLabel(xKey),(left+right)/2,height-13,right-left);
  ctx.save();
  ctx.translate(12,(top+bottom)/2);
  ctx.rotate(-Math.PI/2);
  ctx.fillText(metricLabel(yKey),0,0,bottom-top);
  ctx.restore();
  function dot([x,y],color,radius) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(xPos(x),yPos(y),radius,0,Math.PI*2);
    ctx.fill();
  }
  cloud.forEach(coords => dot(coords,"#92aca17a",3));
  featured.forEach((coords,index) => {
    if (valid(coords)) {
      dot(coords,"#101b18",8);
      dot(coords,chartColors[index],6);
    }
  });
}

function renderCharts(players) {
  $("charts").hidden = !players.length;
  if (!players.length) return;
  const keys = [...new Set([...profiles[profile].cols,"min","appearances","rating"])]
    .filter(key => !["date","text","valuation"].includes(fields[key][1]));
  const hasXg = [...benchmark,...players].some(row=>Number.isFinite(row.expectedGoals));
  const [first,second] = profile === "finishing" ? [hasXg ? "xg" : "shots","goals"] : profile === "creation" ? ["key","assists"] : keys;
  for (const [id,fallback] of [["bar-metric",keys[0]],["scatter-x",first],["scatter-y",second]]) {
    const select = $(id);
    const previous = select.value;
    select.innerHTML = keys.map(key => '<option value="' + key + '">' + h(metricLabel(key)) + '</option>').join("");
    select.value = chartProfile === profile && keys.includes(previous) ? previous : fallback;
  }
  chartProfile = profile;
  $("chart-legend").innerHTML = players.map((row,index) =>
    '<span><i aria-hidden="true" style="background:' + chartColors[index] + '"></i>' +
    h(row.player.name) + ' · ' + h(row.team.name) + '</span>').join("");
  drawCharts();
}

function drawCharts() {
  if (view !== "compare" || $("charts").hidden) return;
  const players = selection.map(key => rows.get(key)).filter(Boolean);
  drawRadar(players);
  drawBars(players);
  drawScatter(players);
}

for (const id of ["bar-metric","scatter-x","scatter-y"]) $(id).addEventListener("change",drawCharts);
new ResizeObserver(drawCharts).observe($("charts"));
