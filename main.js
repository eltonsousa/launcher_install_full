const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { exec } = require("child_process");
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
    await update(win);
    win.webContents.send("ready");
  } catch (error) {
    win.webContents.send("status", "! Erro na atualização.");
    win.webContents.send("ready");
  }
});

ipcMain.on("play", () => {
  const realPath = process.env.PORTABLE_EXECUTABLE_DIR || clientPath;
  exec(`start "" "Start_Game.bat"`, { cwd: realPath }, (err) => {
    if (err) console.error("Erro ao abrir:", err);
  });
  setTimeout(() => {
    app.quit();
  }, 1000);
});

ipcMain.on("close-app", () => {
  app.quit();
});
