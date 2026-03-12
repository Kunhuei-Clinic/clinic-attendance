'use client';

import React, { useState } from 'react';
import { Settings, User, Building, QrCode } from 'lucide-react';
import StaffManagement from './settings/StaffManagement';
import SystemConfiguration from './settings/SystemConfiguration';
import QrGenerator from './settings/QrGenerator';

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState<'staff' | 'system' | 'qr'>('staff');

  return (
    <div className="w-full animate-fade-in space-y-6 pb-20">
      {/* 主選單切換 */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Settings className="text-gray-600"/> 
          {activeTab === 'staff' ? '人員檔案管理' : activeTab === 'system' ? '系統設定中心' : 'QR 下載'}
        </h2>
        <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('staff')} 
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition ${
              activeTab === 'staff' 
                ? 'bg-white shadow text-blue-700' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <User size={16}/> 人員
          </button>
          <button 
            onClick={() => setActiveTab('system')} 
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition ${
              activeTab === 'system' 
                ? 'bg-white shadow text-purple-700' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Building size={16}/> 系統
          </button>
          <button 
            onClick={() => setActiveTab('qr')} 
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition ${
              activeTab === 'qr' 
                ? 'bg-white shadow text-teal-700' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <QrCode size={16}/> QR 下載
          </button>
        </div>
      </div>

      {/* 根據 Tab 顯示對應元件 */}
      {activeTab === 'staff' && <StaffManagement />}
      {activeTab === 'system' && <SystemConfiguration />}
      {activeTab === 'qr' && <QrGenerator />}
    </div>
  );
}
