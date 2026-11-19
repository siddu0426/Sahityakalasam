'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { BottomNav, NavTab } from '@/components/layout/BottomNav';
import { HomeView } from '@/components/home/HomeView';
import { ListenView } from '@/components/listen/ListenView';
import { UploadWizard } from '@/components/upload/UploadWizard';
import { ProfileView } from '@/components/profile/ProfileView';
import { NowListeningView } from '@/components/player/NowListeningView';
import { MiniPlayer } from '@/components/player/MiniPlayer';
import { WeeklyWinnerModal } from '@/components/winner/WeeklyWinnerModal';
import { NotificationDrawer } from '@/components/notifications/NotificationDrawer';
import { LoginModal } from '@/components/auth/LoginModal';
import { Story } from '@/lib/types';

export default function HomePage() {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [isWinnerModalOpen, setIsWinnerModalOpen] = useState<boolean>(false);
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState<boolean>(false);
  const [resubmitStory, setResubmitStory] = useState<Story | null>(null);

  const handleResubmitStory = (story: Story) => {
    setResubmitStory(story);
    setCurrentTab('upload');
  };

  return (
    <AppShell>
      {/* Tab Views */}
      <main className="w-full flex-1">
        {currentTab === 'home' && (
          <HomeView
            onNavigateTab={(tab) => setCurrentTab(tab)}
            onOpenWinner={() => setIsWinnerModalOpen(true)}
          />
        )}

        {currentTab === 'listen' && <ListenView />}

        {currentTab === 'upload' && (
          <UploadWizard
            initialResubmitStory={resubmitStory}
            onStorySubmitted={() => {
              setResubmitStory(null);
              setCurrentTab('profile');
            }}
          />
        )}

        {currentTab === 'profile' && (
          <ProfileView
            onResubmitStory={handleResubmitStory}
            onOpenNotifications={() => setIsNotifDrawerOpen(true)}
          />
        )}
      </main>

      {/* Floating Mini Player (visible across all tabs when audio is active) */}
      <MiniPlayer />

      {/* Fixed Bottom Navigation */}
      <BottomNav currentTab={currentTab} onTabChange={(tab) => setCurrentTab(tab)} />

      {/* Full Screen "Now Listening" View */}
      <NowListeningView />

      {/* Weekly Winner Celebration Modal */}
      <WeeklyWinnerModal
        isOpen={isWinnerModalOpen}
        onClose={() => setIsWinnerModalOpen(false)}
      />

      {/* In-app Notifications Drawer */}
      <NotificationDrawer
        isOpen={isNotifDrawerOpen}
        onClose={() => setIsNotifDrawerOpen(false)}
        onActionClick={(item) => {
          setIsNotifDrawerOpen(false);
          if (item.type === 'weekly_winner') {
            setIsWinnerModalOpen(true);
          } else if (item.type === 'story_rejected') {
            setCurrentTab('profile');
          }
        }}
      />

      {/* Phone OTP Auth Modal */}
      <LoginModal />
    </AppShell>
  );
}
