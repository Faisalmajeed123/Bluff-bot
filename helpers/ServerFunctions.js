module.exports = {
  partitionCards: (cardset, roomCapacity) => {
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
  },
  // this () will distribute the cards to the players like if 4 players then it will take shuffle cards [] of 52
  // cards and distribute them to 4 players by first 13 cards to next 13 to another and so on.
  // partitionedCards= [0-13,13-26,26-39, 39-52]

  // Function to be executed after 2 seconds
  delayedCode: (cardset, roomCapacity, connectedClients) => {
    // Code to be executed after 2 seconds
    const partitionedCards = module.exports.partitionCards(
      cardset,
      roomCapacity
    );
    // Iterate over the client array and assign subpartitions to each client
    connectedClients.forEach((client, index) => {
      const subpartition = partitionedCards[index]; // Get the corresponding subpartition
      console.log("SUBPARTITION: ", subpartition);
      // Emit the subpartition to the client
      client.emit("STO1C-DRAW-CARDS", subpartition);
    });
  },
};
