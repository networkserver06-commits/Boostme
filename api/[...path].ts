// Vercel bundles this pure API factory; it intentionally excludes local Vite/bootstrap code.
import { createApp } from "../server/app.ts";

export default createApp();
