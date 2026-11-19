'use client';

import React from 'react';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#EDE9E3] flex flex-col items-center justify-start py-0 md:py-6 selection:bg-teal-200 selection:text-teal-900">
      {/* Main Mobile App Column Container (max-width 430px centered) */}
      <div className="w-full max-w-[430px] min-h-[100dvh] md:min-h-[880px] bg-[#FAF8F5] relative shadow-2xl flex flex-col md:rounded-3xl overflow-x-hidden border-x border-[#EAE5DC]">
        {children}
      </div>
    </div>
  );
};

