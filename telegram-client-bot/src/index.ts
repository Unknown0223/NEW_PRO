import { config as loadEnv } from "dotenv";
import { createServer } from "node:http";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Bot } from "grammy";
import { loadConfig } from "./config.js";
import { ensureBotSchema, loadSession, saveSession } from "./db.js";
import { createBotHandlers } from "./handlers.js";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../backend/.env") });
loadEnv({ path: resolve(here, "../.env"), override: true });

const cfg = loadConfig();
await ensureBotSchema(cfg.databaseUrl);

const bot = new Bot(cfg.token);
const handlers = createBotHandlers({
  databaseUrl: cfg.databaseUrl,
  tenantSlug: cfg.tenantSlug,
  apiUrl: cfg.apiUrl,
  apiSecret: cfg.apiSecret
});

bot.catch((err) => {
  console.error("[client-intake-bot]", err);
});

bot.command("start", async (ctx) => {
  if (!ctx.from) return;
  const sess = await loadSession(cfg.databaseUrl, ctx.from.id);
  await handlers.onStart(ctx, sess);
  await saveSession(cfg.databaseUrl, ctx.from.id, sess);
});

bot.on("callback_query:data", async (ctx) => {
  if (!ctx.from) return;
  const sess = await loadSession(cfg.databaseUrl, ctx.from.id);
  await handlers.onCallback(ctx, sess, ctx.callbackQuery.data);
  await saveSession(cfg.databaseUrl, ctx.from.id, sess);
});

bot.on("message:location", async (ctx) => {
  if (!ctx.from || !ctx.message.location) return;
  const sess = await loadSession(cfg.databaseUrl, ctx.from.id);
  await handlers.onLocation(ctx, sess, ctx.message.location.latitude, ctx.message.location.longitude);
  await saveSession(cfg.databaseUrl, ctx.from.id, sess);
});

bot.on("message:text", async (ctx) => {
  if (!ctx.from) return;
  const text = ctx.message.text ?? "";
  if (text.startsWith("/start")) return;
  const sess = await loadSession(cfg.databaseUrl, ctx.from.id);
  await handlers.onText(ctx, sess, text);
  await saveSession(cfg.databaseUrl, ctx.from.id, sess);
});

function listenHealth(): void {
  const port = Number(process.env.PORT ?? "8080");
  if (!Number.isFinite(port) || port <= 0) return;
  createServer((req, res) => {
    const path = req.url?.split("?")[0] ?? "/";
    const ok = path === "/" || path === "/health";
    res.writeHead(ok ? 200 : 404, { "content-type": "text/plain; charset=utf-8" });
    res.end(ok ? "ok" : "not found");
  }).listen(port, "0.0.0.0", () => {
    console.log(`[client-intake-bot] health :${port}`);
  });
}

listenHealth();

process.once("SIGINT", () => void bot.stop());
process.once("SIGTERM", () => void bot.stop());

await bot.start({
  onStart: (info) => {
    console.log(`Client intake bot @${info.username} ishga tushdi (tenant=${cfg.tenantSlug})`);
  }
});
