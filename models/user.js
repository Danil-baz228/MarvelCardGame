const db = require('../db');

async function registerUser({ login, password, full_name, email }) {
  try {
    await db.query(
      'INSERT INTO users (login, password, full_name, email, status) VALUES (?, ?, ?, ?, ?)',
      [login, password, full_name, email, 'user']
    );
    return { success: true, message: 'Registration successful' };
  } catch (err) {
    console.error("DB Error:", err.message);
    if (err.code === 'ER_DUP_ENTRY') {
      return { success: false, message: 'Login or email already exists' };
    }
    return { success: false, message: 'Registration failed' };
  }
}

async function loginUser({ login, password }) {
  const [rows] = await db.query(
    'SELECT * FROM users WHERE login = ? AND password = ?',
    [login, password]
  );
  return rows[0];
}

async function findUserByEmail(email) {
  const [rows] = await db.query(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );
  return rows[0];
}

module.exports = {
  registerUser,
  loginUser,
  findUserByEmail
};
