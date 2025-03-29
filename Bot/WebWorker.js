const alpha = 0.1; // Learning rate(controls how much new information affects the Q-table)
const gamma = 0.9; // Discount factor(determines how much future rewards matter)
const epsilon = 0.2; // Exploration probability

const QTable = {
  raise: 0,
  move: 0,
  bluff: 0,
};

const getQMove = () => {
  const moves = ["raise", "move", "bluff"];
  if (Math.random() < epsilon) {
    return moves[Math.floor(Math.random() * moves.length)]; // for exploration(random value)
  }
  return moves.reduce(
    (bestMove, currentMove) =>
      QTable[currentMove] > QTable[bestMove] ? currentMove : bestMove,
    moves[0] //for exploitation(highest Q-value)
  );
};

const updateQValues = (move, outcome) => {
  const reward = outcome === "win" ? 1 : -1;
  const nextMaxQ = Math.max(...Object.values(QTable));
  QTable[move] =
    QTable[move] + alpha * (reward + gamma * nextMaxQ - QTable[move]);

  postMessage({ type: "updateQValues", qTable: QTable });
};

onmessage = (event) => {
  if (event.data.type === "getQMove") {
    postMessage({ type: "qMove", move: getQMove() });
  } else if (event.data.type === "updateQValues") {
    updateQValues(event.data.move, event.data.outcome);
  }
};
