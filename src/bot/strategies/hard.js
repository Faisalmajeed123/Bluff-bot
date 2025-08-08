export class AdvancedStrategy {
  constructor(personality) {
    this.personality = personality || {};
    this.currentGameState = {};
    this.currentBotCards = [];
  }

  setGameState(state) {
    this.currentGameState = state;
  }

  setBotCards(cards) {
    this.currentBotCards = cards;
  }

  getGameState() {
    return this.currentGameState;
  }

  getBotCards() {
    return this.currentBotCards;
  }

  decideChallenge(gameState, botCards, memory) {
    const lastAction = gameState.lastAction;
    if (!lastAction || lastAction.type !== "place") return false;

    const claimedValue = lastAction.bluffText;
    const cardsPlaced = lastAction.cards.length;

    const discardPile = gameState.discardPile || [];
    const cardsPlayedForValue =
      discardPile.filter((c) => c.value === claimedValue).length + cardsPlaced;

    const knownInHand = botCards.filter((c) => c.value === claimedValue).length;

    const remainingForValue = Math.max(
      0,
      4 - cardsPlayedForValue - knownInHand
    );

    let challengeScore = 0;
    const threshold = 0.8;
    const bluffRatio =
      memory?.getPlayerBluffProbability(lastAction.playerId) || 0.3;
    const trust = memory?.getPlayerTrustScore(lastAction.playerId) || 0.5;

    const gameStage = this.calculateGameStage(gameState);

    // Factor: impossible claim (more than 4 of value)
    if (remainingForValue < 0) {
      challengeScore += 2;
    }

    // Factor: many cards claimed but unlikely left
    if (remainingForValue === 0 && cardsPlaced >= 2) {
      challengeScore += 1;
    }

    // Factor: opponent’s past bluffing tendency
    challengeScore += (bluffRatio - 0.3) * 1.5;

    // Factor: opponent’s trust
    challengeScore += (1 - trust) * 1.0;

    // Factor: early or late game (more aggressive in late)
    if (gameStage > 0.7) challengeScore += 0.2;

    // Personality: risk tolerance
    challengeScore *= this.personality.riskTolerance || 1.0;
    return challengeScore >= threshold;
  }

  selectCardsAndBluff(gameState, botCards, memory) {
    const lastAction = gameState.lastAction;
    const declaredValue = lastAction?.bluffText || null;

    const cardGroups = this.groupCardsByValue(botCards);
    const gameStage = this.calculateGameStage(gameState);

    const discardPile = gameState.discardPile || [];
    const countsRemaining = this.estimateRemainingCards(botCards, discardPile);

    let playValue = this.pickBestPlayValue(
      cardGroups,
      countsRemaining,
      declaredValue
    );
    let selectedCards = this.pickCardsForValue(
      cardGroups,
      playValue,
      gameState
    );

    const bluffProbability = this.shouldBluff(gameStage);

    if (bluffProbability > 0.5) {
      const bluffValue = this.pickBluffValue(countsRemaining, playValue);
      return { selectedCards, bluffText: bluffValue };
    }

    return { selectedCards, bluffText: playValue };
  }

  pickBestPlayValue(cardGroups, countsRemaining, declaredValue) {
    // prioritize:
    // - declaredValue if you can match it
    // - largest group if not
    if (declaredValue && cardGroups[declaredValue]?.length > 0) {
      return declaredValue;
    }

    const sorted = Object.entries(cardGroups)
      .filter(([v, cards]) => cards.length > 0)
      .sort((a, b) => b[1].length - a[1].length);

    return sorted[0]?.[0];
  }

  pickCardsForValue(cardGroups, value, gameState) {
    const cards = cardGroups[value] || [];
    const countAvailable = cards.length;

    const gameStage = this.calculateGameStage(gameState);
    const aggression = this.personality.aggression ?? 0.5;

    // Base probability of playing N cards
    let maxToPlay = Math.min(4, countAvailable);
    if (maxToPlay <= 1) return cards.slice(0, 1); // can't do more

    // Weight multipliers for how many cards to play
    const weights = [];

    for (let i = 1; i <= maxToPlay; i++) {
      // Higher aggression and later stage => more likely to play more cards
      const weight = i ** aggression * (1 + gameStage);
      weights.push(weight);
    }

    // Normalize weights to pick based on probability
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const rand = Math.random() * totalWeight;

    let cumulative = 0;
    let chosen = 1;
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (rand <= cumulative) {
        chosen = i + 1;
        break;
      }
    }

    return cards.slice(0, chosen);
  }

  pickBluffValue(countsRemaining, avoidValue) {
    const available = Object.entries(countsRemaining)
      .filter(([v, c]) => c > 0 && v !== avoidValue)
      .map(([v]) => v);

    return (
      available[Math.floor(Math.random() * available.length)] || avoidValue
    );
  }

  shouldBluff(gameStage) {
    let base = 0.1;
    if (gameStage > 0.5) base += 0.2;
    if (gameStage > 0.8) base += 0.1;

    base += this.personality.bluffProbabilityModifier || 0;

    return Math.random() < base ? 1 : 0;
  }

  groupCardsByValue(cards) {
    const groups = {};
    for (const card of cards) {
      if (!groups[card.value]) groups[card.value] = [];
      groups[card.value].push(card);
    }
    return groups;
  }

  estimateRemainingCards(botCards, discardPile) {
    const counts = {};
    const values = [
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

    for (const v of values) counts[v] = 4;

    for (const c of botCards) counts[c.value]--;
    for (const c of discardPile) counts[c.value]--;

    return counts;
  }

  calculateGameStage(gameState) {
    const initialCards = 52 / gameState.players.length;
    const avgCardsLeft =
      gameState.players.reduce((s, p) => s + p.cardCount, 0) /
      gameState.players.length;

    return 1 - avgCardsLeft / initialCards;
  }
}
