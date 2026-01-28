import React, { useState } from 'react';
import { User, Calendar, Save, Edit2, ChevronRight } from 'lucide-react';
import PortalTopHeader from './PortalTopHeader';

interface ProfileUser {
  name?: string | null;
  role?: string | null;
  start_date?: string | null;
  phone?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  bank_account?: string | null;
  id_number?: string | null;
  annual_leave_quota?: number | null;
  annual_leave_history?: any;
}

interface ProfileViewProps {
  user: ProfileUser | null;
  staffUser?: { name?: string | null; role?: string | null } | null;
  onUpdateProfile: (payload: {
    phone: string;
    address: string;
    emergency_contact: string;
  }) => Promise<void> | void;
}

// 遮罩敏感資料：顯示頭尾，其他以 * 取代
const maskSensitiveData = (value: string | null | undefined, showLength = 3) => {
  if (!value) return '未設定';
  if (value.length <= showLength * 2) return value;
  const start = value.slice(0, showLength);
  const end = value.slice(-showLength);
  return `${start}${'*'.repeat(Math.max(4, value.length - showLength * 2))}${end}`;
};

export default function ProfileView({
  user,
  staffUser,
  onUpdateProfile,
}: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showAnnualHistory, setShowAnnualHistory] = useState(false);

  const [form, setForm] = useState({
    phone: user?.phone || '',
    address: user?.address || '',
    emergency_contact: user?.emergency_contact || '',
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">載入個人資料中...</div>
      </div>
    );
  }

  const handleSave = async () => {
    await onUpdateProfile({
      phone: form.phone,
      address: form.address,
      emergency_contact: form.emergency_contact,
    });
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 max-w-md mx-auto shadow-2xl relative">
      {/* 共用頂部個人資訊區塊（以 staffUser 為主，若無則退回 user） */}
      <PortalTopHeader
        name={staffUser?.name ?? user.name}
        role={staffUser?.role ?? user.role}
      >
        <div className="flex items-center justify-between text-xs text-teal-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <User size={18} />
            </div>
            <span className="font-bold">員工資料</span>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-[11px] font-bold flex items-center gap-1 bg-white/10 border border-white/30 px-3 py-1.5 rounded-full"
            >
              <Edit2 size={11} />
              編輯
            </button>
          )}
        </div>
      </PortalTopHeader>

      <div className="p-4 space-y-4 text-sm">
        {/* 基本資料卡片 */}
        <div className="bg-white p-4 rounded-xl shadow-sm space-y-3">
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">姓名</label>
            <div className="text-sm font-bold text-slate-800">{user.name || '未設定'}</div>
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">職稱</label>
            <div className="text-sm font-bold text-slate-800">{user.role || '未設定'}</div>
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">到職日</label>
            <div className="text-sm font-bold text-slate-800">
              {user.start_date
                ? new Date(user.start_date).toLocaleDateString('zh-TW')
                : '未設定'}
            </div>
          </div>

          {/* 可編輯欄位：電話、地址、緊急聯絡人 */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">電話</label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full border p-2 rounded bg-slate-50 text-sm"
                  placeholder="請輸入電話"
                />
              ) : (
                <div className="text-sm font-bold text-slate-800">
                  {user.phone || '未設定'}
                </div>
              )}
            </div>
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">地址</label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full border p-2 rounded bg-slate-50 text-sm"
                  placeholder="請輸入地址"
                />
              ) : (
                <div className="text-sm font-bold text-slate-800">
                  {user.address || '未設定'}
                </div>
              )}
            </div>
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">緊急聯絡人</label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.emergency_contact}
                  onChange={(e) =>
                    setForm({ ...form, emergency_contact: e.target.value })
                  }
                  className="w-full border p-2 rounded bg-slate-50 text-sm"
                  placeholder="請輸入緊急聯絡人"
                />
              ) : (
                <div className="text-sm font-bold text-slate-800">
                  {user.emergency_contact || '未設定'}
                </div>
              )}
            </div>
          </div>

          {/* 敏感資料：銀行帳號、身分證字號（唯讀 + 遮罩） */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">銀行帳號</label>
              <div className="text-sm font-bold text-slate-800">
                {maskSensitiveData(user.bank_account || undefined)}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">如需修改請洽管理員</p>
            </div>
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">身分證字號</label>
              <div className="text-sm font-bold text-slate-800">
                {maskSensitiveData(user.id_number || undefined)}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">如需修改請洽管理員</p>
            </div>
          </div>

          {/* 編輯動作按鈕 */}
          {isEditing && (
            <div className="flex gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setForm({
                    phone: user.phone || '',
                    address: user.address || '',
                    emergency_contact: user.emergency_contact || '',
                  });
                }}
                className="flex-1 py-2 border rounded-lg text-xs font-bold text-slate-600"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2 bg-teal-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"
              >
                <Save size={12} />
                儲存
              </button>
            </div>
          )}
        </div>

        {/* 特休存摺 / 儀表板 */}
        <div className="bg-gradient-to-br from-teal-50 via-blue-50 to-indigo-50 p-4 rounded-xl shadow-md border border-teal-200 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={16} className="text-teal-600" />
            <h3 className="text-sm font-bold text-slate-800">特休存摺</h3>
          </div>

          {/* 到職日 */}
          {user.start_date && (
            <div className="bg-white/90 p-3 rounded-lg border border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-bold">到職日</span>
              <span className="text-sm font-black text-slate-800">
                {new Date(user.start_date).toLocaleDateString('zh-TW', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}

          {/* 今年額度 */}
          {user.annual_leave_quota !== null &&
            user.annual_leave_quota !== undefined && (
              <div className="bg-gradient-to-r from-teal-50 to-blue-50 p-3 rounded-lg border-2 border-teal-300">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-slate-600 font-bold">
                    今年特休額度
                  </span>
                  <span className="text-lg font-black text-teal-700">
                    {Number(user.annual_leave_quota).toFixed(1)} 天
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  額度以公司人事設定為準，如有疑問請洽管理員。
                </p>
              </div>
            )}

          {/* 歷年紀錄 Accordion（預設收合） */}
          {user.annual_leave_history && (
            <div className="bg-white/90 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setShowAnnualHistory((v) => !v)}
                className="w-full px-3 py-2 flex items-center justify-between"
              >
                <span className="text-[11px] font-bold text-slate-600">
                  歷年特休紀錄
                </span>
                <ChevronRight
                  size={14}
                  className={`text-slate-400 transition-transform ${
                    showAnnualHistory ? 'rotate-90' : ''
                  }`}
                />
              </button>
              {showAnnualHistory && (
                <div className="px-3 pb-3 pt-1 space-y-2 max-h-48 overflow-y-auto">
                  {typeof user.annual_leave_history === 'string' ? (
                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded">
                      {user.annual_leave_history}
                    </div>
                  ) : (
                    Object.entries(user.annual_leave_history)
                      .sort(([a], [b]) => b.localeCompare(a))
                      .map(([year, days]: [string, any]) => (
                        <div
                          key={year}
                          className="flex items-center justify-between bg-slate-50 p-2 rounded text-[11px]"
                        >
                          <span className="font-bold text-slate-700">
                            {year} 年
                          </span>
                          <span className="font-black text-teal-600">
                            {Number(days).toFixed(1)} 天
                          </span>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

