import { BotFactory } from "./bot-factory";

export class BotManager {
  constructor() {
    this.bots = [];
    this.gameState = null;
  }

  /**
   * Initializes bots for a game
   */
  initializeBots(botCount, difficultyLevel) {
    this.bots = BotFactory.createBots(botCount, difficultyLevel);
    return this.bots;
  }

  /**
   * Updates the game state
   */
  updateGameState(gameState) {
    // Add previous moves to the game state for strategy use
    gameState.previousMoves = this.gameState
      ? [
          ...(this.gameState.previousMoves || []),
          this.gameState.lastAction,
        ].filter(Boolean)
      : [];

    // Add possible moves (for strategy use)
    gameState.possibleMoves = this.getPossibleMoves(gameState);

    // Add opponent bluff patterns (for hard strategy)
    gameState.opponentBluffPatterns = this.analyzeOpponentPatterns(gameState);

    this.gameState = gameState;

    // Update bot cards if needed
    for (const bot of this.bots) {
      const playerState = gameState.players.find((p) => p.id === bot.id);
      if (playerState) {
        bot.cards = playerState.cards || [];
      }
    }
  }

  /**
   * Gets a bot's action when it's their turn
   */
  async getBotAction(botId) {
    if (!this.gameState) return null;

    const bot = this.bots.find((b) => b.id === botId);
    if (!bot) return null;

    return await bot.decideAction(this.gameState);
  }

  /**
   * Handles a bot's response to another player's action
   */
  async handleBotResponse(botId, action) {
    if (!this.gameState) return null;

    const bot = this.bots.find((b) => b.id === botId);
    if (!bot) return null;

    // Update game state with the new action
    this.gameState = {
      ...this.gameState,
      lastAction: action,
    };

    return await bot.decideAction(this.gameState);
  }

  /**
   * Gets possible moves for the current game state
   * This is used by the strategies
   */
  getPossibleMoves(gameState) {
    // In a real implementation, this would return valid moves based on game rules
    // For simplicity, we'll return all card values
    return ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  }

  /**
   * Analyzes opponent patterns for the hard strategy
   */
  analyzeOpponentPatterns(gameState) {
    // In a real implementation, this would analyze past moves to detect patterns
    // For simplicity, we'll return an empty array
    return [];
  }

  /**
   * Updates bots' memory with challenge results
   */
  updateBotsWithChallengeResult(action, wasSuccessful) {
    for (const bot of this.bots) {
      bot.updateMemoryWithChallengeResult(action, wasSuccessful);
    }
  }

  /**
   * Gets information about a bot's personality
   */
  getBotPersonalityInfo(botId) {
    const bot = this.bots.find((b) => b.id === botId);
    if (!bot) return null;

    return {
      name: bot.getPersonalityName(),
      description: bot.getPersonalityDescription(),
    };
  }

  /**
   * Resets all bots' memory for a new game
   */
  resetBotMemory() {
    for (const bot of this.bots) {
      bot.resetMemory();
    }
  }
}
