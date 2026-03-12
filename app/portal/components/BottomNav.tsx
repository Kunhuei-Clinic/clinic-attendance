'use client';

import React from 'react';
import { Clock, Calendar, DollarSign, History, Coffee, User } from 'lucide-react';

type ViewType = 'home' | 'history' | 'roster' | 'leave' | 'payslip' | 'profile';

interface BottomNavProps {
  view: ViewType;
  setView: (v: ViewType) => void;
}

export default function BottomNav({ view, setView }: BottomNavProps) {
  const navClass = (v: ViewType) =>
    `flex flex-col items-center gap-1 w-14 p-1.5 rounded-xl transition ${
      view === v ? 'text-teal-600 bg-teal-50' : ''
    }`;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-2 pb-6 pb-[env(safe-area-inset-bottom)] flex justify-around items-center text-[10px] font-bold text-slate-400 z-50 max-w-md mx-auto">
      <button onClick={() => setView('home')} className={navClass('home')}>
        <Clock size={20} />
        打卡
      </button>
      <button onClick={() => setView('history')} className={navClass('history')}>
        <History size={20} />
        紀錄
      </button>
      <button onClick={() => setView('roster')} className={navClass('roster')}>
        <Calendar size={20} />
        班表
      </button>
      <button onClick={() => setView('leave')} className={navClass('leave')}>
        <Coffee size={20} />
        請假
      </button>
      <button onClick={() => setView('payslip')} className={navClass('payslip')}>
        <DollarSign size={20} />
        薪資
      </button>
      <button onClick={() => setView('profile')} className={navClass('profile')}>
        <User size={20} />
        個人
      </button>
    </div>
  );
}
