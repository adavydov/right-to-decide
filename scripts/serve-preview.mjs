import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve("out");
const base = "/right-to-decide";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};
http
  .createServer((req, res) => {
    try {
      let name = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (name === base) name = "/";
      else if (name.startsWith(base + "/")) name = name.slice(base.length);
      const file = path.resolve(root, "." + name);
      if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const target =
        fs.existsSync(file) && fs.statSync(file).isDirectory()
          ? path.join(file, "index.html")
          : file;
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type":
          mime[path.extname(target)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      fs.createReadStream(target).pipe(res);
    } catch {
      res.writeHead(400);
      res.end("Bad request");
    }
  })
  .listen(3210, "127.0.0.1", () =>
    console.log("Preview: http://127.0.0.1:3210/right-to-decide/"),
  );
