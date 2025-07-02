export const Personalities = {
  AGGRESSIVE: {
    name: "Aggressive",
    description: "Bluffs often and challenges frequently",
    bluffProbabilityModifier: 0.3,
    challengeProbabilityModifier: 0.25,
    multiCardPlayModifier: 0.2,
    riskTolerance: 0.8,
    adaptiveRate: 0.15,
  },

  CAUTIOUS: {
    name: "Cautious",
    description: "Rarely bluffs and challenges only when confident",
    bluffProbabilityModifier: -0.2,
    challengeProbabilityModifier: -0.15,
    multiCardPlayModifier: -0.1,
    riskTolerance: 0.3,
    adaptiveRate: 0.2,
  },

  BALANCED: {
    name: "Balanced",
    description: "Uses a mix of bluffing and honest play",
    bluffProbabilityModifier: 0.0,
    challengeProbabilityModifier: 0.0,
    multiCardPlayModifier: 0.0,
    riskTolerance: 0.5,
    adaptiveRate: 0.25,
  },

  UNPREDICTABLE: {
    name: "Unpredictable",
    description: "Behavior varies wildly from round to round",
    bluffProbabilityModifier: 0.1,
    challengeProbabilityModifier: 0.1,
    multiCardPlayModifier: 0.1,
    riskTolerance: 0.6,
    adaptiveRate: 0.1,
    randomnessFactor: 0.4,
  },
};

export function getRandomPersonality() {
  const personalities = Object.values(Personalities);
  return personalities[Math.floor(Math.random() * personalities.length)];
}

export function getPersonalityForDifficulty(difficultyLevel) {
  switch (difficultyLevel) {
    case "beginner":
      const beginnerDistribution = [
        Personalities.CAUTIOUS,
        Personalities.CAUTIOUS,
        Personalities.BALANCED,
        Personalities.AGGRESSIVE,
      ];
      return beginnerDistribution[
        Math.floor(Math.random() * beginnerDistribution.length)
      ];

    case "intermediate":
      return getRandomPersonality();

    case "advanced":
      const advancedDistribution = [
        Personalities.AGGRESSIVE,
        Personalities.AGGRESSIVE,
        Personalities.BALANCED,
        Personalities.UNPREDICTABLE,
        Personalities.UNPREDICTABLE,
      ];
      return advancedDistribution[
        Math.floor(Math.random() * advancedDistribution.length)
      ];

    default:
      return getRandomPersonality();
  }
}
