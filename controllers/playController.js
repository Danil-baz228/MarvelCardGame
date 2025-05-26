const path = require('path');
const fs = require('fs');

// Главное меню выбора режима
exports.handle = (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    return res.sendFile(path.resolve('views', 'play.html'));
};

// Одиночная игра (то что у тебя уже есть)
exports.single = require('./playSingleController');

// Онлайн меню
exports.onlineMenu = (req, res) => {
    return res.sendFile(path.resolve('views', 'online-menu.html'));
};
