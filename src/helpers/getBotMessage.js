import {
  AggressiveMessages,
  CautiousMessages,
  BalancedMessages,
  UnpredictableMessages,
} from "../bot/messages.js";

const MESSAGE_MAP = {
  Aggressive: AggressiveMessages,
  Cautious: CautiousMessages,
  Balanced: BalancedMessages,
  Unpredictable: UnpredictableMessages,
};

export function maybeGetBotMessage(personalityName, messageType) {
  const messageSet = MESSAGE_MAP[personalityName];
  if (!messageSet || !messageSet[messageType]) return null;

  const shouldSay = Math.random() < 0.3;
  if (!shouldSay) return null;

  const messages = messageSet[messageType];
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
}
