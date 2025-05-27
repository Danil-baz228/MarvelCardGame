const path = require('path');
const nodemailer = require('nodemailer');
const config = require('../config.json');
const { findUserByEmail } = require('../models/user');
const db = require('../db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

exports.handle = async (req, res) => {
  if (req.method === 'GET') {
    return res.sendFile(path.resolve('views', 'reminder.html'));
  }

  const { email } = req.body;
  const user = await findUserByEmail(email);

  if (!user) {
    return res.send('No user found with that email.');
  }

  const tempPassword = crypto.randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);

  const hashedPassword = await bcrypt.hash(tempPassword, 10);
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, user.id]);

  const transporter = nodemailer.createTransport(config.smtp);

  try {
    await transporter.sendMail({
      from: config.smtp.auth.user,
      to: email,
      subject: 'S.W.O.R.D. Password Reminder',
      text: `Hello ${user.username},\n\nYour temporary password is: ${tempPassword}\n\nPlease log in and change your password immediately.\n\nSincerely,\nS.W.O.R.D.`
    });

    res.send(`
      <html>
        <head>
          <link rel="stylesheet" href="/style.css">
          <title>Password Sent</title>
        </head>
        <body>
          <div class="message-box">
            <h2>Info sent to your email.</h2>
            <a href="/login" class="button-link">Back to Login</a>
          </div>
        </body>
      </html>
    `);

  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to send email.');
  }
};
