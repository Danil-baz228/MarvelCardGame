const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');

// Настройка multer
const storage = multer.diskStorage({
    destination: './public/uploads/avatars',
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `user_${req.session.user.id}${ext}`);
    }
});

const upload = multer({ storage });

// Основной экспорт — middleware + хендлер
exports.handle = [
    upload.single('avatar'), // обрабатываем поле <input type="file" name="avatar">
    async (req, res) => {
        if (!req.session.user) return res.redirect('/login');

        const userId = req.session.user.id;

        if (req.method === 'GET') {
            const [[user]] = await db.query(
                'SELECT username, email, avatar_url FROM users WHERE id = ?', [userId]
            );
            const filePath = path.resolve('views', 'profile.html');

            fs.readFile(filePath, 'utf8', (err, html) => {
                if (err) return res.status(500).send('Template error');

                const rendered = html
                    .replace('{{username}}', user.username || '')
                    .replace('{{email}}', user.email || '')
                    .replace(/{{avatar_url}}/g, user.avatar_url || '/uploads/avatars/default.png')

                res.send(rendered);
            });

        } else if (req.method === 'POST') {
            const { username, email, current_avatar_url } = req.body;

            const avatar_url = req.file
                ? '/uploads/avatars/' + req.file.filename
                : current_avatar_url;

            await db.query(
                'UPDATE users SET username = ?, email = ?, avatar_url = ? WHERE id = ?',
                [username, email, avatar_url, userId]
            );

            req.session.user.username = username;
            req.session.user.avatar_url = avatar_url;

            res.redirect('/');
        }
    }
];
