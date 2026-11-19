import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, phone } = body;

    const identifier = email || phone;
    if (!identifier) {
      return NextResponse.json({ error: 'Email or phone number is required' }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const rate = await checkRateLimit(`otp_send:${identifier.toLowerCase()}:${clientIp}`, 5, 60000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: rate.message || `Too many OTP requests. Please wait ${rate.retryAfterSeconds} seconds before requesting again.` },
        { status: 429 }
      );
    }

    const isPhoneOtpEnabled = process.env.NEXT_PUBLIC_ENABLE_PHONE_OTP === 'true';

    if (phone && !isPhoneOtpEnabled && !email) {
      return NextResponse.json(
        { error: 'Phone OTP is currently disabled. Please use Email verification.' },
        { status: 400 }
      );
    }

    if (supabaseUrl && anonKey && !supabaseUrl.includes('mock.supabase.co')) {
      const client = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      if (email) {
        const { error } = await client.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
          },
        });
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      } else if (phone && isPhoneOtpEnabled) {
        const { error } = await client.auth.signInWithOtp({
          phone,
          options: {
            shouldCreateUser: true,
          },
        });
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
    }

    return NextResponse.json({
      success: true,
      destination: identifier,
      method: email ? 'email' : 'phone',
      message: `Verification code sent to ${identifier}`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error sending OTP' }, { status: 500 });
  }
}
