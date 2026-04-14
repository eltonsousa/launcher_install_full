const { ipcRenderer, shell } = require("electron");

const playBtn = document.getElementById("play");
const progress = document.getElementById("progress");
const statusText = document.getElementById("status");
const downloadInfo = document.getElementById("download-info");
const percentText = document.getElementById("progress-percent"); // Novo ID do layout

let totalSize = 0;

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

  if (percentText) {
    percentText.innerText = `${percent}%`;
  }

  if (downloadInfo) {
    downloadInfo.innerText = `⚔ ${mbDownloaded} MB / ${mbTotal} MB`;
  }
});

ipcRenderer.on("total-size", (e, size) => {
  totalSize = size;
});

ipcRenderer.on("status", (e, text) => {
  if (statusText) statusText.innerText = text;

  // Lista de ícones ou palavras que indicam erro/offline
  const isOffline =
    text.includes("✖") ||
    text.toLowerCase().includes("offline") ||
    text.toLowerCase().includes("indisponível");

  if (isOffline) {
    playBtn.disabled = true; // Esta linha é crucial para a trava
    playBtn.style.filter = "grayscale(1)";
    playBtn.innerText = "OFFLINE";
    playBtn.style.cursor = "not-allowed"; // Muda o cursor para "bloqueado"
  }
});

ipcRenderer.on("ready", () => {
  playBtn.disabled = false;
  if (percentText) percentText.innerText = "100%";
  if (downloadInfo) downloadInfo.innerText = "";
});

// ▶ Iniciar jogo (Com trava de segurança)
playBtn.onclick = () => {
  // Verifica se o botão está desativado ou se o texto é OFFLINE
  if (playBtn.disabled || playBtn.innerText === "OFFLINE") {
    console.log("Acesso negado: Servidor Offline ou Atualização pendente.");
    return;
  }

  ipcRenderer.send("play");
};

// ❌ Botão Fechar (Atualizado para o ID do novo layout)
// const closeBtn = document.getElementById("close-btn");
// closeBtn.onclick = () => {
//   ipcRenderer.send("close-app");
// };

document.addEventListener("DOMContentLoaded", () => {
  const closeBtn = document.getElementById("close-btn");

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      console.log("BOTÃO CLICADO 🔥");
      ipcRenderer.send("close-app");
    });
  }
});

// 🌐 Links externos (ajustado para funcionar com links dentro da Nav)
let registerUrl = "#"; // Valor inicial de segurança

ipcRenderer.on("config-data", (e, data) => {
  console.log("CONFIG RECEBIDA ⚙️", data);

  registerUrl = data.registerUrl;

  const titleElem = document.getElementById("game-title");
  if (titleElem) {
    titleElem.innerText = data.gameName.toUpperCase();
  }

  if (data.serverIp) {
    loadNews(data.serverIp);
  }
});

async function loadNews(serverIp) {
  const newsContainer = document.getElementById("news-container");
  const newsUrl = `http://${serverIp}/patch/news.json`;

  try {
    const response = await fetch(newsUrl);
    const news = await response.json();

    newsContainer.innerHTML = ""; // Limpa o "Carregando..."

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

// 3. Atualiza o evento de clique para usar a variável dinâmica
const registerLink = document.getElementById("register-link");
if (registerLink) {
  registerLink.onclick = (e) => {
    e.preventDefault();

    console.log("CLICOU REGISTER 🌐");
    console.log("URL:", registerUrl);

    if (registerUrl && registerUrl !== "#") {
      shell.openExternal(registerUrl);
    } else {
      console.warn("URL de registo ainda não carregada ou inválida.");
    }
  };
}
