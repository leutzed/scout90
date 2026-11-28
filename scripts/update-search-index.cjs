"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {buildSearchIndex,searchIndexPath} = require("../scout90-search-data.js");

const root = path.resolve(__dirname,"..");
const file = path.join(root,"campeonatos.json");
const catalog = JSON.parse(fs.readFileSync(file,"utf8"));

for (const entry of catalog.competitions) {
  if (!/^(brasileirao-serie-a-2026\.json|dados\/[a-z0-9-]+\/consolidado\.json)$/.test(entry.path)) {
    throw new Error("Caminho de base inválido: " + entry.path);
  }
  const source = JSON.parse(fs.readFileSync(path.join(root,entry.path),"utf8"));
  if (source.competition !== entry.competition || source.season !== entry.season || !Array.isArray(source.results)) {
    throw new Error("Base não corresponde ao catálogo: " + entry.path);
  }
  entry.search = searchIndexPath(entry.path);
  fs.writeFileSync(path.join(root,entry.search),JSON.stringify(buildSearchIndex(source))+"\n");
}
fs.writeFileSync(file,JSON.stringify(catalog,null,2)+"\n");
console.log(catalog.competitions.length + " índices de busca atualizados.");
