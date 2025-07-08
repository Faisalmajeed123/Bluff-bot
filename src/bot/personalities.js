export const Personalities = {
  AGGRESSIVE: {
    name: "Aggressive",
    bluffProbabilityModifier: 0.1,
    challengeProbabilityModifier: 0.1,
    riskTolerance: 0.7,
  },
  CAUTIOUS: {
    name: "Cautious",
    bluffProbabilityModifier: -0.1,
    challengeProbabilityModifier: -0.1,
    riskTolerance: 0.3,
  },
  BALANCED: {
    name: "Balanced",
    bluffProbabilityModifier: 0,
    challengeProbabilityModifier: 0,
    riskTolerance: 0.5,
  },
  UNPREDICTABLE: {
    name: "Unpredictable",
    bluffProbabilityModifier: 0.1,
    challengeProbabilityModifier: 0.05,
    riskTolerance: 0.6,
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
