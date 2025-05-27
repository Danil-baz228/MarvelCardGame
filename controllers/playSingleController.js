const path = require('path');
const db = require('../db');

async function fetchAllCards() {
    const [rows] = await db.query('SELECT * FROM cards');
    return rows;
}


const gameStates = {};


async function getOrCreateGame(userId) {
    if (!gameStates[userId]) {
        // Set up initial game state
        const cardDeck = await fetchAllCards();
        gameStates[userId] = {
            player: {
                health: 30,
                defense: 0,
                coins: 5,
                hand: getRandomCards(cardDeck, 4),
                deck: [...cardDeck]
            },
            opponent: {
                health: 30,
                defense: 0,
                hand: 4,
                deck: cardDeck.length
            },
            turn: 1,
            playerTurn: true,
            gameLog: ["Game started! Your turn."],
            gameOver: false
        };
    }
    return gameStates[userId];
}


function getRandomCards(deck, count) {
    const cards = [];
    for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * deck.length);
        cards.push({ ...deck[randomIndex] });
    }
    return cards;
}


async function opponentTurn(gameState) {
    const action = Math.random() > 0.3 ? 'attack' : 'defense';
    const strength = Math.floor(Math.random() * 5) + 1;

    if (action === 'attack') {

        const actualDamage = Math.max(0, strength - gameState.player.defense);
        gameState.player.health -= actualDamage;
        gameState.player.defense = Math.max(0, gameState.player.defense - strength);

        gameState.gameLog.push(`Opponent attacks for ${strength} damage! You blocked ${strength - actualDamage} with defense.`);
    } else {
        gameState.opponent.defense += strength;
        gameState.gameLog.push(`Opponent gains ${strength} defense!`);
    }


    if (gameState.player.health <= 0) {
        gameState.gameOver = true;
        gameState.gameLog.push("Game over! You lost.");
    }


    gameState.playerTurn = true;
    gameState.turn++;
    gameState.player.coins += Math.min(10, gameState.turn);


    if (gameState.player.hand.length < 5) {
        cardDeck = await fetchAllCards();
        gameState.player.hand.push(getRandomCards(cardDeck, 1)[0]);
    }

    gameState.gameLog.push(`Turn ${gameState.turn}: Your turn. You have ${gameState.player.coins} coins.`);
    return gameState;
}


function playCard(gameState, cardIndex) {
    const card = gameState.player.hand[cardIndex];

    if (!gameState.playerTurn) return

    if (card.cost > gameState.player.coins) {
        gameState.gameLog.push(`Not enough coins to play ${card.name}!`);
        return gameState;
    }


    gameState.player.hand.splice(cardIndex, 1);
    gameState.player.coins -= card.cost;


    if (card.attack > 0) {

        const actualDamage = Math.max(0, card.attack - gameState.opponent.defense);
        gameState.opponent.health -= actualDamage;
        gameState.opponent.defense = Math.max(0, gameState.opponent.defense - card.attack);

        gameState.gameLog.push(`You played ${card.name} for ${card.attack} attack! Opponent blocked ${card.attack - actualDamage} with defense.`);
    }

    if (card.defense > 0) {
        gameState.player.defense += card.defense;
        gameState.gameLog.push(`You gained ${card.defense} defense from ${card.name}!`);
    }


    if (gameState.opponent.health <= 0) {
        gameState.gameOver = true;
        gameState.gameLog.push("Game over! You won!");
        return gameState;
    }

    return gameState;
}


function endTurn(gameState) {
    gameState.playerTurn = false;
    gameState.gameLog.push("You ended your turn. Opponent is thinking...");


    setTimeout(() => {
        opponentTurn(gameState);
    }, 1000);

    return gameState;
}


function resetGame(userId) {
    delete gameStates[userId];
    return getOrCreateGame(userId);
}

exports.handle = async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const userId = req.session.user.id;

    if (req.method === 'GET') {

        return res.sendFile(path.resolve('views', 'play-single.html'));
    } else if (req.method === 'POST') {
        // Handle game actions via API calls
        const action = req.body.action;
        let gameState = await getOrCreateGame(userId);

        switch (action) {
            case 'getState':
                return res.json({ success: true, gameState });

            case 'playCard':
                const cardIndex = parseInt(req.body.cardIndex);
                if (isNaN(cardIndex) || cardIndex < 0 || cardIndex >= gameState.player.hand.length) {
                    return res.json({ success: false, message: 'Invalid card index' });
                }
                gameState = playCard(gameState, cardIndex);
                return res.json({ success: true, gameState });

            case 'endTurn':
                gameState = endTurn(gameState);
                return res.json({ success: true, gameState });

            case 'resetGame':
                gameState = resetGame(userId);
                return res.json({ success: true, gameState });

            default:
                return res.json({ success: false, message: 'Invalid action' });
        }
    }
};