import React from 'react';

export default function SecurityPanel({ data, onChange, isNewData }: any) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <label className="flex items-center gap-3 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={data.enable_login || false}
            onChange={(e) => onChange('enable_login', e.target.checked)}
            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="font-bold text-slate-700">開通系統登入權限</span>
        </label>

        {data.enable_login && (
          <div className="space-y-4 pl-8 border-l-2 border-blue-200 ml-2 animate-fade-in">
            <div className="bg-blue-50/50 p-3 rounded text-sm text-blue-800 mb-2">
              系統將使用員工的<strong>手機號碼</strong>或<strong>聯絡信箱 (Email)</strong>作為登入帳號。
            </div>

            {/* 若已綁定 Auth，提供強制重設密碼功能；否則提供預設密碼設定 */}
            {data.auth_user_id ? (
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                <label className="block text-xs font-bold text-orange-800 mb-1">強制重設登入密碼</label>
                <input type="text" value={data.new_password || ''} onChange={e => onChange('new_password', e.target.value)} className="w-full border p-2 rounded-lg bg-white" placeholder="若不修改請留空..." />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">初始登入密碼</label>
                <input type="text" value={data.login_password || '0000'} onChange={e => onChange('login_password', e.target.value)} className="w-full border p-2 rounded-lg bg-white font-mono" />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">系統後台權限</label>
              <div className="flex flex-wrap gap-2">
                {['staff:一般員工', 'manager:排班主管', 'owner:診所負責人'].map(opt => {
                  const [val, label] = opt.split(':');
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => onChange('system_role', val)}
                      className={`px-3 py-2 rounded-lg border text-sm font-bold transition ${
                        (data.system_role || 'staff') === val
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-500 mb-2">LINE 官方帳號管理權限 (admin_role)</label>
              <select value={data.admin_role ?? 'none'} onChange={e => onChange('admin_role', e.target.value)} className="w-full border border-slate-300 p-2 rounded-lg text-sm bg-white">
                <option value="none">無管理權限 (預設)</option>
                <option value="manager">部門主管</option>
                <option value="owner">最高負責人</option>
              </select>
            </div>
          </div>
        )}
      </div>
      
      {/* Portal 打卡密碼 */}
      <div>
        <label className="block text-xs font-bold text-slate-500 mb-1">前台/LINE 打卡專用密碼 (PIN碼)</label>
        <input type="text" value={data.password || ''} onChange={e => onChange('password', e.target.value)} className="w-full border p-2 rounded font-mono tracking-widest bg-white" placeholder={isNewData ? "預設 0000" : "若不修改請留空"} />
        <p className="text-xs text-slate-400 mt-1">用於員工在診所平板上打卡，或初次綁定 LINE 帳號時使用。</p>
      </div>
    </div>
  );
}
