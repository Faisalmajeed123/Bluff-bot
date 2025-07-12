export class MemorySystem {
  constructor(adaptiveRate = 0.2) {
    this.playerProfiles = new Map(); // Stores data about each player
    this.gameHistory = []; // Stores recent game actions
    this.adaptiveRate = adaptiveRate; // How quickly the bot adapts (0-1)
    this.cardCounts = {}; // Tracks cards that have been seen
    this.roundsSinceReset = 0;
  }

  /**
   * Initializes the memory system with player IDs
   */
  initializePlayers(playerIds) {
    playerIds.forEach((id) => {
      if (!this.playerProfiles.has(id)) {
        this.playerProfiles.set(id, {
          id,
          bluffFrequency: 0.5, // Initial assumption: 50% bluff rate
          challengeFrequency: 0.5,
          successfulBluffs: 0,
          failedBluffs: 0,
          successfulChallenges: 0,
          failedChallenges: 0,
          totalActions: 0,
          recentActions: [],
          cardPlayPatterns: {}, // Tracks patterns in card plays
          trustScore: 0.5, // 0 = never trust, 1 = always trust
        });
      }
    });

    // Initialize card counts
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
    cardValues.forEach((value) => {
      this.cardCounts[value] = 4; // 4 of each card in a standard deck
    });
  }

  /**
   * Records a game action and updates player profiles
   */
  recordAction(action, wasBluff = null) {
    // Add to game history
    this.gameHistory.push({
      ...action,
      timestamp: Date.now(),
      wasBluff,
    });

    // Keep history manageable
    if (this.gameHistory.length > 50) {
      this.gameHistory.shift();
    }

    // Update player profile
    if (this.playerProfiles.has(action.playerId)) {
      const profile = this.playerProfiles.get(action.playerId);
      profile.totalActions++;
      profile.recentActions.push(action);

      // Keep recent actions manageable
      if (profile.recentActions.length > 10) {
        profile.recentActions.shift();
      }

      // Update bluff statistics if we know if it was a bluff
      if (action.type === "place" && wasBluff !== null) {
        if (wasBluff) {
          profile.successfulBluffs++;
          profile.bluffFrequency = this.updateFrequency(
            profile.bluffFrequency,
            profile.successfulBluffs /
              (profile.successfulBluffs + profile.failedBluffs)
          );
          profile.trustScore = Math.max(
            0.1,
            profile.trustScore - this.adaptiveRate * 0.2
          );
        } else {
          profile.failedBluffs++;
          profile.trustScore = Math.min(
            0.9,
            profile.trustScore + this.adaptiveRate * 0.1
          );
        }
      }

      // Update challenge statistics
      if (action.type === "raise" && action.wasSuccessful !== undefined) {
        if (action.wasSuccessful) {
          profile.successfulChallenges++;
        } else {
          profile.failedChallenges++;
        }

        profile.challengeFrequency = this.updateFrequency(
          profile.challengeFrequency,
          profile.successfulChallenges /
            (profile.successfulChallenges + profile.failedChallenges || 1)
        );
      }

      // Update card play patterns
      if (action.type === "place" && action.bluffText) {
        if (!profile.cardPlayPatterns[action.bluffText]) {
          profile.cardPlayPatterns[action.bluffText] = {
            count: 0,
            wasBluff: 0,
          };
        }

        profile.cardPlayPatterns[action.bluffText].count++;
        if (wasBluff) {
          profile.cardPlayPatterns[action.bluffText].wasBluff++;
        }
      }

      this.playerProfiles.set(action.playerId, profile);
    }

    // Update card counts if cards were revealed
    if (action.type === "place" && action.cards && wasBluff !== null) {
      action.cards.forEach((card) => {
        const actualValue = card.value;
        if (this.cardCounts[actualValue] && this.cardCounts[actualValue] > 0) {
          this.cardCounts[actualValue]--;
        }
      });
    }

    this.roundsSinceReset++;
  }

  /**
   * Updates a frequency value with adaptive learning
   */
  updateFrequency(currentValue, newObservation) {
    return (
      currentValue * (1 - this.adaptiveRate) +
      newObservation * this.adaptiveRate
    );
  }

  /**
   * Gets a player's bluff probability based on history
   */
  getPlayerBluffProbability(playerId) {
    if (!this.playerProfiles.has(playerId)) {
      return 0.5; // Default if no data
    }

    const profile = this.playerProfiles.get(playerId);

    // If we have enough data, use the calculated bluff frequency
    if (profile.successfulBluffs + profile.failedBluffs >= 3) {
      return profile.bluffFrequency;
    }

    // Otherwise use a default with a slight adjustment based on limited data
    return 0.5 + (profile.successfulBluffs - profile.failedBluffs) * 0.05;
  }

  /**
   * Gets a player's trust score (how likely they are to tell the truth)
   */
  getPlayerTrustScore(playerId) {
    if (!this.playerProfiles.has(playerId)) {
      return 0.5; // Default if no data
    }

    return this.playerProfiles.get(playerId).trustScore;
  }

  /**
   * Gets the probability that a specific card value is being bluffed
   */
  getCardBluffProbability(playerId, cardValue, cardCount) {
    if (!this.playerProfiles.has(playerId)) {
      return 0.5; // Default if no data
    }

    const profile = this.playerProfiles.get(playerId);

    // Check if we have pattern data for this card value
    if (profile.cardPlayPatterns[cardValue]) {
      const pattern = profile.cardPlayPatterns[cardValue];
      if (pattern.count > 0) {
        return pattern.wasBluff / pattern.count;
      }
    }

    // Factor in how many of this card are likely still in play
    const remainingCards = this.cardCounts[cardValue] || 0;
    const cardScarcity = 1 - remainingCards / 4; // 0 = all cards available, 1 = no cards available

    // Combine player's general bluff rate with card scarcity
    const baseBluffProb = this.getPlayerBluffProbability(playerId);
    return baseBluffProb * 0.7 + cardScarcity * 0.3;
  }

  /**
   * Analyzes recent game state to detect patterns
   */
  analyzeGameState(gameState) {
    // Calculate how many rounds have passed
    const roundCount = Math.floor(
      this.gameHistory.length / gameState.players.length
    );

    // Detect if the game is in early, mid, or late stage
    const gameStage = this.calculateGameStage(gameState);

    // Analyze player behavior changes as the game progresses
    const playerBehaviorChanges = {};
    this.playerProfiles.forEach((profile, playerId) => {
      // Skip if not enough data
      if (profile.totalActions < 5) return;

      // Compare early game vs recent actions
      const earlyActions = this.gameHistory
        .filter((a) => a.playerId === playerId)
        .slice(0, Math.min(5, profile.totalActions / 2));

      const recentActions = profile.recentActions.slice(-5);

      // Calculate if player is bluffing more or less as game progresses
      const earlyBluffRate =
        earlyActions.filter((a) => a.wasBluff).length / earlyActions.length;
      const recentBluffRate =
        recentActions.filter((a) => a.wasBluff).length / recentActions.length;

      playerBehaviorChanges[playerId] = {
        bluffRateChange: recentBluffRate - earlyBluffRate,
        isMoreAggressive: recentBluffRate > earlyBluffRate,
        isMoreCautious: recentBluffRate < earlyBluffRate,
      };
    });

    return {
      gameStage,
      roundCount,
      playerBehaviorChanges,
    };
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
   * Resets the memory system for a new game
   */
  reset() {
    this.gameHistory = [];
    this.playerProfiles.clear();
    this.roundsSinceReset = 0;

    // Reset card counts
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
    cardValues.forEach((value) => {
      this.cardCounts[value] = 4;
    });
  }
}
