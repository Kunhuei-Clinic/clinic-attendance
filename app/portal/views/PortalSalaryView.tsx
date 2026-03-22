'use client';

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  ChevronRight,
  ChevronDown,
  X,
  FileText,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  CalendarDays,
  TrendingUp,
} from 'lucide-react';

const fmt = (val: any) => Number(val || 0).toLocaleString();

function netPayFromItem(item: any) {
  if (item?.snapshot_data?.net_pay != null) return item.snapshot_data.net_pay;
  if (item?.snapshot?.net_pay != null) return item.snapshot.net_pay;
  if (item?.snapshot?.netPay != null) return item.snapshot.netPay;
  if (item?.net_pay != null) return item.net_pay;
  return 0;
}

function isDoctorSlip(item: any, user: any) {
  return user?.role === '醫師' || item?._doctor_row === true || (!!item?.paid_in_month && item?.doctor_id != null);
}

export default function PortalSalaryView({ user }: { user: any }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [inputPwd, setInputPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<any>(null);

  useEffect(() => {
    if (isUnlocked && user) fetchLockedSalaryHistory();
  }, [isUnlocked, user]);

  const handleUnlock = async () => {
    if (!inputPwd) {
      setErrorMsg('請輸入密碼');
      return;
    }
    setIsVerifying(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/portal/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, password: inputPwd }),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setIsUnlocked(true);
        setInputPwd('');
      } else {
        setErrorMsg('密碼錯誤，請重試');
      }
    } catch (err) {
      setErrorMsg('驗證失敗，請檢查網路連線');
    } finally {
      setIsVerifying(false);
    }
  };

  const fetchLockedSalaryHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/salary-history?userId=${encodeURIComponent(user.id)}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setList(data.data || []);
      }
    } catch (error) {
      console.error('Fetch salary error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 animate-fade-in">
        <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <Lock size={32} className="text-slate-500" />
        </div>
        <h2 className="text-xl font-black text-slate-800 mb-2">薪資明細安全鎖</h2>
        <p className="text-sm text-slate-500 text-center mb-8">
          薪資為極機密資訊，請輸入您的登入密碼以解鎖檢視。
        </p>

        <div className="w-full max-w-sm space-y-4">
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={inputPwd}
              onChange={(e) => setInputPwd(e.target.value)}
              placeholder="請輸入密碼"
              className="w-full border-2 border-slate-200 p-4 rounded-xl font-mono text-lg tracking-widest focus:border-blue-500 outline-none pr-12 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
            >
              {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {errorMsg && (
            <p className="text-red-500 text-sm font-bold text-center animate-shake">{errorMsg}</p>
          )}
          <button
            type="button"
            onClick={handleUnlock}
            disabled={isVerifying}
            className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              '驗證中...'
            ) : (
              <>
                <Unlock size={20} /> 解鎖查閱
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (selectedSlip) {
    if (isDoctorSlip(selectedSlip, user)) {
      return (
        <DoctorSalaryDetail
          slip={selectedSlip}
          onBack={() => setSelectedSlip(null)}
        />
      );
    }

    const raw = selectedSlip.snapshot_data ?? selectedSlip.snapshot ?? {};
    const details = {
      net_pay: raw.net_pay ?? raw.netPay,
      base_pay: raw.base_pay ?? raw.baseAmount,
      ot_pay: raw.ot_pay ?? raw.workAmount ?? 0,
      holiday_pay: raw.holiday_pay ?? 0,
      fixed_bonus_pay: raw.fixed_bonus_pay ?? raw.fixedBonusPay ?? 0,
      temp_bonus_details: raw.temp_bonus_details ?? [],
      insurance_labor: raw.insurance_labor ?? raw.insLabor ?? 0,
      insurance_health: raw.insurance_health ?? raw.insHealth ?? 0,
      leave_deduction: raw.leave_deduction ?? 0,
      fixed_deduction_pay: raw.fixed_deduction_pay ?? 0,
      temp_deduction_details: raw.temp_deduction_details ?? [],
    };

    const ym = selectedSlip.year_month || '';

    return (
      <div className="animate-fade-in bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-100">
        <div className="bg-slate-900 p-6 text-white relative">
          <button
            type="button"
            onClick={() => setSelectedSlip(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition"
          >
            <X size={20} />
          </button>
          <div className="text-slate-400 text-sm font-bold mb-1 flex items-center gap-2">
            <CalendarDays size={16} /> {ym.replace('-', '年')}月
          </div>
          <h2 className="text-2xl font-black mb-6">薪資明細單</h2>

          <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
            <div className="text-sm text-slate-300 mb-1">實發金額 (Net Pay)</div>
            <div className="text-4xl font-mono font-bold tracking-tight">
              <span className="text-2xl mr-1">$</span>
              {fmt(details.net_pay)}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <details
            className="group rounded-2xl border border-blue-100 bg-blue-50/40 overflow-hidden open:shadow-sm"
            open
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-bold text-blue-800 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                應發項目
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">加項 +</span>
              </span>
              <ChevronDown className="h-5 w-5 shrink-0 text-blue-600 transition group-open:rotate-180" />
            </summary>
            <ul className="space-y-3 border-t border-blue-100/80 px-4 pb-4 pt-3 text-sm text-slate-600">
              <li className="flex justify-between items-end">
                <span>底薪 / 本薪</span>
                <span className="font-mono font-bold text-slate-800 text-base">${fmt(details.base_pay)}</span>
              </li>
              {details.ot_pay > 0 && (
                <li className="flex justify-between items-end">
                  <span>加班費彙總</span>
                  <span className="font-mono font-bold text-slate-800 text-base">${fmt(details.ot_pay)}</span>
                </li>
              )}
              {details.holiday_pay > 0 && (
                <li className="flex justify-between items-end">
                  <span>國定假日加發</span>
                  <span className="font-mono font-bold text-slate-800 text-base">${fmt(details.holiday_pay)}</span>
                </li>
              )}
              <li className="flex justify-between items-end">
                <span>固定津貼</span>
                <span className="font-mono font-bold text-slate-800 text-base">${fmt(details.fixed_bonus_pay)}</span>
              </li>
              {(details.temp_bonus_details || []).map((b: any, i: number) => (
                <li key={i} className="flex justify-between items-end text-blue-600">
                  <span className="text-xs">↳ {b.name}</span>
                  <span className="font-mono font-bold text-base">${fmt(b.amount)}</span>
                </li>
              ))}
            </ul>
          </details>

          <details
            className="group rounded-2xl border border-red-100 bg-red-50/40 overflow-hidden open:shadow-sm"
            open
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-bold text-red-800 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                應扣項目
                <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded font-bold">減項 -</span>
              </span>
              <ChevronDown className="h-5 w-5 shrink-0 text-red-600 transition group-open:rotate-180" />
            </summary>
            <ul className="space-y-3 border-t border-red-100/80 px-4 pb-4 pt-3 text-sm text-slate-600">
              <li className="flex justify-between items-end">
                <span>勞健保自付</span>
                <span className="font-mono font-bold text-red-600 text-base">
                  -${fmt((details.insurance_labor || 0) + (details.insurance_health || 0))}
                </span>
              </li>
              <li className="flex justify-between items-end">
                <span>請假扣款</span>
                <span className="font-mono font-bold text-red-600 text-base">-${fmt(details.leave_deduction)}</span>
              </li>
              <li className="flex justify-between items-end">
                <span>固定扣除</span>
                <span className="font-mono font-bold text-red-600 text-base">-${fmt(details.fixed_deduction_pay)}</span>
              </li>
              {(details.temp_deduction_details || []).map((d: any, i: number) => (
                <li key={i} className="flex justify-between items-end text-red-600">
                  <span className="text-xs">↳ {d.name}</span>
                  <span className="font-mono font-bold text-base">-${fmt(d.amount)}</span>
                </li>
              ))}
            </ul>
          </details>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
            <strong>【機密聲明】</strong>{' '}
            本薪資明細單為個人機密文件，如有任何疑義，請於發薪日起三日內向管理部提出查核。
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6 px-2">
        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
          <FileText className="text-blue-600" /> 我的薪資單
        </h2>
        <button
          type="button"
          onClick={() => setIsUnlocked(false)}
          className="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full hover:bg-slate-200 font-bold transition"
        >
          重新上鎖
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-400 font-bold animate-pulse">載入中...</div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-slate-100 px-6">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <DollarSign className="text-slate-400" size={24} />
          </div>
          <h3 className="font-bold text-slate-700 mb-1">目前尚無薪資紀錄</h3>
          <p className="text-sm text-slate-500">系統會在每月結算封存後自動派發薪資單</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((item, idx) => {
            const ym = item.year_month || item.paid_in_month || '';
            const monthPart = ym.split('-')[1] || '--';
            return (
              <button
                key={item.id ?? idx}
                type="button"
                onClick={() => setSelectedSlip(item)}
                className="w-full bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all flex items-center justify-between group active:scale-95"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 font-black text-blue-600">
                    {monthPart}
                    <span className="text-xs font-normal">月</span>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-slate-800 text-lg mb-0.5">
                      {ym.replace('-', '年')} 薪資
                    </div>
                    <div className="text-xs text-slate-400 bg-slate-100 inline-block px-2 py-0.5 rounded">
                      已結算封存
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-mono font-black text-slate-800 text-lg">${fmt(netPayFromItem(item))}</div>
                  <ChevronRight className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DoctorSalaryDetail({ slip, onBack }: { slip: any; onBack: () => void }) {
  const doc = {
    month: slip.paid_in_month,
    basePay: slip.actual_base_pay,
    bonus: slip.final_ppf_bonus,
    netPay: slip.net_pay,
    ppfMonth: slip.target_month,
    transfer: slip.transfer_amount,
    cash: slip.cash_amount,
    patientCount: slip.patient_count,
    nhiPoints: slip.nhi_points,
    totalPerformance: slip.total_performance,
    selfPayItems: (slip.self_pay_items as any[]) || [],
    extraItems: (slip.extra_items as any[]) || [],
    insLabor: Number(slip.insurance_labor || 0),
    insHealth: Number(slip.insurance_health || 0),
  };

  const selfPayTotal =
    doc.selfPayItems.reduce(
      (sum: number, item: any) => sum + Number(item.amount || 0) * (Number(item.rate || 0) / 100),
      0,
    ) || 0;
  const extraTotal =
    doc.extraItems.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0) || 0;

  return (
    <div className="animate-fade-in bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-100">
      <div className="bg-slate-900 p-6 text-white relative">
        <button
          type="button"
          onClick={onBack}
          className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition"
        >
          <X size={20} />
        </button>
        <div className="text-slate-400 text-sm font-bold mb-1 flex items-center gap-2">
          <CalendarDays size={16} /> {String(doc.month || '').replace('-', '年')}月
        </div>
        <h2 className="text-2xl font-black mb-6">醫師薪資明細</h2>

        <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
          <div className="text-sm text-slate-300 mb-1">實發金額 (Net Pay)</div>
          <div className="text-4xl font-mono font-bold tracking-tight">
            <span className="text-2xl mr-1">$</span>
            {fmt(doc.netPay)}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <details
          className="group rounded-2xl border border-blue-100 bg-blue-50/40 overflow-hidden open:shadow-sm"
          open
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-bold text-blue-800 [&::-webkit-details-marker]:hidden">
            <span>應發項目</span>
            <ChevronDown className="h-5 w-5 shrink-0 text-blue-600 transition group-open:rotate-180" />
          </summary>
          <div className="space-y-3 border-t border-blue-100/80 px-4 pb-4 pt-3 text-sm text-slate-600">
            <div className="flex justify-between">
              <span>保障薪 / 掛牌費</span>
              <span className="font-mono font-bold">${fmt(doc.basePay)}</span>
            </div>
            {doc.bonus > 0 && (
              <div className="flex justify-between text-blue-700">
                <span className="flex items-center gap-1">
                  <TrendingUp size={14} /> PPF 績效獎金
                </span>
                <span className="font-mono font-bold">+${fmt(doc.bonus)}</span>
              </div>
            )}
            {doc.bonus > 0 && (
              <p className="text-xs text-blue-500 text-right">結算月份: {doc.ppfMonth}</p>
            )}
            {selfPayTotal > 0 && (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-2">
                <div className="mb-2 flex justify-between font-bold text-emerald-800">
                  <span>自費項目抽成</span>
                  <span className="font-mono">+${fmt(selfPayTotal)}</span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-600">
                  {doc.selfPayItems.map((item: any, idx: number) => {
                    const amount = Number(item.amount || 0);
                    const rate = Number(item.rate || 0);
                    const share = amount * (rate / 100);
                    return (
                      <div key={idx} className="flex justify-between rounded bg-white/70 px-2 py-1">
                        <span className="max-w-[60%] truncate">
                          {item.name || '自費項目'}{' '}
                          <span className="text-slate-400">
                            ({fmt(amount)} × {rate}%)
                          </span>
                        </span>
                        <span className="font-mono font-bold text-emerald-800">+${fmt(share)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {extraTotal !== 0 && (
              <div className="flex justify-between">
                <span>特殊費用 / 津貼</span>
                <span className="font-mono font-bold">
                  {extraTotal > 0 ? '+' : ''}${fmt(extraTotal)}
                </span>
              </div>
            )}
          </div>
        </details>

        {(doc.insLabor > 0 || doc.insHealth > 0) && (
          <details
            className="group rounded-2xl border border-red-100 bg-red-50/40 overflow-hidden open:shadow-sm"
            open
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-bold text-red-800 [&::-webkit-details-marker]:hidden">
              <span>應扣項目</span>
              <ChevronDown className="h-5 w-5 shrink-0 text-red-600 transition group-open:rotate-180" />
            </summary>
            <div className="space-y-2 border-t border-red-100/80 px-4 pb-4 pt-3 text-sm">
              <div className="flex justify-between font-bold text-red-700">
                <span>勞健保自付</span>
                <span className="font-mono">-${fmt(doc.insLabor + doc.insHealth)}</span>
              </div>
              {doc.insLabor > 0 && (
                <div className="flex justify-between text-xs text-red-600">
                  <span>勞保自付額</span>
                  <span className="font-mono font-bold">-${fmt(doc.insLabor)}</span>
                </div>
              )}
              {doc.insHealth > 0 && (
                <div className="flex justify-between text-xs text-red-600">
                  <span>健保自付額</span>
                  <span className="font-mono font-bold">-${fmt(doc.insHealth)}</span>
                </div>
              )}
            </div>
          </details>
        )}

        <details className="group rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden open:shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-bold text-slate-600 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-1">
              <FileText size={14} /> PPF 統計
            </span>
            <ChevronDown className="h-5 w-5 shrink-0 transition group-open:rotate-180" />
          </summary>
          <div className="grid grid-cols-2 gap-2 border-t border-slate-200 px-4 pb-4 pt-3 text-[11px] text-slate-600">
            <div className="rounded bg-white p-2">
              看診人數: <span className="font-bold text-slate-800">{doc.patientCount}</span>
            </div>
            <div className="rounded bg-white p-2">
              健保點數: <span className="font-bold text-slate-800">{fmt(doc.nhiPoints)}</span>
            </div>
            <div className="col-span-2 rounded bg-white p-2">
              總業績: <span className="font-bold text-yellow-700">${fmt(doc.totalPerformance)}</span>
            </div>
          </div>
        </details>

        <div className="flex justify-between rounded-xl bg-slate-100 p-4 text-sm">
          <div>
            <div className="text-[11px] font-bold text-slate-500">銀行匯款</div>
            <div className="font-mono font-bold text-lg">${fmt(doc.transfer)}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-bold text-slate-500">現金發放</div>
            <div className="font-mono font-bold text-lg text-green-600">${fmt(doc.cash)}</div>
          </div>
        </div>

        <div className="p-4 text-[11px] leading-relaxed text-slate-500">
          <strong>【機密聲明】</strong> 本薪資明細單為個人機密文件，如有任何疑義，請於發薪日起三日內向管理部提出查核。
        </div>
      </div>
    </div>
  );
}
