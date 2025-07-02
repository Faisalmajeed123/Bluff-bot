export const partitionCards = (cardset, roomCapacity) => {
  const totalCards = cardset.length;
  const cardsPerPlayer = Math.floor(totalCards / roomCapacity);
  console.log("PERPLAYER", cardsPerPlayer);
  const partitionedCards = [];

  for (let i = 0; i < roomCapacity; i++) {
    const start = i * cardsPerPlayer;
    const end = (i + 1) * cardsPerPlayer;
    partitionedCards.push(cardset.slice(start, end));
  }
  return partitionedCards;
};

// Function to distribute cards among players
// partitionedCards = [0-13, 13-26, 26-39, 39-52]

export const delayedCode = (
  cardset,
  roomCapacity,
  connectedClients,
  rooms,
  roomId
) => {
  const partitionedCards = partitionCards(cardset, roomCapacity);
  rooms[roomId].playerCards = {};

  connectedClients.forEach((client, index) => {
    const playerCards = partitionedCards[index];
    rooms[roomId].playerCards[client.id] = playerCards;

    client.emit("STO1C-DRAW-CARDS", playerCards);
  });
};
