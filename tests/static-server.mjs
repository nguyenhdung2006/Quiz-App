import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(".");
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

createServer((request, response) => {
  let pathname = decodeURIComponent(new URL(request.url || "/", `http://127.0.0.1:${port}`).pathname);
  if (pathname === "/") {
    response.writeHead(307, { Location: "/frontend/login.html" });
    response.end();
    return;
  }

  const filePath = normalize(join(root, pathname));
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const stats = statSync(filePath);
    if (!stats.isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream"
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Static server running at http://127.0.0.1:${port}/ (public login entry)`);
});
