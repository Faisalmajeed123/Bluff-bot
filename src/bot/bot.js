// Enhanced Bot player implementation for Accessible-Bluff game
import { MemorySystem } from "./memories.js";
import { getPersonalityForDifficulty, Personalities } from "./personalities.js";
import { BeginnerStrategy } from "./strategies/easy.js";
import { IntermediateStrategy } from "./strategies/medium.js";
import { MasterStrategy } from "./strategies/hard.js";

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

    // Initialize memory system with adaptive rate based on personality
    this.memory = new MemorySystem(this.personality.adaptiveRate || 0.2);

    // Initialize strategy based on difficulty
    this.strategy = this.initializeStrategy();

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
        return new MasterStrategy(this.personality);
      default:
        return new BeginnerStrategy(this.personality);
    }
  }

  decideAction(gameState) {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (gameState.lastAction) {
          this.memory.recordAction(
            gameState.lastAction,
            gameState.lastAction.wasSuccessful
          );
        }

        if (
          gameState.lastAction?.type === "place" &&
          gameState.lastAction.playerId !== this.id
        ) {
          if (
            this.strategy.decideChallenge(gameState, this.cards, this.memory)
          ) {
            return resolve({ type: "raise", playerId: this.id });
          }
        }

        if (gameState.currentPlayerId !== this.id) {
          return resolve({ type: "pass", playerId: this.id });
        }

        if (this.cards.length === 0) {
          return resolve({ type: "pass", playerId: this.id });
        }

        const { selectedCards, bluffText } = this.strategy.selectCardsToPlay(
          gameState,
          this.cards,
          this.memory
        );

        return resolve({
          type: "place",
          playerId: this.id,
          cards: selectedCards,
          bluffText,
        });
      }, 800 + Math.random() * 600);
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
