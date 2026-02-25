'use client';

import React, { useEffect, useState } from 'react';
import { OcrGridResult } from './RecognitionEngine';

export type OcrAttendanceRecord = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  workType: string;
  note: string;
  errors: string[];
};

type Props = {
  ocrResult: OcrGridResult | null;
  records: OcrAttendanceRecord[];
  setRecords: (records: OcrAttendanceRecord[]) => void;
};

type Staff = {
  id: number;
  name: string;
};

export default function ResultTable({ records, setRecords }: Props) {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadStaff = async () => {
      try {
        const res = await fetch('/api/staff');
        if (!res.ok) return;
        const json = await res.json();
        const list = Array.isArray(json)
          ? json
          : Array.isArray(json.data)
          ? json.data
          : [];
        const mapped: Staff[] = list.map((s: any) => ({
          id: Number(s.id),
          name: s.name || `員工#${s.id}`,
        }));
        setStaffList(mapped);
      } catch (e) {
        console.error('載入員工清單失敗', e);
      }
    };
    loadStaff();
  }, []);

  const updateField = (
    id: string,
    field: keyof OcrAttendanceRecord,
    value: string
  ) => {
    setRecords(
      records.map((r) =>
        r.id === id
          ? {
              ...r,
              [field]: value,
            }
          : r
      )
    );
  };

  const handleSubmit = async () => {
    if (!records.length) {
      alert('目前沒有可送出的紀錄');
      return;
    }
    if (!selectedStaffId) {
      alert('請先選擇員工');
      return;
    }
    const staffIdNum = Number(selectedStaffId);
    const staff = staffList.find((s) => s.id === staffIdNum);
    if (!staff) {
      alert('選擇的員工不存在，請重新選擇');
      return;
    }

    const validRecords = records.filter((r) => r.startTime || r.endTime);
    if (!validRecords.length) {
      alert('所有列皆為空白時間，無需送出');
      return;
    }

    setSubmitting(true);
    try {
      await Promise.all(
        validRecords.map((r) =>
          fetch('/api/attendance', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              staffId: staffIdNum,
              staffName: staff.name,
              date: r.date,
              startTime: r.startTime,
              endTime: r.endTime,
              workType: r.workType,
              note: r.note,
            }),
          })
        )
      );
      alert('批次補登完成');
      setRecords([]);
    } catch (e) {
      console.error('批次送出失敗', e);
      alert('批次送出失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  if (!records.length) {
    return (
      <div className="flex-1 flex flex-col min-h-0 items-center justify-center text-slate-400 text-sm">
        尚未有辨識結果，請先於左側上傳並執行 OCR。
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <div className="font-bold text-slate-700 text-sm">辨識結果校正</div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">此卡片歸屬員工：</span>
          <select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            className="border rounded px-2 py-1 text-xs"
          >
            <option value="">請選擇員工</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 border-b text-slate-500">
            <tr>
              <th className="px-2 py-1 text-left">日期</th>
              <th className="px-2 py-1 text-left">上班時間</th>
              <th className="px-2 py-1 text-left">下班時間</th>
              <th className="px-2 py-1 text-left">類型</th>
              <th className="px-2 py-1 text-left">備註</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-2 py-1 whitespace-nowrap text-slate-700">
                  {r.date}
                </td>
                <td className="px-2 py-1">
                  <input
                    value={r.startTime}
                    onChange={(e) =>
                      updateField(r.id, 'startTime', e.target.value)
                    }
                    className="w-20 border rounded px-1 py-0.5 text-xs"
                    placeholder="HH:MM"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    value={r.endTime}
                    onChange={(e) =>
                      updateField(r.id, 'endTime', e.target.value)
                    }
                    className="w-20 border rounded px-1 py-0.5 text-xs"
                    placeholder="HH:MM"
                  />
                </td>
                <td className="px-2 py-1 text-slate-700">{r.workType}</td>
                <td className="px-2 py-1">
                  <input
                    value={r.note}
                    onChange={(e) => updateField(r.id, 'note', e.target.value)}
                    className="w-full border rounded px-1 py-0.5 text-xs"
                    placeholder="備註"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 border-t flex items-center justify-end gap-2">
        <button
          onClick={handleSubmit}
          disabled={submitting || !records.length}
          className="px-4 py-1.5 text-xs rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? '送出中...' : '批次送出補登紀錄'}
        </button>
      </div>
    </div>
  );
}

