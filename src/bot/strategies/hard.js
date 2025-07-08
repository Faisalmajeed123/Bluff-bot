export class MasterStrategy {
  constructor(personality) {
    this.personality = personality;
    this.failedChallengeCooldown = 0; // number of turns to wait after failed challenge
  }
  selectCardsToPlay(gameState, botCards, memory) {
    const lastValue = gameState.lastAction?.bluffText || null;
    const groups = this.groupCardsByValue(botCards);
    const stage = this.calculateGameStage(gameState);
    const otherCounts = this.estimateOtherPlayerCards(
      gameState,
      botCards,
      memory
    );

    /**
     * Utility to calculate a dynamic `toPlay` value
     */
    const computeToPlay = (available, remaining) => {
      const safePlay = Math.min(available, remaining);
      let toPlay = 1;

      if (stage < 0.3) {
        toPlay = Math.min(
          safePlay,
          1 + Math.floor(this.personality.riskTolerance * safePlay)
        );
      } else if (stage < 0.7) {
        toPlay = Math.min(
          safePlay,
          Math.ceil(safePlay / 2 + this.personality.riskTolerance * safePlay)
        );
      } else {
        toPlay = safePlay;
      }

      toPlay = Math.min(toPlay, available);
      toPlay = Math.max(toPlay, 1);

      return toPlay;
    };

    // Prefer honest play if possible (matching last declared value)
    if (lastValue && groups[lastValue]?.length > 0) {
      const available = groups[lastValue].length;
      const discards = this.countInDiscard(gameState, lastValue);
      const remaining = 4 - discards;

      const toPlay = computeToPlay(available, remaining);

      return {
        selectedCards: groups[lastValue].slice(0, toPlay),
        bluffText: lastValue,
      };
    }

    // Play largest group honestly
    let bestValue = null,
      maxCount = 0;

    for (const [val, cards] of Object.entries(groups)) {
      if (cards.length > maxCount) {
        bestValue = val;
        maxCount = cards.length;
      }
    }

    if (bestValue) {
      const available = groups[bestValue].length;
      const discards = this.countInDiscard(gameState, bestValue);
      const remaining = 4 - discards;

      const toPlay = computeToPlay(available, remaining);

      return {
        selectedCards: groups[bestValue].slice(0, toPlay),
        bluffText: bestValue,
      };
    }

    // If no good honest play → bluff
    const bluffValue = this.chooseBestBluff(
      gameState,
      botCards,
      memory,
      otherCounts
    );
    return {
      selectedCards: [botCards[0]],
      bluffText: bluffValue,
    };
  }

  decideChallenge(gameState, botCards, memory) {
    const last = gameState.lastAction;
    if (!last || last.type !== "place") return false;

    if (this.failedChallengeCooldown > 0) {
      this.failedChallengeCooldown--;
      return false;
    }

    const claimed = last.bluffText;
    const placed = last.cards.length;

    const ourCount = botCards.filter((c) => c.value === claimed).length;
    const discards = this.countInDiscard(gameState, claimed);
    const remaining = 4 - (ourCount + discards);

    const stage = this.calculateGameStage(gameState);
    const myCardsLeft = botCards.length;
    const opponent = gameState.players.find((p) => p.id === last.playerId);
    const theirCardsLeft = opponent?.cardCount || 0;

    const bluffProb = memory?.getPlayerBluffProbability(last.playerId) || 0.3;
    const trust = memory?.getPlayerTrustScore(last.playerId) || 0.5;

    // impossible claim: more cards placed than exist
    if (remaining < placed) {
      return true;
    }

    // perfectly plausible claim: exactly matches remaining
    if (remaining === placed) {
      return false; // no reason to suspect
    }

    let chance = 0;

    if (placed >= 3) {
      // Big play → suspicious but not impossible
      chance =
        (1 - trust) * 0.1 + // less trust → more suspicion
        (bluffProb - 0.3) * 0.1 +
        stage * 0.1;

      // if early game & plausible → even less suspicion
      if (stage < 0.3 && remaining >= placed) {
        chance *= 0.5;
      }
    } else {
      // normal play → very low chance
      chance = (1 - trust) * 0.05 + (bluffProb - 0.3) * 0.05 + stage * 0.05;
    }

    // further adjust by players’ positions
    if (theirCardsLeft > 5) chance *= 0.7;
    if (myCardsLeft <= 3) chance *= 0.7;

    // cap at a reasonable level if possible
    chance = Math.min(chance, 0.3);

    const decision = Math.random() < chance;

    if (decision) {
      this.failedChallengeCooldown = 2;
    }

    return decision;
  }

  chooseBestBluff(gameState, botCards, memory, otherCounts = null) {
    if (!otherCounts) {
      otherCounts = this.estimateOtherPlayerCards(gameState, botCards, memory);
    }

    const viable = Object.entries(otherCounts)
      .filter(([val, count]) => count > 0 && count < 4)
      .sort(([, a], [, b]) => a - b);

    if (viable.length > 0) {
      return viable[0][0];
    }

    const allVals = [
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
    return allVals[Math.floor(Math.random() * allVals.length)];
  }

  groupCardsByValue(cards) {
    const g = {};
    cards.forEach((c) => {
      if (!g[c.value]) g[c.value] = [];
      g[c.value].push(c);
    });
    return g;
  }

  estimateOtherPlayerCards(gameState, botCards, memory) {
    const counts = {};
    const vals = [
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
    vals.forEach((v) => (counts[v] = 4));

    botCards.forEach((c) => counts[c.value]--);
    gameState.discardPile.forEach((c) => counts[c.value]--);

    return counts;
  }

  countInDiscard(gameState, value) {
    return gameState.discardPile.filter((c) => c.value === value).length;
  }

  calculateGameStage(gameState) {
    const total = gameState.players.reduce((s, p) => s + p.cardCount, 0);
    const avg = total / gameState.players.length;
    const start = 52 / gameState.players.length;
    return 1 - avg / start;
  }
}

// export class AdvancedStrategy {
//   constructor(personality) {
//     this.personality = personality;
//   }

//   decideChallenge(gameState, botCards, memory) {
//     const lastAction = gameState.lastAction;
//     if (!lastAction || lastAction.type !== "place") return false;

//     const claimedValue = lastAction.bluffText;
//     const numCardsPlaced = lastAction.cards.length;

//     // Calculate key variables
//     const bluffRatio = memory?.getPlayerBluffProbability(lastAction.playerId) || 0.3;
//     const trustScore = memory?.getPlayerTrustScore(lastAction.playerId) || 0.5;
//     const cardProbability = this.calculateCardProbability(
//       claimedValue, numCardsPlaced, gameState, botCards
//     );
//     const gameStage = this.calculateGameStage(gameState);

//     const myCardCount = botCards.length;
//     const targetCardCount =
//       gameState.players.find(p => p.id === lastAction.playerId)?.cardCount || 0;

//     let challengeProbability =
//       0.1 + (this.personality.challengeProbabilityModifier || 0);

//     // Adjust by bluff ratio & trust
//     challengeProbability += (bluffRatio - 0.3) * 0.5; // higher bluffRatio => more likely to challenge
//     challengeProbability += (1 - trustScore) * 0.4;
//     challengeProbability += (1 - cardProbability) * 0.4;

//     // Adjust by game stage
//     if (gameStage < 0.2) challengeProbability -= 0.15; // early: cautious
//     else if (gameStage > 0.7) challengeProbability += 0.1; // late: aggressive

//     // Target close to winning
//     if (targetCardCount <= 3) challengeProbability += 0.2;

//     // Bot close to winning: more conservative
//     if (myCardCount <= 3) challengeProbability -= 0.2;

//     // Risk tolerance
//     const riskTolerance = this.personality.riskTolerance || 0.5;
//     challengeProbability *= riskTolerance * 1.5;

//     // Cap
//     challengeProbability = Math.min(Math.max(0.1, challengeProbability), 0.85);

//     // Small controlled randomness
//     const randomFactor = this.personality.randomnessFactor || 0;
//     challengeProbability += (Math.random() * 2 - 1) * randomFactor * 0.2;

//     return Math.random() < challengeProbability;
//   }

//   selectCardsAndBluff(gameState, botCards, memory) {
//     const lastPlayedValue = gameState.lastAction?.bluffText || null;

//     const cardGroups = this.groupCardsByValue(botCards);
//     const gameStage = this.calculateGameStage(gameState);
//     const otherPlayerCards = this.estimateOtherPlayerCards(gameState, botCards, memory);

//     // Prefer matching last declared if available
//     if (lastPlayedValue && cardGroups[lastPlayedValue]?.length > 0) {
//       const numToPlay = Math.min(
//         cardGroups[lastPlayedValue].length,
//         1 + Math.floor(Math.random() * Math.min(3, gameStage * 5))
//       );
//       const selectedCards = cardGroups[lastPlayedValue].slice(0, numToPlay);

//       const shouldBluff = this.shouldBluff(gameStage);

//       const bluffValue = shouldBluff
//         ? this.chooseOptimalBluffValue(gameState, otherPlayerCards, botCards, memory)
//         : lastPlayedValue;

//       return { selectedCards, bluffText: bluffValue };
//     }

//     // Otherwise, pick best group
//     const bestValue = this.chooseBestValue(cardGroups, gameStage, otherPlayerCards, memory);

//     const numToPlay = Math.min(
//       cardGroups[bestValue].length,
//       1 + Math.floor(Math.random() * Math.min(3, gameStage * 5))
//     );
//     const selectedCards = cardGroups[bestValue].slice(0, numToPlay);

//     const shouldBluff = this.shouldBluff(gameStage);

//     const bluffValue = shouldBluff
//       ? this.chooseOptimalBluffValue(gameState, otherPlayerCards, botCards, memory, bestValue)
//       : bestValue;

//     return { selectedCards, bluffText: bluffValue };
//   }

//   shouldBluff(gameStage) {
//     // Base bluff chance higher in mid/late game
//     let bluffChance = 0.2;
//     if (gameStage > 0.5) bluffChance += 0.2;
//     if (gameStage > 0.8) bluffChance += 0.1;

//     bluffChance += (this.personality.bluffProbabilityModifier || 0);

//     return Math.random() < bluffChance;
//   }

//   chooseBestValue(cardGroups, gameStage, otherPlayerCards, memory) {
//     const valueScores = new Map();

//     for (const [value, cards] of Object.entries(cardGroups)) {
//       if (cards.length === 0) continue;

//       let score = cards.length * 2; // prefer large groups
//       if (otherPlayerCards[value]) score -= otherPlayerCards[value] * 0.5;
//       if (gameStage > 0.7 && cards.length >= 3) score += 3;

//       if (memory?.gameHistory) {
//         const frequency = memory.gameHistory.filter(
//           a => a.type === 'place' && a.bluffText === value
//         ).length;
//         score += frequency * 0.5;
//       }

//       valueScores.set(value, score);
//     }

//     const sorted = [...valueScores.entries()].sort((a, b) => b[1] - a[1]);
//     return sorted[0]?.[0] || Object.keys(cardGroups)[0];
//   }

//   chooseOptimalBluffValue(gameState, otherPlayerCards, botCards, memory, avoidValue = null) {
//     const cardValues = [
//       "A","2","3","4","5","6","7","8","9","10","J","Q","K"
//     ];

//     const available = cardValues.filter(v => v !== avoidValue);

//     const bluffCandidates = available.filter(value => {
//       const playedCount = gameState.discardPile.filter(c => c.value === value).length;
//       return playedCount < 4;
//     });

//     return bluffCandidates[Math.floor(Math.random() * bluffCandidates.length)] ||
//            available[Math.floor(Math.random() * available.length)];
//   }

//   calculateCardProbability(claimedValue, numCardsPlaced, gameState, botCards) {
//     let probability = 0.7;

//     const countInHand = botCards.filter(c => c.value === claimedValue).length;
//     if (countInHand > 0) probability -= 0.1 * countInHand;

//     if (numCardsPlaced >= 3) probability -= 0.1 * (numCardsPlaced - 2);

//     const gameStage = this.calculateGameStage(gameState);
//     probability -= gameStage * 0.2;

//     return Math.max(0.1, Math.min(0.9, probability));
//   }

//   calculateGameStage(gameState) {
//     const initialCardsPerPlayer = 52 / gameState.players.length;
//     const avgCardsLeft =
//       gameState.players.reduce((sum, p) => sum + p.cardCount, 0) / gameState.players.length;

//     return 1 - avgCardsLeft / initialCardsPerPlayer;
//   }

//   groupCardsByValue(cards) {
//     const groups = {};
//     for (const card of cards) {
//       if (!groups[card.value]) groups[card.value] = [];
//       groups[card.value].push(card);
//     }
//     return groups;
//   }

//   estimateOtherPlayerCards(gameState, botCards, memory) {
//     const counts = {};
//     const cardValues = [
//       "A","2","3","4","5","6","7","8","9","10","J","Q","K"
//     ];
//     for (const v of cardValues) counts[v] = 4;

//     for (const c of botCards) {
//       if (counts[c.value]) counts[c.value]--;
//     }

//     if (memory?.cardCounts) {
//       Object.entries(memory.cardCounts).forEach(([v, c]) => {
//         counts[v] = c;
//       });
//     }

//     return counts;
//   }
// }
