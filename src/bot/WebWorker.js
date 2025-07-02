// Q-learning constants
const alpha = 0.1; // How much new information affects the Q-table
const gamma = 0.9; // How much future rewards are considered
const epsilon = 0.2; // Chance to explore a random move

const QTable = {
  raise: 0,
  move: 0,
  bluff: 0,
};

// Choose move using epsilon-greedy strategy
const getQMove = () => {
  const moves = ["raise", "move", "bluff"];
  if (Math.random() < epsilon) {
    // Explore: pick a random move
    return moves[Math.floor(Math.random() * moves.length)];
  }
  // Exploit: pick the move with the highest Q-value
  return moves.reduce(
    (bestMove, currentMove) =>
      QTable[currentMove] > QTable[bestMove] ? currentMove : bestMove,
    moves[0]
  );
};

// Update Q-values based on move outcome
const updateQValues = (move, outcome) => {
  const reward = outcome === "win" ? 1 : -1; // Win gives +1, loss gives -1
  const nextMaxQ = Math.max(...Object.values(QTable)); // Max Q-value for future moves
  QTable[move] =
    QTable[move] + alpha * (reward + gamma * nextMaxQ - QTable[move]); // Update Q-value

  // Send updated Q-table back
  postMessage({ type: "updateQValues", qTable: QTable });
};

// Handle incoming messages
onmessage = (event) => {
  if (event.data.type === "getQMove") {
    postMessage({ type: "qMove", move: getQMove() });
  } else if (event.data.type === "updateQValues") {
    updateQValues(event.data.move, event.data.outcome);
  }
};
