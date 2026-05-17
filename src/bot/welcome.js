const { Markup } = require('telegraf');
const { findOrCreateUser, getUserByTelegramId, isAdmin } = require('../db/queries');

const welcomeHandler = async (ctx) => {
  const { id: telegramId, username, first_name: firstName } = ctx.from;

  // Create/update user in DB
  const user = await findOrCreateUser(telegramId, username, firstName);

  const welcomeMessage =
    `👋 *Welcome to WelcomeGuardBot, ${firstName}!*\n\n` +
    `I help manage user verification for this community.\n\n` +
    `📋 *Commands:*\n` +
    `/start — Show this welcome message\n` +
    `/verify — Start verification process\n` +
    `/status — Check your verification status\n` +
    `/profile — View your profile\n` +
    `/help — Show help\n\n` +
    `Your current status: *${user.status === 'pending' ? '⏳ Pending' : user.status === 'verified' ? '✅ Verified' : user.status === 'rejected' ? '❌ Rejected' : '🚫 Banned'}*`;

  const buttons = [];

  if (user.status === 'pending') {
    buttons.push([Markup.button.callback('📝 Start Verification', 'start_verify')]);
  }

  buttons.push([Markup.button.callback('👤 My Profile', 'show_profile')]);

  // Admin button if user is admin
  if (await isAdmin(telegramId)) {
    buttons.push([Markup.button.url('⚙️ Admin Dashboard', `${process.env.ADMIN_BASE_URL || 'http://localhost:3000'}/admin`)]);
  }

  await ctx.reply(welcomeMessage, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons),
  });
};

module.exports = welcomeHandler;