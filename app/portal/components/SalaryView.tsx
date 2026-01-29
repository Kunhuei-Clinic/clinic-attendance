'use client';

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  ChevronRight,
  X,
  Calendar,
  FileText,
  TrendingUp,
  Lock,
  Unlock,
  Eye,
  EyeOff,
} from 'lucide-react';

// 輔助函式（單純格式化數字字串，不做商業邏輯計算）
const fmt = (val: any) => Number(val || 0).toLocaleString();

export default function PortalSalaryView({ user }: { user: any }) {
    // 🔒 安全鎖狀態
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [inputPwd, setInputPwd] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const [list, setList] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedSlip, setSelectedSlip] = useState<any>(null);

    // 當解鎖成功後，才去抓資料
    useEffect(() => {
        if (isUnlocked && user) fetchSalaryList();
    }, [isUnlocked, user]);

    const handleUnlock = () => {
        // 比對資料庫裡的 password (預設 0000)
        // 注意：這裡 user 是從父層傳進來的，理論上包含 password 欄位
        if (inputPwd === user.password) {
            setIsUnlocked(true);
            setErrorMsg('');
        } else {
            setErrorMsg('❌ 密碼錯誤');
            setInputPwd('');
        }
    };

    const fetchSalaryList = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/portal/data?type=salary&staffId=${user.id}`);
            const result = await response.json();
            
            // 格式化資料以符合現有的顯示邏輯
            const formatted = (result.data || []).map((item: any) => {
                if (user.role === '醫師') {
                    return {
                        id: item.id,
                        year_month: item.paid_in_month,
                        is_doctor_ppf: true,
                        data: item,
                        // 保留原始資料供 Modal 使用
                        ...item
                    };
                } else {
                    return {
                        id: item.id,
                        year_month: item.year_month,
                        is_doctor_ppf: false,
                        snapshot: item.snapshot,
                        // 保留原始資料供 Modal 使用
                        ...item
                    };
                }
            });
            setList(formatted);
        } catch (error) {
            console.error('讀取薪資列表失敗:', error);
            setList([]);
        } finally {
            setLoading(false);
        }
    };

    // 🔒 1. 上鎖狀態畫面
    if (!isUnlocked) {
        return (
            <div className="flex flex-col items-center justify-center py-10 space-y-6 animate-fade-in">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                    <Lock size={40} />
                </div>
                <div className="text-center">
                    <h3 className="text-xl font-bold text-slate-700">薪資隱私保護</h3>
                    <p className="text-slate-400 text-sm mt-1">請輸入您的個人密碼以查看內容</p>
                </div>
                
                <div className="w-full max-w-xs space-y-4">
                    <div className="relative">
                        <input 
                            type={showPwd ? "text" : "password"} 
                            value={inputPwd}
                            onChange={(e) => setInputPwd(e.target.value)}
                            placeholder="輸入密碼 (預設為生日四碼)"
                            className="w-full border-2 border-slate-200 rounded-xl p-3 text-center font-bold text-lg focus:border-teal-500 outline-none tracking-widest"
                        />
                        <button 
                            onClick={() => setShowPwd(!showPwd)}
                            className="absolute right-3 top-4 text-slate-400"
                        >
                            {showPwd ? <EyeOff size={20}/> : <Eye size={20}/>}
                        </button>
                    </div>
                    
                    {errorMsg && <p className="text-red-500 text-center text-sm font-bold animate-shake">{errorMsg}</p>}

                    <button 
                        onClick={handleUnlock}
                        className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition flex items-center justify-center gap-2"
                    >
                        <Unlock size={18}/> 解鎖查看
                    </button>
                </div>
            </div>
        );
    }

    // 🔓 2. 解鎖後畫面 (原本的列表)
    return (
        <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-700 flex items-center gap-2 text-lg">
                    <DollarSign className="text-teal-600" /> 歷史薪資單
                </h3>
                <button onClick={() => setIsUnlocked(false)} className="text-xs text-slate-400 flex items-center gap-1 border px-2 py-1 rounded hover:bg-slate-50">
                    <Lock size={12}/> 重新上鎖
                </button>
            </div>

            {loading ? (
                <div className="text-center py-10 text-slate-400">載入中...</div>
            ) : list.length === 0 ? (
                <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed">尚無薪資紀錄</div>
            ) : (
                <div className="space-y-3">
                    {list.map((item) => {
                        const titleMonth = user.role === '醫師' ? item.paid_in_month : item.year_month;
                        // 一般員工讀取 snapshot.netPay，醫師直接使用後端欄位 net_pay
                        const netPay = user.role === '醫師' ? item.net_pay : (item.snapshot?.netPay || 0);

                        return (
                            <div key={item.id} onClick={() => setSelectedSlip(item)} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition active:scale-95">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm shrink-0">{titleMonth?.slice(5)}月</div>
                                    <div>
                                        <div className="font-bold text-slate-800 text-lg">{titleMonth} 薪資</div>
                                        <div className="text-xs text-slate-500 font-mono">實領 ${fmt(netPay)}</div>
                                    </div>
                                </div>
                                <ChevronRight size={20} className="text-slate-300" />
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedSlip && <SalaryDetailModal data={selectedSlip} role={user.role} onClose={() => setSelectedSlip(null)} />}
        </div>
    );
}

// ... 下面 SalaryDetailModal 保持不變 (直接沿用上一版的即可) ...
// 為了完整性，這裡再貼一次 SalaryDetailModal，確保您複製時不會漏掉
function SalaryDetailModal({ data, role, onClose }: any) {
  const isDoctor = role === '醫師';

  // 醫師資料對應：完全依照後端欄位顯示，不在前端做薪資計算
  const doc = isDoctor
    ? {
        month: data.paid_in_month,
        basePay: data.actual_base_pay,
        bonus: data.final_ppf_bonus,
        netPay: data.net_pay,
        ppfMonth: data.target_month,
        transfer: data.transfer_amount,
        cash: data.cash_amount,
        // 統計資訊
        patientCount: data.patient_count,
        nhiPoints: data.nhi_points,
        totalPerformance: data.total_performance,
        // 自費與特殊費用項目
        selfPayItems: (data.self_pay_items as any[]) || [],
        extraItems: (data.extra_items as any[]) || [],
        // 勞健保自付
        insLabor: Number(data.insurance_labor || 0),
        insHealth: Number(data.insurance_health || 0),
      }
    : undefined;

  // 自費抽成總額：amount * (rate / 100) 加總
  const selfPayTotal = isDoctor && doc
    ? doc.selfPayItems.reduce(
        (sum: number, item: any) =>
          sum +
          Number(item.amount || 0) *
            (Number(item.rate || 0) / 100),
        0,
      )
    : 0;

  // 特殊費用 / 津貼總額：amount 加總
  const extraTotal = isDoctor && doc
    ? doc.extraItems.reduce(
        (sum: number, item: any) => sum + Number(item.amount || 0),
        0,
      )
    : 0;

  // 一般員工：沿用 snapshot 內容
  const staff = !isDoctor ? data.snapshot : null;

  return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg白 w-full h-full md:h-auto md:max-h-[90vh] md:max-w-md rounded-none md:rounded-2xl overflow-hidden flex flex-col shadow-2xl pb-[env(safe-area-inset-bottom)]">
                <div className="bg-slate-900 text白 p-4 md:p-5 flex justify-between items-center shrink-0">
                    <div>
                        <p className="text-[11px] md:text-xs text-slate-400 mb-1">薪資單明細</p>
                        <h3 className="text-xl md:text-2xl font-bold">{isDoctor ? doc?.month : data.year_month}</h3>
                    </div>
                    <button onClick={onClose} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition">
                        <X size={18} className="md:size-5" />
                    </button>
                </div>
                <div className="p-4 pb-10 md:p-6 overflow-y-auto space-y-6 flex-1 min-h-0">
                    <div className="text-center border-b border-slate-100 pb-6">
                        <p className="text-xs md:text-sm text-slate-500 font-bold mb-1">本月實領金額 (Net Pay)</p>
                        <p className="text-3xl md:text-5xl font-black text-slate-800 tracking-tight">
                            ${fmt(isDoctor ? doc?.netPay : staff.netPay)}
                        </p>
                    </div>
                    {isDoctor && doc ? (
                      <div className="space-y-4">
                        {/* 應發項目 (Earnings) */}
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 space-y-3 text-sm md:text-base">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-700 font-bold">
                              保障薪 / 掛牌費
                            </span>
                            <span className="font-mono font-bold text-base md:text-lg">
                              ${fmt(doc!.basePay)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-blue-700">
                            <span className="font-bold flex items-center gap-1">
                              <TrendingUp size={14} className="md:size-4" /> PPF 績效獎金
                            </span>
                            <span className="font-mono font-bold text-base md:text-lg">
                              +${fmt(doc!.bonus)}
                            </span>
                          </div>
                          <div className="text-xs text-blue-500 text-right">
                            (結算月份: {doc!.ppfMonth})
                          </div>

                          {/* 自費項目抽成 */}
                          {selfPayTotal > 0 && (
                            <div className="mt-3 pt-3 border-t border-dashed border-emerald-200 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-emerald-700">
                                  自費項目抽成
                                </span>
                                <span className="font-mono font-bold text-sm md:text-base text-emerald-800">
                                  +${fmt(selfPayTotal)}
                                </span>
                              </div>
                              <div className="space-y-1 text-[11px] md:text-xs text-slate-600">
                                {doc!.selfPayItems.map((item: any, idx: number) => {
                                  const amount = Number(item.amount || 0);
                                  const rate = Number(item.rate || 0);
                                  const share = amount * (rate / 100);
                                  return (
                                    <div
                                      key={idx}
                                      className="flex justify-between items-center bg-white/70 px-2 py-1 rounded"
                                    >
                                      <span className="truncate max-w-[60%]">
                                        {item.name || '自費項目'}{' '}
                                        <span className="text-slate-400">
                                          ({fmt(amount)} × {rate}%)
                                        </span>
                                      </span>
                                      <span className="font-mono font-bold text-emerald-800">
                                        +${fmt(share)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* 特殊費用 / 津貼 */}
                          {extraTotal !== 0 && (
                            <div className="mt-3 pt-3 border-t border-dashed border-emerald-200 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-emerald-700">
                                  特殊費用 / 津貼
                                </span>
                                <span className="font-mono font-bold text-sm md:text-base text-emerald-800">
                                  {extraTotal > 0 ? '+' : ''}
                                  ${fmt(extraTotal)}
                                </span>
                              </div>
                              <div className="space-y-1 text-[11px] md:text-xs text-slate-600">
                                {doc!.extraItems.map((item: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="flex justify-between items-center bg-white/70 px-2 py-1 rounded"
                                  >
                                    <span className="truncate max-w-[60%]">
                                      {item.name || '特殊項目'}
                                    </span>
                                    <span className="font-mono font-bold text-emerald-800">
                                      {Number(item.amount || 0) > 0 ? '+' : ''}
                                      ${fmt(item.amount || 0)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 應扣項目 (Deductions) */}
                        {(doc!.insLabor > 0 || doc!.insHealth > 0) && (
                          <div className="bg-red-50 p-4 rounded-xl border border-red-200 space-y-2 text-xs md:text-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-red-700 font-bold">應扣項目</span>
                            </div>
                            {doc!.insLabor > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-red-700">勞保自付額</span>
                                <span className="font-mono font-bold text-red-700">
                                  -${fmt(doc!.insLabor)}
                                </span>
                              </div>
                            )}
                            {doc!.insHealth > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-red-700">健保自付額</span>
                                <span className="font-mono font-bold text-red-700">
                                  -${fmt(doc!.insHealth)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 醫師 PPF / 統計資訊：僅顯示後端提供的原始欄位 */}
                        <div className="border-t border-dashed pt-4 space-y-2">
                          <h4 className="text-[11px] md:text-xs font-bold text-slate-400 mb-2 flex items-center gap-1">
                            <FileText size={11} className="md:size-3" /> PPF 統計資訊
                          </h4>
                          <div className="grid grid-cols-2 gap-3 text-[11px] md:text-xs text-slate-600">
                            <div className="bg-slate-50 p-2 rounded">
                              看診人數:{' '}
                              <span className="font-bold text-slate-800">
                                {doc!.patientCount}
                              </span>
                            </div>
                            <div className="bg-slate-50 p-2 rounded">
                              健保點數:{' '}
                              <span className="font-bold text-slate-800">
                                {fmt(doc!.nhiPoints)}
                              </span>
                            </div>
                            <div className="bg-slate-50 p-2 rounded col-span-2">
                              總業績:{' '}
                              <span className="font-bold text-yellow-700">
                                ${fmt(doc!.totalPerformance)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                        <div className="space-y-3 text-xs md:text-sm">
                            <div className="flex justify-between border-b border-dashed pb-2">
                                <span className="text-slate-600">底薪 / 保障薪</span>
                                <span className="font-mono font-bold text-sm md:text-base">
                                    ${fmt(staff.baseAmount)}
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-dashed pb-2">
                                <span className="text-slate-600">加班 / 工時費</span>
                                <span className="font-mono font-bold text-sm md:text-base">
                                    ${fmt(staff.workAmount)}
                                </span>
                            </div>
                            {staff.bonusesTotal > 0 && (
                                <div className="flex justify-between border-b border-dashed pb-2 text-blue-600">
                                    <span className="font-bold">獎金津貼</span>
                                    <span className="font-mono font-bold text-sm md:text-base">
                                        +${fmt(staff.bonusesTotal)}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between items-center bg-red-50 p-2 rounded text-red-700">
                                <span className="font-bold text-xs md:text-sm">勞健保自付</span>
                                <span className="font-mono font-bold text-sm md:text-base">
                                    -${fmt((staff.insLabor || 0) + (staff.insHealth || 0))}
                                </span>
                            </div>
                        </div>
                    )}
                    <div className="bg-slate-100 p-4 rounded-xl flex justify-between items-center text-xs md:text-sm">
                        <div className="flex flex-col">
                            <span className="text-[11px] text-slate-500 font-bold mb-1">銀行匯款</span>
                            <span className="font-mono font-bold text-base md:text-lg">
                                ${fmt(isDoctor ? doc!.transfer : 0)}
                            </span>
                        </div>
                        <div className="w-px h-8 bg-slate-300"></div>
                        <div className="flex flex-col text-right">
                            <span className="text-[11px] text-slate-500 font-bold mb-1">現金發放</span>
                            <span className="font-mono font-bold text-base md:text-lg text-green-600">
                                ${fmt(isDoctor ? doc!.cash : 0)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
