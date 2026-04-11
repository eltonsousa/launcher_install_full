require("dotenv").config();
const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const update = require("./updater");
const { exec } = require("child_process");

// 1. DEFINIÇÃO ÚNICA DO CAMINHO (Identifica onde o .exe está rodando)
const clientPath = app.isPackaged
  ? path.dirname(app.getPath("exe"))
  : process.cwd();

let win;

function createWindow() {
  console.log(">>> CRIANDO JANELA...");

  win = new BrowserWindow({
    width: 900,
    height: 550,
    title: "Talisman Launcher", // Nome fixo ou via process.env
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile("index.html");

  win.webContents.on("did-finish-load", () => {
    // 2. ENVIAR CONFIGURAÇÕES PARA O RENDERER
    // Se não houver .env (em produção), usamos valores padrão
    win.webContents.send("config-data", {
      registerUrl: process.env.REGISTER_URL || "http://66.55.64.1",
      serverIp: process.env.SERVER_IP || "66.55.64.1",
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
