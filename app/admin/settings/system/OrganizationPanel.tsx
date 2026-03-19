import React from 'react';
import { Building2, Briefcase, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

export default function OrganizationPanel({ entities, setEntities, jobTitles, setJobTitles }: any) {
  // 職稱上下排序邏輯
  const moveJobTitle = (index: number, direction: 'up' | 'down') => {
    const newTitles = [...jobTitles];
    if (direction === 'up' && index > 0) {
      [newTitles[index - 1], newTitles[index]] = [newTitles[index], newTitles[index - 1]];
    } else if (direction === 'down' && index < newTitles.length - 1) {
      [newTitles[index], newTitles[index + 1]] = [newTitles[index + 1], newTitles[index]];
    }
    setJobTitles(newTitles);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 組織/部門單位設定 */}
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Building2 className="text-blue-600" size={18} /> 組織 / 部門單位設定
        </h3>
        <p className="text-xs text-slate-500 mb-4">請設定貴機構的實體單位（如：總店、分店、部門）。</p>
        <div className="space-y-3">
          {entities.map((ent: any, idx: number) => (
            <div key={idx} className="flex items-center gap-3">
              <input
                type="text"
                value={ent.name}
                onChange={(e) => {
                  const newEnts = [...entities];
                  newEnts[idx].name = e.target.value;
                  setEntities(newEnts);
                }}
                className="flex-1 border p-2 rounded-lg text-sm bg-white outline-none focus:border-blue-500 transition"
                placeholder="例如：台北總店、餐飲部..."
              />
              <button
                onClick={() => setEntities(entities.filter((_: any, i: number) => i !== idx))}
                className="text-red-400 hover:text-red-600 p-2 transition"
                type="button"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setEntities([...entities, { id: Date.now().toString(), name: '' }])}
            className="text-xs flex items-center gap-1 text-blue-600 font-bold hover:bg-blue-50 px-3 py-2 rounded-lg transition"
            type="button"
          >
            <Plus size={16} /> 新增單位
          </button>
        </div>
      </div>

      {/* 職稱與排班權重排序設定 */}
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Briefcase className="text-purple-600" size={18} /> 職稱與排班權重排序
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          越上方的職稱，在排班表與人員清單中的「顯示排序」越前面。可透過上下箭頭調整。
        </p>
        <div className="space-y-3">
          {jobTitles.map((jt: any, idx: number) => (
            <div
              key={idx}
              className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm"
            >
              {/* 排序按鈕 */}
              <div className="flex flex-col gap-1 px-1">
                <button
                  onClick={() => moveJobTitle(idx, 'up')}
                  disabled={idx === 0}
                  className="text-slate-400 hover:text-blue-600 disabled:opacity-20 transition"
                  type="button"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  onClick={() => moveJobTitle(idx, 'down')}
                  disabled={idx === jobTitles.length - 1}
                  className="text-slate-400 hover:text-blue-600 disabled:opacity-20 transition"
                  type="button"
                >
                  <ArrowDown size={14} />
                </button>
              </div>

              <input
                type="text"
                value={jt.name}
                onChange={(e) => {
                  const newTitles = [...jobTitles];
                  newTitles[idx].name = e.target.value;
                  setJobTitles(newTitles);
                }}
                className="flex-1 border-none p-1 text-sm outline-none font-bold text-slate-700"
                placeholder="例如：店長、護理師..."
              />

              <label className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-md cursor-pointer">
                <input
                  type="checkbox"
                  checked={jt.in_roster}
                  onChange={(e) => {
                    const newTitles = [...jobTitles];
                    newTitles[idx].in_roster = e.target.checked;
                    setJobTitles(newTitles);
                  }}
                  className="w-4 h-4 text-purple-600 rounded"
                />
                顯示於排班表
              </label>

              <button
                onClick={() => setJobTitles(jobTitles.filter((_: any, i: number) => i !== idx))}
                className="text-red-400 hover:text-red-600 p-2 ml-1 transition"
                type="button"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setJobTitles([...jobTitles, { name: '', in_roster: true }])}
            className="text-xs flex items-center gap-1 text-purple-600 font-bold hover:bg-purple-50 px-3 py-2 rounded-lg transition mt-2"
            type="button"
          >
            <Plus size={16} /> 新增職稱
          </button>
        </div>
      </div>
    </div>
  );
}

