"use strict";

const fields = {
  min:["Minutos","count"], appearances:["Jogos","count","appearances"], starts:["Titularidades","count","matchesStarted"],
  goals:["Gols","rate","goals"], nonPen:["Gols sem pênalti","rate"], xg:["xG","rate","expectedGoals"],
  shots:["Finalizações","rate","totalShots"], shotsOn:["Chutes no alvo","rate","shotsOnTarget"],
  assists:["Assistências","rate","assists"], key:["Passes-chave","rate","keyPasses"], chances:["Grandes chances criadas","rate","bigChancesCreated"],
  finalThird:["Passes certos no terço final","rate","accurateFinalThirdPasses"], cross:["Cruzamentos certos","rate","accurateCrosses"],
  crossPct:["Acerto em cruzamentos","percent","accurateCrossesPercentage"], dribbles:["Dribles certos","rate","successfulDribbles"],
  tackles:["Desarmes","rate","tackles"], intercept:["Interceptações","rate","interceptions"], clearances:["Alívios","rate","clearances"],
  blocks:["Chutes bloqueados","rate","blockedShots"], aerial:["Duelos aéreos ganhos","rate","aerialDuelsWon"],
  aerialPct:["Vitória em duelos aéreos","percent","aerialDuelsWonPercentage"], passPct:["Acerto no passe","percent","accuratePassesPercentage"],
  saves:["Defesas","rate","saves"], inside:["Defesas dentro da área","rate","savedShotsFromInsideTheBox"],
  clean:["Jogos sem sofrer gol","count","cleanSheet"], claims:["Bolas aéreas agarradas","rate","highClaims"],
  rating:["Nota média","decimal","rating"], salary:["Salário mensal","money"], annual:["Salário anualizado","money"],
  value:["Valor estimado","money"], contract:["Fim de contrato","date"],
  contributionCost:["Custo por gol + assistência","money"], saveCost:["Custo por defesa","money"]
};
const legacyMetrics = ["minutesPlayed","penaltyGoals","totalPasses", ...Object.values(fields).map(field => field[2]).filter(Boolean)];
Object.assign(fields, {
  penaltyGoals:["Gols de pênalti","rate","penaltyGoals"], penaltyAttempts:["Pênaltis cobrados","rate","penaltiesTaken"],
  penaltyPct:["Conversão de pênaltis","percent","penaltyConversion","penaltiesTaken"],
  shotAccuracy:["Chutes no alvo","percent"], offTarget:["Chutes para fora","rate","shotsOffTarget"],
  goalPct:["Conversão de chutes","percent","goalConversionPercentage","totalShots"],
  bigMiss:["Grandes chances perdidas","rate","bigChancesMissed"], woodwork:["Bolas na trave","rate","hitWoodwork"],
  insideGoals:["Gols dentro da área","rate","goalsFromInsideTheBox"], outsideGoals:["Gols fora da área","rate","goalsFromOutsideTheBox"],
  headerGoals:["Gols de cabeça","rate","headedGoals"], leftGoals:["Gols de esquerda","rate","leftFootGoals"],
  rightGoals:["Gols de direita","rate","rightFootGoals"], freeKickGoals:["Gols de falta","rate","freeKickGoal"],
  setShots:["Chutes de bola parada","rate","shotFromSetPiece"], setPct:["Conversão de bola parada","percent","setPieceConversion","shotFromSetPiece"],
  offsides:["Impedimentos","rate","offsides"], wonPenalty:["Pênaltis sofridos","rate","penaltyWon"],
  passes:["Passes tentados","rate","totalPasses"], accurate:["Passes certos","rate","accuratePasses"],
  wrongPasses:["Passes errados","rate","inaccuratePasses"],
  longBalls:["Bolas longas certas","rate","accurateLongBalls"], longPct:["Acerto em bolas longas","percent","accurateLongBallsPercentage","accurateLongBalls"],
  ownHalf:["Passes certos no campo defensivo","rate","accurateOwnHalfPasses"],
  oppHalf:["Passes certos no campo ofensivo","rate","accurateOppositionHalfPasses"],
  preAssist:["Passes antes da assistência","rate","passToAssist"], dribblePct:["Acerto em dribles","percent","successfulDribblesPercentage","successfulDribbles"],
  fouled:["Faltas sofridas","rate","wasFouled"], possessionLost:["Perdas de posse","rate","possessionLost"],
  dispossessed:["Vezes desarmado","rate","dispossessed"], dribbledPast:["Dribles sofridos","rate","dribbledPast"],
  ground:["Duelos terrestres ganhos","rate","groundDuelsWon"],
  groundPct:["Vitória em duelos terrestres","percent","groundDuelsWonPercentage","groundDuelsWon"],
  duels:["Duelos ganhos","rate","totalDuelsWon"], duelsPct:["Vitória em duelos","percent","totalDuelsWonPercentage","totalDuelsWon"],
  outfielderBlocks:["Bloqueios de linha","rate","outfielderBlocks"], fouls:["Faltas cometidas","rate","fouls"],
  yellows:["Amarelos","rate","yellowCards"], reds:["Vermelhos","rate","redCards"],
  penaltyConceded:["Pênaltis cometidos","rate","penaltyConceded"], ownGoals:["Gols contra","rate","ownGoals"],
  errorsGoal:["Erros que geraram gol","rate","errorLeadToGoal"], errorsShot:["Erros que geraram chute","rate","errorLeadToShot"],
  outside:["Defesas fora da área","rate","savedShotsFromOutsideTheBox"], punches:["Socos na bola","rate","punches"],
  notClaimed:["Cruzamentos sem domínio","rate","crossesNotClaimed"], runs:["Saídas do gol","rate","runsOut"],
  successRuns:["Saídas certas","rate","successfulRunsOut"], runsPct:["Acerto nas saídas","percent"],
  concededInside:["Gols sofridos dentro da área","rate","goalsConcededInsideTheBox"], concededOutside:["Gols sofridos fora da área","rate","goalsConcededOutsideTheBox"],
  faced:["Pênaltis enfrentados","rate","penaltyFaced"], savedPen:["Pênaltis defendidos","rate","penaltySave"],
  savesPct:["Pênaltis defendidos","percent"], observedCost:["Custo salarial no recorte","money"]
});
const profiles = {
  overview:{label:"Visão geral", cols:["goals","assists","key","tackles","rating"], note:"Panorama da base. Use os perfis para trocar o conjunto de métricas."},
  finishing:{label:"Finalização", cols:["nonPen","goals","xg","shotsOn","shots"], note:"Gols sem pênalti excluem os pênaltis convertidos. O xG sem pênalti é estimado pela fórmula da planilha, que desconta 0,79 por pênalti cobrado. Resultados abaixo de zero são exibidos como zero."},
  creation:{label:"Criação", cols:["key","chances","assists","finalThird","passPct"], note:"Compare volume de passes-chave, qualidade das chances criadas e assistências."},
  wings:{label:"Jogo pelos lados", cols:["cross","crossPct","dribbles","key","tackles"], note:"Use a posição cadastrada para restringir a busca. As tentativas estimadas são recuperadas quando a taxa arredondada permite identificar uma única contagem."},
  recovery:{label:"Recuperação", cols:["tackles","intercept","clearances","blocks","passPct"], note:"Compare ações defensivas por 90 com acerto de passe. O volume depende também do contexto de jogo."},
  aerial:{label:"Defesa aérea", cols:["aerial","aerialPct","clearances","intercept"], note:"As contagens estimadas são recuperadas quando a taxa arredondada permite identificar um único total. A taxa de vitória exige uma estimativa de ao menos 10 duelos."},
  goalkeeper:{label:"Goleiros", cols:["saves","inside","clean","claims","passPct"], note:"Inclui goleiros cadastrados, identificados pelo perfil ou com defesas registradas. As bolas enfrentadas são a soma de defesas e gols sofridos dentro e fora da área."},
  finance:{label:"Custos", cols:["annual","salary","value","contributionCost","saveCost"], note:"Cadastre valores na ficha do jogador. Salário anualizado é o mensal × 12. Os custos por ação usam o gasto salarial no recorte. O valor de mercado da fonte mantém a moeda original e a ordenação agrupa moedas."}
};
Object.assign(fields,{
  nationality:["Nacionalidade","text"],birthDate:["Nascimento","date"],
  preferredFoot:["Pé preferido","text"],heightCm:["Altura (cm)","count"]
});

const profileExtras = {
  overview:["appearances","starts","nonPen","xg","shots","shotsOn","chances","passes","passPct","intercept","duels","aerial","dribbles","fouls","yellows","reds"],
  finishing:["shotAccuracy","offTarget","goalPct","bigMiss","woodwork","insideGoals","outsideGoals","headerGoals","leftGoals","rightGoals","freeKickGoals","setShots","setPct","penaltyGoals","penaltyAttempts","penaltyPct","offsides","wonPenalty"],
  creation:["preAssist","passes","accurate","wrongPasses","longBalls","longPct","ownHalf","oppHalf","cross","crossPct","dribbles","possessionLost"],
  wings:["dribblePct","finalThird","oppHalf","chances","assists","fouled","possessionLost","dispossessed","passPct","intercept"],
  recovery:["outfielderBlocks","dribbledPast","ground","groundPct","duels","duelsPct","fouls","yellows","reds","penaltyConceded","ownGoals","errorsGoal","errorsShot"],
  aerial:["duels","duelsPct","headerGoals"],
  goalkeeper:["outside","punches","notClaimed","runs","successRuns","runsPct","concededInside","concededOutside","faced","savedPen","savesPct","longBalls","longPct","errorsGoal","errorsShot"],
  finance:["observedCost","contract"]
};
for (const [id,keys] of Object.entries(profileExtras)) profiles[id].cols.push(...keys);

const combine = (operation,...values) => values.every(Number.isFinite) ? operation(...values) : null;
const sum = (...values) => combine((...numbers)=>numbers.reduce((total,value)=>total+value,0),...values);
const subtract = (a,b) => combine((left,right)=>left-right,a,b);
const ratio = (a,b,scale=1) => Number.isFinite(a) && Number.isFinite(b) && b > 0 ? scale*a/b : null;
const contributions = row => sum(row.goals,row.assists);
const nonPenaltyXg = row => combine((xg,attempts)=>Math.max(0,xg-0.79*attempts),row.expectedGoals,row.penaltiesTaken);
const goalsConceded = row => sum(row.goalsConcededInsideTheBox,row.goalsConcededOutsideTheBox);
const shotsFaced = row => sum(row.saves,goalsConceded(row));

// Published percentages are rounded to two decimals. Only recover a count when the rounded rate identifies one integer.
function attemptsFromRate(won,accuracy) {
  if (!Number.isSafeInteger(won) || won <= 0 || !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 100) return null;
  const error = 0.005000001;
  const minimum = Math.max(won,Math.ceil(100*won/(accuracy+error)));
  const maximum = Math.floor(100*won/(accuracy-error));
  return minimum === maximum && Number.isSafeInteger(minimum) ? minimum : null;
}

const aerialAttempts = row => attemptsFromRate(row.aerialDuelsWon,row.aerialDuelsWonPercentage);
const duelAttempts = row => attemptsFromRate(row.totalDuelsWon,row.totalDuelsWonPercentage);
const crossesAttempted = row => attemptsFromRate(row.accurateCrosses,row.accurateCrossesPercentage);
const longBallsAttempted = row => attemptsFromRate(row.accurateLongBalls,row.accurateLongBallsPercentage);
const dribblesAttempted = row => attemptsFromRate(row.successfulDribbles,row.successfulDribblesPercentage);

const moneyballMetrics = {
  equivalentGames:[["Equivalente em jogos de 90 min","decimal"],row=>ratio(row.minutesPlayed,90)],
  minutesPerGame:[["Minutos por partida","decimal"],row=>ratio(row.minutesPlayed,row.appearances)],
  startsPct:[["Jogos como titular","percent"],row=>ratio(row.matchesStarted,row.appearances,100)],
  contributions:[["Gols + assistências","rate"],contributions],
  nonPenaltyContributions:[["Gols sem pênalti + assistências","rate"],row=>sum(raw(row,"nonPen"),row.assists)],
  contributionsPerGame:[["Gols + assistências por partida","decimal"],row=>ratio(contributions(row),row.appearances)],
  minutesPerGoal:[["Minutos por gol","decimal"],row=>ratio(row.minutesPlayed,row.goals)],
  minutesPerContribution:[["Minutos por participação em gol","decimal"],row=>ratio(row.minutesPlayed,contributions(row))],
  minutesPerShot:[["Minutos por finalização","decimal"],row=>ratio(row.minutesPlayed,row.totalShots)],
  minutesPerShotOn:[["Minutos por chute no alvo","decimal"],row=>ratio(row.minutesPlayed,row.shotsOnTarget)],
  shotsPerGoal:[["Finalizações por gol","decimal"],row=>ratio(row.totalShots,row.goals)],
  shotsOnPerGoal:[["Chutes no alvo por gol","decimal"],row=>ratio(row.shotsOnTarget,row.goals)],
  minutesPerKey:[["Minutos por passe-chave","decimal"],row=>ratio(row.minutesPlayed,row.keyPasses)],
  minutesPerPossessionLoss:[["Minutos por perda de posse","decimal"],row=>ratio(row.minutesPlayed,row.possessionLost)],
  minutesPerWrongPass:[["Minutos por passe errado","decimal"],row=>ratio(row.minutesPlayed,row.inaccuratePasses)],
  wrongPassPct:[["Passes errados","percent"],row=>ratio(row.inaccuratePasses,row.totalPasses,100)],
  passBalance:[["Passes certos − errados","rate"],row=>subtract(row.accuratePasses,row.inaccuratePasses)],
  xgPerGame:[["xG por partida","decimal"],row=>ratio(row.expectedGoals,row.appearances)],
  goalsPerGame:[["Gols por partida","decimal"],row=>ratio(row.goals,row.appearances)],
  assistsPerGame:[["Assistências por partida","decimal"],row=>ratio(row.assists,row.appearances)],
  minutesPerChance:[["Minutos por grande chance criada","decimal"],row=>ratio(row.minutesPlayed,row.bigChancesCreated)],
  xgPerShot:[["xG total por finalização","decimal"],row=>ratio(row.expectedGoals,row.totalShots)],
  goalsOverXg:[["Gols − xG","rate"],row=>subtract(row.goals,row.expectedGoals)],
  npxg:[["xG sem pênalti (estim.)","rate"],nonPenaltyXg],
  npxgPerShot:[["xG por finalização sem pênalti (estim.)","decimal"],row=>ratio(nonPenaltyXg(row),subtract(row.totalShots,row.penaltiesTaken))],
  nonPenaltyOverXg:[["Gols sem pênalti − xG sem pênalti (estim.)","rate"],row=>subtract(raw(row,"nonPen"),nonPenaltyXg(row))],
  missedPenalties:[["Pênaltis não convertidos","rate"],row=>subtract(row.penaltiesTaken,row.penaltyGoals)],
  totalCards:[["Total de cartões","rate"],row=>sum(row.yellowCards,row.redCards)],
  airAttempts:[["Duelos aéreos disputados (estim.)","rate"],aerialAttempts],
  airLosses:[["Duelos aéreos perdidos (estim.)","rate"],row=>subtract(aerialAttempts(row),row.aerialDuelsWon)],
  allDuelAttempts:[["Duelos disputados (estim.)","rate"],duelAttempts],
  allDuelLosses:[["Duelos perdidos (estim.)","rate"],row=>subtract(duelAttempts(row),row.totalDuelsWon)],
  crossesAttempted:[["Cruzamentos tentados (estim.)","rate"],crossesAttempted],
  longBallsAttempted:[["Bolas longas tentadas (estim.)","rate"],longBallsAttempted],
  dribblesAttempted:[["Dribles tentados (estim.)","rate"],dribblesAttempted],
  savesPerGame:[["Defesas por partida","decimal"],row=>ratio(row.saves,row.appearances)],
  goalsConceded:[["Gols sofridos (dentro + fora da área)","rate"],goalsConceded],
  concededPerGame:[["Gols sofridos por partida","decimal"],row=>ratio(goalsConceded(row),row.appearances)],
  facedPerConceded:[["Bolas no alvo enfrentadas por gol sofrido","decimal"],row=>ratio(shotsFaced(row),goalsConceded(row))],
  minutesPerConceded:[["Minutos por gol sofrido","decimal"],row=>ratio(row.minutesPlayed,goalsConceded(row))],
  shotsFaced:[["Bolas no alvo enfrentadas (defesas + gols)","rate"],shotsFaced],
  saveRate:[["Defesas sobre defesas + gols sofridos","percent"],row=>ratio(row.saves,shotsFaced(row),100)],
  cleanRate:[["Partidas sem sofrer gol sobre jogos","percent"],row=>ratio(row.cleanSheet,row.appearances,100)],
  costPerGoal:[["Custo por gol","money"],row=>ratio(periodCost(row),row.goals)],
  costPerAssist:[["Custo por assistência","money"],row=>ratio(periodCost(row),row.assists)],
  profileMarketValue:[["Valor de mercado da fonte","valuation"],row=>athlete(row).marketValue ?? null],
  profileContract:[["Fim de contrato informado na fonte","date"],row=>athlete(row).contractUntil ?? null]
};

const extraMoneyballColumns = {
  overview:["contributions","minutesPerGame","startsPct","equivalentGames","minutesPerContribution"],
  finishing:["contributions","nonPenaltyContributions","contributionsPerGame","goalsOverXg","npxg","xgPerShot","npxgPerShot",
    "nonPenaltyOverXg","minutesPerGoal","minutesPerContribution","minutesPerShot","minutesPerShotOn","shotsPerGoal","shotsOnPerGoal","missedPenalties","xgPerGame","goalsPerGame"],
  creation:["contributions","minutesPerKey","minutesPerChance","longBallsAttempted","assistsPerGame","minutesPerWrongPass","wrongPassPct","passBalance"],
  wings:["crossesAttempted","dribblesAttempted","minutesPerPossessionLoss"],
  recovery:["allDuelAttempts","allDuelLosses","totalCards"],
  aerial:["airAttempts","airLosses","allDuelAttempts","allDuelLosses"],
  goalkeeper:["savesPerGame","goalsConceded","minutesPerConceded","shotsFaced","saveRate","cleanRate","longBallsAttempted","concededPerGame","facedPerConceded"],
  finance:["costPerGoal","costPerAssist","profileMarketValue","profileContract"]
};

for (const [key,[field]] of Object.entries(moneyballMetrics)) fields[key] = field;
for (const [name,columns] of Object.entries(extraMoneyballColumns)) profiles[name].cols.push(...columns);
const decimalRates = new Set(["xg","goalsOverXg","npxg","nonPenaltyOverXg"]);


const playerKey = row => row.player.id + "/" + row.team.id;
const scout = row => info.scouts[row.player.id] || {};
const financial = row => info.finance[playerKey(row)] || {};
const periodCost = row => financial(row).periodCosts?.[snapshot] ?? null;

function datasetKey(data) {
  const canonical = [...data.results].sort((a,b) => a.player.id - b.player.id || a.team.id - b.team.id)
    .map(row => [playerKey(row), ...[...new Set(legacyMetrics)].map(key => row[key] ?? null)]);
  const labels = data.original ? ["",""] : data.legacyLabels ?? [data.competition || "",data.season || ""];
  const text = JSON.stringify([...labels,canonical]);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return canonical.length + "-" + (hash >>> 0).toString(16);
}
const positionsOptions = label => '<option value="">' + h(label) + "</option>" +
  positions.map(position => '<option>' + h(position) + '</option>').join("");
const aerialWinRate = row => {
  const wins = row.aerialDuelsWon;
  const pct = row.aerialDuelsWonPercentage;
  return wins > 0 && pct > 0 && Math.round(100 * wins / pct) >= 10 ? pct : null;
};

function raw(row, key) {
  if (Object.hasOwn(moneyballMetrics,key)) return moneyballMetrics[key][1](row);
  switch (key) {
    case "min": return row.minutesPlayed;
    case "nationality": return athlete(row).nationality ? countryName(athlete(row).nationality) : null;
    case "birthDate": return athlete(row).birthDate ?? null;
    case "preferredFoot": return footNames[athlete(row).preferredFoot] ?? null;
    case "heightCm": return athlete(row).heightCm ?? null;
    case "nonPen": return row.goals != null && row.penaltyGoals != null ? row.goals - row.penaltyGoals : null;
    case "aerialPct": return aerialWinRate(row);
    case "passPct": return row.totalPasses > 0 ? row.accuratePassesPercentage : null;
    case "crossPct": return row.accurateCrosses > 0 ? row.accurateCrossesPercentage : null;
    case "rating": return row.rating > 0 ? row.rating : null;
    case "shotAccuracy": return row.totalShots > 0 && row.shotsOnTarget != null ? 100 * row.shotsOnTarget / row.totalShots : null;
    case "runsPct": return row.runsOut > 0 && row.successfulRunsOut != null ? 100 * row.successfulRunsOut / row.runsOut : null;
    case "savesPct": return row.penaltyFaced > 0 && row.penaltySave != null ? 100 * row.penaltySave / row.penaltyFaced : null;
    case "observedCost": return periodCost(row);
    case "salary": return financial(row).salary ?? null;
    case "annual": return financial(row).salary == null ? null : financial(row).salary * 12;
    case "value": return financial(row).value ?? null;
    case "contract": return financial(row).contract || null;
    case "contributionCost": {
      const total = row.goals != null && row.assists != null ? row.goals + row.assists : 0;
      const cost = periodCost(row);
      return total > 0 && cost != null ? cost / total : null;
    }
    case "saveCost": {
      const cost = periodCost(row);
      return row.saves > 0 && cost != null ? cost / row.saves : null;
    }
    default: {
      const [, , source, volume] = fields[key];
      return volume && !(row[volume] > 0) ? null : row[source] ?? null;
    }
  }
}

function measurement(row, key, mode = unit) {
  const value = raw(row, key);
  if (value === null || fields[key][1] !== "rate" || mode !== "rate") return value;
  return row.minutesPlayed > 0 ? value * 90 / row.minutesPlayed : null;
}

function formatted(value, key, mode = unit) {
  if (value === null) return "—";
  const type = fields[key][1];
  if (type === "money") return currency.format(value);
  if (type === "valuation") return new Intl.NumberFormat("pt-BR",{style:"currency",currency:value.currency}).format(value.value);
  if (type === "date") return value.split("-").reverse().join("/");
  if (type === "text") return value;
  if (type === "percent") return decimal.format(value) + "%";
  return decimalRates.has(key) || type === "decimal" || (type === "rate" && mode === "rate") ? decimal.format(value) : number.format(value);
}

function metricLabel(key, mode = unit) {
  return fields[key][0] + (fields[key][1] === "percent" ? " (%)" : fields[key][1] === "rate" && mode === "rate" ? "/90" : "");
}

function cell(row, key, mode = unit) {
  const value = measurement(row, key, mode);
  if (key === "xg" && value === null && row.totalShots === 0) return "Sem finalizações";
  return formatted(value, key, mode);
}

function activeColumns() {
  return custom.get(profile) || [...profiles[profile].cols,...profileColumns];
}

function profileMatch(row) {
  if (profile === "goalkeeper") {
    const position = scout(row).position;
    return position ? position === "Goleiro" : athlete(row).position === "G" || athlete(row).position === "GK" || row.saves > 0;
  }
  if (profile === "finance") {
    const detail = financial(row);
    const published = athlete(row);
    const hasData = detail.salary != null || detail.value != null || detail.contract || periodCost(row) != null ||
      published.marketValue || published.contractUntil;
    const budget = $("budget").valueAsNumber;
    return hasData && (Number.isNaN(budget) || (detail.salary != null && detail.salary <= budget));
  }
  return true;
}
