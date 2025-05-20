const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'sword_secret',
  resave: false,
  saveUninitialized: true
}));

// Защита маршрутов (не пускаем незалогиненных)
function ensureAuth(req, res, next) {
  const publicPaths = ['/', '/auth/login', '/auth/register', '/reminder'];
  if (!req.session.user && !publicPaths.includes(req.path)) {
    return res.redirect('/auth/login');
  }
  next();
}

app.use(ensureAuth);

// Универсальный роутинг
app.all('*', (req, res) => {
  const [_, controllerName = 'main'] = req.path.split('/');
  try {
    const controller = require(`./controllers/${controllerName}Controller`);
    controller.handle(req, res);
  } catch (err) {
    res.status(404).sendFile(path.join(__dirname, 'views/404.html'));
  }
});

// 💡 Вот эта строка запускает сервер:
app.listen(PORT, () => {
  console.log(`App running on http://localhost:${PORT}`);
});
