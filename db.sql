DROP DATABASE IF EXISTS great_battle;


CREATE DATABASE great_battle;
USE great_battle;

CREATE TABLE users (
                       id INT AUTO_INCREMENT PRIMARY KEY,
                       username VARCHAR(50) UNIQUE NOT NULL,
                       password_hash VARCHAR(255) NOT NULL,
                       email VARCHAR(100) UNIQUE NOT NULL,
                       avatar_url VARCHAR(255),
                       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE cards (
                       id INT AUTO_INCREMENT PRIMARY KEY,
                       name VARCHAR(100) NOT NULL,
                       image_url VARCHAR(255),
                       attack INT NOT NULL,
                       defense INT NOT NULL,
                       cost INT NOT NULL
);

CREATE TABLE matches (
                         id INT AUTO_INCREMENT PRIMARY KEY,
                         player1_id INT NOT NULL,
                         player2_id INT DEFAULT NULL,
                         winner_id INT DEFAULT NULL,
                         started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                         ended_at DATETIME DEFAULT NULL,
                         current_turn_id INT DEFAULT NULL,
                         FOREIGN KEY (player1_id) REFERENCES users(id),
                         FOREIGN KEY (player2_id) REFERENCES users(id),
                         FOREIGN KEY (winner_id) REFERENCES users(id)
);


CREATE TABLE match_cards (
                             id INT AUTO_INCREMENT PRIMARY KEY,
                             match_id INT NOT NULL,
                             user_id INT NOT NULL,
                             card_id INT NOT NULL,
                             in_hand BOOLEAN DEFAULT TRUE,
                             FOREIGN KEY (match_id) REFERENCES matches(id),
                             FOREIGN KEY (user_id) REFERENCES users(id),
                             FOREIGN KEY (card_id) REFERENCES cards(id)
);


INSERT INTO cards (id, name, image_url, attack, defense, cost) VALUES
                                                                   (1, 'Banshee', '/cardsimg/banshee.jpg', 3, 3, 2),
                                                                   (2, 'Beast', '/cardsimg/Beast.jpg', 3, 3, 2),
                                                                   (3, 'Blackwidow', '/cardsimg/blackwidow.jpg', 5, 4, 2),
                                                                   (4, 'Brucebanner', '/cardsimg/brucebanner.jpg', 3, 3, 2),
                                                                   (5, 'Captainamerica', '/cardsimg/captainamerica.jpg', 9, 8, 4),
                                                                   (6, 'Colossus', '/cardsimg/colossus.jpg', 7, 8, 4),
                                                                   (7, 'Falcon', '/cardsimg/falcon.jpg', 2, 2, 1),
                                                                   (8, 'Ghostrider', '/cardsimg/ghostrider.jpg', 9, 7, 4),
                                                                   (9, 'Hulk', '/cardsimg/hulk.jpg', 7, 7, 4),
                                                                   (10, 'Ironman', '/cardsimg/ironman.jpg', 10, 7, 5),
                                                                   (11, 'Loki', '/cardsimg/loki.jpg', 5, 4, 2),
                                                                   (12, 'Mystique', '/cardsimg/mystique.jpg', 6, 5, 2),
                                                                   (13, 'Nova', '/cardsimg/nova.jpg', 5, 4, 2),
                                                                   (14, 'Redskull', '/cardsimg/redskull.jpg', 6, 5, 2),
                                                                   (15, 'Silversurfer', '/cardsimg/silversurfer.jpg', 4, 3, 2),
                                                                   (16, 'Spiderman', '/cardsimg/spiderman.jpg', 4, 3, 3),
                                                                   (17, 'Storm', '/cardsimg/storm.jpg', 6, 5, 3),
                                                                   (18, 'Thor', '/cardsimg/thor.jpg', 7, 7, 4),
                                                                   (19, 'Vulture', '/cardsimg/vulture.jpg', 5, 4, 3),
                                                                   (20, 'Wolverine', '/cardsimg/wolverine.jpg', 4, 3, 3);
