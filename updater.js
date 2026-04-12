const axios = require("axios");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const unzipper = require("unzipper");
const { app } = require("electron");
const http = require("http");
const https = require("https");
const { URL } = require("url");
const gameConfig = require("./config");

const clientPath =
  process.env.PORTABLE_EXECUTABLE_DIR ||
  (app.isPackaged ? path.dirname(app.getPath("exe")) : process.cwd());

const PATCH_URL = gameConfig.patchUrl;

function getFileHash(filePath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) return resolve(null);
    const hash = crypto.createHash("md5");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", () => resolve(null));
  });
}

async function downloadFile(fileUrl, dest, win, totalDownloadedRef) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(fileUrl);
    const requestModule = parsedUrl.protocol === "https:" ? https : http;

    fs.mkdirSync(path.dirname(dest), { recursive: true });

    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        Connection: "keep-alive",
      },
      timeout: 60000,
    };

    const request = requestModule.get(fileUrl, options, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Falha no download: ${response.statusCode}`));
        return;
      }

      const writer = fs.createWriteStream(dest);
      response.on("data", (chunk) => {
        totalDownloadedRef.value += chunk.length;
        win.webContents.send("progress-bytes", {
          downloaded: totalDownloadedRef.value,
        });
      });

      response.pipe(writer);
      writer.on("finish", () => {
        writer.close();
        resolve();
      });
      writer.on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    });

    request.on("error", (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
    request.on("timeout", () => {
      request.destroy();
      reject(new Error("Timeout"));
    });
  });
}

async function update(win) {
  win.webContents.send("status", "⚡ Conectando ao Reino...");
  let res;
  try {
    res = await axios.get(`${PATCH_URL}?t=${Date.now()}`, {
      headers: { "Cache-Control": "no-cache" },
    });
  } catch (err) {
    win.webContents.send("status", "✖ Servidor em Manutenção");
    return;
  }

  const allFiles = res.data.files || [];
  const coreFiles = allFiles.filter((f) => f.url.includes("/download/"));
  const updateFiles = allFiles.filter((f) =>
    f.url.includes("/files_to_update/"),
  );

  let totalSize = 0;
  let totalDownloadedRef = { value: 0 };

  win.webContents.send("status", "🔍 Analisando arquivos...");
  for (let file of allFiles) {
    try {
      const head = await axios.head(encodeURI(file.url), { timeout: 10000 });
      file.actualSize = parseInt(head.headers["content-length"] || 0);
      totalSize += file.actualSize;
    } catch (e) {
      file.actualSize = 0;
    }
  }
  win.webContents.send("total-size", totalSize);

  // --- ETAPA 1: CLIENT CORE ---
  for (let file of coreFiles) {
    const dest = path.join(clientPath, file.path);
    const serverHash = file.hash.toLowerCase();
    let localHash = await getFileHash(dest);

    // Lógica para evitar baixar o .zip se o client.exe já existir
    let precisaBaixar = localHash !== serverHash;
    if (
      file.path.endsWith(".zip") &&
      !fs.existsSync(dest) &&
      fs.existsSync(path.join(clientPath, "client.exe"))
    ) {
      precisaBaixar = false;
    }

    if (precisaBaixar) {
      win.webContents.send(
        "status",
        `⚔ [Core] Baixando: ${path.basename(file.path)}...`,
      );
      try {
        await downloadFile(encodeURI(file.url), dest, win, totalDownloadedRef);
        if (file.path.endsWith(".zip")) {
          win.webContents.send(
            "status",
            `📦 Extraindo: ${path.basename(file.path)}`,
          );
          await new Promise((resolve, reject) => {
            fs.createReadStream(dest)
              .pipe(unzipper.Extract({ path: clientPath }))
              .on("close", () => {
                fs.unlinkSync(dest);
                resolve();
              })
              .on("error", (err) => reject(err));
          });
        }
      } catch (err) {
        console.error("Erro core:", err);
      }
    } else {
      totalDownloadedRef.value += file.actualSize;
      win.webContents.send("progress-bytes", {
        downloaded: totalDownloadedRef.value,
      });
    }
  } // <--- FECHAMENTO CORRETO DO LOOP CORE

  // --- ETAPA 2: UPDATES ---
  win.webContents.send("status", "🛡 Aplicando patches...");
  for (let file of updateFiles) {
    const dest = path.join(clientPath, file.path);
    const serverHash = file.hash.toLowerCase();
    const localHash = await getFileHash(dest);

    if (localHash !== serverHash) {
      win.webContents.send(
        "status",
        `✨ Atualizando: ${path.basename(file.path)}`,
      );
      try {
        await downloadFile(encodeURI(file.url), dest, win, totalDownloadedRef);
      } catch (err) {
        console.error("Erro update:", err);
      }
    } else {
      totalDownloadedRef.value += file.actualSize;
      win.webContents.send("progress-bytes", {
        downloaded: totalDownloadedRef.value,
      });
    }
  }

  win.webContents.send("status", "✔ Client Pronto para Jogar");
}

module.exports = update;
