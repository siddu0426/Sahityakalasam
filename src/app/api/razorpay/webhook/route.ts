import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ServerDB } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

const processedPayments = new Set<string>();

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Signature verification if webhook secret is configured
    if (webhookSecret && !webhookSecret.includes('mock') && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (expectedSignature !== signature) {
        console.warn('Invalid Razorpay webhook signature');
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
      }
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;

    // Handle payment.captured or order.paid
    if (event === 'payment.captured' || event === 'order.paid') {
      const payment = payload.payload?.payment?.entity;
      const paymentId = payment?.id;
      const orderId = payment?.order_id || `order_${paymentId}`;
      const userId = payment?.notes?.userId;

      if (!paymentId) {
        return NextResponse.json({ status: 'ignored_missing_payment_id' }, { status: 200 });
      }

      // Idempotency check: if already processed, return 200 without duplicate grant
      if (processedPayments.has(paymentId)) {
        return NextResponse.json({
          status: 'already_processed',
          message: 'Payment was already processed idempotently',
          paymentId,
        });
      }

      processedPayments.add(paymentId);

      if (userId) {
        if (supabaseAdmin) {
          const { data: paymentRow, error: payErr } = await supabaseAdmin
            .from('payments')
            .insert({
              user_id: userId,
              razorpay_order_id: orderId,
              razorpay_payment_id: paymentId,
              amount: payment.amount || 2000,
              currency: 'INR',
              status: 'paid',
            })
            .select()
            .single();

          if (!payErr && paymentRow) {
            await supabaseAdmin.rpc('grant_upload_credit', {
              p_payment_id: paymentRow.id,
              p_user_id: userId,
            });
          }
        } else {
          await ServerDB.recordVerifiedPayment({
            user_id: userId,
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            amount: 2000,
            currency: 'INR',
            status: 'paid',
          });
        }
      }

      return NextResponse.json({
        success: true,
        status: 'credit_granted',
        paymentId,
        userId,
      });
    }

    return NextResponse.json({ status: 'unhandled_event' });
  } catch (error: any) {
    console.error('Error handling Razorpay webhook:', error);
    return NextResponse.json({ error: error.message || 'Webhook processing error' }, { status: 500 });
  }
}
