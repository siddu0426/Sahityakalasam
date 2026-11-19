'use client';

import React from 'react';
import { X, CheckCircle2, AlertCircle, Trophy, CreditCard, Heart, Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DataService } from '@/lib/data-service';
import { NotificationItem } from '@/lib/types';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onActionClick?: (item: NotificationItem) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  onActionClick,
}) => {
  const { currentUser } = useAuth();
  const notifications = currentUser ? DataService.getNotifications(currentUser.id) : [];

  if (!isOpen) return null;

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'weekly_winner':
        return <Trophy className="w-5 h-5 text-amber-500" />;
      case 'story_approved':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'story_rejected':
        return <AlertCircle className="w-5 h-5 text-rose-500" />;
      case 'credit_received':
        return <CreditCard className="w-5 h-5 text-teal-600" />;
      case 'new_vote':
        return <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />;
      default:
        return <Bell className="w-5 h-5 text-teal-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-[430px] bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-teal-700" />
            <h3 className="font-bold text-gray-900 text-base">నోటిఫికేషన్లు · Notifications</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="mt-3 flex-1 overflow-y-auto space-y-2.5 pr-1">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              నోటిఫికేషన్లు లేవు (No notifications yet)
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  DataService.markNotificationRead(item.id);
                  onActionClick?.(item);
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  item.is_read
                    ? 'bg-stone-50 border-gray-100'
                    : 'bg-teal-50/50 border-teal-200 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-white shadow-sm flex-shrink-0">
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-gray-900 leading-tight">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                      {item.message}
                    </p>
                    <span className="text-[10px] text-gray-400 mt-1 block font-medium">
                      {new Date(item.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
