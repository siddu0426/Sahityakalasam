'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Profile } from '../lib/types';
import { createClient } from '../lib/supabase/client';

interface AuthContextType {
  currentUser: Profile | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  creditsCount: number;
  isLoading: boolean;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  sendOtp: (params: { email?: string; phone?: string }) => Promise<{ success: boolean; message?: string }>;
  verifyOtp: (params: {
    email?: string;
    phone?: string;
    otp: string;
    displayName?: string;
    username?: string;
    age?: number;
    city?: string;
    showAgeCity?: boolean;
    isMinor?: boolean;
    guardianName?: string;
    guardianPhone?: string;
    guardianRelationship?: string;
    guardianConsent?: boolean;
  }) => Promise<{ success: boolean; message?: string }>;
  loginWithOtp: (params: {
    phone?: string;
    email?: string;
    otp: string;
    displayName: string;
    username: string;
    age?: number;
    city?: string;
    showAgeCity?: boolean;
    isMinor?: boolean;
    guardianName?: string;
    guardianPhone?: string;
    guardianRelationship?: string;
    guardianConsent?: boolean;
  }) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  switchUser: (userId: string) => void;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  refreshCredits: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [creditsCount, setCreditsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  const supabase = createClient();

  const fetchProfileAndCredits = useCallback(async (token?: string) => {
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/auth/me', { headers });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.profile);
        setCreditsCount(data.availableCredits || 0);
      } else {
        setCurrentUser(null);
        setCreditsCount(0);
      }
    } catch (e) {
      console.warn('Failed to load authenticated user profile:', e);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshCredits = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await fetchProfileAndCredits(session?.access_token);
  }, [supabase, fetchProfileAndCredits]);

  useEffect(() => {
    // 1. Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfileAndCredits(session.access_token);
      } else {
        setIsLoading(false);
      }
    });

    // 2. Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await fetchProfileAndCredits(session.access_token);
      } else {
        setCurrentUser(null);
        setCreditsCount(0);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfileAndCredits]);

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);

  const sendOtp = async (params: { email?: string; phone?: string }): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'Failed to send verification code' };
      }
      return { success: true, message: data.message };
    } catch (e: any) {
      return { success: false, message: e.message || 'Network error sending OTP' };
    }
  };

  const verifyOtp = async (params: {
    email?: string;
    phone?: string;
    otp: string;
    displayName?: string;
    username?: string;
    age?: number;
    city?: string;
    showAgeCity?: boolean;
    isMinor?: boolean;
    guardianName?: string;
    guardianPhone?: string;
    guardianRelationship?: string;
    guardianConsent?: boolean;
  }): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'Verification failed' };
      }

      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      if (data.profile) {
        setCurrentUser(data.profile);
      }

      await refreshCredits();
      setIsLoginModalOpen(false);
      return { success: true, message: 'Logged in successfully' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Verification error' };
    }
  };

  const loginWithOtp = async (params: {
    phone?: string;
    email?: string;
    otp: string;
    displayName: string;
    username: string;
    age?: number;
    city?: string;
    showAgeCity?: boolean;
    isMinor?: boolean;
    guardianName?: string;
    guardianPhone?: string;
    guardianRelationship?: string;
    guardianConsent?: boolean;
  }) => {
    return verifyOtp(params);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setCreditsCount(0);
  };

  const switchUser = (userId: string) => {
    // Only allowed if NEXT_PUBLIC_ENABLE_DEV_TOOLS is true
    if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS !== 'true') return;
    console.warn('Persona switching is active only in developer test console');
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!currentUser) return;
    setCurrentUser((prev) => (prev ? { ...prev, ...updates } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoggedIn: Boolean(currentUser),
        isAdmin: currentUser?.role === 'admin',
        creditsCount,
        isLoading,
        isLoginModalOpen,
        openLoginModal,
        closeLoginModal,
        sendOtp,
        verifyOtp,
        loginWithOtp,
        logout,
        switchUser,
        updateProfile,
        refreshCredits,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
