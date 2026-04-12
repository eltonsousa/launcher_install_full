const { ipcRenderer, shell } = require("electron");

const playBtn = document.getElementById("play");
const progress = document.getElementById("progress");
const statusText = document.getElementById("status");
const downloadInfo = document.getElementById("download-info");
const percentText = document.getElementById("progress-percent");

let totalSize = 0;
let registerUrl = "#";
let serverIp = ""; // Declarando a variável globalmente

console.log("RENDERER INICIOU ✅");

playBtn.disabled = true;
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

ipcRenderer.on("status", (e, text) => {
  if (statusText) statusText.innerText = text;

  const isOffline =
    text.includes("✖") ||
    text.toLowerCase().includes("offline") ||
    text.toLowerCase().includes("indisponível");

  if (isOffline) {
    playBtn.disabled = true;
    playBtn.style.filter = "grayscale(1)";
    playBtn.innerText = "OFFLINE";
    playBtn.style.cursor = "not-allowed";
  }
});

ipcRenderer.on("ready", () => {
  playBtn.disabled = false;
  playBtn.style.filter = "none";
  playBtn.innerText = "JOGAR";
  playBtn.style.cursor = "pointer";
  if (percentText) percentText.innerText = "100%";
  if (downloadInfo) downloadInfo.innerText = "";
});

// 2. Escuta a configuração e CHAMA a função de notícias
ipcRenderer.on("config-data", (e, data) => {
  registerUrl = data.registerUrl;
  serverIp = data.serverIp;

  // Atualiza o título do jogo
  ipcRenderer.on("config-data", (e, data) => {
    // ... outras variaveis
    const titleElem = document.getElementById("game-title");
    if (titleElem && data.gameName) {
      titleElem.innerText = data.gameName.toUpperCase();
    }
  });

  // >>> AQUI ESTÁ A CHAMADA QUE FALTA <<<
  loadNews(serverIp);

  console.log("Configurações recebidas:", data);
});

// 📰 Função para carregar as notícias
async function loadNews(ip) {
  const newsContainer = document.getElementById("news-container");
  if (!newsContainer) return;

  const newsUrl = `http://${ip}/patch/news.json?t=${Date.now()}`; // ?t= evita cache

  try {
    const response = await fetch(newsUrl);
    if (!response.ok) throw new Error("Erro na rede");

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
    console.error("Erro ao carregar notícias:", error);
    newsContainer.innerHTML = "<p>Não foi possível carregar as notícias.</p>";
  }
}

// ▶ Iniciar jogo
playBtn.onclick = () => {
  if (playBtn.disabled || playBtn.innerText === "OFFLINE") return;
  ipcRenderer.send("play");
};

// ❌ Botão Fechar
const closeBtn = document.getElementById("close-btn");
if (closeBtn) {
  closeBtn.onclick = () => window.close();
}

// 🌐 Link de Registro
const registerLink = document.getElementById("register-link");
if (registerLink) {
  registerLink.onclick = (e) => {
    e.preventDefault();
    if (registerUrl && registerUrl !== "#") {
      shell.openExternal(registerUrl);
    }
  };
}

// ✨ Lógica das Faíscas
function initSparks() {
  const sparks = document.querySelectorAll(".spark");
  sparks.forEach((spark) => {
    const duration = (Math.random() * 6 + 4).toFixed(1) + "s";
    const delay = (Math.random() * 5).toFixed(1) + "s";
    const left = (Math.random() * 90 + 5).toFixed(1) + "%";
    const drift = (Math.random() * 300 - 150).toFixed(0) + "px";
    const scale = (Math.random() * 1 + 0.5).toFixed(1);

    spark.style.animationDuration = duration;
    spark.style.animationDelay = delay;
    spark.style.left = left;
    spark.style.setProperty("--drift", drift);
    spark.style.setProperty("--scale", scale);
  });
}

initSparks();
