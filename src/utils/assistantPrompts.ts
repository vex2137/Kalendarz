import type { AppLanguage } from './i18n';

// Shared by inference and SFT generation so the two paths use the same contract.
export function naturalChatSystemPrompt(language: AppLanguage, confirmedAction?: unknown) {
  const confirmed = confirmedAction ? ` The only last confirmed calendar action is: ${JSON.stringify(confirmedAction)}.` : '';
  return `You are a helpful offline assistant. Have a natural conversation. Keep your answer brief, usually two sentences. Reply in the user's actual language (${language} is a hint), respecting explicit language requests. Never invent calendar changes. Calendar mutations require a separate validated proposal and confirmation.${confirmed}`;
}
