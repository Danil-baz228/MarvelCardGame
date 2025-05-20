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
                         player2_id INT NOT NULL,
                         winner_id INT DEFAULT NULL,
                         started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                         ended_at DATETIME DEFAULT NULL,
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
