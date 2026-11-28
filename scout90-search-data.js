"use strict";

const searchMetrics = [
  "min","appearances","goals","assists","contributions","nonPen","xg","shots","shotsOn","shotAccuracy",
  "key","chances","finalThird","passPct","dribbles","cross","tackles","intercept","clearances",
  "aerial","aerialPct","saves","rating"
];
const searchSourceFields = [
  "minutesPlayed","appearances","goals","assists","penaltyGoals","expectedGoals","totalShots","shotsOnTarget",
  "keyPasses","bigChancesCreated","accurateFinalThirdPasses","totalPasses","accuratePassesPercentage",
  "successfulDribbles","accurateCrosses","tackles","interceptions","clearances","aerialDuelsWon",
  "aerialDuelsWonPercentage","saves","rating"
];

function searchIndexPath(path) {
  return path === "brasileirao-serie-a-2026.json" ? "indice-brasileirao-serie-a-2026.json" :
    path.replace(/\/consolidado\.json$/, "/indice.json");
}

function buildSearchIndex(record) {
  const players = {};
  const teams = {};
  const lines = record.results.map(row => {
    const {player,team} = row;
    const p = {...player,...player.profile};
    players[player.id] = [
      player.name,p.country?.alpha2 ?? p.country?.code ?? p.country?.alpha3 ?? p.nationality ??
        (typeof p.country === "string" ? p.country : null),
      p.birthDate ?? p.dateOfBirth ?? null,p.dateOfBirthTimestamp ?? null,p.preferredFoot ?? null,p.heightCm ?? p.height ?? null,
      p.position ?? null,p.positionsDetailed ?? null
    ];
    teams[team.id] = team.name;
    return [player.id,team.id,...searchSourceFields.map(key=>Number.isFinite(row[key]) ? row[key] : null)];
  });
  return {version:1,competition:record.competition,season:record.season,players,teams,lines};
}

if (typeof module !== "undefined") module.exports = {buildSearchIndex,searchIndexPath};
