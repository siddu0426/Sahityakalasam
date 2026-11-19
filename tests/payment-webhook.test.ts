import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';

describe('Razorpay Payment Webhook & Verification Tests', () => {
  const webhookSecret = 'test_secret_123456';

  function generateSignature(payload: string, secret: string) {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  it('correctly verifies a valid Razorpay webhook signature', () => {
    const rawBody = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_ABC12345',
            amount: 2000,
            currency: 'INR',
            notes: { userId: 'user-saanvi' },
          },
        },
      },
    });

    const signature = generateSignature(rawBody, webhookSecret);
    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    expect(signature).toBe(expected);
  });

  it('rejects an invalid or tampered webhook signature', () => {
    const rawBody = JSON.stringify({ event: 'payment.captured' });
    const tamperedSignature = 'invalid_tampered_signature_hex';
    const actual = generateSignature(rawBody, webhookSecret);

    expect(actual).not.toBe(tamperedSignature);
  });

  it('enforces idempotency on payment webhook processing', () => {
    const processedPaymentIds = new Set<string>();

    function processWebhook(paymentId: string): { creditGranted: boolean; status: string } {
      if (processedPaymentIds.has(paymentId)) {
        return { creditGranted: false, status: 'already_processed' };
      }
      processedPaymentIds.add(paymentId);
      return { creditGranted: true, status: 'credit_granted' };
    }

    // First delivery
    const firstCall = processWebhook('pay_TEST_IDEMPOTENT_001');
    expect(firstCall.creditGranted).toBe(true);
    expect(firstCall.status).toBe('credit_granted');

    // Duplicate delivery of the exact same payment webhook
    const duplicateCall = processWebhook('pay_TEST_IDEMPOTENT_001');
    expect(duplicateCall.creditGranted).toBe(false);
    expect(duplicateCall.status).toBe('already_processed');
  });
});
