/**
 * Functional payment service
 * 
 * Uses functional factory pattern:
 * - Pure business logic in core/payment-validation
 * - Side effects isolated in service methods
 * - Functional composition over class inheritance
 */

import { CreatePaymentRequest, Payment } from '../types/payment';
import { validatePaymentRequest } from '../core/payment-validation';
import { IPaymentGateway } from '../ports/gateway';
import { IPaymentStore } from '../ports/payment-store';
import { ILogger } from '../ports/logger';

export type PaymentServiceDeps = {
  store: IPaymentStore;
  gateway: IPaymentGateway;
  logger: ILogger;
};

/**
 * Create a payment service using functional factory pattern
 */
export const createPaymentService = (deps: PaymentServiceDeps) => {
  const { store, gateway, logger } = deps;

  /**
   * Create and authorize a payment
   * Orchestrates side effects while using pure functions for logic
   */
  const createPayment = async (req: CreatePaymentRequest) => {
    // Validate using pure function
    const validation = validatePaymentRequest(
      req.amount,
      req.currency,
      req.fromAccount,
      req.toAccount
    );

    if (!validation.valid) {
      logger.warn('Payment validation failed', { reason: validation.reason });
      return { success: false, reason: validation.reason };
    }

    // Create pending record
    const payment = await store.create({
      amount: req.amount,
      currency: req.currency,
      fromAccount: req.fromAccount,
      toAccount: req.toAccount,
      status: 'PENDING'
    } as any);

    // Authorize via gateway
    const auth = await gateway.authorize(
      req.amount,
      req.currency,
      req.fromAccount,
      req.toAccount
    );

    if (!auth.success) {
      await store.updateStatus(payment.id, 'FAILED');
      logger.warn('Payment authorization failed', {
        paymentId: payment.id,
        error: auth.error
      });
      return { success: false, paymentId: payment.id, reason: auth.error };
    }

    // Mark as completed
    await store.updateStatus(payment.id, 'COMPLETED', auth.providerRef);
    logger.info('Payment completed', {
      paymentId: payment.id,
      providerRef: auth.providerRef
    });

    return { success: true, paymentId: payment.id };
  };

  /**
   * Get payment by ID
   */
  const getPayment = async (paymentId: string): Promise<Payment | null> => {
    return store.get(paymentId);
  };

  /**
   * Capture payment (for two-phase commits)
   */
  const capturePayment = async (paymentId: string) => {
    const payment = await store.get(paymentId);
    if (!payment) {
      throw new Error('PAYMENT_NOT_FOUND');
    }

    if (!payment.providerRef) {
      throw new Error('NO_PROVIDER_REF');
    }

    const result = await gateway.capture(payment.providerRef);
    
    if (result.success) {
      await store.updateStatus(paymentId, 'COMPLETED');
      logger.info('Payment captured', { paymentId });
    }

    return result;
  };

  // Return service interface
  return {
    createPayment,
    getPayment,
    capturePayment
  };
};

// Type for the service returned by factory
export type PaymentService = ReturnType<typeof createPaymentService>;
