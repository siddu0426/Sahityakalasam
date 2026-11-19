'use client';

import React from 'react';
import { Home, Headphones, PlusCircle, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DataService } from '@/lib/data-service';

export type NavTab = 'home' | 'listen' | 'upload' | 'profile';

interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  pendingItemsCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  pendingItemsCount,
}) => {
  const { currentUser } = useAuth();

  // Check if there is an actual pending story or rejected story needing attention
  const userStories = currentUser ? DataService.getNarratorStories(currentUser.id) : [];
  const realPendingCount =
    pendingItemsCount !== undefined
      ? pendingItemsCount
      : userStories.filter((s) => s.status === 'pending' || s.status === 'rejected').length;

  const tabs: {
    id: NavTab;
    label: string;
    teluguLabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'home', label: 'Home', teluguLabel: 'హోమ్', icon: Home },
    { id: 'listen', label: 'Listen', teluguLabel: 'వినండి', icon: Headphones },
    { id: 'upload', label: 'Upload', teluguLabel: 'చెప్పండి', icon: PlusCircle },
    { id: 'profile', label: 'Profile', teluguLabel: 'ప్రొఫైల్', icon: User },
  ];

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40 bg-white/95 backdrop-blur-md border-t border-[#EAE5DC] px-2 py-1.5 shadow-nav transition-all duration-200"
      style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      aria-label="Main Navigation"
    >
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all duration-150 tap-target relative ${
                isActive ? 'text-[#1F7A6D]' : 'text-[#627571] hover:text-[#1F7A6D]'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-6 h-6 transition-transform duration-150 ${
                    isActive ? 'scale-110 stroke-[2.5px] text-[#1F7A6D]' : 'stroke-[1.75px]'
                  }`}
                />
                {/* Upload badge shows only when there is a real pending item */}
                {tab.id === 'upload' && realPendingCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full shadow-sm">
                    {realPendingCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[12px] tracking-tight mt-1 transition-all ${
                  isActive ? 'font-bold text-[#1F7A6D]' : 'font-medium text-[#7A8B86]'
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#1F7A6D] mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
