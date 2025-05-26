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

        // Випадковим чином обираємо, хто перший ходить
        const firstTurnId = Math.random() < 0.5 ? match.player1_id : userId;

        // Оновлюємо одразу player2 і поточний хід
        await db.query(
            'UPDATE matches SET player2_id = ?, current_turn_id = ? WHERE id = ?',
            [userId, firstTurnId, matchId]
        );

        // Отримуємо username для відображення
        const [[user]] = await db.query('SELECT username FROM users WHERE id = ?', [userId]);
        const username = user?.username || `Гравець ${userId}`;

        io.to(`match_${matchId}`).emit('player_joined', { userId, username });

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
                #result { font-size: 24px; color: red; margin-top: 20px; }
            </style>
        </head>
        <body>
            <h1>Матч №${matchId}</h1>
            <h2>Ви — ${username} — HP: <span id="my-hp">30</span></h2>
            <h3>Противник — <span id="opponent-name">Очікується...</span> — HP: <span id="enemy-hp">30</span></h3>
            <h4>💧 Мана: <span id="mana">10</span> | ⏳ Хід завершується через <span id="timer">30</span> сек.</h4>

            <div id="cards"></div>
            <div id="result"></div>
            <div id="log"></div>

            <script src="/socket.io/socket.io.js"></script>
            <script>
                const matchId = ${matchId};
                const userId = ${userId};
                const username = ${JSON.stringify(username)};

                let myHp = 30;
                let enemyHp = 30;
                let gameOver = false;
                let mana = 10;
                let timer = 30;
                let interval;

                const socket = io();
                socket.emit('join_match', { matchId, userId, username });

                socket.on('player_joined', ({ username }) => {
                    if (username !== window.username) {
                        document.getElementById('opponent-name').textContent = username;
                    }
                    log(username + ' приєднався');
                });

                socket.on('card_played', ({ userId: attackerId, card, username: attackerName }) => {
                    if (gameOver) return;

                    if (attackerId === userId) {
                        enemyHp -= card.attack;
                        document.getElementById('enemy-hp').textContent = Math.max(enemyHp, 0);
                        log(attackerName + ' атакує на ' + card.attack + ' 🗡️');
                        if (enemyHp <= 0) {
                            gameOver = true;
                            showResult("🎉 Ви перемогли матч!");
                        }
                    } else {
                        myHp -= card.attack;
                        document.getElementById('my-hp').textContent = Math.max(myHp, 0);
                        log(attackerName + ' атакує на ' + card.attack + ' 🗡️');
                        if (myHp <= 0) {
                            gameOver = true;
                            showResult("❌ Ви програли матч!");
                        }
                    }
                });

                socket.on('card_removed', ({ cardId, userId: ownerId }) => {
                    if (ownerId !== userId) return;
                    const button = document.querySelector(\`button[data-id="\${cardId}"]\`);
                    if (button && button.parentElement) {
                        button.parentElement.remove();
                    }
                });

                socket.on('turn_ended', async ({ username, nextTurnId }) => {
                    if (!gameOver) {
                        log(username + ' завершив хід');
                        if (nextTurnId === userId) {
                            mana = 10;
                            document.getElementById('mana').textContent = mana;
                            resetTimer();
                            await drawCards();
                        }
                    }
                });

                socket.on('match_ended', ({ winnerId }) => {
                    if (gameOver) return;
                    gameOver = true;
                    showResult(winnerId === userId ? "🎉 Ви перемогли матч!" : "❌ Ви програли матч!");
                });

                function playCard(card) {
                    if (gameOver || card.cost > mana) return;
                    mana -= card.cost;
                    document.getElementById('mana').textContent = mana;
                    const updatedEnemyHp = Math.max(enemyHp - card.attack, 0);

                    socket.emit('play_card', {
                        matchId,
                        userId,
                        username,
                        card,
                        hp: updatedEnemyHp,
                        cardId: card.id
                    });
                }

                function log(msg) {
                    const div = document.createElement('div');
                    div.textContent = msg;
                    document.getElementById('log').appendChild(div);
                }

                function showResult(text) {
                    const result = document.getElementById('result');
                    result.textContent = text;
                }

                async function drawCards() {
                    const cardsInHand = document.querySelectorAll('.card').length;
                    const cardsToDraw = 4 - cardsInHand;
                    for (let i = 0; i < cardsToDraw; i++) {
                        const res = await fetch('/api/match/' + matchId + '/draw', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ matchId, userId })
                        });
                        const data = await res.json();
                        if (data.cardId) loadNewCard(data.cardId);
                    }
                }

                async function loadNewCard(cardId) {
                    const res = await fetch('/api/card/' + cardId);
                    const card = await res.json();
                    const container = document.getElementById('cards');
                    const btn = document.createElement('div');
                    btn.className = 'card';
                    btn.innerHTML = \`
                        <strong>\${card.name}</strong><br>
                        <img src="\${card.image_url}" alt=""><br>
                        🗡️ \${card.attack} | 🛡️ \${card.defense} | 💰 \${card.cost}<br>
                        <button data-id="\${card.id}" \${card.cost > mana ? 'disabled' : ''}>Грати</button>
                    \`;
                    btn.querySelector('button').onclick = () => playCard(card);
                    container.appendChild(btn);
                }

                function resetTimer() {
                    clearInterval(interval);
                    timer = 30;
                    document.getElementById('timer').textContent = timer;
                    interval = setInterval(() => {
                        if (gameOver) return;
                        timer--;
                        document.getElementById('timer').textContent = timer;
                        if (timer === 0) {
                            clearInterval(interval);
                            socket.emit('end_turn', { matchId, userId, username });
                        }
                    }, 1000);
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
                                🗡️ \${card.attack} | 🛡️ \${card.defense} | 💰 \${card.cost}<br>
                                <button data-id="\${card.id}" \${card.cost > mana ? 'disabled' : ''}>Грати</button>
                            \`;
                            btn.querySelector('button').onclick = () => playCard(card);
                            container.appendChild(btn);
                        });
                        resetTimer();
                    });
            </script>
        </body>
        </html>
    `);
};


