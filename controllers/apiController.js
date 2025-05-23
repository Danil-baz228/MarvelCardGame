const db = require('../db');

exports.getHand = async (req, res) => {
    const matchId = req.params.matchId;
    const userId = req.session.user?.id;

    if (!userId) return res.status(403).json({ error: 'Сесія не знайдена' });

    try {
        const [cards] = await db.query(`
            SELECT cards.id, cards.name, cards.attack, cards.defense, cards.cost, cards.image_url
            FROM match_cards
            JOIN cards ON match_cards.card_id = cards.id
            WHERE match_cards.match_id = ? AND match_cards.user_id = ? AND match_cards.in_hand = 1
        `, [matchId, userId]);

        res.json({ cards });
    } catch (err) {
        console.error('❌ Помилка при отриманні карт:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
};
