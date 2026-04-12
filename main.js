const { app, BrowserWindow, ipcMain } = require("electron"); // Primeiro o app
const path = require("path");
const { spawn, exec } = require("child_process");
const update = require("./updater");

// 1. CONFIGURAÇÃO DO .ENV (Apenas uma vez e com o caminho dinâmico)
const envPath = app.isPackaged
  ? path.join(process.resourcesPath, ".env")
  : path.join(__dirname, ".env");

require("dotenv").config({ path: envPath });

// 2. DEFINIÇÃO DO CAMINHO DO CLIENTE
const clientPath = app.isPackaged
  ? path.dirname(app.getPath("exe"))
  : process.cwd();

let win;

function createWindow() {
  console.log(">>> JANELA INICIADA | GAME:", process.env.CLIENT_NAME);

  win = new BrowserWindow({
    width: 900,
    height: 550,
    // Plano B direto no título da janela
    title: process.env.CLIENT_NAME || "Talisman Kamatera",
    resizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile("index.html");

  win.webContents.on("did-finish-load", () => {
    // 3. ENVIAR CONFIGURAÇÕES COM PLANO B (Fallback)
    win.webContents.send("config-data", {
      registerUrl: process.env.REGISTER_URL || "http://66.55.64.1",
      serverIp: process.env.SERVER_IP || "66.55.64.1",
      // Se o .env falhar aqui, o Launcher ainda mostra o nome certo
      gameName: process.env.CLIENT_NAME || "Talisman Kamatera",
    });
  });
}

app.whenReady().then(() => {
  createWindow();
});

ipcMain.on("start-update", async () => {
  console.log(">>> INICIANDO VERIFICACAO NA PASTA:", clientPath);
  try {
    await update(win);
    win.webContents.send("ready");
  } catch (error) {
    console.error("ERRO DURANTE O UPDATE:", error.message);
    win.webContents.send("status", "! Erro na atualização. Servidor Offline?");
    win.webContents.send("ready");
  }
});

// ▶ iniciar jogo
ipcMain.on("play", () => {
  // 1. Tenta pegar a pasta real de onde o EXE foi aberto.
  // Se não for portable, usa o caminho padrão.
  const realPath = process.env.PORTABLE_EXECUTABLE_DIR || clientPath;

  const batchFile = path.join(realPath, "Play.bat");

  console.log(">>> PASTA REAL:", realPath);
  console.log(">>> EXECUTANDO:", batchFile);

  // Usamos o exec para disparar o comando do Windows diretamente
  // O 'start' é o segredo para o Windows assumir a execução
  exec(`start "" "Play.bat"`, { cwd: realPath }, (err) => {
    if (err) {
      console.error("Erro ao abrir:", err);
    }
  });

  // Fecha o launcher
  setTimeout(() => {
    app.quit();
  }, 1000);
});
