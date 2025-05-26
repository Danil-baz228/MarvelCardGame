const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcrypt');
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

exports.handle = [
    upload.single('avatar'),
    async (req, res) => {
        if (!req.session.user) {
            return res.status(401).json({ error: 'unauthorized' });
        }

        const userId = req.session.user.id;

        if (req.method === 'GET') {
            try {
                const [[user]] = await db.query(
                    'SELECT username, email, avatar_url FROM users WHERE id = ?', [userId]
                );

                const filePath = path.resolve('views', 'profile.html');

                fs.readFile(filePath, 'utf8', (err, html) => {
                    if (err) return res.status(500).send('Template error');

                    const rendered = html
                        .replace('{{username}}', user.username || '')
                        .replace('{{email}}', user.email || '')
                        .replace(/{{avatar_url}}/g, user.avatar_url || '/uploads/avatars/default.png');

                    res.send(rendered);
                });

            } catch (err) {
                console.error('❌ Failed to load profile page:', err);
                res.status(500).send('Server error');
            }

        } else if (req.method === 'POST') {
            const {
                username,
                email,
                current_avatar_url,
                password_current,
                password_new
            } = req.body;

            const avatar_url = req.file
                ? '/uploads/avatars/' + req.file.filename
                : current_avatar_url;

            try {
                // Смена пароля, если поля присутствуют
                if (password_current && password_new) {
                    const [[user]] = await db.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
                    const isMatch = await bcrypt.compare(password_current, user.password_hash);
                    if (!isMatch) {
                        return res.json({ success: false, error: 'wrong_password' });
                    }
                    const hashed = await bcrypt.hash(password_new, 10);
                    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashed, userId]);
                }

                // Проверка на дубликат username только если он изменился
                const [[currentUser]] = await db.query('SELECT username FROM users WHERE id = ?', [userId]);
                if (username !== currentUser.username) {
                    const [existing] = await db.query(
                        'SELECT id FROM users WHERE username = ? AND id != ?',
                        [username, userId]
                    );

                    if (existing.length > 0) {
                        return res.json({ error: 'duplicate_username' });
                    }
                }

                await db.query(
                    'UPDATE users SET username = ?, email = ?, avatar_url = ? WHERE id = ?',
                    [username, email, avatar_url, userId]
                );

                req.session.user.username = username;
                req.session.user.avatar_url = avatar_url;

                return res.json({ success: true });

            } catch (err) {
                console.error('❌ Profile update error:', err);
                return res.status(500).json({ error: 'server' });
            }
        }
    }
];