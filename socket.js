let io = null;

module.exports = {
    init: (server) => {
        io = require('socket.io')(server);

        io.on('connection', (socket) => {
            console.log('🔗 Гравець підключився:', socket.id);

            socket.on('join_match', ({ matchId, userId }) => {
                socket.join(`match_${matchId}`);
                console.log(`Гравець ${userId} приєднався до матчу ${matchId}`);
                io.to(`match_${matchId}`).emit('player_joined', { userId });
            });

            socket.on('play_card', (data) => {
                io.to(`match_${data.matchId}`).emit('card_played', data);
            });

            socket.on('end_turn', (data) => {
                io.to(`match_${data.matchId}`).emit('turn_ended', data);
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
