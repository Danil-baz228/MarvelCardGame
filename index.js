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


const mainController = require('./controllers/mainController');
app.get('/', mainController.handle);


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


app.listen(PORT, () => {
  console.log(`App running on http://localhost:${PORT}`);
});
