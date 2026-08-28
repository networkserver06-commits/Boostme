process.env.VERCEL = "1";
const bundle = await import("../dist/app.js");
if (typeof bundle.createApp !== "function") throw new Error("createApp export missing from dist/app.js");
const entry = await import("../api/[...path].ts");
if (!entry.default || typeof entry.default.use !== "function") throw new Error("Vercel app export missing");
console.log("bundle-and-api-load-ok");
