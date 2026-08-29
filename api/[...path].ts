// Vercel bundles this pure API factory; it intentionally excludes local Vite/bootstrap code.
import { createApp } from "../dist/app.js";

export default createApp();
