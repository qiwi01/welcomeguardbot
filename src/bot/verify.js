const { Markup } = require('telegraf');
const { getUserByTelegramId, updateUserProfile, updateUserStatus } = require('../db/queries');

// In-memory conversation state (for multi-step forms)
const verificationSessions = new Map();

const startVerify = async (ctx) => {
  const telegramId = ctx.from.id;
  const user = await getUserByTelegramId(telegramId);

  if (!user) {
    return ctx.reply('Please use /start first.');
  }

  if (user.status === 'verified') {
    return ctx.reply('✅ You are already verified!');
  }

  if (user.status === 'banned') {
    return ctx.reply('🚫 You have been banned from this bot.');
  }

  // Start the verification form
  verificationSessions.set(telegramId, { step: 'name' });
  await ctx.reply(
    '📝 *Verification Process*\n\n' +
    'Please provide your *full name* (e.g., John Doe):',
    { parse_mode: 'Markdown' }
  );
};

const handleVerificationInput = async (ctx) => {
  const telegramId = ctx.from.id;
  const session = verificationSessions.get(telegramId);

  if (!session) return false; // Not in verification flow

  const text = ctx.message.text?.trim();

  if (!text) {
    await ctx.reply('Please send text input.');
    return true;
  }

  switch (session.step) {
    case 'name':
      session.name = text;
      session.step = 'email';
      await ctx.reply('Great! Now please provide your *email address*:', { parse_mode: 'Markdown' });
      break;

    case 'email':
      // Basic email validation
      if (!text.includes('@') || !text.includes('.')) {
        await ctx.reply('❌ Invalid email format. Please enter a valid email (e.g., user@example.com):');
        return true;
      }
      session.email = text;
      session.step = 'phone';
      await ctx.reply('Thanks! Finally, please provide your *phone number* (e.g., +1234567890):', { parse_mode: 'Markdown' });
      break;

    case 'phone':
      session.phone = text;
      session.step = 'done';

      // Save to database
      await updateUserProfile(telegramId, {
        first_name: session.name,
        email: session.email,
        phone: session.phone,
      });

      verificationSessions.delete(telegramId);

      await ctx.reply(
        `✅ *Verification Submitted!*\n\n` +
        `Your information has been recorded:\n` +
        `• *Name:* ${session.name}\n` +
        `• *Email:* ${session.email}\n` +
        `• *Phone:* ${session.phone}\n\n` +
        `⏳ Your account is now *pending approval*.\n` +
        `An admin will review and verify you shortly.`,
        { parse_mode: 'Markdown' }
      );
      break;
  }

  return true;
};

const verifyCommand = async (ctx) => {
  await startVerify(ctx);
};

// Handle callback from inline "Start Verification" button
const verifyCallback = async (ctx) => {
  await ctx.answerCbQuery();
  await startVerify(ctx);
};

module.exports = {
  verifyCommand,
  verifyCallback,
  handleVerificationInput,
  verificationSessions,
};