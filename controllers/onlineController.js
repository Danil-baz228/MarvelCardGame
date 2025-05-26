const db = require('../db');
const path = require('path');
const io = require('../socket').getIO(); // ⬅️ правильно підключаємо сокет

exports.createGame = async (req, res) => {
    const userId = req.session.user?.id;
    if (!userId) return res.status(403).send('Немає сесії');

    try {
        const [results] = await db.query(
            'INSERT INTO matches (player1_id, player2_id) VALUES (?, ?)',
            [userId, null]
        );

        const matchId = results.insertId;
        res.json({ matchId });
    } catch (err) {
        console.error('❌ Помилка при створенні матчу:', err);
        res.status(500).send('Помилка БД');
    }
};

exports.joinGame = async (req, res) => {
    const matchId = req.body.gameId;
    const userId = req.session.user?.id;

    try {
        const [rows] = await db.query('SELECT * FROM matches WHERE id = ?', [matchId]);
        if (rows.length === 0) return res.send('Матч не знайдено');

        const match = rows[0];

        if (match.player2_id && match.player2_id !== 0) {
            return res.send('Матч вже заповнений');
        }

        if (match.player1_id == userId) {
            return res.send('Не можна приєднатися до власного матчу');
        }

        await db.query('UPDATE matches SET player2_id = ? WHERE id = ?', [userId, matchId]);

        io.to(`match_${matchId}`).emit('player_joined', { userId });

        res.redirect(`/play/online/${matchId}`);
    } catch (err) {
        console.error('❌ Помилка при приєднанні до матчу:', err);
        res.status(500).send('Помилка сервера');
    }
};

const giveStartingCards = (userId, matchId) => {
    return db.query('SELECT id FROM cards ORDER BY RAND() LIMIT 4')
        .then(([cards]) => {
            if (cards.length === 0) throw new Error('Немає карт у базі');
            const values = cards.map(row => [matchId, userId, row.id, true]);
            return db.query('INSERT INTO match_cards (match_id, user_id, card_id, in_hand) VALUES ?', [values]);
        });
};

exports.handleGame = async (req, res) => {
    const userId = req.session.user.id;
    const matchId = req.params.gameId;

    try {
        const [existingCards] = await db.query(
            'SELECT * FROM match_cards WHERE match_id = ? AND user_id = ?',
            [matchId, userId]
        );

        if (existingCards.length === 0) {
            await giveStartingCards(userId, matchId);
        }

        res.sendFile(path.resolve('views', 'online-game.html'));
    } catch (err) {
        console.error('❌ Помилка у handleGame:', err);
        res.status(500).send('Помилка при завантаженні гри');
    }
};

exports.checkStatus = async (req, res) => {
    const matchId = req.params.matchId;

    try {
        const [rows] = await db.query(
            'SELECT player1_id, player2_id FROM matches WHERE id = ?',
            [matchId]
        );

        if (rows.length === 0) return res.json({ ready: false });

        const { player1_id, player2_id } = rows[0];
        res.json({ ready: !!(player1_id && player2_id) });
    } catch (err) {
        console.error('❌ Помилка при перевірці статусу:', err);
        res.status(500).json({ ready: false });
    }
};

exports.handleBattle = async (req, res) => {
    const userId = req.session.user.id;
    const matchId = req.params.matchId;

    const [[user]] = await db.query('SELECT username FROM users WHERE id = ?', [userId]);
    const username = user?.username || `Гравець ${userId}`;

    res.send(`
        <!DOCTYPE html>
        <html lang="uk">
        <head>
            <meta charset="UTF-8">
            <title>Матч №${matchId}</title>
            <style>
                .card { border: 1px solid #ccc; padding: 10px; margin: 5px; display: inline-block; width: 120px; text-align: center; }
                .card img { width: 100px; height: 100px; object-fit: cover; }
                #log { margin-top: 20px; }
            </style>
        </head>
        <body>
            <h1>Матч №${matchId}</h1>
            <h2>${username} — HP: <span id="hp">30</span></h2>

            <div id="cards"></div>
            <button onclick="endTurn()">Кінець ходу</button>

            <div id="log"></div>

            <script src="/socket.io/socket.io.js"></script>
            <script>
                const matchId = ${matchId};
                const userId = ${userId};
                const username = "${username}";
                let hp = 30;

                const socket = io();
                socket.emit('join_match', { matchId, userId, username });

                socket.on('player_joined', ({ username }) => log(username + ' приєднався'));
                socket.on('card_played', ({ username, card }) => {
                    if (username !== window.username) {
                        hp -= Math.max(0, card.attack);
                        document.getElementById('hp').textContent = hp;
                        log(username + ' атакує на ' + card.attack + ' 🗡️');
                    }
                });
                socket.on('turn_ended', ({ username }) => log(username + ' завершив хід'));

                function playCard(card) {
                    socket.emit('play_card', { matchId, userId, username, card });
                }

                function endTurn() {
                    socket.emit('end_turn', { matchId, userId, username });
                }

                function log(msg) {
                    const div = document.createElement('div');
                    div.textContent = msg;
                    document.getElementById('log').appendChild(div);
                }

                fetch('/api/match/' + matchId + '/hand')
                    .then(res => res.json())
                    .then(data => {
                        const container = document.getElementById('cards');
                        data.cards.forEach(card => {
                            const btn = document.createElement('div');
                            btn.className = 'card';
                            btn.innerHTML = \`
                                <strong>\${card.name}</strong><br>
                                <img src="\${card.image_url}" alt=""><br>
                                🗡️ \${card.attack} | 🛡️ \${card.defense}<br>
                                <button>Грати</button>
                            \`;
                            btn.querySelector('button').onclick = () => playCard(card);
                            container.appendChild(btn);
                        });
                    });
            </script>
        </body>
        </html>
    `);
};


