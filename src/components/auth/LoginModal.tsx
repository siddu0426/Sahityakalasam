'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Mail, Phone, ShieldCheck, CheckCircle2, User, ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export const LoginModal: React.FC = () => {
  const { isLoginModalOpen, closeLoginModal, sendOtp, verifyOtp } = useAuth();

  const isPhoneOtpEnabled = process.env.NEXT_PUBLIC_ENABLE_PHONE_OTP === 'true';

  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [step, setStep] = useState<'input' | 'otp' | 'profile'>('input');
  const [emailAddress, setEmailAddress] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [otpValues, setOtpValues] = useState<string[]>(['', '', '', '', '', '']);
  const [timer, setTimer] = useState<number>(30);
  const [isResendActive, setIsResendActive] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // New profile fields
  const [displayName, setDisplayName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [age, setAge] = useState<string>('24');
  const [city, setCity] = useState<string>('Hyderabad');
  const [showAgeCity, setShowAgeCity] = useState<boolean>(true);
  const [guardianName, setGuardianName] = useState<string>('');
  const [guardianPhone, setGuardianPhone] = useState<string>('');
  const [guardianRelationship, setGuardianRelationship] = useState<string>('Parent');
  const [guardianConsent, setGuardianConsent] = useState<boolean>(true);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'otp' && timer > 0) {
      interval = setInterval(() => {
        setTimer((t) => t - 1);
      }, 1000);
    } else if (timer === 0) {
      setIsResendActive(true);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  if (!isLoginModalOpen) return null;

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');
    setIsLoading(true);

    if (authMethod === 'email') {
      const trimmedEmail = emailAddress.trim();
      if (!trimmedEmail || !trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
        setErrorMessage('దయచేసి సరైన ఈమెయిల్ ఇవ్వండి (Please enter a valid email address)');
        setIsLoading(false);
        return;
      }

      const res = await sendOtp({ email: trimmedEmail });
      setIsLoading(false);
      if (!res.success) {
        setErrorMessage(res.message || 'Failed to send OTP code');
        return;
      }
      setStatusMessage(`Verification code sent to ${trimmedEmail}`);
    } else {
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      if (cleanNumber.length !== 10) {
        setErrorMessage('దయచేసి సరైన 10 అంకెల మొబైల్ నంబర్ ఇవ్వండి (Enter valid 10-digit number)');
        setIsLoading(false);
        return;
      }

      const res = await sendOtp({ phone: `+91${cleanNumber}` });
      setIsLoading(false);
      if (!res.success) {
        setErrorMessage(res.message || 'Failed to send OTP code');
        return;
      }
      setStatusMessage(`Verification code sent to +91 ${cleanNumber}`);
    }

    setTimer(30);
    setIsResendActive(false);
    setOtpValues(['', '', '', '', '', '']);
    setStep('otp');
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }
    const newOtp = [...otpValues];
    newOtp[index] = value;
    setOtpValues(newOtp);

    // Auto-advance
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleResendOtp = async () => {
    if (!isResendActive) return;
    setIsLoading(true);
    setErrorMessage('');
    const res = await sendOtp(
      authMethod === 'email'
        ? { email: emailAddress.trim() }
        : { phone: `+91${phoneNumber.replace(/\D/g, '')}` }
    );
    setIsLoading(false);
    if (res.success) {
      setTimer(30);
      setIsResendActive(false);
      setStatusMessage('కొత్త కోడ్ పంపబడింది (New code sent)');
    } else {
      setErrorMessage(res.message || 'Failed to resend code');
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const otp = otpValues.join('');
    if (otp.length !== 6) {
      setErrorMessage('దయచేసి 6-అంకెల OTP పూర్తిగా నమోదు చేయండి (Enter full 6-digit OTP)');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    // Attempt direct login with OTP
    const res = await verifyOtp({
      email: authMethod === 'email' ? emailAddress.trim() : undefined,
      phone: authMethod === 'phone' ? `+91${phoneNumber.replace(/\D/g, '')}` : undefined,
      otp,
    });

    setIsLoading(false);

    if (res.success) {
      // User is verified and logged in!
      return;
    }

    // If verification error indicates profile setup is needed:
    if (res.message?.includes('Profile') || res.message?.includes('registration')) {
      setStep('profile');
    } else {
      setErrorMessage(res.message || 'Invalid verification code');
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    const parsedAge = age ? parseInt(age, 10) : undefined;
    const isUnder18 = parsedAge !== undefined && parsedAge < 18;

    if (isUnder18 && !guardianConsent) {
      setErrorMessage('Under-18 narrators require parent/guardian consent.');
      setIsLoading(false);
      return;
    }

    const res = await verifyOtp({
      email: authMethod === 'email' ? emailAddress.trim() : undefined,
      phone: authMethod === 'phone' ? `+91${phoneNumber.replace(/\D/g, '')}` : undefined,
      otp: otpValues.join(''),
      displayName: displayName.trim() || undefined,
      username: username.trim().replace(/^@/, '') || undefined,
      age: parsedAge,
      city: city.trim(),
      showAgeCity,
      isMinor: isUnder18,
      guardianName: isUnder18 ? guardianName : undefined,
      guardianPhone: isUnder18 ? guardianPhone : undefined,
      guardianRelationship: isUnder18 ? guardianRelationship : undefined,
      guardianConsent: isUnder18 ? guardianConsent : undefined,
    });

    setIsLoading(false);
    if (!res.success) {
      setErrorMessage(res.message || 'Login failed');
    }
  };

  const parsedAge = age ? parseInt(age, 10) : 0;
  const isMinor = parsedAge > 0 && parsedAge < 18;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-[430px] bg-white rounded-t-3xl sm:rounded-3xl shadow-float max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200 p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#EFEBE4]">
          <div className="flex items-center gap-2">
            {step !== 'input' && (
              <button
                onClick={() => setStep(step === 'profile' ? 'otp' : 'input')}
                className="p-1 -ml-1 text-[#627571] hover:text-teal-700"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h3 className="text-xl font-bold text-[#1A2E2B] font-telugu">
                {step === 'input' && 'కథలలోకి స్వాగతం'}
                {step === 'otp' && 'OTP ధృవీకరణ'}
                {step === 'profile' && 'మీ వివరాలు (Your Profile)'}
              </h3>
              <p className="text-[13px] text-[#627571]">
                {step === 'input' && 'Welcome to Kathalu · Real Supabase Auth'}
                {step === 'otp' && (authMethod === 'email' ? `Code sent to ${emailAddress}` : `Code sent to +91 ${phoneNumber}`)}
                {step === 'profile' && 'Set up your storyteller profile'}
              </p>
            </div>
          </div>
          <button
            onClick={closeLoginModal}
            className="p-2 text-[#7A8B86] hover:text-[#1A2E2B] rounded-full hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs font-medium border border-red-200 animate-in fade-in duration-200">
            {errorMessage}
          </div>
        )}

        {statusMessage && !errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-teal-50 text-teal-800 text-xs font-medium border border-teal-200 animate-in fade-in duration-200">
            {statusMessage}
          </div>
        )}

        {/* STEP 1: Email / Mobile Entry */}
        {step === 'input' && (
          <form onSubmit={handleSendCode} className="mt-6 space-y-4">
            {isPhoneOtpEnabled && (
              <div className="flex bg-stone-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAuthMethod('email')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                    authMethod === 'email' ? 'bg-white text-teal-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" /> Email OTP
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMethod('phone')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                    authMethod === 'phone' ? 'bg-white text-teal-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" /> Mobile OTP
                </button>
              </div>
            )}

            {authMethod === 'email' ? (
              <div>
                <label className="block text-xs font-bold text-[#1A2E2B] mb-1.5">
                  మీ ఈమెయిల్ (Email Address)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    placeholder="you@example.com"
                    autoFocus
                    required
                    className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm text-[#1A2E2B] focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white transition-all font-medium"
                  />
                </div>
                <p className="text-[11px] text-[#7A8B86] mt-1.5">
                  We will send a 6-digit login code to this email.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-[#1A2E2B] mb-1.5">
                  భారతీయ మొబైల్ నంబర్ (Mobile Number)
                </label>
                <div className="flex gap-2">
                  <span className="inline-flex items-center px-3.5 rounded-xl border border-stone-200 bg-stone-100 text-stone-700 font-bold text-sm">
                    🇮🇳 +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="98765 43210"
                    autoFocus
                    required
                    className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm text-[#1A2E2B] focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white transition-all font-medium"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 py-3.5 bg-teal-800 hover:bg-teal-900 active:scale-[0.98] text-white font-bold rounded-2xl shadow-sm text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> కోడ్ పంపుతున్నాము...
                </>
              ) : (
                'లాగిన్ కోడ్ పంపండి (Send Code)'
              )}
            </button>
          </form>
        )}

        {/* STEP 2: OTP Verification */}
        {step === 'otp' && (
          <form onSubmit={handleOtpVerify} className="mt-6 space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#1A2E2B] mb-2 text-center">
                6-అంకెల ధృవీకరణ కోడ్ ఇవ్వండి (Enter 6-digit OTP)
              </label>
              <div className="flex justify-between gap-2 max-w-[320px] mx-auto">
                {otpValues.map((val, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpInputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={val}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-11 h-13 text-center text-xl font-bold bg-stone-50 border-2 border-stone-200 focus:border-teal-700 focus:bg-white rounded-xl focus:outline-none transition-all"
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-[#7A8B86] pt-1">
              <span>కోడ్ రాలేదా? (Didn't receive code?)</span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={!isResendActive || isLoading}
                className="font-bold text-teal-800 disabled:text-stone-400 hover:underline"
              >
                {isResendActive ? 'మళ్ళీ పంపండి (Resend)' : `${timer}s లో రీసెండ్ చేయవచ్చు`}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading || otpValues.join('').length !== 6}
              className="w-full py-3.5 bg-teal-800 hover:bg-teal-900 active:scale-[0.98] text-white font-bold rounded-2xl shadow-sm text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> ధృవీకరిస్తున్నాము...
                </>
              ) : (
                'ధృవీకరించండి (Verify & Continue)'
              )}
            </button>
          </form>
        )}

        {/* STEP 3: Profile Registration (First-time users) */}
        {step === 'profile' && (
          <form onSubmit={handleFinalSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#1A2E2B] mb-1">
                మీ పేరు (Display Name) *
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="ఉదా: రాముడు / Sita Devi"
                required
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-teal-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1A2E2B] mb-1">
                యూజర్‌నేమ్ (Username) *
              </label>
              <div className="flex items-center bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5">
                <span className="text-stone-400 text-sm font-bold mr-1">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="ramu_stories"
                  required
                  className="w-full bg-transparent text-sm font-medium focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#1A2E2B] mb-1">
                  వయస్సు (Age)
                </label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1A2E2B] mb-1">
                  పట్టణం (City)
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="ఉదా: Hyderabad"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>

            {/* Child Safety Protection Notice for Under-18 */}
            {isMinor && (
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 space-y-3">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">
                      బాలల భద్రతా నిబంధన (Guardian Consent Safeguard)
                    </h4>
                    <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                      18 ఏళ్ల లోపు కథకులకు తల్లిదండ్రులు లేదా సంరక్షకుల అనుమతి తప్పనిసరి.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-1 border-t border-amber-200/60">
                  <input
                    type="text"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    placeholder="సంరక్షకుడి పేరు (Guardian's Full Name)"
                    required={isMinor}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-medium"
                  />
                  <input
                    type="tel"
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value)}
                    placeholder="సంరక్షకుడి ఫోన్ నంబర్ (+91...)"
                    required={isMinor}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-medium"
                  />
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={guardianConsent}
                      onChange={(e) => setGuardianConsent(e.target.checked)}
                      className="w-4 h-4 text-teal-700 rounded border-amber-400 focus:ring-amber-500"
                    />
                    <span className="text-[11px] text-amber-900 font-medium">
                      సంరక్షకులు అనుమతి ఇచ్చారు (I confirm parental/guardian consent)
                    </span>
                  </label>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || (isMinor && !guardianConsent)}
              className="w-full py-3.5 bg-teal-800 hover:bg-teal-900 active:scale-[0.98] text-white font-bold rounded-2xl shadow-sm text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> నమోదు చేస్తున్నాము...
                </>
              ) : (
                'పూర్తి చేయండి (Complete Registration)'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
