const path = require('path');
const fs = require('fs');


exports.handle = (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    return res.sendFile(path.resolve('views', 'play.html'));
};


exports.single = require('./playSingleController');


exports.onlineMenu = (req, res) => {
    return res.sendFile(path.resolve('views', 'online-menu.html'));
};
