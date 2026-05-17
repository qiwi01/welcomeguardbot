const { getUserByTelegramId, updateUserProfile } = require('../db/queries');
const { handleVerificationInput } = require('./verify');

const helpCommand = async (ctx) => {
  await ctx.reply(
    `📋 *WelcomeGuardBot Help*\n\n` +
    `*/start* — Welcome message and your status\n` +
    `*/verify* — Start the verification process (submit name, email, phone)\n` +
    `*/status* — Check your current verification status\n` +
    `*/profile* — View your submitted profile information\n` +
    `*/help* — Show this help message`,
    { parse_mode: 'Markdown' }
  );
};

const statusCommand = async (ctx) => {
  const user = await getUserByTelegramId(ctx.from.id);
  if (!user) {
    return ctx.reply('Please use /start first.');
  }

  const statusMap = {
    verified: '✅ *Verified* — You have full access.',
    pending: '⏳ *Pending* — Your verification is being reviewed.',
    rejected: '❌ *Rejected* — Your verification was not approved.',
    banned: '🚫 *Banned* — You have been banned from this bot.',
  };

  await ctx.reply(
    `*Account Status*\n\n` +
    `Status: ${statusMap[user.status] || 'Unknown'}\n` +
    `Joined: ${new Date(user.created_at).toLocaleDateString()}\n` +
    `${user.verified_at ? `Verified: ${new Date(user.verified_at).toLocaleDateString()}` : ''}`,
    { parse_mode: 'Markdown' }
  );
};

const profileCommand = async (ctx) => {
  const user = await getUserByTelegramId(ctx.from.id);
  if (!user) {
    return ctx.reply('Please use /start first.');
  }

  await ctx.reply(
    `👤 *Your Profile*\n\n` +
    `*Name:* ${user.first_name}\n` +
    `${user.username ? `*Username:* @${user.username}\n` : ''}` +
    `*Email:* ${user.email || 'Not provided'}\n` +
    `*Phone:* ${user.phone || 'Not provided'}\n` +
    `*Status:* ${user.status}\n` +
    `*Role:* ${user.role}\n` +
    `*Joined:* ${new Date(user.created_at).toLocaleDateString()}`,
    { parse_mode: 'Markdown' }
  );
};

const showProfileCallback = async (ctx) => {
  await ctx.answerCbQuery();
  await profileCommand(ctx);
};

module.exports = {
  helpCommand,
  statusCommand,
  profileCommand,
  showProfileCallback,
};