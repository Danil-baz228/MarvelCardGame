const path = require('path');

const cardDeck = [
    { id: 1, name: "Warrior", attack: 3, defense: 1, cost: 2, image: "/cardsimg/iron_man.png" },
    { id: 2, name: "Shield Bearer", attack: 1, defense: 4, cost: 2, image: "/cardsimg/iron_man.png" },
    { id: 3, name: "Knight", attack: 4, defense: 2, cost: 3, image: "/cardsimg/iron_man.png" },
    { id: 4, name: "Archer", attack: 5, defense: 0, cost: 3, image: "/cardsimg/iron_man.png" },
    { id: 5, name: "Paladin", attack: 3, defense: 3, cost: 4, image: "../public/cardsimg/iron_man.png" },
    { id: 6, name: "Assassin", attack: 6, defense: 0, cost: 4, image: "../public/cardsimg/iron_man.png" },
    { id: 7, name: "Guardian", attack: 2, defense: 5, cost: 4, image: "../public/cardsimg/iron_man.png" },
    { id: 8, name: "Berserker", attack: 7, defense: 1, cost: 5, image: "../public/cardsimg/iron_man.png" },
    { id: 9, name: "Champion", attack: 5, defense: 5, cost: 6, image: "../public/cardsimg/iron_man.png" },
    { id: 10, name: "Dragon", attack: 8, defense: 3, cost: 8, image: "../public/cardsimg/iron_man.png" }
];

// Game state for different player sessions
const gameStates = {};

// Initialize a new game or get existing one
function getOrCreateGame(userId) {
    if (!gameStates[userId]) {
        // Set up initial game state
        gameStates[userId] = {
            player: {
                health: 30,
                defense: 0,
                coins: 3,
                hand: getRandomCards(4),
                deck: [...cardDeck]
            },
            opponent: {
                health: 30,
                defense: 0,
                hand: 4, // Just track number of cards for opponent
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

// Get random cards for player's hand
function getRandomCards(count) {
    const cards = [];
    for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * cardDeck.length);
        cards.push({...cardDeck[randomIndex]});
    }
    return cards;
}

// Simulate AI opponent's turn
function opponentTurn(gameState) {
    const action = Math.random() > 0.3 ? 'attack' : 'defense';
    const strength = Math.floor(Math.random() * 5) + 1;

    if (action === 'attack') {
        // Apply player's defense first
        const actualDamage = Math.max(0, strength - gameState.player.defense);
        gameState.player.health -= actualDamage;
        gameState.player.defense = Math.max(0, gameState.player.defense - strength);

        gameState.gameLog.push(`Opponent attacks for ${strength} damage! You blocked ${strength - actualDamage} with defense.`);
    } else {
        gameState.opponent.defense += strength;
        gameState.gameLog.push(`Opponent gains ${strength} defense!`);
    }

    // Check if game is over
    if (gameState.player.health <= 0) {
        gameState.gameOver = true;
        gameState.gameLog.push("Game over! You lost.");
    }

    // Start player's turn
    gameState.playerTurn = true;
    gameState.turn++;
    gameState.player.coins += Math.min(10, gameState.turn); // Coins equal to turn number, max 10

    // Draw a card
    if (gameState.player.hand.length < 10) {
        gameState.player.hand.push(getRandomCards(1)[0]);
    }

    gameState.gameLog.push(`Turn ${gameState.turn}: Your turn. You have ${gameState.player.coins} coins.`);
    return gameState;
}

// Play a card
function playCard(gameState, cardIndex) {
    const card = gameState.player.hand[cardIndex];

    if (card.cost > gameState.player.coins) {
        gameState.gameLog.push(`Not enough coins to play ${card.name}!`);
        return gameState;
    }

    // Remove card from hand and spend coins
    gameState.player.hand.splice(cardIndex, 1);
    gameState.player.coins -= card.cost;

    // Apply card effects
    if (card.attack > 0) {
        // Apply opponent's defense first
        const actualDamage = Math.max(0, card.attack - gameState.opponent.defense);
        gameState.opponent.health -= actualDamage;
        gameState.opponent.defense = Math.max(0, gameState.opponent.defense - card.attack);

        gameState.gameLog.push(`You played ${card.name} for ${card.attack} attack! Opponent blocked ${card.attack - actualDamage} with defense.`);
    }

    if (card.defense > 0) {
        gameState.player.defense += card.defense;
        gameState.gameLog.push(`You gained ${card.defense} defense from ${card.name}!`);
    }

    // Check if game is over
    if (gameState.opponent.health <= 0) {
        gameState.gameOver = true;
        gameState.gameLog.push("Game over! You won!");
        return gameState;
    }

    return gameState;
}

// End player's turn
function endTurn(gameState) {
    gameState.playerTurn = false;
    gameState.gameLog.push("You ended your turn. Opponent is thinking...");

    // Simulate delay for opponent's turn
    setTimeout(() => {
        opponentTurn(gameState);
    }, 1000);

    return gameState;
}

// Reset game
function resetGame(userId) {
    delete gameStates[userId];
    return getOrCreateGame(userId);
}

exports.handle = (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const userId = req.session.user.id;

    if (req.method === 'GET') {
        // Render the game page
        return res.sendFile(path.resolve('views', 'play.html'));
    } else if (req.method === 'POST') {
        // Handle game actions via API calls
        const action = req.body.action;
        let gameState = getOrCreateGame(userId);

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
