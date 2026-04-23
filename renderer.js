const { ipcRenderer, shell } = require("electron");

const playBtn = document.getElementById("play");
const progress = document.getElementById("progress");
const statusText = document.getElementById("status");
const downloadInfo = document.getElementById("download-info");
const percentText = document.getElementById("progress-percent");

let totalSize = 0;

console.log("RENDERER INICIOU ✅");

// Inicia bloqueado aguardando a atualização
playBtn.disabled = true;
playBtn.style.filter = "grayscale(1)";
ipcRenderer.send("start-update");

// 📊 Controle de Progresso e Percentual
ipcRenderer.on("progress-bytes", (e, data) => {
  const downloaded = data.downloaded;
  const mbDownloaded = (downloaded / 1024 / 1024).toFixed(2);
  const mbTotal = (totalSize / 1024 / 1024).toFixed(2);
  const percent = totalSize ? Math.floor((downloaded / totalSize) * 100) : 0;

  progress.value = percent;
  if (percentText) percentText.innerText = `${percent}%`;
  if (downloadInfo)
    downloadInfo.innerText = `⚔ ${mbDownloaded} MB / ${mbTotal} MB`;
});

ipcRenderer.on("total-size", (e, size) => {
  totalSize = size;
});

// 1. AJUSTE NO FILTRO DE ERROS (STATUS)
ipcRenderer.on("status", (e, text) => {
  if (statusText) statusText.innerText = text;

  // Só bloqueamos se o erro for de conexão ou servidor offline de fato
  const isCriticalError =
    text.toLowerCase().includes("offline") ||
    text.toLowerCase().includes("indisponível") ||
    text.includes("Falha na conexão");

  if (isCriticalError) {
    playBtn.disabled = true;
    playBtn.style.filter = "grayscale(1)";
    playBtn.innerText = "OFFLINE";
    playBtn.style.cursor = "not-allowed";
  }
});

// 2. SINAL READY (DESBLOQUEIO DEFINITIVO)
ipcRenderer.on("ready", () => {
  console.log("Sinal READY recebido! Liberando o jogo...");

  playBtn.disabled = false;
  playBtn.style.filter = "none";
  playBtn.style.cursor = "pointer";
  playBtn.innerText = "JOGAR"; // Garante que o texto volte ao normal se estava "OFFLINE"

  if (statusText) statusText.innerText = "✔ Jogo pronto para iniciar!";
});

// ▶ Iniciar jogo
playBtn.onclick = () => {
  if (playBtn.disabled) return;
  ipcRenderer.send("play");
};

// ❌ Botão Fechar
document.addEventListener("DOMContentLoaded", () => {
  const closeBtn = document.getElementById("close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      ipcRenderer.send("close-app");
    });
  }
});

// 🌐 Configurações Iniciais e News
let registerUrl = "#";
ipcRenderer.on("config-data", (e, data) => {
  registerUrl = data.registerUrl;
  const titleElem = document.getElementById("game-title");
  if (titleElem) titleElem.innerText = data.gameName.toUpperCase();
  if (data.serverIp) loadNews(data.serverIp);
});

async function loadNews(serverIp) {
  const newsContainer = document.getElementById("news-container");
  const newsUrl = `http://${serverIp}/patch/news.json`;
  try {
    const response = await fetch(newsUrl);
    const news = await response.json();
    newsContainer.innerHTML = "";
    news.forEach((item) => {
      const newsItem = document.createElement("div");
      newsItem.className = "news-item";
      newsItem.innerHTML = `
        <span class="tag tag-${item.tag}">${item.tagName}</span>
        <p>${item.title}</p>
      `;
      newsContainer.appendChild(newsItem);
    });
  } catch (error) {
    newsContainer.innerHTML = "<p>Não foi possível carregar as notícias.</p>";
  }
}

const registerLink = document.getElementById("register-link");
if (registerLink) {
  registerLink.onclick = (e) => {
    e.preventDefault();
    if (registerUrl && registerUrl !== "#") shell.openExternal(registerUrl);
  };
}
