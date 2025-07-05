export class IntermediateStrategy {
  constructor(personality, memorySystem) {
    this.personality = personality;
    this.memorySystem = memorySystem;
  }

  /**
   * Decides whether to challenge based on more complex heuristics
   */
  decideChallenge(gameState, botCards, memory) {
    const lastAction = gameState.lastAction;
    if (!lastAction || lastAction.type !== "place") return false;

    // Get the claimed card value and the number of cards placed
    const claimedValue = lastAction.bluffText;
    const numCardsPlaced = lastAction.cards.length;

    // Analyze previous moves to estimate if the opponent is bluffing
    let bluffRatio = 0.3; // Default assumption

    if (memory) {
      // Use memory to get player's bluff probability
      bluffRatio = memory.getPlayerBluffProbability(lastAction.playerId);
    }

    // Base challenge probability - adjusted by personality
    let challengeProbability =
      0.25 + (this.personality.challengeProbabilityModifier || 0);

    // If the bluff ratio is moderate (over 40%) and with a 50% chance, attempt to challenge
    if (bluffRatio > 0.4) {
      challengeProbability += 0.2;
    }

    // Increase probability if we have cards of the claimed value
    const cardsOfClaimedValue = botCards.filter(
      (card) => card.value === claimedValue
    ).length;
    if (cardsOfClaimedValue > 0) {
      challengeProbability += 0.1 * cardsOfClaimedValue;
    }

    // Increase probability if many cards were placed
    if (numCardsPlaced >= 3) {
      challengeProbability += 0.1 * (numCardsPlaced - 2);
    }

    // Cap probability
    challengeProbability = Math.min(Math.max(0.1, challengeProbability), 0.9);

    // Add some randomness based on personality
    const randomFactor = this.personality.randomnessFactor || 0;
    challengeProbability += (Math.random() * 2 - 1) * randomFactor;

    return Math.random() < challengeProbability;
  }

  /**
   * Chooses a strategic value to bluff for intermediate bots
   */
  chooseStrategicBluffValue(actualValue, gameState, botCards, memory) {
    const cardValues = [
      "A",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "J",
      "Q",
      "K",
    ];

    // Try to choose a value close to the actual value to be more believable
    const actualIndex = cardValues.indexOf(actualValue);

    if (actualIndex !== -1) {
      // Choose a value 1-2 steps away from actual value
      const offset = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
      const targetIndex = Math.max(
        0,
        Math.min(cardValues.length - 1, actualIndex + offset)
      );
      return cardValues[targetIndex];
    }

    // Fallback to random value
    return cardValues[Math.floor(Math.random() * cardValues.length)];
  }

  /**
   * Groups cards by their value
   */
  groupCardsByValue(cards) {
    const groups = {};

    for (const card of cards) {
      if (!groups[card.value]) {
        groups[card.value] = [];
      }
      groups[card.value].push(card);
    }

    return groups;
  }

  /**
   * Selects cards to play with intermediate strategy
   */
  selectCardsAndBluff(gameState, botCards, memory) {
    const lastPlayedValue = gameState.lastAction?.bluffText || null;

    // Group cards by value
    const cardGroups = this.groupCardsByValue(botCards);

    // Analyze previous moves to determine a promising card value
    const frequencyMap = {};
    if (memory && memory.gameHistory) {
      memory.gameHistory.forEach((action) => {
        if (action.type === "place" && action.bluffText) {
          frequencyMap[action.bluffText] =
            (frequencyMap[action.bluffText] || 0) + 1;
        }
      });
    }

    // Choose the most frequent value from the bot's available cards
    let bestValue = "";
    let maxFrequency = 0;

    for (const [value, cards] of Object.entries(cardGroups)) {
      if (frequencyMap[value] && frequencyMap[value] > maxFrequency) {
        bestValue = value;
        maxFrequency = frequencyMap[value];
      }
    }

    // If no best value found, use the group with the most cards
    if (!bestValue) {
      let maxCards = 0;
      for (const [value, cards] of Object.entries(cardGroups)) {
        if (cards.length > maxCards) {
          maxCards = cards.length;
          bestValue = value;
        }
      }
    }

    // Try to play cards that match the last played value if possible
    if (
      lastPlayedValue &&
      cardGroups[lastPlayedValue] &&
      cardGroups[lastPlayedValue].length > 0
    ) {
      const cardsOfValue = cardGroups[lastPlayedValue];
      const numToPlay = Math.min(
        cardsOfValue.length,
        1 + Math.floor(Math.random() * 2)
      );
      const selectedCards = cardsOfValue.slice(0, numToPlay);

      // With a 50% chance, decide to bluff
      const baseBluffProb = 0.3;
      const adjustedBluffProb =
        baseBluffProb + (this.personality.bluffProbabilityModifier || 0);
      const shouldBluff = Math.random() < adjustedBluffProb;

      if (shouldBluff) {
        // Bluff by choosing a plausible alternative declared value
        const possibleValues = [
          "A",
          "2",
          "3",
          "4",
          "5",
          "6",
          "7",
          "8",
          "9",
          "10",
          "J",
          "Q",
          "K",
        ];
        const bluffValue =
          possibleValues[Math.floor(Math.random() * possibleValues.length)];
        return { selectedCards, bluffText: bluffValue };
      } else {
        // Tell the truth
        return { selectedCards, bluffText: lastPlayedValue };
      }
    }

    // If we have a best value, play those cards
    if (
      bestValue &&
      cardGroups[bestValue] &&
      cardGroups[bestValue].length > 0
    ) {
      const cardsOfValue = cardGroups[bestValue];
      const numToPlay = Math.min(
        cardsOfValue.length,
        1 + Math.floor(Math.random() * 2)
      );
      const selectedCards = cardsOfValue.slice(0, numToPlay);

      // With a 50% chance, decide to bluff
      const baseBluffProb = 0.5;
      const adjustedBluffProb =
        baseBluffProb + (this.personality.bluffProbabilityModifier || 0);
      const shouldBluff =
        Math.random() < adjustedBluffProb ||
        (lastPlayedValue && bestValue !== lastPlayedValue);

      if (shouldBluff) {
        // If we need to follow the last played value, bluff that value
        const bluffValue =
          lastPlayedValue ||
          this.chooseStrategicBluffValue(
            bestValue,
            gameState,
            botCards,
            memory
          );
        return { selectedCards, bluffText: bluffValue };
      } else {
        // Tell the truth
        return { selectedCards, bluffText: bestValue };
      }
    }

    // Fallback - just play the first card
    return {
      selectedCards: [botCards[0]],
      bluffText: lastPlayedValue || botCards[0].value,
    };
  }
}
