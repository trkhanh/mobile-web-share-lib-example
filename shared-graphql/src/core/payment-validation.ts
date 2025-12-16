/**
 * Pure business logic for payment operations
 * 
 * Functional approach:
 * - Pure functions for business rules
 * - Side effects handled in service layer
 */

import { Payment } from '../types/payment';

/**
 * Determine if payment amount is valid
 * Pure function - simple business rule
 */
export const isValidPaymentAmount = (amount: number, currency: string): boolean => {
  if (amount <= 0) return false;
  if (amount > 1000000) return false; // Max limit
  return true;
};

/**
 * Calculate payment status based on authorization result
 * Pure function - business logic as data transformation
 */
export const determinePaymentStatus = (
  authorized: boolean,
  captured: boolean
): Payment['status'] => {
  if (!authorized) return 'FAILED';
  if (captured) return 'COMPLETED';
  return 'PENDING';
};

/**
 * Validate payment request
 * Pure function - composing validation rules
 */
export const validatePaymentRequest = (
  amount: number,
  currency: string,
  fromAccount: string,
  toAccount: string
): { valid: boolean; reason?: string } => {
  if (!isValidPaymentAmount(amount, currency)) {
    return { valid: false, reason: 'INVALID_AMOUNT' };
  }
  
  if (!fromAccount || fromAccount.length < 8) {
    return { valid: false, reason: 'INVALID_FROM_ACCOUNT' };
  }
  
  if (!toAccount || toAccount.length < 8) {
    return { valid: false, reason: 'INVALID_TO_ACCOUNT' };
  }
  
  if (fromAccount === toAccount) {
    return { valid: false, reason: 'SAME_ACCOUNT' };
  }
  
  return { valid: true };
};
