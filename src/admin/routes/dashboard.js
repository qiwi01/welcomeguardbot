const express = require('express');
const router = express.Router();
const {
  getUserStats,
  getAllUsers,
  getUsersByStatus,
  updateUserStatus,
  getUserByTelegramId,
  getVerificationLogs,
  saveBroadcast,
  getBroadcasts,
} = require('../../db/queries');
const { isAdmin } = require('../../db/queries');

// Middleware: check admin session
const requireAdmin = async (req, res, next) => {
  if (!req.session?.telegramId) {
    return res.redirect('/login');
  }
  const admin = await isAdmin(req.session.telegramId);
  if (!admin) {
    return res.status(403).send('Access denied. Admin only.');
  }
  next();
};

// Login page
router.get('/login', (req, res) => {
  res.render('login', { error: null, adminBaseUrl: process.env.ADMIN_BASE_URL || '' });
});

// Login verification via Telegram ID + secret
router.post('/login', async (req, res) => {
  const { telegram_id, password } = req.body;

  if (!telegram_id || !password) {
    return res.render('login', { error: 'Please fill all fields', adminBaseUrl: process.env.ADMIN_BASE_URL || '' });
  }

  try {
    // Simple auth: check admin status + match session password env
    const user = await getUserByTelegramId(parseInt(telegram_id));
    if (!user) {
      return res.render('login', { error: 'User not found', adminBaseUrl: process.env.ADMIN_BASE_URL || '' });
    }

    const admin = await isAdmin(parseInt(telegram_id));
    if (!admin) {
      return res.render('login', { error: 'Not an admin user', adminBaseUrl: process.env.ADMIN_BASE_URL || '' });
    }

    // Check ADMIN_PASSWORD env var (simple shared secret for dashboard)
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.render('login', { error: 'Invalid password', adminBaseUrl: process.env.ADMIN_BASE_URL || '' });
    }

    req.session.telegramId = parseInt(telegram_id);
    req.session.username = user.first_name;
    res.redirect('/admin');
  } catch (err) {
    console.error('❌ Login error:', err);
    res.render('login', { error: `Server error: ${err.message}`, adminBaseUrl: process.env.ADMIN_BASE_URL || '' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Admin dashboard — home
router.get('/', requireAdmin, async (req, res) => {
  const stats = await getUserStats();
  const { users, total, page, totalPages } = await getAllUsers({ page: 1, limit: 10 });
  const recentLogs = await getVerificationLogs({ limit: 10 });
  const recentBroadcasts = await getBroadcasts(5);

  res.render('dashboard', {
    stats,
    recentUsers: users,
    recentLogs,
    recentBroadcasts,
    username: req.session.username,
    currentPage: 'dashboard',
    pageTitle: 'Dashboard',
  });
});

// Users list with pagination & filters
router.get('/users', requireAdmin, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const status = req.query.status || '';
  const search = req.query.search || '';

  const result = await getAllUsers({ page, limit: 20, status, search });

  res.render('users', {
    users: result.users,
    total: result.total,
    page: result.page,
    totalPages: result.totalPages,
    currentStatus: status,
    currentSearch: search,
    username: req.session.username,
    currentPage: 'users',
    pageTitle: 'User Management',
  });
});

// User detail
router.get('/users/:telegramId', requireAdmin, async (req, res) => {
  const user = await getUserByTelegramId(parseInt(req.params.telegramId));
  if (!user) return res.status(404).send('User not found');

  const logs = await getVerificationLogs({ limit: 50 });

  res.render('user_detail', {
    user,
    logs: logs.filter(l => l.user_id === user.id),
    username: req.session.username,
    currentPage: 'users',
    pageTitle: `User: ${user.first_name}`,
  });
});

// Approve / Reject / Ban user
router.post('/users/:telegramId/action', requireAdmin, async (req, res) => {
  const { telegramId } = req.params;
  const { action, notes } = req.body;

  const validActions = ['verified', 'rejected', 'banned', 'pending'];
  if (!validActions.includes(action)) {
    return res.status(400).send('Invalid action');
  }

  await updateUserStatus(
    parseInt(telegramId),
    action,
    req.session.telegramId,
    notes || `Action performed via admin dashboard: ${action}`
  );

  res.redirect(`/admin/users/${telegramId}`);
});

// Broadcast page
router.get('/broadcast', requireAdmin, async (req, res) => {
  const broadcasts = await getBroadcasts(20);
  res.render('broadcast', { broadcasts, username: req.session.username, sent: null, failed: null, currentPage: 'broadcast', pageTitle: 'Broadcast Messages' });
});

// Send broadcast
router.post('/broadcast/send', requireAdmin, async (req, res) => {
  const { message, filterStatus } = req.body;
  if (!message) {
    return res.redirect('/admin/broadcast?error=Message is required');
  }

  const users = filterStatus
    ? await getUsersByStatus(filterStatus)
    : (await getAllUsers({ limit: 10000 })).users;

  const { Telegraf } = require('telegraf');
  const bot = new Telegraf(process.env.BOT_TOKEN);

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await bot.telegram.sendMessage(user.telegram_id, message);
      sent++;
    } catch {
      failed++;
    }
    // Rate limiting delay
    await new Promise(r => setTimeout(r, 50));
  }

  await saveBroadcast(req.session.telegramId, message, sent, failed);

  const broadcasts = await getBroadcasts(20);
  res.render('broadcast', { broadcasts, username: req.session.username, sent, failed, currentPage: 'broadcast', pageTitle: 'Broadcast Messages' });
});

// Logs
router.get('/logs', requireAdmin, async (req, res) => {
  const logs = await getVerificationLogs({ limit: 100 });
  res.render('logs', { logs, username: req.session.username, currentPage: 'logs', pageTitle: 'Activity Logs' });
});

module.exports = router;