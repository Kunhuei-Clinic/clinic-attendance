'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, FileSpreadsheet } from 'lucide-react';
import { saveAs } from 'file-saver';
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
  id: string; // UUID
  name: string;
};

const calculateHours = (start: string, end: string) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60; // 跨夜處理
  return diff / 60;
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
        // 權重排序：依照職類分組排序
        const roleWeight: Record<string, number> = { 
          '醫師': 1, 
          '主管': 2, 
          '櫃台': 3, 
          '護理師': 4, 
          '營養師': 5, 
          '診助': 6, 
          '藥師': 7, 
          '藥局助理': 8 
        };
        const sorted = [...list].sort((a, b) => {
          const aWeight = roleWeight[a.role || ''] ?? 999;
          const bWeight = roleWeight[b.role || ''] ?? 999;
          if (aWeight !== bWeight) return aWeight - bWeight;
          // 同職類內按姓名排序
          return (a.name || '').localeCompare(b.name || '');
        });
        const mapped: Staff[] = sorted.map((s: any) => ({
          id: s.id,
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

  const handleTimeChange = (
    id: string,
    field: 'startTime' | 'endTime',
    rawValue: string
  ) => {
    // 只保留數字
    let val = rawValue.replace(/\D/g, '');
    // 最多四碼 (HHmm)
    val = val.slice(0, 4);
    // 自動補冒號
    if (val.length >= 3) {
      val = val.slice(0, 2) + ':' + val.slice(2);
    }
    updateField(id, field, val);
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
    const staff = staffList.find((s) => s.id === selectedStaffId);
    if (!staff) {
      alert('選擇的員工不存在，請重新選擇');
      return;
    }

    if (records.some((r) => !r.startTime || !r.endTime)) {
      alert('尚有缺漏的上下班時間，請補齊後再送出！');
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
              staffId: selectedStaffId,
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

  const handleExportCSV = () => {
    if (!records.length) {
      return alert('沒有可匯出的資料');
    }
    if (!selectedStaffId) {
      return alert('請先選擇歸屬員工，以便在報表上顯示姓名');
    }

    const staff = staffList.find((s) => String(s.id) === selectedStaffId);
    const staffName = staff ? staff.name : '未知員工';

    const firstDate = records[0].date;
    const dateObj = new Date(firstDate);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    const grouped: Record<string, any> = {};

    records.forEach((r) => {
      if (!r.startTime && !r.endTime) return;

      const d = r.date;
      if (!grouped[d]) {
        grouped[d] = {
          amIn: '',
          amOut: '',
          amHrs: 0,
          pmIn: '',
          pmOut: '',
          pmHrs: 0,
          otIn: '',
          otOut: '',
          otHrs: 0,
          notes: [] as string[],
        };
      }

      const hrs = calculateHours(r.startTime, r.endTime);
      const n = r.note || '';
      if (n) grouped[d].notes.push(n);

      if (n.includes('早')) {
        grouped[d].amIn = r.startTime;
        grouped[d].amOut = r.endTime;
        grouped[d].amHrs = hrs;
      } else if (n.includes('午')) {
        grouped[d].pmIn = r.startTime;
        grouped[d].pmOut = r.endTime;
        grouped[d].pmHrs = hrs;
      } else {
        grouped[d].otIn = r.startTime;
        grouped[d].otOut = r.endTime;
        grouped[d].otHrs = hrs;
      }
    });

    const headers = [
      '日期',
      '星期',
      '早上班',
      '早下班',
      '早時數',
      '午上班',
      '午下班',
      '午時數',
      '晚上班',
      '晚下班',
      '晚時數',
      '單日總時數',
      '備註',
    ];
    const rows: string[][] = [];
    let totalMonthHours = 0;

    for (let i = 1; i <= daysInMonth; i++) {
      const dStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(
        2,
        '0'
      )}`;
      const dObj2 = new Date(year, month - 1, i);
      const weekday = ['日', '一', '二', '三', '四', '五', '六'][dObj2.getDay()];

      if (grouped[dStr]) {
        const r = grouped[dStr];
        const total = (r.amHrs || 0) + (r.pmHrs || 0) + (r.otHrs || 0);
        totalMonthHours += total;
        const uniqueNotes = Array.from(new Set(r.notes)).join('; ');
        rows.push([
          `${month}/${i}`,
          weekday,
          r.amIn,
          r.amOut,
          r.amHrs ? r.amHrs.toFixed(2) : '',
          r.pmIn,
          r.pmOut,
          r.pmHrs ? r.pmHrs.toFixed(2) : '',
          r.otIn,
          r.otOut,
          r.otHrs ? r.otHrs.toFixed(2) : '',
          total ? total.toFixed(2) : '',
          uniqueNotes,
        ]);
      } else {
        rows.push([`${month}/${i}`, weekday, '', '', '', '', '', '', '', '', '', '', '']);
      }
    }

    rows.push([]);
    rows.push([
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '本月總工時',
      totalMonthHours.toFixed(2),
      '',
    ]);

    const titleRow = [`${year}年${month}月 考勤表 (獨立 OCR 辨識) - ${staffName}`];
    const csvContent =
      '\uFEFF' +
      titleRow.join(',') +
      '\n' +
      headers.join(',') +
      '\n' +
      rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${year}年${month}月_${staffName}_OCR打卡表.csv`);
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
            {records.map((r) => {
              const hasError = r.errors && r.errors.length > 0;
              return (
                <tr
                  key={r.id}
                  className={`border-b last:border-0 ${
                    hasError
                      ? 'bg-red-50 hover:bg-red-100'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-2 py-1 whitespace-nowrap text-slate-700">
                    {r.date}
                    {hasError && (
                      <span
                        className="inline-flex items-center ml-1 text-red-500"
                        title={r.errors.join('、')}
                      >
                        <AlertCircle size={14} className="inline" />
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <input
                      value={r.startTime}
                      onChange={(e) =>
                        handleTimeChange(r.id, 'startTime', e.target.value)
                      }
                      className={`w-20 border rounded px-1 py-0.5 text-xs ${
                        !r.startTime ? 'border-red-400 bg-red-100' : ''
                      }`}
                      placeholder="HH:MM"
                      maxLength={5}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      value={r.endTime}
                      onChange={(e) =>
                        handleTimeChange(r.id, 'endTime', e.target.value)
                      }
                      className={`w-20 border rounded px-1 py-0.5 text-xs ${
                        !r.endTime ? 'border-red-400 bg-red-100' : ''
                      }`}
                      placeholder="HH:MM"
                      maxLength={5}
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
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 border-t flex items-center justify-end gap-2">
        <button
          onClick={handleExportCSV}
          disabled={!records.length}
          className="px-4 py-1.5 text-xs rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
        >
          <FileSpreadsheet size={14} /> 直接匯出全月 CSV (不寫入)
        </button>
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

