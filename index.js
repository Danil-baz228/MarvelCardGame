const express = require('express');
const session = require('express-session');
const path = require('path');
const http = require('http');

const app = express();
const server = http.createServer(app);

const socket = require('./socket'); // ⬅️ окремий файл для Socket.IO
const io = socket.init(server);     // ⬅️ ініціалізація

const PORT = 3001;

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
    '/', '/login', '/register',
    '/auth/login', '/auth/register',
    '/reminder'
  ];
  if (!req.session.user && !publicPaths.includes(req.path)) {
    return res.redirect('/');
  }
  next();
}

app.use(ensureAuth);

// Контроллери
const mainController = require('./controllers/mainController');
const profileController = require('./controllers/profileController');
const playController = require('./controllers/playController');
const onlineController = require('./controllers/onlineController');
const singleController = require('./controllers/playSingleController');
const apiController = require('./controllers/apiController');
app.get('/api/match/:matchId/hand', apiController.getHand);
app.post('/api/match/:matchId/draw', apiController.drawCard);
app.get('/api/card/:cardId', apiController.getCardById);

app.get('/login', (req, res) => res.redirect('/auth/login'));
app.get('/register', (req, res) => res.redirect('/auth/register'));

app.get('/', mainController.handle);
app.all('/profile', profileController.handle);
app.get('/play', playController.handle);
app.all('/play/single', singleController.handle);
app.get('/play/online-menu', playController.onlineMenu);
app.post('/play/online/create', onlineController.createGame);
app.post('/play/online/join', onlineController.joinGame);
app.get('/play/online/:gameId', onlineController.handleGame);
app.get('/play/online/status/:matchId', onlineController.checkStatus);
app.get('/play/online/battle/:matchId', onlineController.handleBattle);
app.get('/api/match/:matchId/turn', onlineController.getCurrentTurn);

const fs = require('fs');

app.all('*', (req, res) => {
  const [, controllerName = 'main'] = req.path.split('/');
  if (!/^[a-zA-Z0-9_-]+$/.test(controllerName)) {
    return res.status(404).sendFile(path.resolve('views', '404.html'));
  }

  const controllerPath = path.resolve(__dirname, 'controllers', `${controllerName}Controller.js`);
  if (!fs.existsSync(controllerPath)) {
    return res.status(404).sendFile(path.resolve('views', '404.html'));
  }

  try {
    const controller = require(controllerPath);
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


server.listen(PORT, () => {
  console.log(`🚀 Гра запущена на http://localhost:${PORT}`);
});
