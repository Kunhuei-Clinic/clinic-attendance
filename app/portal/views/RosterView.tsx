'use client';

import React from 'react';
import { FileText } from 'lucide-react';

interface RosterItem {
  date: string;
  shift_code?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

interface RosterViewProps {
  rosterData: RosterItem[];
  staffRole: string;
}

const getShiftLabel = (code: string) => {
  if (code === 'AM') {
    return {
      label: '早診',
      color: 'bg-orange-100 text-orange-700 border-orange-300',
    };
  }
  if (code === 'PM') {
    return {
      label: '午診',
      color: 'bg-blue-100 text-blue-700 border-blue-300',
    };
  }
  if (code === 'NIGHT') {
    return {
      label: '晚診',
      color: 'bg-purple-100 text-purple-700 border-purple-300',
    };
  }
  return {
    label: code || '班別',
    color: 'bg-slate-100 text-slate-700 border-slate-300',
  };
};

export default function RosterView({ rosterData, staffRole }: RosterViewProps) {
  return (
    <div className="min-h-screen bg-slate-50 pb-24 max-w-md mx-auto shadow-2xl relative">
      <div className="p-4 space-y-4">
        <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
          <FileText size={18} />
          近期班表 ({staffRole})
        </h3>

        <div className="space-y-2">
          {rosterData.map((r, i) => {
            const shiftInfo = getShiftLabel(r.shift_code || '');

            return (
              <div
                key={`${r.date}-${i}`}
                className="bg-white p-3 rounded-xl border-l-4 border-teal-500 shadow-sm flex flex-col gap-1"
              >
                <div className="flex justify-between items-center mb-1">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-700 text-sm">
                      {r.date}
                    </span>
                    {staffRole !== '醫師' && (
                      <span className="text-[11px] text-slate-400">
                        {r.start_time
                          ? `${r.start_time}-${r.end_time || ''}`
                          : '詳見班表'}
                      </span>
                    )}
                  </div>

                  {staffRole === '醫師' && r.shift_code && (
                    <span
                      className={`text-[11px] font-bold px-2 py-1 rounded border ${shiftInfo.color}`}
                    >
                      {shiftInfo.label}
                    </span>
                  )}
                </div>

                {staffRole === '醫師' && (
                  <div className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">
                    {r.start_time && r.end_time
                      ? `${r.start_time}-${r.end_time}`
                      : '時間未設定'}
                  </div>
                )}
              </div>
            );
          })}

          {rosterData.length === 0 && (
            <div className="text-center text-slate-400 py-4 text-xs">
              近期無排班
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

