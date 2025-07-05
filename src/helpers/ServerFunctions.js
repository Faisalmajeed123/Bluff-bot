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

export const delayedCode = (
  cardset,
  roomCapacity,
  connectedClients,
  rooms,
  roomId
) => {
  const partitionedCards = partitionCards(cardset, roomCapacity);
  rooms[roomId].playerCards = {};

  connectedClients.slice(0, roomCapacity).forEach((client, index) => {
    const playerCards = partitionedCards[index];
    rooms[roomId].playerCards[client.id] = playerCards;

    if (client.isBot) {
      client.botInstance.cards = playerCards;
    } else {
      client.socket.emit("STO1C-DRAW-CARDS", playerCards);
    }
  });
};
