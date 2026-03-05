'use client';

import React from 'react';
import { Clock, Save, X } from 'lucide-react';
import { BusinessHours, ShiftConfig } from './types';

type TimeSettingModalProps = {
    isOpen: boolean;
    onClose: () => void;
    businessHours: BusinessHours;
    setBusinessHours: React.Dispatch<React.SetStateAction<BusinessHours>>;
    setShiftsConfig: React.Dispatch<React.SetStateAction<ShiftConfig[]>>;
    handleSaveGlobalTime: () => void;
};

export default function TimeSettingModal({
    isOpen,
    onClose,
    businessHours,
    setBusinessHours,
    setShiftsConfig,
    handleSaveGlobalTime,
}: TimeSettingModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200 overflow-hidden">
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2">
                        <Clock size={18} /> 設定班表預設時間
                    </h3>
                    <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800 mb-4">
                        💡 修改此處會更新系統預設值。點擊排班格子時，將寫入當下設定的時間 (Snapshot)，避免日後修改設定影響舊班表。
                    </div>
                    {businessHours.shifts.map((shift, index) => (
                        <div key={shift.id} className="flex items-center gap-4">
                            <div className="w-16 text-center text-xs font-bold py-1 rounded text-white bg-slate-500">
                                {shift.name} ({shift.code})
                            </div>
                            <div className="flex items-center gap-2 flex-1">
                                <input
                                    type="time"
                                    value={shift.start}
                                    onChange={e => {
                                        const newShifts = businessHours.shifts.map((s, i) =>
                                            i === index ? { ...s, start: e.target.value } : s
                                        );
                                        setBusinessHours({ ...businessHours, shifts: newShifts });
                                        setShiftsConfig(newShifts);
                                    }}
                                    className="border rounded p-2 text-sm font-mono flex-1 text-center bg-slate-50 focus:bg-white transition outline-none focus:ring-2 focus:ring-blue-200"
                                />
                                <span className="text-slate-400">-</span>
                                <input
                                    type="time"
                                    value={shift.end}
                                    onChange={e => {
                                        const newShifts = businessHours.shifts.map((s, i) =>
                                            i === index ? { ...s, end: e.target.value } : s
                                        );
                                        setBusinessHours({ ...businessHours, shifts: newShifts });
                                        setShiftsConfig(newShifts);
                                    }}
                                    className="border rounded p-2 text-sm font-mono flex-1 text-center bg-slate-50 focus:bg-white transition outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </div>
                        </div>
                    ))}
                    <button
                        onClick={handleSaveGlobalTime}
                        className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold hover:bg-black transition flex justify-center items-center gap-2"
                    >
                        <Save size={18} /> 儲存並套用
                    </button>
                </div>
            </div>
        </div>
    );
}

