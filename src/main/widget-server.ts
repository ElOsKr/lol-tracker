import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { WidgetSnapshot } from "../shared/widget";

export const WIDGET_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://ddragon.leagueoflegends.com https://raw.communitydragon.org; connect-src 'self'; object-src 'none'; frame-ancestors 'none'";

// Deliberately no general static-file handler: only these three public assets
// and a read-only snapshot can be reached by an OBS browser source.
export async function startWidgetServer(root: string, snapshot: () => WidgetSnapshot, port = 4123) {
  const files: Record<string, [string, string]> = {
    "/widget.html": ["widget.html", "text/html; charset=utf-8"],
    "/widget.css": ["widget.css", "text/css; charset=utf-8"],
    "/build/widget/widget.js": ["build/widget/widget.js", "text/javascript; charset=utf-8"],
  };
  const server: Server = createServer(async (req, res) => {
    res.setHeader("Content-Security-Policy", WIDGET_CSP);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    const address = server.address();
    const host = typeof address === "object" && address ? `127.0.0.1:${address.port}` : "";
    // Reject foreign Host/Origin values, including DNS rebinding attempts.
    if (
      req.headers.host !== host ||
      (req.headers.origin && req.headers.origin !== `http://${host}`)
    ) {
      res.writeHead(403).end();
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end();
      return;
    }
    try {
      const route = new URL(req.url ?? "/", `http://${host}`).pathname;
      if (route === "/api/matches") {
        res.setHeader("Content-Type", "application/json");
        res.end(req.method === "HEAD" ? undefined : JSON.stringify(snapshot()));
        return;
      }
      const file = files[route];
      if (!file) {
        res.writeHead(404).end();
        return;
      }
      const data = await readFile(path.join(root, file[0]));
      res.setHeader("Content-Type", file[1]);
      res.end(req.method === "HEAD" ? undefined : data);
    } catch {
      res.writeHead(500).end("Widget unavailable");
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Invalid OBS address");
  return {
    url: `http://127.0.0.1:${address.port}/widget.html`,
    close: () => {
      server.close();
      server.closeAllConnections();
    },
  };
}
