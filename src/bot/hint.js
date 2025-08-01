import { MemorySystem } from "./memories.js";

export class HintEngine {
  constructor() {
    this.memory = new MemorySystem(0.2);
  }

  getHint(gameState, botCards) {
    if (
      gameState.lastAction?.type === "place" &&
      gameState.lastAction.playerId !== gameState.currentPlayerId
    ) {
      const shouldRaise = this.shouldRaise(gameState, botCards);
      if (shouldRaise) {
        return {
          decision: "raise",
          message: "Raise now",
        };
      }
    }

    if (botCards.length === 0) {
      return {
        decision: "pass",
        message: "Pass this round",
      };
    }

    const declaredValue = gameState.lastAction?.bluffText;
    const hasDeclaredCard = botCards.some((c) => c.value === declaredValue);
    const alreadyPlayedCount = gameState.discardPile.filter(
      (c) => c.value === declaredValue
    ).length;

    const maxRankCount = 4;

    if (!hasDeclaredCard && alreadyPlayedCount >= maxRankCount) {
      return {
        decision: "pass",
        message: `Pass this round`,
      };
    }

    const { selectedCards, bluffText } = this.getBestPlay(gameState, botCards);
    const isTruth = selectedCards.every((c) => c.value === bluffText);

    const cardsStr = selectedCards
      .map((c) => `${c.value} of ${c.suit}`)
      .join(", ");
    const actionText = `Place ${selectedCards.length} cards of ${bluffText}.`;

    return {
      decision: isTruth ? "placeTruth" : "placeBluff",
      message: actionText,
    };
  }

  shouldRaise(gameState, botCards) {
    const claimedValue = gameState.lastAction.bluffText;
    const cardsPlaced = gameState.lastAction.cards.length;
    const discardPile = gameState.discardPile || [];

    const cardsPlayedForValue =
      discardPile.filter((c) => c.value === claimedValue).length + cardsPlaced;

    const knownInHand = botCards.filter((c) => c.value === claimedValue).length;

    const remainingForValue = 4 - cardsPlayedForValue - knownInHand;

    if (remainingForValue < 0) {
      return true;
    }

    if (remainingForValue === 0 && cardsPlaced >= 2) {
      return true;
    }

    return false;
  }

  getBestPlay(gameState, botCards) {
    const declaredValue = gameState.lastAction?.bluffText;
    const cardGroups = this.groupCardsByValue(botCards);

    if (declaredValue && cardGroups[declaredValue]?.length > 0) {
      const cards = cardGroups[declaredValue].slice(
        0,
        Math.min(2, cardGroups[declaredValue].length)
      );
      return { selectedCards: cards, bluffText: declaredValue };
    }

    const sortedGroups = Object.entries(cardGroups).sort(
      (a, b) => b[1].length - a[1].length
    );
    const [bestValue, cards] = sortedGroups[0];

    return {
      selectedCards: cards.slice(0, Math.min(2, cards.length)),
      bluffText: bestValue,
    };
  }

  groupCardsByValue(cards) {
    const groups = {};
    for (const card of cards) {
      if (!groups[card.value]) groups[card.value] = [];
      groups[card.value].push(card);
    }
    return groups;
  }
}
