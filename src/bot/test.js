import { BotPlayer } from "./bot.js";
import { Personalities } from "./personalities.js";

// Step 1: Create a bot player with beginner difficulty
const bot = new BotPlayer("bot-1", "Bot Beginner", "beginner");

// Step 2: Assign some cards to the bot (simulate bot hand)
bot.cards = [
  { value: "4", suit: "hearts" },
  { value: "5", suit: "spades" },
  { value: "7", suit: "clubs" },
  { value: "7", suit: "diamonds" },
];

// Step 3: Create a mock game state
const gameState = {
  currentPlayerId: "bot-1", // it's the bot's turn
  players: [
    { id: "bot-1", name: "Bot Beginner" },
    { id: "player-1", name: "You" },
  ],
  lastAction: {
    type: "place",
    playerId: "player-1",
    bluffText: "6", // opponent claims to have played a 6
    cards: [
      { value: "?", suit: "?" }, // unknown card, because it's face-down
    ],
  },
  discardPile: [
    { value: "6", suit: "hearts" },
    { value: "6", suit: "diamonds" },
    { value: "6", suit: "spades" },
  ],
};

// Step 4: Run the bot's decision logic
bot.decideAction(gameState);
