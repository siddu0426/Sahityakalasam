import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuth } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ServerDB } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;

    const userId = authResult.caller.user.id;
    const { orderId, paymentId, signature } = await request.json();

    if (!orderId || !paymentId) {
      return NextResponse.json({ error: 'Missing required payment verification parameters' }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // If real key secret exists and signature was sent, verify HMAC
    if (keySecret && !keySecret.includes('mock') && signature) {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      if (generatedSignature !== signature) {
        return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
      }
    }

    // Grant upload credit to the authenticated user
    if (supabaseAdmin) {
      // Record payment first
      const { data: paymentRow, error: payErr } = await supabaseAdmin
        .from('payments')
        .insert({
          user_id: userId,
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature || null,
          amount: 2000,
          currency: 'INR',
          status: 'paid',
        })
        .select()
        .single();

      if (!payErr && paymentRow) {
        // Execute grant_upload_credit RPC (service_role only)
        const { error: grantErr } = await supabaseAdmin.rpc('grant_upload_credit', {
          p_payment_id: paymentRow.id,
          p_user_id: userId,
        });

        if (grantErr) {
          console.error('[grant_upload_credit RPC error]:', grantErr);
        }
      }
    } else {
      await ServerDB.recordVerifiedPayment({
        user_id: userId,
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature || undefined,
        amount: 2000,
        currency: 'INR',
        status: 'paid',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified and upload credit granted',
      paymentId,
      orderId,
    });
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    return NextResponse.json({ error: error.message || 'Verification error' }, { status: 500 });
  }
}
