const path = require('path');
const db = require('../db');

exports.handle = async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const userId = req.session.user.id;

    if (req.method === 'GET') {
        const [[user]] = await db.query('SELECT username, email, avatar_url FROM users WHERE id = ?', [userId]);
        const filePath = path.resolve('views', 'profile.html');
        const fs = require('fs');

        fs.readFile(filePath, 'utf8', (err, html) => {
            if (err) return res.status(500).send('Template error');
            const rendered = html
                .replace('{{username}}', user.username || '')
                .replace('{{email}}', user.email || '')
                .replace('{{avatar_url}}', user.avatar_url || '');
            res.send(rendered);
        });

    } else if (req.method === 'POST') {
        const { username, email, avatar_url } = req.body;

        await db.query(
            'UPDATE users SET username = ?, email = ?, avatar_url = ? WHERE id = ?',
            [username, email, avatar_url, userId]
        );

        req.session.user.username = username;
        res.redirect('/');
    }
};
