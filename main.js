const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { exec } = require("child_process");
const { spawn } = require("child_process");
const update = require("./updater");
const gameConfig = require("./config"); // Importa o novo config

const clientPath = app.isPackaged
  ? path.dirname(app.getPath("exe"))
  : process.cwd();

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 550,
    transparent: true,
    title: gameConfig.gameName, // Título dinâmico
    resizable: false,
    maximizable: false,
    frame: false,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile("index.html");
  // win.webContents.openDevTools({ mode: "detach" });
  win.webContents.on("did-finish-load", () => {
    // Envia os dados do config.js para o renderer
    win.webContents.send("config-data", {
      registerUrl: gameConfig.registerUrl,
      serverIp: gameConfig.serverIp,
      gameName: gameConfig.gameName,
    });
  });
}

app.whenReady().then(createWindow);

ipcMain.on("start-update", async () => {
  try {
    await update(win); // Espera o 'return true' do updater.js
    win.webContents.send("ready"); // Envia o sinal para o renderer.js
  } catch (error) {
    console.error(error);
    win.webContents.send("status", "! Erro na atualização.");
    win.webContents.send("ready"); // Libera o botão mesmo com erro para o user tentar jogar
  }
});

ipcMain.on("play", () => {
  const realPath = process.env.PORTABLE_EXECUTABLE_DIR || clientPath;
  const batFile = "Start_Game.bat";

  // Usamos spawn para desvincular totalmente o processo
  const child = spawn("cmd.exe", ["/c", batFile], {
    cwd: realPath,
    detached: true,
    stdio: "ignore",
    windowsHide: false, // Permite que o jogo apareça, mas desvincula o CMD
  });

  child.unref(); // Corta o vínculo de referência

  setTimeout(() => {
    app.quit();
  }, 1000);
});

ipcMain.on("close-app", () => {
  app.quit();
});
