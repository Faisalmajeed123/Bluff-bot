// MEDIUM & HARD MODE
const botMoveHistories = {};
const opponentMoveHistory = { bluff: { success: 0, fail: 0 } };
let qWorkers = {};

// Initialize
const initializeBot = (botId) => {
  botMoveHistories[botId] = {
    raise: { success: 0, fail: 0 },
    move: { success: 0, fail: 0 },
    bluff: { success: 0, fail: 0 },
  };

  qWorkers[botId] = new Worker("qLearningWorker.js");
};

const updateMediumModeProbabilities = (botId) => {
  const history = botMoveHistories[botId];

  const totalAttempts = {
    raise: history.raise.success + history.raise.fail + 1,
    move: history.move.success + history.move.fail + 1,
    bluff: history.bluff.success + history.bluff.fail + 1,
  };

  let probabilities = {
    raise: history.raise.success / totalAttempts.raise,
    move: history.move.success / totalAttempts.move,
    bluff: history.bluff.success / totalAttempts.bluff,
  };

  const bluffSuccessRate =
    opponentMoveHistory.bluff.success /
    (opponentMoveHistory.bluff.success + opponentMoveHistory.bluff.fail + 1);

  if (bluffSuccessRate > 0.6) {
    probabilities.raise += 0.1;
    probabilities.move -= 0.05;
    probabilities.bluff -= 0.05;
  } else if (bluffSuccessRate < 0.3) {
    probabilities.bluff += 0.1;
    probabilities.raise -= 0.05;
    probabilities.move -= 0.05;
  }

  const total = probabilities.raise + probabilities.move + probabilities.bluff;
  probabilities.raise /= total;
  probabilities.move /= total;
  probabilities.bluff /= total;

  return probabilities;
};

//Medium Mode
const monteCarloMove = (botId) => {
  const probabilities = updateMediumModeProbabilities(botId);
  const moves = ["raise", "move", "bluff"];
  let random = Math.random();
  let cumulativeProbability = 0;

  for (let i = 0; i < moves.length; i++) {
    cumulativeProbability += probabilities[moves[i]];
    if (random < cumulativeProbability) {
      return moves[i];
    }
  }
  return moves[moves.length - 1];
};

// Hard Mode
const selectBotMove = (botId, difficulty) => {
  if (difficulty === "hard") {
    qWorkers[botId].postMessage({ type: "getQMove" });

    return new Promise((resolve) => {
      qWorkers[botId].onmessage = (event) => {
        if (event.data.type === "qMove") {
          resolve(event.data.move);
        }
      };
    });
  }
  return Promise.resolve(monteCarloMove(botId));
};

let currentBotIndex = 0;
const botIds = ["bot1", "bot2", "bot3", "bot4"];

botIds.forEach((botId) => initializeBot(botId));

gameEvents.on("botPlayed", async (botId, botMove, outcome, opponentMove) => {
  if (outcome === "win") {
    botMoveHistories[botId][botMove].success++;
  } else {
    botMoveHistories[botId][botMove].fail++;
  }

  if (opponentMove === "bluff") {
    if (outcome === "lose") {
      opponentMoveHistory.bluff.fail++;
    } else {
      opponentMoveHistory.bluff.success++;
    }
  }

  if (currentDifficulty === "hard") {
    qWorkers[botId].postMessage({
      type: "updateQValues",
      move: botMove,
      outcome,
    });
  }

  currentBotIndex++;
  if (currentBotIndex < botIds.length) {
    const nextBot = botIds[currentBotIndex];
    const nextMove = await selectBotMove(nextBot, currentDifficulty);
    gameEvents.emit("BotTurn", nextBot, nextMove);
  } else {
    gameEvents.emit("roundOver");
    currentBotIndex = 0; //reset
  }
});
