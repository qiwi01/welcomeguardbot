require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

// In-memory storage (replace with DB later)
const users = new Map();

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  users.set(userId, { verified: false, username: ctx.from.username || ctx.from.first_name });

  await ctx.reply(
    `👋 Welcome to Demo Bot, ${ctx.from.first_name}!\n\n` +
    `Please verify yourself to access all features.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Verify Account", callback_data: "verify_user" }]
        ]
      }
    }
  );
});

bot.action('verify_user', async (ctx) => {
  const userId = ctx.from.id;
  users.set(userId, { verified: true });

  await ctx.editMessageText(
    `✅ Verification Successful!\n\n` +
    `Welcome aboard, ${ctx.from.first_name}! 🎉\n` +
    `You are now a verified user.`
  );
});

bot.command('status', async (ctx) => {
  const user = users.get(ctx.from.id);
  if (user?.verified) {
    await ctx.reply("🟢 You are Verified");
  } else {
    await ctx.reply("🔴 Please verify first");
  }
});

// Auto-detect: use webhook if RAILWAY_PUBLIC_DOMAIN is set, otherwise use polling (local dev)
const webhookDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
if (webhookDomain) {
  bot.launch({
    webhook: {
      domain: webhookDomain,
      port: Number(process.env.PORT) || 8080,
      secretToken: process.env.WEBHOOK_SECRET
    }
  });
} else {
  bot.launch(); // Uses long-polling – perfect for local testing
}

console.log(`🚀 WelcomeGuardBot is running... (${webhookDomain ? 'Webhook mode' : 'Polling mode'})`);
