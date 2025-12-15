import { ValidatePayeeResult } from '../types/payee';

/**
 * Payee helpers (pure functions)
 *
 * SOLID notes:
 * - Single Responsibility: focused helpers for payee validation (name similarity, account format).
 * - Open/Closed: algorithms are encapsulated and easily swappable.
 * - Interface Segregation: consumers import only the helpers they need.
 */
export const calculateNameSimilarity = (name1: string, name2: string): number => {
  const s1 = name1.toLowerCase();
  const s2 = name2.toLowerCase();

  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 && len2 === 0) return 1.0;

  const dp: number[][] = Array.from({ length: len1 + 1 }, () => new Array(len2 + 1).fill(0));
  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  const distance = dp[len1][len2];
  const maxLength = Math.max(len1, len2);
  if (maxLength === 0) return 1.0;
  const ratio = 1 - distance / maxLength;
  return Math.max(0, Math.min(1, ratio));
};

export const validatePayeeName = (
  inputName: string,
  registeredName: string
): ValidatePayeeResult => {
  const similarity = calculateNameSimilarity(inputName, registeredName);

  return {
    isValid: similarity >= 0.85,
    matchLevel: similarity >= 0.95 ? 'EXACT' : similarity >= 0.85 ? 'CLOSE' : 'NO_MATCH',
    confidence: similarity,
    suggestedName: similarity < 0.85 ? registeredName : undefined
  };
};

export const validateAccountNumberFormat = (accountNumber: string, bankCode: string): boolean => {
  const isValidLength = accountNumber.length >= 8 && accountNumber.length <= 12;
  const isNumeric = /^\d+$/.test(accountNumber);

  if (bankCode.startsWith('01')) {
    return isValidLength && isNumeric && accountNumber.startsWith('1');
  }

  return isValidLength && isNumeric;
};
