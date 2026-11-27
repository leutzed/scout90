"use strict";
const $ = id => document.getElementById(id);
const h = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[char]));
const normalized = value => String(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const number = new Intl.NumberFormat("pt-BR", {maximumFractionDigits:0});
const decimal = new Intl.NumberFormat("pt-BR", {minimumFractionDigits:2,maximumFractionDigits:2});
const currency = new Intl.NumberFormat("pt-BR", {style:"currency",currency:"BRL"});

const positions = ["Goleiro","Zagueiro","Lateral","Volante","Box-to-Box","Armador","Ponta","Avançado"];
const readLocal = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const baseKey = "scout90.base.v1";
const metaKey = "scout90.notes.v1";
const activeBaseKey = "scout90.active-competition.v1";
const library = new Map();
let db;
let base = {results:[]};
let activeBaseId;
let originalBaseId;
let libraryBusy = false;
let info = readLocal(metaKey, {scouts:{},finance:{},shortlist:{}});
let rows = new Map();
let view = "ranking";
let profile = "overview";
let unit = "rate";
let order = {key:"min",asc:false};
const custom = new Map();
const originalHiddenKey = "scout90.hidden.v1";
let hiddenKey = originalHiddenKey;
let hiddenPlayers = new Set();
const pickedPlayers = new Set();
let pickAnchor = null;
let selection = [];
let activePlayer;
let snapshot = "";
let noticeTimer;
let lastResults = [];
let benchmark = [];
const chartColors = ["#d0f488","#68d9fd","#f8be78","#e7aaff"];
let chartProfile;

function notice(message) {
  $("notice").textContent = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => $("notice").textContent = "", 5200);
}

function persist(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { notice("O navegador não pôde salvar. As mudanças valem nesta sessão."); return false; }
}
