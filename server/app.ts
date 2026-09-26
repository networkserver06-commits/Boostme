import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { scheduledSyncHandler } from "./scheduled";
import { registerStorageProxy } from "./_core/storageProxy";

/** Pure API application factory used by both local startup and Vercel. */
export function createApp(): Express {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  app.get("/api/scheduled/sync-catalog", (req, res) => { void scheduledSyncHandler(req, res); });
  app.get("/api/scheduled/sync-orders", (req, res) => { void scheduledSyncHandler(req, res); });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );
  return app;
}
