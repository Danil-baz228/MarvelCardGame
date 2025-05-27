const fs = require('fs');
const path = require('path');
const db = require('../db'); // ← це твій pool з mysql2/promise

exports.handle = async (req, res) => {
  const filePath = path.resolve('views', 'main.html');

  fs.readFile(filePath, 'utf8', async (err, html) => {
    if (err) return res.status(500).send('Template error');

    const user = req.session.user
        ? JSON.stringify(req.session.user)
        : 'null';

    let topPlayers = [];
    try {
      const [rows] = await db.query(`
        SELECT 
          users.username,
          COUNT(matches.winner_id) AS wins
        FROM matches
        JOIN users ON users.id = matches.winner_id
        WHERE matches.winner_id IS NOT NULL
        GROUP BY users.username
        ORDER BY wins DESC
        LIMIT 10;
      `);

      topPlayers = rows.map((row, i) => ({
        username: row.username,
        wins: parseInt(row.wins),
        rating: parseInt(row.wins) * 10 + (100 - i * 5)
      }));
    } catch (e) {
      console.error('Помилка отримання топ-гравців:', e);
    }

    const finalHtml = html.replace(
        '<!-- {{USER_INJECT}} -->',
        `<script>
        window.user = ${user};
        window.topPlayers = ${JSON.stringify(topPlayers)};
      </script>`
    );

    res.send(finalHtml);
  });
};
