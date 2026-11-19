import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;

    const userId = authResult.caller.user.id;

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // ₹20 entry fee in paise = 2000
    const amount = 2000;
    const currency = 'INR';
    const receipt = `rcpt_${Date.now()}`;

    // If real Razorpay keys are configured, call Razorpay Orders API
    if (keyId && keySecret && !keyId.includes('mock')) {
      const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${basicAuth}`,
        },
        body: JSON.stringify({
          amount,
          currency,
          receipt,
          notes: { userId, product: 'Kathalu Story Upload' },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Razorpay order creation error:', errorData);
        return NextResponse.json({ error: errorData.error?.description || 'Failed to create order' }, { status: 500 });
      }

      const orderData = await response.json();
      return NextResponse.json(orderData);
    }

    // Mock order for testing / sandbox demonstration
    const mockOrder = {
      id: `order_${Date.now()}_test`,
      entity: 'order',
      amount,
      amount_paid: 0,
      amount_due: amount,
      currency,
      receipt,
      status: 'created',
      notes: { userId, mode: 'test_fallback' },
      created_at: Math.floor(Date.now() / 1000),
    };

    return NextResponse.json(mockOrder);
  } catch (error: any) {
    console.error('Error in create-order route:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
