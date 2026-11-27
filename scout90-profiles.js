"use strict";

const regionNames = new Intl.DisplayNames(["pt-BR"],{type:"region",fallback:"none"});
const personalColumns = ["nationality","birthDate","preferredFoot","heightCm"];
const personalInputs = ["nationality-filter","birth-from","birth-to","foot-filter","height-from","height-to"];
const footNames = {right:"Direito",left:"Esquerdo",both:"Ambos"};
const footballCountries = {"gb-eng":"Inglaterra","gb-sct":"Escócia","gb-wls":"País de Gales","gb-nir":"Irlanda do Norte"};
const countryAliases = {eng:"gb-eng",sco:"gb-sct",wal:"gb-wls",nir:"gb-nir",uk:"gb"};
const storedProfiles = new Map();
let activeProfiles = new Map();
let profileColumns = [];
let profileDb;

function profileDate(value, timestamp) {
  const fromValue = typeof value === "string" ? value.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/)?.[1] : null;
  const ms = typeof timestamp === "number" ? timestamp * 1000 : NaN;
  let date = fromValue;
  if (!date && Number.isFinite(ms) && Math.abs(ms) < 8.64e15) date = new Date(ms).toISOString().slice(0,10);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(date + "T00:00:00Z");
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date ? null : date;
}

function profileCountry(value) {
  const code = typeof value === "string" ? value : (value?.alpha2 || value?.code || value?.alpha3);
  const key = typeof code === "string" ? code.toLowerCase().trim() : "";
  const country = countryAliases[key] || key;
  return Object.hasOwn(flagAssets,country) ? country : null;
}

function profileFoot(value) {
  if (typeof value !== "string") return null;
  const labels = {right:"right",direito:"right",left:"left",esquerdo:"left",both:"both",ambos:"both",ambidestro:"both"};
  const key = normalized(value.trim());
  return Object.hasOwn(labels,key) ? labels[key] : null;
}

function countryName(code) {
  return code ? footballCountries[code] || (/^[a-z]{2}$/.test(code) && regionNames.of(code.toUpperCase())) || code.toUpperCase() : "—";
}

function flag(code) {
  const source = code && flagAssets[code];
  if (!source) return "";
  const name = h(countryName(code));
  return '<img class="nation-flag" src="data:image/png;base64,' + source + '" alt="' + name + '" title="' + name + '">';
}

function safePhoto(value,id) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.origin === "https://img.sofascore.com" && !url.username && !url.password &&
      url.pathname === "/api/v1/player/" + id + "/image" ? url.origin + url.pathname : null;
  } catch { return null; }
}

function normalizePlayerProfile(payload,id) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  if (payload.id != null && Number(payload.id) !== id) return {};
  const profile = {};
  const country = profileCountry(payload.country ?? payload.nationality);
  const birth = profileDate(payload.birthDate ?? payload.dateOfBirth,payload.dateOfBirthTimestamp);
  const foot = profileFoot(payload.preferredFoot);
  const height = payload.heightCm ?? payload.height;
  const position = typeof payload.position === "string" ? payload.position.trim() : "";
  const positions = Array.isArray(payload.positionsDetailed) ?
    [...new Set(payload.positionsDetailed.filter(code=>typeof code === "string" && code.trim()).map(code=>code.trim()))] : [];
  const contract = profileDate(payload.contractUntil,payload.contractUntilTimestamp);
  const valuation = payload.marketValue ?? payload.proposedMarketValueRaw;
  const club = payload.currentTeam ?? payload.team;
  const shirt = payload.shirtNumber ?? payload.jerseyNumber;
  const photo = safePhoto(payload.photoUrl,id);
  if (country) profile.nationality = country;
  if (birth) profile.birthDate = birth;
  if (foot) profile.preferredFoot = foot;
  if (Number.isFinite(height) && height > 0) profile.heightCm = height;
  if (position) profile.position = position;
  if (positions.length) profile.positionsDetailed = positions;
  if (contract) profile.contractUntil = contract;
  if (Number.isFinite(valuation?.value) && valuation.value >= 0 && /^[A-Z]{3}$/.test(valuation.currency)) {
    profile.marketValue = {value:valuation.value,currency:valuation.currency};
  }
  if (typeof club?.name === "string" && club.name.trim()) profile.currentTeam = club.name.trim();
  if (Number.isInteger(shirt) && shirt >= 0) profile.shirtNumber = shirt;
  if (photo) profile.photoUrl = photo;
  return profile;
}

function athlete(row) {
  return activeProfiles.get(row) || {};
}

function refreshProfileFilters() {
  activeProfiles = new Map(base.results.map(row=>[
    row,{
      ...normalizePlayerProfile(row.player,row.player.id),
      ...normalizePlayerProfile(row.player.profile,row.player.id),
      ...storedProfiles.get(row.player.id)
    }
  ]));
  const has = new Set();
  const nations = new Set();
  for (const profile of activeProfiles.values()) {
    for (const key of personalColumns) if (profile[key] != null) has.add(key);
    if (profile.nationality) nations.add(profile.nationality);
  }
  profileColumns = personalColumns.filter(key=>has.has(key));
  const previous = $("nationality-filter").value;
  const missing = [...activeProfiles.values()].some(profile=>!profile.nationality);
  $("profile-filter-note").hidden = Boolean(has.size) || !base.results.length;
  $("nationality-filter").innerHTML = '<option value="">Todas</option>' +
    [...nations].sort((a,b)=>countryName(a).localeCompare(countryName(b),"pt-BR")).map(country=>
      '<option value="' + h(country) + '">' + h(countryName(country)) + '</option>').join("") +
    (missing ? '<option value="unknown">Sem informação</option>' : "");
  if (nations.has(previous) || (previous === "unknown" && missing)) $("nationality-filter").value = previous;
}

function profilePredicates() {
  const values = Object.fromEntries(personalInputs.map(id=>[id,$(id).value]));
  const numeric = id => $(id).valueAsNumber;
  const lowHeight = numeric("height-from");
  const highHeight = numeric("height-to");
  return row => {
    const data = athlete(row);
    const country = values["nationality-filter"];
    const foot = values["foot-filter"];
    const from = values["birth-from"];
    const to = values["birth-to"];
    return (!country || (data.nationality || "unknown") === country) &&
      (!foot || (data.preferredFoot || "unknown") === foot) &&
      (!from || (data.birthDate != null && data.birthDate >= from)) &&
      (!to || (data.birthDate != null && data.birthDate <= to)) &&
      (Number.isNaN(lowHeight) || (data.heightCm != null && data.heightCm >= lowHeight)) &&
      (Number.isNaN(highHeight) || (data.heightCm != null && data.heightCm <= highHeight));
  };
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]).join("").toUpperCase();
}

function portrait(row) {
  const photo = athlete(row).photoUrl;
  return '<span class="portrait"><span aria-hidden="true">' + h(initials(row.player.name)) + '</span>' +
    (photo ? '<img class="player-photo" src="' + h(photo) + '" alt="" referrerpolicy="no-referrer">' : "") + '</span>';
}

function profileDetail(row) {
  const data = athlete(row);
  const valuation = data.marketValue;
  const estimated = valuation ? new Intl.NumberFormat("pt-BR",{style:"currency",currency:valuation.currency}).format(valuation.value) : "—";
  $("detail-portrait").innerHTML = portrait(row);
  $("detail-flag").innerHTML = flag(data.nationality);
  $("detail-bio").innerHTML = [
    ["Nacionalidade",countryName(data.nationality)],
    ["Nascimento",formatted(data.birthDate ?? null,"birthDate")],
    ["Pé preferido",footNames[data.preferredFoot] || "—"],
    ["Altura",data.heightCm ? number.format(data.heightCm) + " cm" : "—"],
    ["Posições",data.positionsDetailed?.join(" / ") || data.position || "—"],
    ["Clube informado no perfil",data.currentTeam || "—"],
    ["Contrato informado no perfil",formatted(data.contractUntil ?? null,"birthDate")],
    ["Valor estimado pela fonte",estimated]
  ].map(([label,value])=>"<div><dt>" + h(label) + "</dt><dd>" + h(value) + "</dd></div>").join("");
}

document.addEventListener("error",event=>{
  if (event.target instanceof HTMLImageElement && event.target.classList.contains("player-photo")) event.target.remove();
},true);

function extractProfiles(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload?.player || (payload && Object.hasOwn(payload,"id"))) return [payload];
  const entries = payload?.profiles ?? payload?.players ?? payload;
  if (Array.isArray(entries)) return entries;
  if (!entries || typeof entries !== "object") throw new Error("Formato de catálogo inválido.");
  const pairs = Object.entries(entries);
  if (!pairs.length) return [];
  return pairs.map(([key,data])=>{
    if (!/^\d+$/.test(key) || !data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("O catálogo precisa conter uma lista de perfis ou perfis indexados por ID.");
    }
    const profile = data.player ?? data;
    if (profile.id != null && Number(profile.id) !== Number(key)) throw new Error("ID divergente para " + key + ".");
    return {...profile,id:Number(key)};
  });
}

async function loadProfileFiles(files) {
  const result = new Map();
  for (const file of files) {
    let payload;
    try { payload = JSON.parse((await file.text()).replace(/^\uFEFF/,"")); }
    catch { throw new Error(file.name + ": JSON inválido."); }
    for (const entry of extractProfiles(payload)) {
      const raw = entry?.player ?? entry;
      const id = typeof raw?.id === "string" && /^\d+$/.test(raw.id) ? Number(raw.id) : raw?.id;
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error(file.name + ": ID de jogador inválido.");
      const data = normalizePlayerProfile(raw,id);
      if (!Object.keys(data).length) continue;
      const prior = result.get(id);
      if (prior && orderedJson(prior) !== orderedJson(data)) {
        throw new Error(file.name + ": há perfis divergentes para o jogador " + id + ".");
      }
      result.set(id,data);
    }
  }
  if (!result.size) throw new Error("Os arquivos não contêm dados de perfil reconhecidos.");
  return result;
}

function openPlayerLibrary() {
  return new Promise((resolve,reject)=>{
    const request = indexedDB.open("scout90-player-profiles",1);
    request.onupgradeneeded = () => request.result.createObjectStore("playerProfiles",{keyPath:"id"});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("O catálogo de jogadores está bloqueado por outra aba."));
  });
}

function savedPlayerProfiles() {
  return new Promise((resolve,reject)=>{
    const request = profileDb.transaction("playerProfiles").objectStore("playerProfiles").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function storePlayerProfiles(profiles) {
  return new Promise((resolve,reject)=>{
    const transaction = profileDb.transaction("playerProfiles","readwrite");
    const store = transaction.objectStore("playerProfiles");
    for (const [id,profile] of profiles) {
      const prior = store.get(id);
      prior.onsuccess = () => store.put({id,profile:{...prior.result?.profile,...profile}});
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

$("open-player-import").addEventListener("click",()=>{
  $("profile-import-form").reset();
  $("profile-import-status").textContent = "";
  $("profile-import-dialog").showModal();
});

$("profile-import-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const button = $("run-profile-import");
  if (button.disabled) return;
  button.disabled = true;
  $("profile-import-status").textContent = "Validando perfis…";
  try {
    const profiles = await loadProfileFiles([...$("profile-files").files]);
    let saved = false;
    if (profileDb) {
      await storePlayerProfiles(profiles);
      for (const {id,profile} of await savedPlayerProfiles()) storedProfiles.set(id,profile);
      saved = true;
    } else {
      for (const [id,profile] of profiles) storedProfiles.set(id,{...storedProfiles.get(id),...profile});
    }
    refreshProfileFilters();
    render();
    $("profile-import-dialog").close();
    const ids = new Set(base.results.map(row=>row.player.id));
    const matched = [...profiles.keys()].filter(id=>ids.has(id)).length;
    notice(number.format(profiles.size) + " perfil(is) importado(s), " + number.format(matched) + " na base ativa." +
      (saved ? "" : " Os perfis valem nesta sessão."));
  } catch (error) {
    $("profile-import-status").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
