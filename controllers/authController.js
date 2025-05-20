const path = require('path');
const { registerUser, loginUser } = require('../models/user');

exports.handle = async (req, res) => {
  const action = req.path.includes('register')
    ? 'register'
    : req.path.includes('logout')
      ? 'logout'
      : 'login';

  if (req.method === 'GET') {
    if (action === 'register') {
      return res.sendFile(path.join(__dirname, '../views/register.html'));
    } else if (action === 'logout') {
      req.session.destroy(() => res.redirect('/login'));
    } else {
      return res.sendFile(path.join(__dirname, '../views/login.html'));
    }
  }

  if (req.method === 'POST') {
    if (action === 'register') {
      const result = await registerUser(req.body);
      return res.send(`
        <html>
          <head>
            <link rel="stylesheet" href="/style.css">
            <title>Registration Success</title>
          </head>
          <body>
            <div class="message-box">
              <h2>${result.message}</h2>
              <a href="/login" class="button-link">Back to Login</a>
            </div>
          </body>
        </html>
      `);

    }

    if (action === 'login') {
      const user = await loginUser(req.body);
      if (user) {
        req.session.user = { id: user.id, status: user.status };
        return res.redirect('/main');
      } else {
        return res.send('Invalid login or password');
      }
    }
  }
};
