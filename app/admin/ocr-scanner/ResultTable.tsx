'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Upload } from 'lucide-react';

export type OcrAttendanceRecord = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  workType: '正常班' | '加班';
  note: string;
  errors: string[];
  staffId?: number;
  staffName?: string;
};

type StaffOption = {
  id: number;
  name: string;
  role?: string | null;
};

type Props = {
  ocrResult: any;
  records: OcrAttendanceRecord[];
  setRecords: (records: OcrAttendanceRecord[]) => void;
};

const ResultTable: React.FC<Props> = ({ ocrResult, records, setRecords }) => {
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const res = await fetch('/api/staff');
        const data = await res.json();
        if (data?.data) {
          setStaffOptions(data.data);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchStaff();
  }, []);

  useEffect(() => {
    if (!selectedStaffId || staffOptions.length === 0) return;
    const staff = staffOptions.find((s) => String(s.id) === selectedStaffId);
    if (!staff) return;
    setRecords(
      records.map((r) => ({
        ...r,
        staffId: staff.id,
        staffName: staff.name,
      }))
    );
  }, [selectedStaffId]);

  const handleFieldChange = (id: string, field: keyof OcrAttendanceRecord, value: any) => {
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

  const validateRecord = (r: OcrAttendanceRecord): string[] => {
    const errors: string[] = [];
    if (!r.date) errors.push('缺少日期');
    if (!r.startTime) errors.push('缺少上班時間');
    if (!r.staffId) errors.push('未選擇員工');
    if (r.startTime && !/^\d{1,2}:\d{2}$/.test(r.startTime)) errors.push('上班時間格式錯誤');
    if (r.endTime && !/^\d{1,2}:\d{2}$/.test(r.endTime)) errors.push('下班時間格式錯誤');
    return errors;
  };

  const handleSubmit = async () => {
    if (records.length === 0) {
      alert('目前沒有可上傳的辨識結果');
      return;
    }

    const withErrors = records.map((r) => ({
      ...r,
      errors: validateRecord(r),
    }));
    setRecords(withErrors);

    const invalid = withErrors.filter((r) => r.errors.length > 0);
    if (invalid.length > 0) {
      alert('請先修正紅色欄位錯誤，再送出上傳。');
      return;
    }

    if (!confirm(`確定要將 ${records.length} 筆補登紀錄上傳到考勤系統嗎？`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      for (const r of withErrors) {
        const res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staffId: r.staffId,
            staffName: r.staffName,
            date: r.date,
            startTime: r.startTime,
            endTime: r.endTime || undefined,
            workType: r.workType,
            note: r.note || undefined,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.message || '上傳失敗');
        }
      }
      alert('批次補登完成！請回主畫面重新整理以查看最新考勤紀錄。');
    } catch (e: any) {
      console.error(e);
      alert(`上傳失敗：${e.message || e.toString()}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-3 border-b flex items-center justify-between bg-slate-50">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 text-sm">辨識結果校對</span>
            {ocrResult && (
              <span className="text-[11px] text-slate-500">
                共 {records.length} 筆可能的打卡紀錄，請逐筆確認
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <AlertCircle size={12} className="text-orange-500" />
            <span>紅色欄位代表格式或必填錯誤，送出前請先修正。</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            className="border rounded-lg px-2 py-1 text-xs bg-white min-w-[150px]"
          >
            <option value="">選擇員工姓名 (整張卡片屬於誰)</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.role ? `(${s.role})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-slate-50 text-slate-500 border-b sticky top-0">
            <tr>
              <th className="p-2 border-r w-20">日期</th>
              <th className="p-2 border-r w-20">上班</th>
              <th className="p-2 border-r w-20">下班</th>
              <th className="p-2 border-r w-20">班別</th>
              <th className="p-2 border-r">備註</th>
              <th className="p-2 w-24">狀態</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  尚未有辨識結果，請先上傳並執行 OCR。
                </td>
              </tr>
            ) : (
              records.map((r) => {
                const errors = validateRecord(r);
                const hasError = errors.length > 0;
                return (
                  <tr key={r.id} className="border-b hover:bg-slate-50/60">
                    <td className="p-1 border-r">
                      <input
                        type="date"
                        value={r.date}
                        onChange={(e) => handleFieldChange(r.id, 'date', e.target.value)}
                        className={`w-full px-1 py-0.5 rounded border text-[11px] ${
                          !r.date ? 'border-red-400 bg-red-50' : 'border-slate-200'
                        }`}
                      />
                    </td>
                    <td className="p-1 border-r">
                      <input
                        type="time"
                        value={r.startTime}
                        onChange={(e) => handleFieldChange(r.id, 'startTime', e.target.value)}
                        className={`w-full px-1 py-0.5 rounded border text-[11px] font-mono ${
                          !r.startTime || !/^\d{1,2}:\d{2}$/.test(r.startTime)
                            ? 'border-red-400 bg-red-50'
                            : 'border-slate-200'
                        }`}
                      />
                    </td>
                    <td className="p-1 border-r">
                      <input
                        type="time"
                        value={r.endTime}
                        onChange={(e) => handleFieldChange(r.id, 'endTime', e.target.value)}
                        className={`w-full px-1 py-0.5 rounded border text-[11px] font-mono ${
                          r.endTime && !/^\d{1,2}:\d{2}$/.test(r.endTime)
                            ? 'border-red-400 bg-red-50'
                            : 'border-slate-200'
                        }`}
                      />
                    </td>
                    <td className="p-1 border-r">
                      <select
                        value={r.workType}
                        onChange={(e) =>
                          handleFieldChange(r.id, 'workType', e.target.value as '正常班' | '加班')
                        }
                        className="w-full px-1 py-0.5 rounded border text-[11px] border-slate-200 bg-white"
                      >
                        <option value="正常班">正常班</option>
                        <option value="加班">加班</option>
                      </select>
                    </td>
                    <td className="p-1 border-r">
                      <input
                        type="text"
                        value={r.note}
                        onChange={(e) => handleFieldChange(r.id, 'note', e.target.value)}
                        placeholder="可填寫異常說明、加班原因等"
                        className="w-full px-1 py-0.5 rounded border text-[11px] border-slate-200"
                      />
                    </td>
                    <td className="p-1 text-center">
                      {hasError ? (
                        <div className="flex flex-col items-center gap-0.5 text-[10px] text-red-500">
                          <AlertCircle size={12} />
                          {errors.map((e) => (
                            <div key={e}>{e}</div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-0.5 text-[10px] text-green-600">
                          <CheckCircle2 size={12} />
                          <span>可上傳</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="p-3 border-t flex justify-between items-center bg-white">
        <div className="text-[11px] text-slate-500 flex items-center gap-1">
          <AlertCircle size={11} className="text-orange-500" />
          <span>此為預備功能，僅透過現有 /api/attendance 新增補登紀錄，不會動到原本打卡流程。</span>
        </div>
        <button
          disabled={records.length === 0 || isSubmitting}
          onClick={handleSubmit}
          className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 hover:bg-emerald-700 disabled:opacity-50"
        >
          <Upload size={14} />
          {isSubmitting ? '上傳中...' : `批次送出 (${records.length})`}
        </button>
      </div>
    </div>
  );
};

export default ResultTable;

