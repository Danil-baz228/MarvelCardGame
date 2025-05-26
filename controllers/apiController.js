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

exports.getCardById = async (req, res) => {
    const cardId = req.params.cardId;
    const [[card]] = await db.query('SELECT * FROM cards WHERE id = ?', [cardId]);
    if (!card) return res.status(404).json({ error: 'Карта не знайдена' });
    res.json(card);
};


exports.drawCard = async (req, res) => {
    const { matchId, userId } = req.body;

    // Найти случайную карту
    const [[card]] = await db.query('SELECT * FROM cards ORDER BY RAND() LIMIT 1');

    // Добавить её в match_cards
    await db.query(`
        INSERT INTO match_cards (match_id, user_id, card_id, in_hand)
        VALUES (?, ?, ?, true)
    `, [matchId, userId, card.id]);

    // Вернуть карту
    res.json({ cardId: card.id });
};


