const db = require('../db');
const bcrypt = require('bcrypt');


async function registerUser({ username, password, email }) {
  try {
    const hashedPassword = await bcrypt.hash(password, 10); // безопасное хеширование
    await db.query(
        'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
        [username, hashedPassword, email]
    );
    return { success: true, message: 'Registration successful' };
  } catch (err) {
    console.error("DB Error:", err.message);
    if (err.code === 'ER_DUP_ENTRY') {
      return { success: false, message: 'Username or email already exists' };
    }
    return { success: false, message: 'Registration failed' };
  }
}


async function loginUser({ username, password }) {
  const [rows] = await db.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
  );
  const user = rows[0];
  if (!user) return null;

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  return passwordMatch ? user : null;
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
