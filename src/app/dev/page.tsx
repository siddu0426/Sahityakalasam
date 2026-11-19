'use client';

import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, UserCheck, Shield, Key } from 'lucide-react';

export default function DevPage() {
  const isDevEnabled = process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true';

  if (!isDevEnabled) {
    notFound();
  }

  const { currentUser, switchUser, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-[#FAF8F5] p-6 max-w-md mx-auto">
      <div className="flex items-center gap-3 pb-4 border-b border-[#EAE5DC]">
        <Link href="/" className="p-2 rounded-full hover:bg-stone-200">
          <ArrowLeft className="w-5 h-5 text-[#1A2E2B]" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[#1A2E2B]">Developer Testing Console</h1>
          <p className="text-xs text-[#7A8B86]">Only active when NEXT_PUBLIC_ENABLE_DEV_TOOLS=true</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="p-4 bg-white rounded-2xl border border-[#EAE5DC] shadow-sm">
          <h2 className="text-sm font-bold text-[#1A2E2B] mb-2 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-teal-600" /> Current Session
          </h2>
          <p className="text-xs text-stone-600">
            User: <b>{currentUser?.display_name || 'Anonymous'}</b>
          </p>
          <p className="text-xs text-stone-600">
            Role: <b>{currentUser?.role || 'None'}</b>
          </p>
          <p className="text-xs text-stone-600 font-mono text-[11px] mt-1">
            ID: {currentUser?.id}
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#EAE5DC] shadow-sm space-y-2">
          <h2 className="text-sm font-bold text-[#1A2E2B] mb-2 flex items-center gap-2">
            <Key className="w-4 h-4 text-teal-600" /> Switch Test Persona
          </h2>
          <button
            onClick={() => switchUser('user-saanvi')}
            className="w-full py-2.5 px-3 text-left text-xs bg-stone-50 hover:bg-teal-50 hover:text-teal-900 rounded-xl font-medium border border-stone-200 transition-colors"
          >
            👤 Saanvi (Minor Narrator · Hyderabad)
          </button>
          <button
            onClick={() => switchUser('user-lakshmi')}
            className="w-full py-2.5 px-3 text-left text-xs bg-stone-50 hover:bg-teal-50 hover:text-teal-900 rounded-xl font-medium border border-stone-200 transition-colors"
          >
            👵 Lakshmi Garu (Elderly Narrator · Tirupati)
          </button>
          <button
            onClick={() => switchUser('user-aarav')}
            className="w-full py-2.5 px-3 text-left text-xs bg-stone-50 hover:bg-teal-50 hover:text-teal-900 rounded-xl font-medium border border-stone-200 transition-colors"
          >
            👦 Aarav (Panchatantra Teller · Visakhapatnam)
          </button>
          <button
            onClick={() => switchUser('user-admin')}
            className="w-full py-2.5 px-3 text-left text-xs bg-stone-50 hover:bg-teal-50 hover:text-teal-900 rounded-xl font-medium border border-stone-200 transition-colors"
          >
            🛡️ Kathalu Editorial Desk (Admin)
          </button>
        </div>

        {isAdmin && (
          <Link
            href="/admin"
            className="w-full py-3 bg-teal-700 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-sm"
          >
            <Shield className="w-4 h-4" /> Go to Protected Admin Desk
          </Link>
        )}
      </div>
    </div>
  );
}
