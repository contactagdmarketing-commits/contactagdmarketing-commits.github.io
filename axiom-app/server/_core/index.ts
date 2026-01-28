import "dotenv/config"; // Charge le fichier .env au démarrage
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createServer } from "http";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { setupVite, serveStatic } from "./vite";

const PORT = process.env.PORT || 3000;
const isDevelopment = process.env.NODE_ENV === "development";

async function main() {
  const app = express();
  const server = createServer(app);

  // Middleware pour parser le JSON
  app.use(express.json());

  // Configuration tRPC
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Configuration Vite (développement) ou fichiers statiques (production)
  if (isDevelopment) {
    await setupVite(app, server);
    console.log(`🚀 Serveur de développement démarré sur http://localhost:${PORT}`);
  } else {
    serveStatic(app);
    console.log(`🚀 Serveur de production démarré sur http://localhost:${PORT}`);
  }

  // Démarrer le serveur - écouter sur toutes les interfaces
  server.listen(PORT, () => {
    console.log(`✅ Serveur AXIOM prêt sur http://localhost:${PORT}`);
    console.log(`✅ Route /axiom disponible sur http://localhost:${PORT}/axiom`);
  });
}

main().catch((error) => {
  console.error("❌ Erreur lors du démarrage du serveur:", error);
  process.exit(1);
});
