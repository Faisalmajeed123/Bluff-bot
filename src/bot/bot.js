// Enhanced Bot player implementation for Accessible-Bluff game
import { MemorySystem } from "./memories.js";
import { getPersonalityForDifficulty, Personalities } from "./personalities.js";
import { BeginnerStrategy } from "./strategies/easy.js";
import { IntermediateStrategy } from "./strategies/medium.js";
import { AdvancedStrategy } from "./strategies/hard.js";

export class BotPlayer {
  constructor(id, name, difficultyLevel) {
    this.id = id;
    this.name = name;
    this.difficultyLevel = difficultyLevel;
    this.cards = [];
    this.gameHistory = [];
    this.isActive = true;
    this.inactiveRounds = 0;

    // Initialize personality based on difficulty
    this.personality = getPersonalityForDifficulty(difficultyLevel);
    console.log("PERSONALITY: ", this.personality);

    // Initialize memory system with adaptive rate based on personality
    this.memory = new MemorySystem(this.personality.adaptiveRate || 0.2);
    console.log("MEMORY: ", this.memory);

    // Initialize strategy based on difficulty
    this.strategy = this.initializeStrategy();
    console.log("STRATEGY: ", this.strategy);

    // Track consecutive actions to avoid repetitive behavior
    this.consecutiveActions = {
      type: null,
      count: 0,
    };
  }

  /**
   * Initialize the appropriate strategy based on difficulty level
   */
  initializeStrategy() {
    switch (this.difficultyLevel) {
      case "beginner":
        return new BeginnerStrategy(this.personality);
      case "intermediate":
        return new IntermediateStrategy(this.personality);
      case "advanced":
        return new AdvancedStrategy(this.personality);
      default:
        return new BeginnerStrategy(this.personality);
    }
  }

  decideAction(gameState) {
    return new Promise((resolve) => {
      // Add a small delay to make the bot's actions feel more natural
      setTimeout(() => {
        if (this.memory.playerProfiles.size === 0) {
          this.memory.initializePlayers(gameState.players.map((p) => p.id));
        }

        // Update game history
        if (gameState.lastAction) {
          this.gameHistory.push(gameState.lastAction);

          // Update memory with the last action
          // We don't know if it was a bluff yet unless it was challenged
          const wasBluff =
            gameState.lastAction.wasSuccessful !== undefined
              ? gameState.lastAction.wasSuccessful
              : null;
          this.memory.recordAction(gameState.lastAction, wasBluff);
        }

        if (
          gameState.lastAction?.type === "place" &&
          gameState.lastAction.playerId !== this.id
        ) {
          const shouldChallenge = this.strategy.decideChallenge(
            gameState,
            this.cards,
            this.memory
          );

          console.log(
            "------------------------------------------",
            shouldChallenge
          );
          if (shouldChallenge) {
            // Avoid too many consecutive challenges
            if (this.consecutiveActions.type === "raise") {
              this.consecutiveActions.count++;
              if (this.consecutiveActions.count > 2) {
                // After 2 consecutive challenges, reduce challenge probability
                if (Math.random() < 0.7) {
                  this.consecutiveActions.count = 0;
                  return resolve({ type: "pass", playerId: this.id });
                }
              }
            } else {
              this.consecutiveActions = { type: "raise", count: 1 };
            }

            return resolve({
              type: "raise",
              playerId: this.id,
            });
          }
        }

        // If it's not the bot's turn, just pass
        if (gameState.currentPlayerId !== this.id) {
          return resolve({ type: "pass", playerId: this.id });
        }

        console.log("--------------------------", this.cards.length);
        // If it's the bot's turn, decide whether to place cards or pass
        if (this.cards.length === 0) {
          return resolve({ type: "pass", playerId: this.id });
        }

        // Decide whether to place or pass based on personality and game state
        const basePassProbability = 0.2; // 20%
        let adjustedPassProbability = basePassProbability;

        // Cautious personalities pass more often
        if (this.personality === Personalities.CAUTIOUS) {
          adjustedPassProbability += 0.1;
        }

        // Aggressive personalities pass less often
        if (this.personality === Personalities.AGGRESSIVE) {
          adjustedPassProbability -= 0.1;
        }

        // Avoid too many consecutive passes
        if (this.consecutiveActions.type === "pass") {
          this.consecutiveActions.count++;
          if (this.consecutiveActions.count > 1) {
            // After 1 consecutive pass, reduce pass probability
            adjustedPassProbability -= 0.15 * this.consecutiveActions.count;
          }
        }

        // Smart pass decision based on real card knowledge
        const declaredValue = gameState.lastAction?.bluffText;
        const hasDeclaredCard = this.cards.some(
          (c) => c.value === declaredValue
        );
        const alreadyPlayedCount = gameState.discardPile.filter(
          (c) => c.value === declaredValue
        ).length;

        console.log("Bot hasDeclaredCard:", hasDeclaredCard);
        console.log("alreadyPlayedCount:", alreadyPlayedCount);

        // Only 4 cards per rank exist
        const maxRankCount = 4;
        const declaredIsLikelyGone = alreadyPlayedCount >= 3;
        console.log("declaredIsLikelyGone:", declaredIsLikelyGone);

        // Force pass if no matching card AND most of them already played
        if (!hasDeclaredCard && declaredIsLikelyGone) {
          this.consecutiveActions = { type: "pass", count: 1 };
          return resolve({
            type: "pass",
            playerId: this.id,
          });
        }

        const shouldPass =
          Math.random() <
          Math.max(0.05, Math.min(0.5, adjustedPassProbability));
        console.log("adjustedPassProbability:", adjustedPassProbability);
        console.log("Random chance decided shouldPass:", shouldPass);

        if (shouldPass) {
          this.consecutiveActions = { type: "pass", count: 1 };

          return resolve({
            type: "pass",
            playerId: this.id,
          });
        } else {
          const { selectedCards, bluffText } =
            this.strategy.selectCardsAndBluff(
              gameState,
              this.cards,
              this.memory
            );

          this.consecutiveActions = { type: "place", count: 1 };

          return resolve({
            type: "place",
            playerId: this.id,
            cards: selectedCards,
            bluffText,
          });
        }
      }, 1000 + Math.random() * 1000); // Random delay between 1-2 seconds
    });
  }
  /**
   * Updates the bot's memory with the result of a challenge
   */
  updateMemoryWithChallengeResult(action, wasSuccessful) {
    if (!action || action.type !== "raise") return;

    // Update the action with the result
    action.wasSuccessful = wasSuccessful;

    // Record in memory
    this.memory.recordAction(action, wasSuccessful);

    // Update game history
    this.gameHistory.push({
      ...action,
      wasSuccessful,
    });
  }

  /**
   * Resets the bot's memory for a new game
   */
  resetMemory() {
    this.memory.reset();
    this.gameHistory = [];
    this.consecutiveActions = {
      type: null,
      count: 0,
    };
  }

  /**
   * Gets the bot's personality name
   */
  getPersonalityName() {
    return this.personality.name;
  }

  /**
   * Gets the bot's personality description
   */
  getPersonalityDescription() {
    return this.personality.description;
  }
}
