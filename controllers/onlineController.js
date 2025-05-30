const db = require('../db');
const path = require('path');
const io = require('../socket').getIO();


function renderErrorPage(title, message, backLink = '/play') {
    return `
    <!DOCTYPE html>
    <html lang="uk">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <link rel="stylesheet" href="/error.css">
    </head>
    <body>

   
      <header class="site-header">
        <div class="header-inner">
          <h1 class="site-title">🃏 Great Battle</h1>
          <div id="auth-bar" class="auth-bar"></div>
        </div>
      </header>

    
      <main class="main-content fade-in">
        <section class="mode-selection">
          <h1>${title}</h1>
          <p>${message}</p>
          <button class="back-button" onclick="location.href='/play/online-menu'">← Назад</button>
        </section>
      </main>

    
      <footer class="site-footer">
        <p>🔗 Звʼязок: 
          <a href="https://t.me/Marshall949">@Marshall949</a>, 
          <a href="https://t.me/danilbaz">@danilbaz</a>, 
          <a href="https://t.me/MxmChb">@MxmChb</a> | 
          GitHub: <a href="https://github.com/Danil-baz228/MarvelCardGame">MarvelCardGame</a>
        </p>
      </footer>

    </body>
    </html>
  `;
}


exports.createGame = async (req, res) => {
    const userId = req.session.user?.id;
    if (!userId) return res.status(403).send(renderErrorPage("🔒 Немає сесії", "Будь ласка, увійдіть у свій акаунт", "/auth/login"));

    try {
        const [results] = await db.query(
            'INSERT INTO matches (player1_id, player2_id) VALUES (?, ?)',
            [userId, null]
        );

        const matchId = results.insertId;
        res.json({ matchId });
    } catch (err) {
        console.error('❌ Помилка при створенні матчу:', err);
        res.status(500).send(renderErrorPage("💥 Помилка БД", "Не вдалося створити гру. Спробуйте пізніше."));
    }
};


exports.joinGame = async (req, res) => {
    const matchId = req.body.gameId;
    const userId = req.session.user?.id;

    try {
        const [rows] = await db.query('SELECT * FROM matches WHERE id = ?', [matchId]);
        if (rows.length === 0) {
            return res.status(404).send(renderErrorPage("❌ Матч не знайдено", "Перевірте ID гри або спробуйте ще раз."));
        }

        const match = rows[0];

        if (match.player2_id && match.player2_id !== 0) {
            return res.status(409).send(renderErrorPage("⚠️ Матч вже заповнений", "Цей матч уже має двох гравців."));
        }

        if (match.player1_id == userId) {
            return res.status(400).send(renderErrorPage("🚫 Неможливо приєднатися", "Ви не можете приєднатися до власного матчу."));
        }

        const firstTurnId = Math.random() < 0.5 ? match.player1_id : userId;

        await db.query(
            'UPDATE matches SET player2_id = ?, current_turn_id = ? WHERE id = ?',
            [userId, firstTurnId, matchId]
        );


        const [[player2]] = await db.query('SELECT username FROM users WHERE id = ?', [userId]);
        const [[player1]] = await db.query('SELECT username FROM users WHERE id = ?', [match.player1_id]);

        const player2Username = player2?.username || `Гравець ${userId}`;
        const player1Username = player1?.username || `Гравець ${match.player1_id}`;


        io.to(`match_${matchId}`).emit('player_joined', {
            player1: {
                id: match.player1_id,
                username: player1Username
            },
            player2: {
                id: userId,
                username: player2Username
            }
        });

        res.redirect(`/play/online/${matchId}`);
    } catch (err) {
        console.error('❌ Помилка при приєднанні до матчу:', err);
        res.status(500).send(renderErrorPage("💥 Помилка сервера", "Не вдалося приєднатися до матчу. Спробуйте пізніше."));
    }
};

exports.getCurrentTurn = async (req, res) => {
    const matchId = req.params.matchId;
    try {
        const [[row]] = await db.query('SELECT current_turn_id FROM matches WHERE id = ?', [matchId]);
        if (!row) return res.status(404).json({ error: 'Match not found' });
        res.json({ currentTurnId: row.current_turn_id });
    } catch (err) {
        res.status(500).json({ error: 'DB error' });
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
    const userId = req.session.user?.id;
    const matchId = req.params.gameId;

    if (!userId) {
        return res.status(403).send(renderErrorPage("🔒 Немає сесії", "Будь ласка, увійдіть у свій акаунт", "/auth/login"));
    }

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
        res.status(500).send(renderErrorPage("💥 Помилка при завантаженні гри", "Спробуйте оновити сторінку або почати новий матч."));
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

    const [[user]] = await db.query('SELECT username, avatar_url FROM users WHERE id = ?', [userId]);
    const avatar = user?.avatar_url || '/uploads/avatars/images.jpg';

    const username = user?.username || `Гравець ${userId}`;

    res.send(`
        <!DOCTYPE html>
        <html lang="uk">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Онлайн Битва Карт — Матч №${matchId}</title>
            <link rel="stylesheet" href="/playOnline.css">
        </head>
        <body>
        <div class="game-container">
            <header class="game-header">
                <h1>Онлайн Битва Карт</h1>
                <div class="game-stats">
                    <div class="match-info">Матч №${matchId}</div>
                    <div class="timer-display">Час: <span id="timer">30</span>с</div>
                </div>
            </header>

            <div class="battlefield">
                <div class="player-area opponent-area">
                    <div class="player-stats">
                        <div class="player-name" id="opponent-name">
                            <img id="opponent-avatar" class="avatar" src="/default-avatar.png" alt="Аватар">
                            <span class="username">Очікується суперник...</span>
                        </div>
                        <div class="stats">
                            <div class="health-bar">
                                <div class="label">Здоров'я:</div>
                                <div class="bar">
                                    <div id="opponent-health-bar" class="bar-fill" style="width: 100%;"></div>
                                </div>
                                <div id="enemy-hp">30</div>
                            </div>
                            <div class="defense-stat">
                                <div class="label">Захист:</div>
                                <div id="opponent-defense">0</div>
                            </div>
                        </div>
                        <div class="card-count">
                            <div class="label">Картки:</div>
                            <div id="opponent-card-count">4</div>
                        </div>
                    </div>
                    <div class="hand opponent-hand">
                        <div class="card card-back">?</div>
                        <div class="card card-back">?</div>
                        <div class="card card-back">?</div>
                        <div class="card card-back">?</div>
                    </div>
                </div>

                <div class="game-log">
                    <h3>Журнал Бою</h3>
                    <div id="log" class="log-content"></div>
                </div>

                <div class="player-area your-area">
                    <div class="hand your-hand" id="cards"></div>
                    <div class="player-stats">
                        <div class="player-name">
                            <img id="my-avatar" class="avatar" src="${avatar}" alt="Аватар">
                            <span class="username">${username}</span>
                        </div>
                        <div class="stats">
                            <div class="health-bar">
                                <div class="label">Здоров'я:</div>
                                <div class="bar">
                                    <div id="player-health-bar" class="bar-fill my-health-bar" style="width: 100%;"></div>
                                </div>
                                <div id="my-hp">30</div>
                            </div>
                            <div class="defense-stat">
                                <div class="label">Захист:</div>
                                <div id="player-defense">0</div>
                            </div>
                            <div class="cost-stat">
                                <div class="label">Вартість:</div>
                                <div id="cost">10</div>
                            </div>
                        </div>
                        <div class="actions">
                            <button id="end-turn" class="action-button">Завершити хід</button>
                        </div>
                        <button id="leave-match" class="leave-button">Вийти з матчу</button>
                    </div>
                </div>
            </div>

            <div id="result" class="status-message hidden"></div>
        </div>

        

        <script src="/socket.io/socket.io.js"></script>
        <script>
            const matchId = ${matchId};
            const userId = ${userId};
            const username = ${JSON.stringify(username)};

            let oponentDefense = 0;
            let myDefense = 0;
            let myHp = 30;
            let enemyHp = 30;
            let gameOver = false;
            let cost = 10;
            let timer = 30;
            let interval;
            let opponentCardCount = 4;

            const socket = io();
            socket.emit('join_match', { matchId, userId, username });

            
            const myHpElement = document.getElementById('my-hp');
            const enemyHpElement = document.getElementById('enemy-hp');
            const costElement = document.getElementById('cost');
            const timerElement = document.getElementById('timer');
            const logElement = document.getElementById('log');
            const resultElement = document.getElementById('result');
            const cardsContainer = document.getElementById('cards');
            const opponentNameElement = document.getElementById('opponent-name');
            const opponentCardCountElement = document.getElementById('opponent-card-count');
            const playerHealthBar = document.getElementById('player-health-bar');
            const opponentHealthBar = document.getElementById('opponent-health-bar');
            const playerDefenseElement = document.getElementById('player-defense');
            const oponentDefenseElement = document.getElementById('opponent-defense');
            
            document.getElementById('leave-match').addEventListener('click', async () => {
                const confirmed = confirm('Ви впевнені, що хочете вийти з матчу?');
                if (!confirmed) return;
            
                try {
                    await fetch('/api/match/leave', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ matchId })
                    });
            
                    socket.disconnect(); 
                    window.location.href = '/play/online-menu'; 
                } catch (err) {
                    console.error('Помилка при виході з матчу:', err);
                }
            });

            
           
            socket.on('player_joined', ({ player1, player2 }) => {

                const opponent = player1.id === userId ? player2 : player1;
                if (opponent && opponent.username !== username) {
                    document.getElementById('opponent-avatar').src = opponent.avatar || '/uploads/avatars/images.jpg';
                    opponentNameElement.querySelector('.username').textContent = opponent.username;

                    opponentNameElement.classList.remove('pulse');
                }
                log((opponent ? opponent.username : 'Opponent') + ' приєднався до матчу');
            });

          
            socket.on('match_state', ({ player1, player2 }) => {
               
                const opponent = player1.id === userId ? player2 : player1;
                if (opponent && opponent.username) {
                    document.getElementById('opponent-avatar').src = opponent.avatar || '/uploads/avatars/images.jpg';
                    opponentNameElement.querySelector('.username').textContent = opponent.username;
    
                    opponentNameElement.classList.remove('pulse');
                    log('Підключено до матчу з ' + opponent.username);
                }
            });

            socket.on('card_played', ({ userId: attackerId, card, username: attackerName }) => {
                if (gameOver) return;

                if (attackerId === userId) {
                    enemyHp -= Math.max(0, card.attack - oponentDefense);
                    enemyHp = Math.max(enemyHp, 0);
                    enemyHpElement.textContent = enemyHp;
                    opponentHealthBar.style.width = (enemyHp / 30) * 100 + "%";
                    oponentDefense = 0;
                    oponentDefenseElement.textContent = oponentDefense;
                    log(attackerName + ' атаки на ' + card.attack + ' дамагу 🗡️');
                    if (enemyHp <= 0) {
                        gameOver = true;
                        showResult("🎉 Перемога! Ви виграли матч!!", 'victory');
                    }
                } else if (attackerId !== userId) {
                    
                    let damage = Math.max(0, card.attack - myDefense);
                    myHp -= damage;
                    myHp = Math.max(myHp, 0);
                    myHpElement.textContent = myHp;
                    playerHealthBar.style.width = (myHp / 30) * 100 + "%"; 
                    oponentDefense = card.defense;
                    oponentDefenseElement.textContent = oponentDefense                   
                    myDefense = 0; // Reset defense after attack
                    playerDefenseElement.textContent = myDefense;
            
                    if (myHp <= 0) {
                        gameOver = true;
                        showResult("❌ Поразка! Ти програв матч!", 'defeat');
                    }
                }
            });

            socket.on('card_removed', ({ cardId, userId: ownerId }) => {
                if (ownerId !== userId) {
                    opponentCardCount = Math.max(0, opponentCardCount - 1);
                    opponentCardCountElement.textContent = opponentCardCount;
                    return;
                }
                const cardElement = document.querySelector(\`[data-card-id="\${cardId}"]\`);
                if (cardElement) {
                    cardElement.remove();
                }
            });

            socket.on('turn_ended', async ({ username: playerName, nextTurnId }) => {
                if (!gameOver) {
                    log(playerName + ' закінчив свій хід.');
                    if (nextTurnId === userId) {
                        cost = 10;
                        costElement.textContent = cost;
                        resetTimer();
                        await drawCards();
                        updateCardButtons();
                    }
                }
            });

            socket.on('match_ended', ({ winnerId }) => {
                if (gameOver) return;
                gameOver = true;
                if (winnerId === userId) {
                    opponentHealthBar.style.width = '0%';
                    enemyHpElement.textContent = '0'
                } else {
                    playerHealthBar.style.width = '0%';
                    myHpElement.textContent = '0';
                }
                showResult(
                    winnerId === userId ? "🎉 Перемога! Ви виграли матч!" : "❌ Поразка! Ви програли матч!",
                    winnerId === userId ? 'victory' : 'defeat'
                );
            });

         
            async function playCard(card) {
                if (gameOver || card.cost > cost) return;
                
                const res = await fetch(\`/api/match/${matchId}/turn\`);
                const data = await res.json();
                if (data.currentTurnId !== userId) {
                    log('❗ Не ваша черга!');
                    return;
                }
                
                cost -= card.cost;
                costElement.textContent = cost
                
                
                if (card.defense > 0) {
                    myDefense += card.defense;
                    playerDefenseElement.textContent = myDefense;
                }
                
                socket.emit('play_card', {
                    matchId,
                    userId,
                    username,
                    card,
                    hp: Math.max(enemyHp - card.attack, 0),
                    cardId: card.id
                });

                updateCardButtons();
            }  

            function updateCardButtons() {
                const cards = document.querySelectorAll('.card:not(.card-back)');
                cards.forEach(cardElement => {
                    const cost = parseInt(cardElement.dataset.cost);

                    if (cost > cost || gameOver) {
                        cardElement.classList.remove('affordable');
                        cardElement.classList.add('unaffordable');
                        cardElement.style.pointerEvents = 'none';
                    } else {
                        cardElement.classList.add('affordable');
                        cardElement.classList.remove('unaffordable');
                        cardElement.style.pointerEvents = 'auto';
                    }
                });
            }

            function log(msg) {
                const div = document.createElement('div');
                div.className = 'log-entry';
                div.textContent = msg;
                logElement.appendChild(div);
                logElement.scrollTop = logElement.scrollHeight;

              
                while (logElement.children.length > 8) {
                    logElement.removeChild(logElement.firstChild);
                }
            }

            function showResult(text, type) {
                resultElement.textContent = text;
                resultElement.className = \`status-message \${type}\`;
                resultElement.classList.remove('hidden');
                clearInterval(interval);

              
                const cards = document.querySelectorAll('.card:not(.card-back)');
                cards.forEach(card => {
                    card.style.pointerEvents = 'none';
                    card.classList.add('unaffordable');
                });
            }

            async function drawCards() {
                const cardsInHand = document.querySelectorAll('.card:not(.card-back)').length;
                const cardsToDraw = 4 - cardsInHand;

                for (let i = 0; i < cardsToDraw; i++) {
                    try {
                        const res = await fetch('/api/match/' + matchId + '/draw', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ matchId, userId })
                        });
                        const data = await res.json();
                        if (data.cardId) {
                            await loadNewCard(data.cardId);
                        }
                    } catch (error) {
                        console.error('Error drawing card:', error);
                    }
                }
            }

            async function loadNewCard(cardId) {
                try {
                    const res = await fetch('/api/card/' + cardId);
                    const card = await res.json();

                    const cardElement = document.createElement('div');
                    cardElement.className = 'card';
                    cardElement.dataset.cardId = card.id;

                    cardElement.innerHTML = \`
                        <div class="card-header">
                            <div class="card-name">\${card.name}</div>
                            <div class="card-cost">\${card.cost}</div>
                        </div>
                        <div class="card-image">
                            <img src="\${card.image_url}" alt="\${card.name}">
                        </div>
                        <div class="card-stats">
                            <div class="card-attack">ATK: \${card.attack}</div>
                            <div class="card-defense">DEF: \${card.defense}</div>
                        </div>
                    \`;

                    cardElement.dataset.cost = card.cost;
                    cardElement.onclick = () => playCard(card);

                    cardsContainer.appendChild(cardElement);
                    updateCardButtons();
                } catch (error) {
                    console.error('Error loading card:', error);
                }
            }

            function resetTimer() {
                clearInterval(interval);
                timer = 30;
                timerElement.textContent = timer;

                interval = setInterval(() => {
                    if (gameOver) return;
                    timer--;
                    timerElement.textContent = timer;

                    if (timer === 0) {
                        clearInterval(interval);
                        socket.emit('end_turn', { matchId, userId, username });
                    }
                }, 1000);
            }

           
            async function initializeGame() {
                try {
                    const res = await fetch('/api/match/' + matchId + '/hand');
                    const data = await res.json();

                    if (data.cards) {
                        data.cards.forEach(card => {
                            const cardElement = document.createElement('div');
                            cardElement.className = 'card';
                            cardElement.dataset.cardId = card.id;

                            cardElement.innerHTML = \`
                                <div class="card-header">
                                    <div class="card-name">\${card.name}</div>
                                    <div class="card-cost">\${card.cost}</div>
                                </div>
                                <div class="card-image">
                                    <img src="\${card.image_url}" alt="\${card.name}">
                                </div>
                                <div class="card-stats">
                                    <div class="card-attack">ATK: \${card.attack}</div>
                                    <div class="card-defense">DEF: \${card.defense}</div>
                                </div>
                            \`;

                            cardElement.dataset.cost = card.cost;
                            cardElement.onclick = () => playCard(card);

                            cardsContainer.appendChild(cardElement);
                        });

                        updateCardButtons();
                        resetTimer();
                    }
                } catch (error) {
                    console.error('Error initializing game:', error);
                }
            }

           
            opponentNameElement.classList.add('pulse');

          
            initializeGame();
        </script>
        </body>
        </html>
    `);


    try {
        const [matchRows] = await db.query('SELECT player1_id, player2_id FROM matches WHERE id = ?', [matchId]);
        if (matchRows.length) {
            const { player1_id, player2_id } = matchRows[0];
            if (player1_id && player2_id) {

                const [[player1]] = await db.query('SELECT username, avatar_url FROM users WHERE id = ?', [player1_id]);
                const [[player2]] = await db.query('SELECT username, avatar_url FROM users WHERE id = ?', [player2_id]);


                setTimeout(() => {
                    io.to(`match_${matchId}`).emit('match_state', {
                        player1: {
                            id: player1_id,
                            username: player1?.username || `Player ${player1_id}`,
                            avatar: player1?.avatar_url || '/uploads/avatars/images.jpg'
                        },
                        player2: {
                            id: player2_id,
                            username: player2?.username || `Player ${player2_id}`,
                            avatar: player2?.avatar_url || '/uploads/avatars/images.jpg'
                        }
                    });
                }, 1000);
            }
        }
    } catch (error) {
        console.error('Error sending match state:', error);
    }
};
