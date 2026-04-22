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

// ================= HASH =================
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

// ================= DOWNLOAD ROBUSTO =================
async function downloadFile(
  fileUrl,
  dest,
  win,
  totalDownloadedRef,
  attempt = 1,
) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(fileUrl);
    const requestModule = parsedUrl.protocol === "https:" ? https : http;

    fs.mkdirSync(path.dirname(dest), { recursive: true });

    const request = requestModule.get(
      fileUrl,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Connection: "keep-alive",
        },
        timeout: 300000, // 5 minutos
      },
      (response) => {
        // 🔁 REDIRECT (ESSENCIAL)
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          return downloadFile(
            response.headers.location,
            dest,
            win,
            totalDownloadedRef,
            attempt,
          )
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          return reject(new Error(`HTTP ${response.statusCode}`));
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
          writer.close(() => {
            resolve();
          });
        });

        writer.on("error", (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
      },
    );

    request.on("timeout", () => {
      request.destroy();
      reject(new Error("Timeout"));
    });

    request.on("error", (err) => {
      reject(err);
    });
  }).catch(async (err) => {
    // 🔁 RETRY AUTOMÁTICO
    if (attempt < 3) {
      win.webContents.send("status", `🔁 Tentando novamente (${attempt}/3)...`);
      return downloadFile(fileUrl, dest, win, totalDownloadedRef, attempt + 1);
    }
    throw err;
  });
}

// ================= UPDATE =================
async function update(win) {
  win.webContents.send("status", "⚡ Conectando ao servidor...");

  let res;
  try {
    res = await axios.get(`${PATCH_URL}?t=${Date.now()}`, {
      headers: { "Cache-Control": "no-cache" },
      timeout: 15000,
    });
  } catch (err) {
    win.webContents.send("status", "✖ Servidor indisponível");
    return;
  }

  const allFiles = res.data.files || [];

  let totalSize = 0;
  let totalDownloadedRef = { value: 0 };

  win.webContents.send("status", "🔍 Verificando arquivos...");

  for (let file of allFiles) {
    try {
      const head = await axios.head(file.url);
      file.actualSize = parseInt(head.headers["content-length"] || 0);
      totalSize += file.actualSize;
    } catch {
      file.actualSize = 0;
    }
  }

  win.webContents.send("total-size", totalSize);

  for (let file of allFiles) {
    const dest = path.join(clientPath, file.path);
    const serverHash = file.hash.toLowerCase();
    let localHash = await getFileHash(dest);

    let precisaBaixar = localHash !== serverHash;

    if (precisaBaixar) {
      win.webContents.send("status", `⬇ Baixando: ${path.basename(file.path)}`);

      try {
        await downloadFile(encodeURI(file.url), dest, win, totalDownloadedRef);

        // 🔍 VALIDAÇÃO BÁSICA
        const stats = fs.statSync(dest);
        if (stats.size < 1000) {
          throw new Error("Arquivo incompleto");
        }

        // 📦 EXTRAÇÃO
        if (file.path.endsWith(".zip")) {
          win.webContents.send("status", "📦 Extraindo...");

          const directory = await unzipper.Open.file(dest);

          let count = 0;

          for (const entry of directory.files) {
            count++;

            win.webContents.send(
              "status",
              `📦 Extraindo (${count}/${directory.files.length})`,
            );

            const fullPath = path.join(clientPath, entry.path);

            if (entry.type === "Directory") {
              fs.mkdirSync(fullPath, { recursive: true });
            } else {
              fs.mkdirSync(path.dirname(fullPath), { recursive: true });

              await new Promise((res, rej) => {
                entry
                  .stream()
                  .pipe(fs.createWriteStream(fullPath))
                  .on("finish", res)
                  .on("error", rej);
              });
            }
          }

          fs.unlinkSync(dest);
          win.webContents.send("status", "✔ Extração concluída");
        }
      } catch (err) {
        console.error("ERRO:", err);

        win.webContents.send("status", "✖ Falha no download/extracao");

        throw err;
      }
    } else {
      totalDownloadedRef.value += file.actualSize;
      win.webContents.send("progress-bytes", {
        downloaded: totalDownloadedRef.value,
      });
    }
  }

  win.webContents.send("status", "✔ Tudo pronto!");
}

module.exports = update;
