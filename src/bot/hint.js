import { MemorySystem } from "./memories.js";

export class HintEngine {
  constructor() {
    this.memory = new MemorySystem(0.2);
    this.hintMessages = {
      pass: [
        "Skip this round. It’s not worth the risk.",
        "Let’s pass. We don’t have the right cards to play safely.",
        "No safe move available. Choose to pass.",
        "Passing is the smart choice this turn.",
        "Pass now. We’ll wait for a better opportunity.",
      ],
      raise: [
        "That move seems fake. Raise and challenge them.",
        "Looks like they’re bluffing. Let’s raise.",
        "Don’t trust their play. Raise to call it out.",
        "They might be lying. Time to raise and see.",
        "Too risky to stay silent. Go ahead and raise.",
      ],
      placeTruth: [
        "Play these cards truthfully. They match the declared rank.",
        "These are valid cards. Make an honest move.",
        "No bluff needed. Place the correct cards.",
        "We have matching cards. Play them truthfully.",
        "Stick to the rules. Place the real cards.",
      ],
      placeBluff: [
        "We don’t have matching cards. Go ahead and bluff.",
        "Play unmatched cards to bluff this turn.",
        "Bluff now. These cards don’t match the declared rank.",
        "It’s time to take a risk. Make a bluff play.",
        "These aren’t the right cards, but we’ll bluff anyway.",
      ],
    };
  }

  getHint(gameState, botCards) {
    if (
      gameState.lastAction?.type === "place" &&
      gameState.lastAction.playerId !== gameState.currentPlayerId
    ) {
      const shouldRaise = this.shouldRaise(gameState, botCards);
      if (shouldRaise) {
        return this.getRandomHint("raise");
      }
    }

    if (botCards.length === 0) {
      return this.getRandomHint("pass");
    }

    const declaredValue = gameState.lastAction?.bluffText;
    const hasDeclaredCard = botCards.some((c) => c.value === declaredValue);
    const alreadyPlayedCount = gameState.discardPile.filter(
      (c) => c.value === declaredValue
    ).length;

    const maxRankCount = 4;

    if (!hasDeclaredCard && alreadyPlayedCount >= maxRankCount) {
      return this.getRandomHint("pass");
    }

    const { selectedCards, bluffText } = this.getBestPlay(gameState, botCards);
    const isTruth = selectedCards.every((c) => c.value === bluffText);

    return this.getRandomHint(isTruth ? "placeTruth" : "placeBluff");
  }

  getRandomHint(type) {
    const messages = this.hintMessages[type];
    const randomIndex = Math.floor(Math.random() * messages.length);
    return {
      decision: type,
      message: messages[randomIndex],
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
      return true; // Claimed too many cards – suspicious
    }

    if (remainingForValue === 0 && cardsPlaced >= 2) {
      return true; // All cards accounted for, but too many placed
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
