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

export const delayedCode = (cardset, roomCapacity, connectedClients) => {
  // Code to be executed after 2 seconds
  const partitionedCards = partitionCards(cardset, roomCapacity);

  // Iterate over the client array and assign subpartitions to each client
  connectedClients.forEach((client, index) => {
    const subpartition = partitionedCards[index]; // Get the corresponding subpartition
    console.log("SUBPARTITION: ", subpartition);
    // Emit the subpartition to the client
    client.emit("STO1C-DRAW-CARDS", subpartition);
  });
};
