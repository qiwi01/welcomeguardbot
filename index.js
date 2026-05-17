require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const { Telegraf } = require('telegraf');
const { initDB, pool } = require('./src/db');
const { ensureFirstUserIsAdmin } = require('./src/db/queries');

// --- Initialize DB ---
initDB().then(() => {
  ensureFirstUserIsAdmin();
});

// --- Telegram Bot Setup ---
const bot = new Telegraf(process.env.BOT_TOKEN);

// Import handlers
const welcomeHandler = require('./src/bot/welcome');
const { verifyCommand, verifyCallback } = require('./src/bot/verify');
const { helpCommand, statusCommand, profileCommand, showProfileCallback } = require('./src/bot/handlers');
const { handleVerificationInput } = require('./src/bot/verify');

// Bot commands
bot.start(welcomeHandler);
bot.command('verify', verifyCommand);
bot.command('status', statusCommand);
bot.command('profile', profileCommand);
bot.command('help', helpCommand);

// Callback actions
bot.action('start_verify', verifyCallback);
bot.action('show_profile', showProfileCallback);

// Handle verification form text input
bot.on('text', async (ctx, next) => {
  const handled = await handleVerificationInput(ctx);
  if (!handled) return next();
});

// --- Express Admin Dashboard ---
const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'welcomeguardbot-secret-change-me';

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 1 day
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/admin/views'));

// Admin routes
const adminRoutes = require('./src/admin/routes/dashboard');
app.use('/admin', adminRoutes);

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/admin/login');
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Launch ---
// Start Express first, then Telegram bot
app.listen(PORT, async () => {
  console.log(`📊 Admin Dashboard running on http://localhost:${PORT}`);

  // Launch Telegram bot (polling mode for local, webhook for Railway)
  const webhookDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (webhookDomain) {
    try {
      await bot.launch({
        webhook: {
          domain: webhookDomain,
          port: PORT,
          secretToken: process.env.WEBHOOK_SECRET,
        },
      });
      console.log(`🤖 Telegram Bot running on webhook: ${webhookDomain}`);
    } catch (err) {
      console.error('❌ Webhook launch failed, falling back to polling:', err.message);
      await bot.launch();
    }
  } else {
    await bot.launch();
    console.log('🤖 Telegram Bot running in polling mode');
  }

  console.log(`🚀 WelcomeGuardBot fully operational!`);
});

// Graceful shutdown
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  pool.end();
  process.exit(0);
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  pool.end();
  process.exit(0);
});