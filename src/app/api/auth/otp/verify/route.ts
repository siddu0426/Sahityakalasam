import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ServerDB } from '@/lib/server-db';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      email,
      phone,
      otp,
      displayName,
      username,
      age,
      city,
      showAgeCity,
      guardianName,
      guardianPhone,
      guardianRelationship,
      guardianConsent,
    } = body;

    const identifier = email || phone;
    if (!identifier || !otp) {
      return NextResponse.json({ error: 'Email/phone and OTP code are required' }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const rate = await checkRateLimit(`otp_verify:${identifier.toLowerCase()}:${clientIp}`, 5, 60000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: rate.message || `Too many verification attempts. Please wait ${rate.retryAfterSeconds} seconds before trying again.` },
        { status: 429 }
      );
    }

    const parsedAge = age !== undefined && age !== '' ? parseInt(String(age), 10) : undefined;
    const isMinor = parsedAge !== undefined && parsedAge < 18;

    if (isMinor && !guardianConsent) {
      return NextResponse.json(
        { error: 'Guardian consent is mandatory for narrators under 18 years of age.' },
        { status: 400 }
      );
    }

    let sessionData: any = null;
    let authUser: any = null;

    if (supabaseUrl && anonKey && !supabaseUrl.includes('mock.supabase.co')) {
      const client = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const verifyParams = email
        ? { email, token: otp.trim(), type: 'email' as const }
        : { phone: phone!, token: otp.trim(), type: 'sms' as const };

      const { data, error } = await client.auth.verifyOtp(verifyParams);

      if (error || !data.user) {
        return NextResponse.json(
          { error: error?.message || 'Invalid or expired verification code' },
          { status: 400 }
        );
      }

      sessionData = data.session;
      authUser = data.user;
    } else {
      // Mock fallback for test environment without active Supabase
      authUser = {
        id: `usr-${Date.now()}`,
        email,
        phone,
      };
    }

    // Upsert or fetch user profile from profiles table
    let profile = await ServerDB.getProfileById(authUser.id);

    if (!profile) {
      profile = await ServerDB.upsertProfile({
        id: authUser.id,
        email: authUser.email,
        phone: authUser.phone,
        display_name: displayName?.trim() || authUser.email?.split('@')[0] || 'కథా ప్రియులు (Story Enthusiast)',
        username: username?.trim().replace(/^@/, '') || `user_${authUser.id.slice(-6)}`,
        avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${authUser.id}`,
        age: parsedAge,
        city: city?.trim() || undefined,
        show_age_city: showAgeCity ?? false,
        is_minor: isMinor,
        guardian_name: isMinor ? guardianName : undefined,
        guardian_phone: isMinor ? guardianPhone : undefined,
        guardian_relationship: isMinor ? guardianRelationship : undefined,
        guardian_consent: isMinor ? Boolean(guardianConsent) : false,
        role: 'listener', // Never allows client privilege escalation!
      });
    } else if (displayName || age !== undefined) {
      // Update non-privileged profile details
      profile = await ServerDB.upsertProfile({
        id: authUser.id,
        display_name: displayName?.trim() || profile.display_name,
        username: username?.trim().replace(/^@/, '') || profile.username,
        age: parsedAge ?? profile.age,
        city: city?.trim() || profile.city,
        show_age_city: showAgeCity ?? profile.show_age_city,
        is_minor: profile.is_minor || isMinor,
        guardian_name: guardianName || profile.guardian_name,
        guardian_phone: guardianPhone || profile.guardian_phone,
        guardian_relationship: guardianRelationship || profile.guardian_relationship,
        guardian_consent: profile.guardian_consent || guardianConsent,
      });
    }

    const response = NextResponse.json({
      success: true,
      user: authUser,
      profile,
      session: sessionData,
      message: 'Authentication successful',
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Verification error' }, { status: 500 });
  }
}
