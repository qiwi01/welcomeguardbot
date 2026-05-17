const { pool } = require('./index');

// --- USER QUERIES ---

const findOrCreateUser = async (telegramId, username, firstName) => {
  const existing = await pool.query(
    'SELECT * FROM users WHERE telegram_id = $1',
    [telegramId]
  );

  if (existing.rows.length > 0) {
    // Update last_active and return
    await pool.query(
      'UPDATE users SET last_active_at = NOW(), username = $2, first_name = $3 WHERE telegram_id = $1',
      [telegramId, username, firstName]
    );
    return existing.rows[0];
  }

  // Create new user
  const result = await pool.query(
    `INSERT INTO users (telegram_id, username, first_name, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING *`,
    [telegramId, username, firstName]
  );

  // Log the registration
  await pool.query(
    `INSERT INTO verification_logs (user_id, action, performed_by, notes)
     VALUES ($1, 'requested', $2, 'User registered via /start')`,
    [result.rows[0].id, telegramId]
  );

  return result.rows[0];
};

const getUserByTelegramId = async (telegramId) => {
  const result = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  return result.rows[0] || null;
};

const updateUserStatus = async (telegramId, status, adminTelegramId, notes = '') => {
  const result = await pool.query(
    `UPDATE users SET status = $2, verified_at = CASE WHEN $2 = 'verified' THEN NOW() ELSE verified_at END
     WHERE telegram_id = $1 RETURNING *`,
    [telegramId, status]
  );

  if (result.rows.length > 0) {
    await pool.query(
      `INSERT INTO verification_logs (user_id, action, performed_by, notes)
       VALUES ($1, $2, $3, $4)`,
      [result.rows[0].id, status, adminTelegramId, notes]
    );
  }

  return result.rows[0] || null;
};

const updateUserProfile = async (telegramId, { email, phone, first_name }) => {
  const result = await pool.query(
    `UPDATE users SET
       email = COALESCE($2, email),
       phone = COALESCE($3, phone),
       first_name = COALESCE($4, first_name)
     WHERE telegram_id = $1 RETURNING *`,
    [telegramId, email, phone, first_name]
  );
  return result.rows[0] || null;
};

const getAllUsers = async ({ page = 1, limit = 50, status, search } = {}) => {
  const offset = (page - 1) * limit;
  let where = [];
  let params = [];
  let paramIndex = 1;

  if (status) {
    where.push(`status = $${paramIndex++}`);
    params.push(status);
  }
  if (search) {
    where.push(`(first_name ILIKE $${paramIndex} OR username ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR CAST(telegram_id AS TEXT) LIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const countResult = await pool.query(`SELECT COUNT(*) FROM users ${whereClause}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limit, offset);
  const result = await pool.query(
    `SELECT * FROM users ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    params
  );

  return {
    users: result.rows,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

const getUserStats = async () => {
  const result = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'verified')::int AS verified,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
      COUNT(*) FILTER (WHERE status = 'banned')::int AS banned,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS joined_today
    FROM users
  `);
  return result.rows[0];
};

const getUsersByStatus = async (status, limit = 100) => {
  const result = await pool.query(
    'SELECT * FROM users WHERE status = $1 ORDER BY created_at DESC LIMIT $2',
    [status, limit]
  );
  return result.rows;
};

const isAdmin = async (telegramId) => {
  const result = await pool.query(
    'SELECT role FROM users WHERE telegram_id = $1 AND role IN ($2, $3)',
    [telegramId, 'admin', 'superadmin']
  );
  return result.rows.length > 0;
};

// Make first user a superadmin on startup — useful for initial setup
const ensureFirstUserIsAdmin = async () => {
  const result = await pool.query(
    `UPDATE users SET role = 'superadmin'
     WHERE id = (SELECT id FROM users ORDER BY id LIMIT 1)
     AND role = 'user'`
  );
  if (result.rowCount > 0) {
    console.log('👑 First user promoted to superadmin');
  }
};

// --- LOGS ---

const getVerificationLogs = async ({ limit = 50, offset = 0 } = {}) => {
  const result = await pool.query(
    `SELECT vl.*, u.first_name, u.username
     FROM verification_logs vl
     JOIN users u ON vl.user_id = u.id
     ORDER BY vl.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
};

// --- BROADCASTS ---

const saveBroadcast = async (adminTelegramId, messageText, sentCount, failedCount) => {
  const result = await pool.query(
    `INSERT INTO broadcasts (admin_id, message_text, sent_count, failed_count)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [adminTelegramId, messageText, sentCount, failedCount]
  );
  return result.rows[0];
};

const getBroadcasts = async (limit = 20) => {
  const result = await pool.query(
    'SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT $1',
    [limit]
  );
  return result.rows;
};

module.exports = {
  findOrCreateUser,
  getUserByTelegramId,
  updateUserStatus,
  updateUserProfile,
  getAllUsers,
  getUserStats,
  getUsersByStatus,
  isAdmin,
  ensureFirstUserIsAdmin,
  getVerificationLogs,
  saveBroadcast,
  getBroadcasts,
};