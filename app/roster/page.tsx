'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

const SHIFT_CONFIG = {
  M: { label: '早', activeClass: 'bg-orange-400', time: '08:00-12:30' },
  A: { label: '午', activeClass: 'bg-blue-400',   time: '15:00-18:00' },
  N: { label: '晚', activeClass: 'bg-purple-400', time: '18:00-21:00' },
};

const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

type Staff = { id: number; name: string; role: string; display_order: number; };
type Shift = 'M' | 'A' | 'N';
type RosterData = { shifts: Shift[]; day_type: 'normal' | 'rest' | 'regular'; };

const GROUP_CLINIC = ['護理師', '櫃台', '診所助理'];
const GROUP_PHARMACY = ['藥師', '藥局助理'];

export default function PublicRosterPage() {
  const [currentDate, setCurrentDate] = useState<Date | null>(null); 
  const [todayStr, setTodayStr] = useState('');
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [rosterMap, setRosterMap] = useState<Record<string, RosterData>>({});
  const [holidays, setHolidays] = useState<string[]>([]);

  useEffect(() => { 
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setTodayStr(`${y}-${m}-${day}`);
    setCurrentDate(new Date()); 
  }, []);

  useEffect(() => { 
    if(currentDate) { fetchStaff(); fetchRoster(); fetchHolidays(); }
  }, [currentDate]);

  const fetchStaff = async () => {
    const { data } = await supabase.from('staff').select('*').order('role').order('display_order');
    if (data) {
      // 🟢 修正：過濾掉 '營養師'
      const validStaff = data.filter((s: any) => s.role !== '醫師' && s.role !== '主管' && s.role !== '營養師');
      // @ts-ignore
      setStaffList(validStaff);
    }
  };

  const fetchHolidays = async () => {
    if(!currentDate) return;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonthDate = new Date(year, month, 1); 
    const endStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
    const { data } = await supabase.from('clinic_holidays').select('date').gte('date', startStr).lt('date', endStr);
    if (data) setHolidays(data.map((h: any) => h.date));
  };

  const fetchRoster = async () => {
    if(!currentDate) return;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonthDate = new Date(year, month, 1); 
    const endStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

    const { data } = await supabase.from('roster').select('*').gte('date', startStr).lt('date', endStr);
    const map: Record<string, RosterData> = {};
    data?.forEach((r: any) => { 
      let shifts: Shift[] = [];
      if (Array.isArray(r.shifts)) shifts = r.shifts.filter((s:any) => typeof s === 'string' && ['M','A','N'].includes(s));
      let day_type = 'normal';
      if (r.day_type === 'rest') day_type = 'rest';
      if (r.day_type === 'regular') day_type = 'regular';
      // @ts-ignore
      map[`${r.staff_id}_${r.date}`] = { shifts, day_type };
    });
    setRosterMap(map);
  };

  const getDaysInMonth = () => {
    if(!currentDate) return [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysCount = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysCount }, (_, i) => {
      const d = new Date(year, month, i + 1);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      return { dateObj: d, dateStr: dateStr, dayOfWeek: d.getDay() };
    });
  };

  if (!currentDate) return <div className="p-8 text-center text-gray-500">載入中...</div>;

  const days = getDaysInMonth();
  const weekDays = ['日','一','二','三','四','五','六'];

  const renderTable = (title: string, groupRoles: string[], colorClass: string) => {
    const groupStaff = staffList.filter(s => groupRoles.includes(s.role || ''));
    if (groupStaff.length === 0) return null;

    return (
      <div className="mb-8">
        <h3 className={`font-bold text-md mb-2 px-2 border-l-4 ${colorClass}`}>{title}</h3>
        {/* 🟢 加入 overflow-x-auto */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white shadow-sm rounded-lg text-xs md:text-sm">
            <thead>
              <tr>
                {/* 🟢 加入 sticky left-0 */}
                <th className="p-2 border bg-slate-50 sticky left-0 z-20 min-w-[80px] text-left text-slate-500 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">員工</th>
                {days.map(d => {
                  const isToday = d.dateStr === todayStr;
                  const isHoliday = holidays.includes(d.dateStr);
                  
                  let headerBg = 'bg-slate-50';
                  let textColor = 'text-slate-800';
                  if (isHoliday) { headerBg = 'bg-red-100'; textColor = 'text-red-700'; }
                  else if (isToday) headerBg = 'bg-yellow-100';
                  else if (d.dayOfWeek === 0 || d.dayOfWeek === 6) { headerBg = 'bg-red-50'; textColor = 'text-red-600'; }

                  return (
                    <th key={d.dateStr} className={`p-1 border text-center min-w-[30px] ${headerBg} ${textColor} ${isToday ? 'border-b-2 border-yellow-400' : ''}`}>
                      <div>{d.dateObj.getDate()}</div><div className="text-[10px]">{isHoliday ? '國' : weekDays[d.dayOfWeek]}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {groupStaff.map(staff => (
                <tr key={staff.id}>
                  {/* 🟢 加入 sticky left-0 */}
                  <td className="p-2 border font-bold text-slate-700 sticky left-0 z-10 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{staff.name}</td>
                  {days.map(d => {
                    const key = `${staff.id}_${d.dateStr}`;
                    const data = rosterMap[key] || { shifts: [], day_type: 'normal' };
                    const isToday = d.dateStr === todayStr;
                    const isHoliday = holidays.includes(d.dateStr);
                    
                    let cellBg = isToday ? 'bg-yellow-50' : '';
                    if (isHoliday) cellBg = 'bg-red-50/30';

                    let badge = null;
                    if (data.day_type === 'rest') {
                      if(!isToday) cellBg = 'bg-emerald-50';
                      badge = <span className="block text-[8px] text-emerald-600 font-bold mb-0.5">休</span>;
                    } else if (data.day_type === 'regular') {
                      cellBg = 'bg-red-50';
                      badge = <span className="block text-[8px] text-red-500 font-bold mb-0.5">例</span>;
                    }

                    return (
                      <td key={d.dateStr} className={`border p-0.5 text-center align-top h-10 ${cellBg} ${isToday ? 'border-x-2 border-yellow-300' : ''}`}>
                        {badge}
                        <div className="flex flex-col gap-[1px] h-full justify-center">
                          {(['M','A','N'] as Shift[]).map(s => {
                            if(!data.shifts.includes(s)) return null;
                            // @ts-ignore
                            const cfg = SHIFT_CONFIG[s];
                            return <div key={s} className={`h-2.5 w-full rounded-[1px] ${cfg.activeClass}`} title={cfg.label}></div>;
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-slate-800">
            <Calendar className="text-blue-500"/>
            <h1 className="text-xl font-bold">診所班表查詢</h1>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-full text-sm">
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-1 hover:bg-white rounded-full"><ChevronLeft/></button>
            <span className="font-bold min-w-[80px] text-center">{currentDate.getFullYear()}/{currentDate.getMonth() + 1}</span>
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-1 hover:bg-white rounded-full"><ChevronRight/></button>
          </div>
        </div>

        <div className="pb-8">
          {renderTable("🏥 診所人員", GROUP_CLINIC, "border-blue-500 text-blue-700")}
          {renderTable("💊 藥局人員", GROUP_PHARMACY, "border-green-500 text-green-700")}
        </div>

        <div className="text-center text-xs text-slate-400 mt-8">
          僅供內部查詢使用 • 黃底標示為今日
        </div>
      </div>
    </div>
  );
}