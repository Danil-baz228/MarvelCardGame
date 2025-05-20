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
      const { username, password, email } = req.body;
      const result = await registerUser({ username, password, email });
      return res.send(`
        <html>
          <head>
            <link rel="stylesheet" href="/style.css">
            <title>Registration</title>
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
      const { username, password } = req.body;
      const user = await loginUser({ username, password });

      if (user) {
        req.session.user = {
          id: user.id,
          username: user.username,
          avatar_url: user.avatar_url
        };
        return res.redirect('/main');
      } else {
        return res.send(`
          <html>
            <head>
              <link rel="stylesheet" href="/style.css">
              <title>Login Failed</title>
            </head>
            <body>
              <div class="message-box">
                <h2>Invalid username or password</h2>
                <a href="/login" class="button-link">Try Again</a>
              </div>
            </body>
          </html>
        `);
      }
    }
  }
};
