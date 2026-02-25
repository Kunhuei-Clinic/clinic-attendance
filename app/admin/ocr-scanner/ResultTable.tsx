'use client';

import React from 'react';
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

export default function ResultTable({ records, setRecords }: Props) {
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
    </div>
  );
}

