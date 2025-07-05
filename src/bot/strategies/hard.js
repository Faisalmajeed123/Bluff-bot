export class AdvancedStrategy {
  constructor(personality) {
    this.personality = personality;
  }

  /**
   * Checks if we suspect a player is bluffing
   */
  suspectBluff(lastAction, gameState, memory) {
    if (memory) {
      const bluffProb = memory.getPlayerBluffProbability(lastAction.playerId);
      return bluffProb > 0.6;
    }
    return false;
  }

  /**
   * Gets a trust score for a player based on past actions
   */
  getPlayerTrustScore(playerId, gameState) {
    // This is a simplified version used when memory system is not available
    return 0.5; // Neutral trust
  }

  /**
   * Calculates the probability that the claimed cards are truthful
   */
  calculateCardProbability(claimedValue, numCardsPlaced, gameState, botCards) {
    // Start with base probability
    let probability = 0.7;

    // Adjust based on how many of the claimed cards we have
    const cardsOfClaimedValue = botCards.filter(
      (card) => card.value === claimedValue
    ).length;
    const totalCardsOfValue = 4; // Assuming 4 cards of each value in a standard deck

    // If we have many of the claimed value, it's less likely the player is telling the truth
    if (cardsOfClaimedValue > 0) {
      probability -= 0.1 * cardsOfClaimedValue;
    }

    // If the player placed many cards, it's less likely they're all the claimed value
    if (numCardsPlaced >= 3) {
      probability -= 0.1 * (numCardsPlaced - 2);
    }

    // Adjust based on game stage - players bluff more in late game
    const gameStage = this.calculateGameStage(gameState);
    probability -= gameStage * 0.2;

    return Math.max(0.1, Math.min(0.9, probability));
  }
  /**
   * Decides whether to challenge based on complex analysis
   */
  decideChallenge(gameState, botCards, memory) {
    const lastAction = gameState.lastAction;
    if (!lastAction || lastAction.type !== "place") return false;

    // Get the claimed card value and the number of cards placed
    const claimedValue = lastAction.bluffText;
    const numCardsPlaced = lastAction.cards.length;

    // Special case: if the declared value is "Joker" and the bot suspects bluff, simply pass
    if (
      claimedValue === "joker" &&
      this.suspectBluff(lastAction, gameState, memory)
    ) {
      return false;
    }

    // Check if we have an opponent pattern for this player
    let bluffRatio = 0.3; // Default assumption

    if (memory) {
      // Use memory to get player's bluff probability
      bluffRatio = memory.getPlayerBluffProbability(lastAction.playerId);
    }

    // Base challenge probability - adjusted by personality
    let challengeProbability =
      0.2 + (this.personality.challengeProbabilityModifier || 0);

    // If the player frequently bluffs (bluff ratio > 0.6), increase challenge probability
    if (bluffRatio > 0.6) {
      challengeProbability += 0.3;
    }

    // Advanced bots use sophisticated analysis
    const playerTrustScore = memory
      ? memory.getPlayerTrustScore(lastAction.playerId)
      : this.getPlayerTrustScore(lastAction.playerId, gameState);

    const cardProbability = this.calculateCardProbability(
      claimedValue,
      numCardsPlaced,
      gameState,
      botCards
    );
    const gameStage = this.calculateGameStage(gameState);

    // Combine factors to make a decision
    challengeProbability += (1 - playerTrustScore) * 0.4;
    challengeProbability += (1 - cardProbability) * 0.3;

    // Adjust based on game stage
    if (gameStage < 0.3) {
      // Early game - challenge less
      challengeProbability -= 0.1;
    } else if (gameStage > 0.7) {
      // Late game - challenge more
      challengeProbability += 0.1;
    }

    // Strategic considerations
    const myCardCount = botCards.length;
    const targetCardCount =
      gameState.players.find((p) => p.id === lastAction.playerId)?.cardCount ||
      0;

    // If target is close to winning, challenge more
    if (targetCardCount <= 3) {
      challengeProbability += 0.2;
    }

    // If we're close to winning, be more cautious
    if (myCardCount <= 3) {
      challengeProbability -= 0.15;
    }

    // Risk tolerance based on personality
    const riskTolerance = this.personality.riskTolerance || 0.5;
    challengeProbability *= riskTolerance * 2;

    // Cap probability
    challengeProbability = Math.min(Math.max(0.1, challengeProbability), 0.9);

    // Add some randomness based on personality
    const randomFactor = this.personality.randomnessFactor || 0;
    challengeProbability += (Math.random() * 2 - 1) * randomFactor;

    return Math.random() < challengeProbability;
  }

  /**
   * Chooses the optimal value to bluff for advanced bots
   */
  chooseOptimalBluffValue(gameState, otherPlayerCards, botCards, memory) {
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
    const valueScores = new Map();

    for (const value of cardValues) {
      let score = 5; // Base score

      // Prefer values that we have (to make future plays easier)
      const ourCount = botCards.filter((card) => card.value === value).length;
      score += ourCount * 2;

      // Avoid values that others might have many of
      if (otherPlayerCards[value]) {
        score -= otherPlayerCards[value];
      }

      // Use memory for more sophisticated analysis if available
      if (memory && memory.gameHistory) {
        // Prefer values that have been played recently (more believable)
        const recentActions = memory.gameHistory.slice(-5);
        for (const action of recentActions) {
          if (action.type === "place" && action.bluffText === value) {
            score += 1;
          }
        }
      }

      valueScores.set(value, score);
    }

    // Sort values by score
    const sortedValues = Array.from(valueScores.entries())
      .sort(([_, scoreA], [__, scoreB]) => scoreB - scoreA)
      .map(([value, _]) => value);

    // Choose one of the top 3 values with some randomness
    const topIndex = Math.min(2, Math.floor(Math.random() * 3));
    return (
      sortedValues[topIndex] ||
      cardValues[Math.floor(Math.random() * cardValues.length)]
    );
  }

  /**
   * Estimates how many cards of each value other players might have
   */
  estimateOtherPlayerCards(gameState, botCards, memory) {
    const cardCounts = {};
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

    // Initialize with 4 of each value (standard deck)
    for (const value of cardValues) {
      cardCounts[value] = 4;
    }

    // Subtract our own cards
    for (const card of botCards) {
      if (cardCounts[card.value]) {
        cardCounts[card.value]--;
      }
    }

    // Use memory for more accurate estimation if available
    if (memory && memory.cardCounts) {
      // Use memory's card counts which are updated based on revealed cards
      for (const [value, count] of Object.entries(memory.cardCounts)) {
        cardCounts[value] = count;
      }
    }

    return cardCounts;
  }

  /**
   * Calculates the current stage of the game (0-1)
   */
  calculateGameStage(gameState) {
    // Estimate game stage based on cards left
    const initialCardsPerPlayer = 52 / gameState.players.length;
    const averageCardsLeft =
      gameState.players.reduce((sum, player) => sum + player.cardCount, 0) /
      gameState.players.length;

    // Game stage from 0 (start) to 1 (end)
    return 1 - averageCardsLeft / initialCardsPerPlayer;
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
   * Selects cards to play with advanced strategy
   */
  selectCardsAndBluff(gameState, botCards, memory) {
    const lastPlayedValue = gameState.lastAction?.bluffText || null;

    // Group cards by value
    const cardGroups = this.groupCardsByValue(botCards);

    // Calculate the optimal play based on game state
    const gameStage = memory
      ? memory.calculateGameStage(gameState)
      : this.calculateGameStage(gameState);
    const otherPlayerCards = this.estimateOtherPlayerCards(
      gameState,
      botCards,
      memory
    );

    // Hard mode: If the bot can match the opponent's last declared value, play that
    if (
      lastPlayedValue &&
      cardGroups[lastPlayedValue] &&
      cardGroups[lastPlayedValue].length > 0
    ) {
      const matchingCards = cardGroups[lastPlayedValue];
      const numToPlay = Math.min(
        matchingCards.length,
        1 + Math.floor(Math.random() * Math.min(3, gameStage * 5))
      );
      const selectedCards = matchingCards.slice(0, numToPlay);

      // With high likelihood, use bluffing smartly
      const baseBluffProb = 0.4;
      const adjustedBluffProb =
        baseBluffProb + (this.personality.bluffProbabilityModifier || 0);
      const shouldBluff = Math.random() < adjustedBluffProb;

      if (shouldBluff) {
        const bluffValue = this.chooseOptimalBluffValue(
          gameState,
          otherPlayerCards,
          botCards,
          memory
        );
        return { selectedCards, bluffText: bluffValue };
      } else {
        return { selectedCards, bluffText: lastPlayedValue };
      }
    }

    // Otherwise, use previous moves to select an optimal card
    const frequencyMap = {};
    if (memory && memory.gameHistory) {
      memory.gameHistory.forEach((action) => {
        if (action.type === "place" && action.bluffText) {
          frequencyMap[action.bluffText] =
            (frequencyMap[action.bluffText] || 0) + 1;
        }
      });
    }

    // Calculate a score for each card group
    const valueScores = new Map();

    for (const [value, cards] of Object.entries(cardGroups)) {
      if (cards.length === 0) continue;

      // Calculate a score for each card group based on various factors
      let score = cards.length * 2; // Prefer groups with more cards

      // Adjust score based on estimated cards in play
      if (otherPlayerCards[value]) {
        score -= otherPlayerCards[value] * 0.5; // Lower score if many of this value are out
      }

      // Adjust score based on game stage
      if (gameStage > 0.7 && cards.length >= 3) {
        score += 3; // In late game, prefer to get rid of large groups
      }

      // Adjust score based on frequency in previous moves
      if (frequencyMap[value]) {
        score += frequencyMap[value] * 0.5;
      }

      valueScores.set(value, score);
    }

    // Sort values by score
    const sortedValues = Array.from(valueScores.entries())
      .sort(([_, scoreA], [__, scoreB]) => scoreB - scoreA)
      .map(([value, _]) => value);

    if (sortedValues.length > 0) {
      const bestValue = sortedValues[0];

      // Advanced bots might play more cards at once in later stages
      const numToPlay = Math.min(
        cardGroups[bestValue].length,
        1 + Math.floor(Math.random() * Math.min(3, gameStage * 5))
      );

      const selectedCards = cardGroups[bestValue].slice(0, numToPlay);

      // With high likelihood, use bluffing smartly
      const baseBluffProb = 0.7;
      const adjustedBluffProb =
        baseBluffProb + (this.personality.bluffProbabilityModifier || 0);
      const shouldBluff =
        Math.random() < adjustedBluffProb ||
        (lastPlayedValue && bestValue !== lastPlayedValue);

      if (shouldBluff) {
        // Choose a declared value from recent moves or optimal bluff value
        const bluffValue =
          lastPlayedValue ||
          this.chooseOptimalBluffValue(
            gameState,
            otherPlayerCards,
            botCards,
            memory
          );

        // Avoid matching the actual card value if bluffing
        if (bestValue === bluffValue) {
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
          const alternatives = cardValues.filter((v) => v !== bestValue);
          const alternativeBluff =
            alternatives[Math.floor(Math.random() * alternatives.length)];
          return { selectedCards, bluffText: alternativeBluff };
        }

        return { selectedCards, bluffText: bluffValue };
      } else {
        // Play honestly using the best card
        return { selectedCards, bluffText: bestValue };
      }
    }

    // Fallback
    return {
      selectedCards: [botCards[0]],
      bluffText:
        lastPlayedValue ||
        this.chooseOptimalBluffValue(
          gameState,
          otherPlayerCards,
          botCards,
          memory
        ),
    };
  }
}
