const db = require('./db');

let io = null;

module.exports = {
    init: (server) => {
        io = require('socket.io')(server);

        io.on('connection', (socket) => {
            console.log('🔗 Гравець підключився:', socket.id);

            socket.on('join_match', async ({ matchId, userId, username }) => {
                socket.join(`match_${matchId}`);
                console.log(`Гравець ${userId} (${username}) приєднався до матчу ${matchId}`);

                const [rows] = await db.query('SELECT player1_id, player2_id, current_turn_id FROM matches WHERE id = ?', [matchId]);
                const match = rows[0];

                if (match.player1_id && match.player2_id && !match.current_turn_id) {
                    const randomFirst = Math.random() > 0.5 ? match.player1_id : match.player2_id;
                    await db.query('UPDATE matches SET current_turn_id = ? WHERE id = ?', [randomFirst, matchId]);
                }

                io.to(`match_${matchId}`).emit('player_joined', { userId, username });
            });

            socket.on('play_card', async (data) => {
                try {
                    const [rows] = await db.query('SELECT player1_id, player2_id, current_turn_id FROM matches WHERE id = ?', [data.matchId]);
                    const match = rows[0];

                    if (data.userId !== match.current_turn_id) {
                        socket.emit('error_message', { message: '❗ Зачекай свій хід!' });
                        return;
                    }

                    // Удаляем карту из руки в базе
                    await db.query(
                        'UPDATE match_cards SET in_hand = false WHERE match_id = ? AND user_id = ? AND card_id = ?',
                        [data.matchId, data.userId, data.card.id]
                    );

                    // Уведомляем клиента удалить карту
                    io.to(`match_${data.matchId}`).emit('card_played', data);
                    io.to(`match_${data.matchId}`).emit('card_removed', { cardId: data.card.id, userId: data.userId });

                    // Проверка победы
                    if (data.hp !== undefined && data.hp <= 0) {
                        await db.query('UPDATE matches SET winner_id = ? WHERE id = ?', [data.userId, data.matchId]);
                        io.to(`match_${data.matchId}`).emit('match_ended', { winnerId: data.userId });
                        return;
                    }

                    const nextTurn = match.current_turn_id === match.player1_id
                        ? match.player2_id
                        : match.player1_id;

                    await db.query('UPDATE matches SET current_turn_id = ? WHERE id = ?', [nextTurn, data.matchId]);

                    io.to(`match_${data.matchId}`).emit('turn_ended', {
                        username: data.username,
                        nextTurnId: nextTurn
                    });

                } catch (err) {
                    console.error('❌ Помилка play_card:', err);
                }
            });


            socket.on('end_turn', async (data) => {
                try {
                    const [matchRow] = await db.query(
                        'SELECT player1_id, player2_id, current_turn_id FROM matches WHERE id = ?',
                        [data.matchId]
                    );
                    const match = matchRow[0];

                    const nextTurn = match.current_turn_id === match.player1_id
                        ? match.player2_id
                        : match.player1_id;

                    await db.query('UPDATE matches SET current_turn_id = ? WHERE id = ?', [nextTurn, data.matchId]);

                    io.to(`match_${data.matchId}`).emit('turn_ended', {
                        username: data.username,
                        nextTurnId: nextTurn
                    });
                } catch (err) {
                    console.error('❌ Помилка end_turn:', err);
                }
            });

            socket.on('disconnect', () => {
                console.log('🔌 Гравець вийшов:', socket.id);
            });
        });

        return io;
    },

    getIO: () => {
        if (!io) throw new Error('Socket.io не ініціалізовано!');
        return io;
    }
};
