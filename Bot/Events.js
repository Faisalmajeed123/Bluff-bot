import store from "../redux/store.js";
import { setNextTurn, recordBotMove, nextRound } from "../redux/slice.js";
import EventEmitter from "events";

const gameEvents = new EventEmitter();

const botIds = [1, 2, 3]; // List of bot IDs
let currentBotIndex = 0; // Track which bot is playing

// Monte Carlo function to determine AI move
const monteCarloMove = () => {
  const moves = ["raise", "move", "bluff"];
  const probabilities = [0.5, 0.4, 0.1]; // Higher chance to "raise" or "move" than "bluff"

  let random = Math.random();
  let cumulativeProbability = 0;

  for (let i = 0; i < moves.length; i++) {
    cumulativeProbability += probabilities[i];
    if (random < cumulativeProbability) {
      return moves[i];
    }
  }
  return moves[moves.length - 1]; // Default case
};

gameEvents.on("BotTurn", (botId) => {
  console.log(`🤖 Bot ${botId} is thinking...`);

  setTimeout(() => {
    const botMove = monteCarloMove();

    console.log(`🤖 Bot ${botId} chooses to: ${botMove}`);
    store.dispatch(recordBotMove({ botId, move: botMove }));
    gameEvents.emit("botPlayed", botId);
  }, 5000);
});
// Increase time accordingly

gameEvents.on("botPlayed", (botId) => {
  currentBotIndex++;
  if (currentBotIndex < botIds.length) {
    const nextBot = botIds[currentBotIndex];
    store.dispatch(setNextTurn(`Bot ${nextBot}`));
    gameEvents.emit("BotTurn", nextBot);
  } else {
    gameEvents.emit("roundOver");
  }
});

gameEvents.on("roundOver", () => {
  console.log("🔄 Round over! Next round starts...");

  setTimeout(() => {
    currentBotIndex = 0; // Reset for new round
    store.dispatch(nextRound()); // Update Redux state
    gameEvents.emit("playerTurn", "Player1");
  }, 2000);
});

// FOR HARD AND MEDIUM MODE

// const botMoveHistory = {
//   raise: { success: 0, fail: 0 },
//   move: { success: 0, fail: 0 },
//   bluff: { success: 0, fail: 0 },
// };

// const updateProbabilities = () => {
//   const totalAttempts = {
//     raise: botMoveHistory.raise.success + botMoveHistory.raise.fail + 1,
//     move: botMoveHistory.move.success + botMoveHistory.move.fail + 1,
//     bluff: botMoveHistory.bluff.success + botMoveHistory.bluff.fail + 1,
//   };

//   return {
//     raise: botMoveHistory.raise.success / totalAttempts.raise,
//     move: botMoveHistory.move.success / totalAttempts.move,
//     bluff: botMoveHistory.bluff.success / totalAttempts.bluff,
//   };
// };

// const monteCarloMove = () => {
//   const probabilities = updateProbabilities();
//   const moves = ["raise", "move", "bluff"];
//   let random = Math.random();
//   let cumulativeProbability = 0;

//   for (let i = 0; i < moves.length; i++) {
//     cumulativeProbability += probabilities[moves[i]];
//     if (random < cumulativeProbability) {
//       return moves[i];
//     }
//   }
//   return moves[moves.length - 1]; // Default case
// };

// gameEvents.on("botPlayed", (botId, outcome) => {
//     if (outcome === "win") {
//       botMoveHistory[botMove].success++;
//     } else {
//       botMoveHistory[botMove].fail++;
//     }

//     currentBotIndex++;
//     if (currentBotIndex < botIds.length) {
//       const nextBot = botIds[currentBotIndex];
//       gameEvents.emit("BotTurn", nextBot);
//     } else {
//       gameEvents.emit("roundOver");
//     }
//   });
