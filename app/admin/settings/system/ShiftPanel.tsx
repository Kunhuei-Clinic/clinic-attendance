import React from 'react';
import { CalendarDays, Clock, Plus, Trash2, Tag, X } from 'lucide-react';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function ShiftPanel({ businessHours, setBusinessHours, specialShiftTypes, setSpecialShiftTypes }: any) {
  const toggleDay = (dayIndex: number) => {
    const newDays = businessHours.openDays.includes(dayIndex)
      ? businessHours.openDays.filter((d: number) => d !== dayIndex)
      : [...businessHours.openDays, dayIndex].sort();
    setBusinessHours({ ...businessHours, openDays: newDays });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 每週營業日 */}
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
          <CalendarDays className="text-slate-700" size={18} /> 每週開診營業日
        </h3>
        <p className="text-xs text-slate-500 mb-4">選擇診所哪些星期需要排班與考勤。</p>
        <div className="flex gap-2">
          {WEEKDAYS.map((day, idx) => (
            <button
              key={idx}
              onClick={() => toggleDay(idx)}
              className={`w-10 h-10 rounded-full font-bold transition flex items-center justify-center ${
                businessHours.openDays.includes(idx)
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-100'
              }`}
              type="button"
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      {/* 常規診次 / 班別設定 */}
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Clock className="text-emerald-600" size={18} /> 常規診次 / 班別設定
        </h3>
        <p className="text-xs text-slate-500 mb-4">設定貴診所的標準排班時段（如：早診、午診、晚診）。</p>
        <div className="space-y-3">
          {businessHours.shifts.map((shift: any, index: number) => (
            <div key={index} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
              <input
                type="text"
                value={shift.name}
                onChange={(e) => {
                  const newShifts = [...businessHours.shifts];
                  newShifts[index].name = e.target.value;
                  setBusinessHours({ ...businessHours, shifts: newShifts });
                }}
                className="w-24 border p-2 rounded-lg text-sm outline-none font-bold focus:border-emerald-400 transition"
                placeholder="診次名稱"
              />
              <input
                type="text"
                value={shift.code}
                onChange={(e) => {
                  const newShifts = [...businessHours.shifts];
                  newShifts[index].code = e.target.value.toUpperCase();
                  setBusinessHours({ ...businessHours, shifts: newShifts });
                }}
                className="w-16 border p-2 rounded-lg text-sm text-center outline-none font-mono font-bold focus:border-emerald-400 transition"
                placeholder="代號"
                maxLength={2}
              />
              <input
                type="time"
                value={shift.start}
                onChange={(e) => {
                  const newShifts = [...businessHours.shifts];
                  newShifts[index].start = e.target.value;
                  setBusinessHours({ ...businessHours, shifts: newShifts });
                }}
                className="border p-2 rounded-lg text-sm outline-none font-mono focus:border-emerald-400 transition"
              />
              <span className="text-slate-400">-</span>
              <input
                type="time"
                value={shift.end}
                onChange={(e) => {
                  const newShifts = [...businessHours.shifts];
                  newShifts[index].end = e.target.value;
                  setBusinessHours({ ...businessHours, shifts: newShifts });
                }}
                className="border p-2 rounded-lg text-sm outline-none font-mono focus:border-emerald-400 transition"
              />
              <button
                onClick={() => {
                  const newShifts = businessHours.shifts.filter((_: any, i: number) => i !== index);
                  setBusinessHours({ ...businessHours, shifts: newShifts });
                }}
                className="text-red-400 hover:text-red-600 p-2 transition"
                type="button"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              setBusinessHours({
                ...businessHours,
                shifts: [
                  ...businessHours.shifts,
                  { id: Date.now().toString(), code: 'X', name: '新診次', start: '00:00', end: '00:00' }
                ]
              })
            }
            className="text-xs flex items-center gap-1 text-emerald-600 font-bold hover:bg-emerald-50 px-3 py-2 rounded-lg transition mt-2"
            type="button"
          >
            <Plus size={16} /> 新增診次
          </button>
        </div>
      </div>

      {/* 特殊門診 / 專診設定 */}
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Tag className="text-pink-600" size={18} /> 特殊門診 / 專診設定
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          設定排班時可額外附加的門診標籤（例如：減重門診、疫苗診、無痛鏡檢）。
        </p>
        <div className="flex flex-wrap gap-3">
          {specialShiftTypes.map((t: string, idx: number) => (
            <div
              key={idx}
              className="flex items-center gap-2 bg-pink-50 border border-pink-200 text-pink-700 pl-3 pr-1 py-1 rounded-full shadow-sm"
            >
              {/* 🟢 加長了 input 的寬度，拿掉了置中，讓你更好輸入！ */}
              <input
                type="text"
                value={t}
                onChange={(e) => {
                  const newTypes = [...specialShiftTypes];
                  newTypes[idx] = e.target.value;
                  setSpecialShiftTypes(newTypes);
                }}
                className="bg-transparent border-none outline-none w-28 text-sm font-bold placeholder-pink-300"
                placeholder="請輸入專診"
              />
              <button
                onClick={() =>
                  setSpecialShiftTypes(specialShiftTypes.filter((_: any, i: number) => i !== idx))
                }
                className="bg-white rounded-full p-1 text-pink-400 hover:text-pink-600 hover:bg-pink-100 transition shadow-sm"
                type="button"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setSpecialShiftTypes([...specialShiftTypes, '新專診'])}
            className="flex items-center gap-1 bg-white border border-pink-200 text-pink-600 px-4 py-1.5 rounded-full text-sm font-bold hover:bg-pink-50 transition shadow-sm"
            type="button"
          >
            <Plus size={14} /> 新增專診
          </button>
        </div>
      </div>
    </div>
  );
}

