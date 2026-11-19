// Runs once when the Next.js server starts. Starts the Telegram bot if a
// token is set, so `npm run dev` is the only process to run.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.TELEGRAM_BOT_TOKEN) return;
  const { startBot } = await import("./lib/telegram");
  startBot();
}
