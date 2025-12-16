/**
 * Legacy helpers for backward compatibility
 * 
 * Re-exports pure functions from core/payee-validation.ts
 * All new code should import directly from core/ instead
 */
export {
  calculateNameSimilarity,
  validatePayeeName,
  validateAccountNumberFormat,
  validatePayee
} from '../core/payee-validation';
