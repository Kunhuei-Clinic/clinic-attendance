'use client';

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  ChevronRight,
  X,
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
  const [isVerifying, setIsVerifying] = useState(false); // 🟢 新增：驗證密碼時的 loading 狀態
  const [selectedSlip, setSelectedSlip] = useState<any>(null);

  // 當解鎖成功後，才去抓資料
  useEffect(() => {
    if (isUnlocked && user) fetchSalaryList();
  }, [isUnlocked, user]);

  // 🟢 修改：直接呼叫後端 API 驗證密碼（與 staff 資料表連動）
  const handleUnlock = async () => {
    if (!inputPwd || inputPwd.trim() === '') {
      setErrorMsg('請輸入密碼');
      return;
    }

    // 檢查 user 是否有 phone 欄位
    if (!user.phone) {
      setErrorMsg('❌ 無法驗證：缺少手機號碼資訊');
      setInputPwd('');
      return;
    }

    // 呼叫後端 API 驗證密碼（與 staff 資料表的 password 欄位比對）
    try {
      setIsVerifying(true);
      setErrorMsg('');

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: user.phone,
          password: inputPwd,
        }),
        credentials: 'include',
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // 驗證成功：密碼與 staff 資料表的 password 欄位匹配
        setIsUnlocked(true);
        setErrorMsg('');
      } else {
        // 驗證失敗：密碼錯誤
        setErrorMsg('❌ 密碼錯誤');
      }
    } catch (error) {
      console.error('密碼驗證錯誤:', error);
      setErrorMsg('❌ 系統錯誤，請稍後再試');
    } finally {
      setIsVerifying(false);
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
            ...item,
          };
        } else {
          return {
            id: item.id,
            year_month: item.year_month,
            is_doctor_ppf: false,
            snapshot: item.snapshot,
            // 保留原始資料供 Modal 使用
            ...item,
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
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="bg-slate-100 p-4 rounded-full">
          <Lock size={48} className="text-slate-400" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-slate-800">薪資單安全鎖</h2>
          <p className="text-sm text-slate-500">請輸入密碼以查看薪資明細</p>
        </div>
        <div className="w-full max-w-xs space-y-4">
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={inputPwd}
              onChange={(e) => setInputPwd(e.target.value)}
              className="w-full border-2 border-slate-200 rounded-xl p-3 text-center text-lg font-bold outline-none focus:border-teal-500 transition tracking-widest"
              placeholder="輸入密碼 (預設為生日四碼)"
            />
            <button
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-3.5 text-slate-400"
            >
              {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {errorMsg && (
            <p className="text-red-500 text-center text-sm font-bold animate-bounce">
              {errorMsg}
            </p>
          )}
          <button
            onClick={handleUnlock}
            disabled={isVerifying}
            className={`w-full bg-teal-600 text-white py-3 rounded-xl font-bold transition shadow-lg shadow-teal-200 flex items-center justify-center gap-2 ${
              isVerifying
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-teal-700'
            }`}
          >
            {isVerifying ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                驗證中...
              </>
            ) : (
              <>
                <Unlock size={18} /> 解鎖查看
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // 🔓 2. 解鎖後畫面
  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <DollarSign className="text-teal-600" /> 我的薪資單
        </h2>
        <button
          onClick={() => setIsUnlocked(false)}
          className="text-xs text-slate-400 flex items-center gap-1 border px-2 py-1 rounded hover:bg-slate-50"
        >
          <Lock size={12} /> 重新上鎖
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-400">載入中...</div>
      ) : list.length === 0 ? (
        <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed">
          尚無薪資紀錄
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((item) => {
            const titleMonth = user.role === '醫師' ? item.paid_in_month : item.year_month;
            // 一般員工讀取 snapshot.netPay，醫師直接使用後端欄位 net_pay
            const netPay =
              user.role === '醫師' ? item.net_pay : item.snapshot?.netPay || 0;

            return (
              <div
                key={item.id}
                onClick={() => setSelectedSlip(item)}
                className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center active:scale-[0.98] transition cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-blue-50 text-blue-600 px-3 py-2 rounded-lg font-mono font-bold text-sm">
                    {titleMonth?.slice(5)}月
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-bold mb-0.5">實領金額</div>
                    <div className="text-lg font-black text-slate-800">${fmt(netPay)}</div>
                  </div>
                </div>
                <ChevronRight className="text-slate-300" size={20} />
              </div>
            );
          })}
        </div>
      )}

      {/* 🟢 薪資詳情 Modal (全螢幕修正版) */}
      {selectedSlip && (
        <SalaryDetailModal
          data={selectedSlip}
          role={user.role}
          onClose={() => setSelectedSlip(null)}
        />
      )}
    </div>
  );
}

// 獨立的 Modal 組件，確保層級與滾動正確
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
  const selfPayTotal =
    isDoctor && doc
      ? doc.selfPayItems.reduce(
          (sum: number, item: any) =>
            sum + Number(item.amount || 0) * (Number(item.rate || 0) / 100),
          0,
        )
      : 0;

  // 特殊費用 / 津貼總額：amount 加總
  const extraTotal =
    isDoctor && doc
      ? doc.extraItems.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0)
      : 0;

  // 一般員工：沿用 snapshot 內容
  const staff = !isDoctor ? data.snapshot : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-white md:bg-black/60 md:backdrop-blur-sm">
      <div className="w-full h-[100dvh] md:h-auto md:max-h-[90vh] md:max-w-md bg-white md:rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 shrink-0 flex justify-between items-center">
          <div>
            <p className="text-[11px] md:text-xs text-slate-400 mb-1">薪資單明細</p>
            <h3 className="text-xl md:text-2xl font-bold">
              {isDoctor ? doc?.month : data.year_month}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition"
          >
            <X size={20} className="md:size-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-6 pb-20 md:pb-6">
          {/* 總覽卡片 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center">
            <p className="text-xs md:text-sm text-slate-500 font-bold mb-1">
              本月實領金額 (Net Pay)
            </p>
            <h2 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight">
              ${fmt(isDoctor ? doc?.netPay : staff?.netPay)}
            </h2>
          </div>

          {isDoctor && doc ? (
            <div className="space-y-4">
              {/* 🟢 區塊 A: 應發項目 (Earnings) */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                  應發項目 (Earnings)
                </h4>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {/* 保障薪 */}
                  <div className="flex justify-between p-3 border-b border-slate-100">
                    <span className="text-slate-700 font-bold text-sm">保障薪 / 掛牌費</span>
                    <span className="font-mono font-bold text-slate-800 text-base md:text-lg">
                      ${fmt(doc.basePay)}
                    </span>
                  </div>

                  {/* PPF 績效獎金 */}
                  {doc.bonus > 0 && (
                    <div className="flex justify-between p-3 border-b border-slate-100 bg-blue-50/30">
                      <span className="text-blue-700 font-bold text-sm flex items-center gap-1">
                        <TrendingUp size={14} className="md:size-4" /> PPF 績效獎金
                      </span>
                      <span className="font-mono font-bold text-blue-700 text-base md:text-lg">
                        +${fmt(doc.bonus)}
                      </span>
                    </div>
                  )}
                  {doc.bonus > 0 && (
                    <div className="text-xs text-blue-500 text-right px-3 pb-2">
                      (結算月份: {doc.ppfMonth})
                    </div>
                  )}

                  {/* 自費項目抽成 */}
                  {selfPayTotal > 0 && (
                    <div className="p-3 border-b border-slate-100 bg-emerald-50/30">
                      <div className="flex justify-between mb-2">
                        <span className="text-emerald-700 font-bold text-sm">自費項目抽成</span>
                        <span className="font-mono font-bold text-emerald-700 text-sm md:text-base">
                          +${fmt(selfPayTotal)}
                        </span>
                      </div>
                      <div className="space-y-1 text-[11px] md:text-xs text-slate-600">
                        {doc.selfPayItems.map((item: any, idx: number) => {
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
                    <div className="p-3 border-b border-slate-100">
                      <div className="flex justify-between mb-2">
                        <span className="text-slate-600 font-bold text-sm">特殊費用 / 津貼</span>
                        <span className="font-mono font-bold text-slate-800 text-sm md:text-base">
                          {extraTotal > 0 ? '+' : ''}${fmt(extraTotal)}
                        </span>
                      </div>
                      <div className="space-y-1 text-[11px] md:text-xs text-slate-600">
                        {doc.extraItems.map((item: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center bg-white/70 px-2 py-1 rounded"
                          >
                            <span className="truncate max-w-[60%]">{item.name || '特殊項目'}</span>
                            <span className="font-mono font-bold text-slate-800">
                              {Number(item.amount || 0) > 0 ? '+' : ''}${fmt(item.amount || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 🟢 區塊 B: 應扣項目 (Deductions) */}
              {(doc.insLabor > 0 || doc.insHealth > 0) && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                    應扣項目 (Deductions)
                  </h4>
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="flex justify-between p-3 border-b border-slate-100 bg-red-50/30">
                      <span className="text-red-700 font-bold text-sm">勞健保自付</span>
                      <span className="font-mono font-bold text-red-700 text-sm md:text-base">
                        -${fmt(doc.insLabor + doc.insHealth)}
                      </span>
                    </div>
                    {doc.insLabor > 0 && (
                      <div className="flex justify-between p-3 border-b border-slate-100 text-xs text-red-600">
                        <span>勞保自付額</span>
                        <span className="font-mono font-bold">-${fmt(doc.insLabor)}</span>
                      </div>
                    )}
                    {doc.insHealth > 0 && (
                      <div className="flex justify-between p-3 text-xs text-red-600">
                        <span>健保自付額</span>
                        <span className="font-mono font-bold">-${fmt(doc.insHealth)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 醫師 PPF / 統計資訊 */}
              <div className="border-t border-dashed pt-4 space-y-2">
                <h4 className="text-[11px] md:text-xs font-bold text-slate-400 mb-2 flex items-center gap-1">
                  <FileText size={11} className="md:size-3" /> PPF 統計資訊
                </h4>
                <div className="grid grid-cols-2 gap-3 text-[11px] md:text-xs text-slate-600">
                  <div className="bg-slate-50 p-2 rounded">
                    看診人數:{' '}
                    <span className="font-bold text-slate-800">{doc.patientCount}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded">
                    健保點數:{' '}
                    <span className="font-bold text-slate-800">{fmt(doc.nhiPoints)}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded col-span-2">
                    總業績:{' '}
                    <span className="font-bold text-yellow-700">${fmt(doc.totalPerformance)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs md:text-sm">
              <div className="flex justify-between border-b border-dashed pb-2">
                <span className="text-slate-600">底薪 / 保障薪</span>
                <span className="font-mono font-bold text-sm md:text-base">
                  ${fmt(staff?.baseAmount || 0)}
                </span>
              </div>
              <div className="flex justify-between border-b border-dashed pb-2">
                <span className="text-slate-600">加班 / 工時費</span>
                <span className="font-mono font-bold text-sm md:text-base">
                  ${fmt(staff?.workAmount || 0)}
                </span>
              </div>
              {(staff?.bonusesTotal || 0) > 0 && (
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
                  -${fmt((staff?.insLabor || 0) + (staff?.insHealth || 0))}
                </span>
              </div>
            </div>
          )}

          {/* 銀行匯款 / 現金發放 */}
          <div className="bg-slate-100 p-4 rounded-xl flex justify-between items-center text-xs md:text-sm">
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-500 font-bold mb-1">銀行匯款</span>
              <span className="font-mono font-bold text-base md:text-lg">
                ${fmt(isDoctor ? doc?.transfer || 0 : 0)}
              </span>
            </div>
            <div className="w-px h-8 bg-slate-300"></div>
            <div className="flex flex-col text-right">
              <span className="text-[11px] text-slate-500 font-bold mb-1">現金發放</span>
              <span className="font-mono font-bold text-base md:text-lg text-green-600">
                ${fmt(isDoctor ? doc?.cash || 0 : 0)}
              </span>
            </div>
          </div>

          {/* 底部說明 */}
          <div className="text-center text-xs text-slate-400 pt-4 pb-8">
            保密薪資單 • 請勿外流
          </div>
        </div>
      </div>
    </div>
  );
}
