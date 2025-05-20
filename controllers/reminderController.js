const path = require('path');
const nodemailer = require('nodemailer');
const config = require('../config.json');
const { findUserByEmail } = require('../models/user');

exports.handle = async (req, res) => {
  if (req.method === 'GET') {
    return res.sendFile(path.resolve('views', 'reminder.html'));
  }

  const { email } = req.body;
  const user = await findUserByEmail(email);

  if (!user) {
    return res.send('No user found with that email.');
  }

  const transporter = nodemailer.createTransport(config.smtp);

  try {
    await transporter.sendMail({
      from: config.smtp.auth.user,
      to: email,
      subject: 'S.W.O.R.D. Password Reminder',
      text: `Hello ${user.username},\n\nSorry, but we can't send the password directly for security reasons.\n\nPlease use the reset function (soon).\n\nSincerely,\nS.W.O.R.D.`
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
