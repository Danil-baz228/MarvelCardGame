const express = require('express');
const session = require('express-session');
const path = require('path');

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


function ensureAuth(req, res, next) {
  const publicPaths = [
    '/',
    '/login',
    '/register',
    '/auth/login',
    '/auth/register',
    '/reminder'
  ];

  if (!req.session.user && !publicPaths.includes(req.path)) {
    return res.redirect('/');
  }

  next();
}

app.use(ensureAuth);

app.get('/login', (req, res) => res.redirect('/auth/login'));
app.get('/register', (req, res) => res.redirect('/auth/register'));

// 🏠 Главная
const mainController = require('./controllers/mainController');
app.get('/', mainController.handle);

// 👤 Профиль
const profileController = require('./controllers/profileController');
app.all('/profile', profileController.handle);

// 🎮 Play Game
const playController = require('./controllers/playController');
app.all('/play', playController.handle)

// 🌐 Универсальный контроллерный роутинг
app.all('*', (req, res) => {
  const [, controllerName = 'main'] = req.path.split('/');
  try {
    const controller = require(`./controllers/${controllerName}Controller`);
    if (typeof controller.handle === 'function') {
      controller.handle(req, res);
    } else {
      throw new Error('Missing handle()');
    }
  } catch (err) {
    console.error('Routing error:', err.message);
    res.status(404).sendFile(path.resolve('views', '404.html'));
  }
});

// ▶ Запуск
app.listen(PORT, () => {
  console.log(`App running on http://localhost:${PORT}`);
});
