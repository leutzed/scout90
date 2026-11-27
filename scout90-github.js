"use strict";

class ExistingRemoteBase extends Error {}

function readCatalog(value) {
  if (value?.version !== 1 || !Array.isArray(value.competitions)) throw new Error("Catálogo de campeonatos inválido.");
  const ids = new Set();
  for (const entry of value.competitions) {
    if (typeof entry?.competition !== "string" || !entry.competition.trim() ||
        typeof entry.season !== "string" || !entry.season.trim() ||
        typeof entry.path !== "string" || !/^(brasileirao-serie-a-2026\.json|dados\/[a-z0-9-]+\/consolidado\.json)$/.test(entry.path)) {
      throw new Error("O catálogo possui um campeonato inválido.");
    }
    const id = baseId(entry.competition,entry.season);
    if (ids.has(id)) throw new Error("O catálogo possui campeonatos duplicados.");
    ids.add(id);
  }
  return value;
}

async function readPublishedCatalog() {
  if (!canPublish) return [];
  const response = await fetch("./" + catalogFile,{cache:"no-cache"});
  if (!response.ok) throw new Error("Catálogo publicado indisponível.");
  return readCatalog(await response.json()).competitions;
}

async function downloadPublished(entry) {
  const response = await fetch("./" + entry.path,{cache:"no-cache"});
  if (!response.ok) throw new Error("Não foi possível carregar esta base do repositório.");
  const data = await response.json();
  if (data.format !== "scout90-competition" || data.version !== 1 || !Array.isArray(data.results) || !data.results.length ||
      baseId(data.competition,data.season) !== baseId(entry.competition,entry.season)) {
    throw new Error("O arquivo publicado não corresponde ao catálogo.");
  }
  return data;
}

function githubClient(token) {
  return async (endpoint,{method = "GET",body,branchUpdate = false} = {}) => {
    const response = await fetch("https://api.github.com/repos/" + githubRepo + endpoint,{
      method,
      redirect:"error",
      credentials:"omit",
      cache:"no-store",
      headers:{
        Accept:"application/vnd.github+json",
        Authorization:"Bearer " + token,
        "X-GitHub-Api-Version":"2022-11-28",
        ...(body ? {"Content-Type":"application/json"} : {})
      },
      body:body ? JSON.stringify(body) : undefined
    });
    if (response.status === 401) throw new Error("Token inválido ou expirado.");
    if (response.status === 403 || response.status === 404) {
      throw new Error("O GitHub negou o acesso. Confira as permissões ou tente novamente se houver limite de requisições.");
    }
    if (branchUpdate && [409,422].includes(response.status)) {
      throw new Error("O GitHub recusou a atualização da main. Nenhum arquivo foi publicado por esta tentativa. Confira se a branch mudou ou está protegida.");
    }
    if (!response.ok) throw new Error("A API do GitHub respondeu com erro " + response.status + ".");
    return response.json();
  };
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let offset=0;offset<bytes.length;offset+=24576) {
    binary += String.fromCharCode(...bytes.subarray(offset,offset+24576));
  }
  return btoa(binary);
}

async function publishCompetition(record,originals,token,replace,progress) {
  if (originals.some(file => !/\.(json|txt)$/i.test(file.name))) {
    throw new Error("Para publicar, os arquivos originais devem ter extensão .json ou .txt.");
  }
  const api = githubClient(token);
  const reference = await api("/git/ref/heads/main");
  const parent = reference.object.sha;
  const head = await api("/git/commits/" + parent);
  const manifestBlob = await api("/contents/" + catalogFile + "?ref=" + parent);
  if (manifestBlob.encoding !== "base64") throw new Error("Não foi possível ler o catálogo no GitHub.");
  const manifestBytes = Uint8Array.from(atob(manifestBlob.content),char=>char.charCodeAt(0));
  const catalog = readCatalog(JSON.parse(new TextDecoder().decode(manifestBytes)));
  const sameCompetition = entry => baseId(entry.competition,entry.season) === record.id;
  const existing = catalog.competitions.find(sameCompetition);
  if (existing && !replace) {
    throw new ExistingRemoteBase("Já existe uma base publicada para este campeonato e temporada. Confirme a substituição da versão ativa.");
  }
  const encoder = new TextEncoder();
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(record.id)));
  const suffix = [...digest.slice(0,8)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
  const label = normalized(record.competition+"-"+record.season).replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70);
  const folder = existing?.path.startsWith("dados/") ? existing.path.split("/").slice(0,2).join("/") :
    "dados/" + (label || "campeonato") + "-" + suffix;
  const revision = crypto.randomUUID();
  const attachments = [];
  const tree = [];
  const upload = async (path,bytes) => {
    const body = {content:bytesToBase64(bytes),encoding:"base64"};
    const blob = await api("/git/blobs",{method:"POST",body});
    tree.push({path,mode:"100644",type:"blob",sha:blob.sha});
  };
  for (const [index,file] of originals.entries()) {
    progress("Enviando original " + (index+1) + " de " + originals.length + "…");
    const fileName = file.name.replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-110) || "parte.json";
    const path = folder + "/originais/" + revision + "/" + String(index+1).padStart(2,"0") + "-" + fileName;
    await upload(path,new Uint8Array(await file.arrayBuffer()));
    attachments.push({path,name:file.name});
  }
  const path = folder + "/consolidado.json";
  progress("Enviando o consolidado e atualizando o catálogo…");
  await upload(path,encoder.encode(JSON.stringify(portableBase(record))+"\n"));
  const entry = {competition:record.competition,season:record.season,path,originals:attachments};
  const next = {...catalog,competitions:[...catalog.competitions.filter(item=>!sameCompetition(item)),entry]};
  await upload(catalogFile,encoder.encode(JSON.stringify(next,null,2)+"\n"));
  const newTree = await api("/git/trees",{method:"POST",body:{base_tree:head.tree.sha,tree}});
  const commit = await api("/git/commits",{method:"POST",body:{
    message:"Atualiza base de " + record.competition + " (" + record.season + ")",
    tree:newTree.sha,parents:[parent]
  }});
  await api("/git/refs/heads/main",{method:"PATCH",branchUpdate:true,body:{sha:commit.sha,force:false}});
  return {entry,sha:commit.sha};
}

