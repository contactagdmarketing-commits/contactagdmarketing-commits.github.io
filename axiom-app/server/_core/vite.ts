import express, { type Express, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  // Wrapper pour capturer les erreurs d'URL mal formées dans le middleware Vite
  const viteMiddlewareWrapper = (req: Request, res: Response, next: NextFunction) => {
    try {
      // Valider l'URL avant de la passer à Vite
      const url = req.originalUrl || req.url || "/";
      
      // Vérifier que l'URL peut être décodée (utiliser decodeURI comme Vite le fait)
      try {
        decodeURI(url);
      } catch {
        // Si l'URL est mal formée, servir directement index.html sans passer par Vite
        console.warn(`URL mal formée détectée: ${url}, servage direct de index.html`);
        const clientTemplate = path.resolve(
          __dirname,
          "../..",
          "client",
          "index.html"
        );
        return fs.promises.readFile(clientTemplate, "utf-8")
          .then(template => {
            res.status(200).set({ "Content-Type": "text/html" }).end(template);
          })
          .catch(() => next());
      }
      
      // Si l'URL est valide, passer au middleware Vite
      vite.middlewares(req, res, (err: any) => {
        // Capturer les erreurs "URI malformed" de Vite
        if (err && (err.message?.includes("URI malformed") || err.message?.includes("decodeURI"))) {
          console.warn(`Erreur URI malformed interceptée: ${url}, servage direct de index.html`);
          const clientTemplate = path.resolve(
            __dirname,
            "../..",
            "client",
            "index.html"
          );
          return fs.promises.readFile(clientTemplate, "utf-8")
            .then(template => {
              res.status(200).set({ "Content-Type": "text/html" }).end(template);
            })
            .catch(() => next());
        }
        next(err);
      });
    } catch (error) {
      console.error("Erreur dans le wrapper du middleware Vite:", error);
      next(error);
    }
  };

  app.use(viteMiddlewareWrapper);
  app.use("*", async (req, res, next) => {
    let url = req.originalUrl || req.url || "/";

    try {
      // Nettoyer et valider l'URL avant de l'utiliser
      try {
        // Essayer de décoder l'URL pour vérifier qu'elle est valide
        decodeURIComponent(url);
      } catch {
        // Si l'URL est mal formée, utiliser "/" par défaut
        console.warn(`URL mal formée: ${url}, utilisation de "/" par défaut`);
        url = "/";
      }

      const clientTemplate = path.resolve(
        __dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(__dirname, "../..", "dist", "public")
      : path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
