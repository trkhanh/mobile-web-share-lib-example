"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAccountNumberFormat = exports.validatePayeeName = exports.calculateNameSimilarity = void 0;
const calculateNameSimilarity = (name1, name2) => {
    // Use Levenshtein distance to compute similarity ratio.
    const s1 = name1.toLowerCase();
    const s2 = name2.toLowerCase();
    const len1 = s1.length;
    const len2 = s2.length;
    if (len1 === 0 && len2 === 0)
        return 1.0;
    // initialize matrix
    const dp = Array.from({ length: len1 + 1 }, () => new Array(len2 + 1).fill(0));
    for (let i = 0; i <= len1; i++)
        dp[i][0] = i;
    for (let j = 0; j <= len2; j++)
        dp[0][j] = j;
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, // deletion
            dp[i][j - 1] + 1, // insertion
            dp[i - 1][j - 1] + cost // substitution
            );
        }
    }
    const distance = dp[len1][len2];
    const maxLength = Math.max(len1, len2);
    if (maxLength === 0)
        return 1.0;
    const ratio = 1 - distance / maxLength;
    return Math.max(0, Math.min(1, ratio));
};
exports.calculateNameSimilarity = calculateNameSimilarity;
const validatePayeeName = (inputName, registeredName) => {
    const similarity = (0, exports.calculateNameSimilarity)(inputName, registeredName);
    return {
        isValid: similarity >= 0.85,
        matchLevel: similarity >= 0.95 ? 'EXACT' : similarity >= 0.85 ? 'CLOSE' : 'NO_MATCH',
        confidence: similarity,
        suggestedName: similarity < 0.85 ? registeredName : undefined
    };
};
exports.validatePayeeName = validatePayeeName;
const validateAccountNumberFormat = (accountNumber, bankCode) => {
    const isValidLength = accountNumber.length >= 8 && accountNumber.length <= 12;
    const isNumeric = /^\d+$/.test(accountNumber);
    if (bankCode.startsWith('01')) {
        return isValidLength && isNumeric && accountNumber.startsWith('1');
    }
    return isValidLength && isNumeric;
};
exports.validateAccountNumberFormat = validateAccountNumberFormat;
