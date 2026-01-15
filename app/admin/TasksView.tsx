'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Calendar, FileText, Filter } from 'lucide-react';

const formatDate = (iso: string) => new Date(iso).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const FILTER_LABELS: Record<string, string> = {
  pending: '待審核',
  approved: '已通過',
  rejected: '已駁回',
  all: '全部'
};

export default function TasksView() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  useEffect(() => { fetchRequests(); }, [filter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        statusFilter: filter === 'all' ? 'all' : filter
      });
      const response = await fetch(`/api/leave?${params.toString()}`);
      const result = await response.json();
      if (result.error) {
        console.error('Error:', result.error);
        setRequests([]);
      } else {
        // 按 created_at 排序（最新的在前）
        const sorted = (result.data || []).sort((a: any, b: any) => {
          const dateA = new Date(a.created_at || a.start_time).getTime();
          const dateB = new Date(b.created_at || b.start_time).getTime();
          return dateB - dateA;
        });
        setRequests(sorted);
      }
    } catch (error) {
      console.error('Fetch requests error:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  // 🟢 核心功能：核准案件 (智慧媒合邏輯)
  const handleApprove = async (req: any) => {
    const name = req.staff_name || '未知員工';
    if (!confirm(`確定要核准 ${name} 的 ${req.type}${req.leave_type ? ` (${req.leave_type})` : ''} 申請嗎？`)) return;

    try {
      if (req.type === '補打卡') {
        const dateStr = req.start_time.split('T')[0];
        const startTime = req.start_time;
        const endTime = req.end_time;

        if (req.leave_type === '全天') {
          // 1. 補全天：直接新增完美紀錄
          const hours = (new Date(endTime).getTime() - new Date(startTime).getTime()) / 3600000;
          const response = await fetch('/api/attendance/punch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'full',
              staff_name: name,
              date: dateStr,
              start_time: startTime,
              end_time: endTime,
              action: 'insert',
              anomaly_reason: '補打卡核准(全天)'
            })
          });
          const result = await response.json();
          if (!result.success) throw new Error(result.message || '新增考勤記錄失敗');

        } else if (req.leave_type === '上班') {
          // 2. 補上班：找有沒有 "只有下班" 的孤兒紀錄
          const orphanRes = await fetch(`/api/attendance/punch?staff_name=${encodeURIComponent(name)}&date=${dateStr}&type=orphan`);
          const orphanData = await orphanRes.json();

          if (orphanData.data) {
            // 找到了！合併成一筆
            const duration = (new Date(orphanData.data.clock_out_time).getTime() - new Date(startTime).getTime()) / 3600000;
            const response = await fetch('/api/attendance/punch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'clock_in',
                staff_name: name,
                date: dateStr,
                start_time: startTime,
                action: 'update',
                target_id: orphanData.data.id,
                anomaly_reason: (orphanData.data.anomaly_reason || '') + ', 補上班核准'
              })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message || '更新考勤記錄失敗');
          } else {
            // 沒找到，新增一筆 working 狀態
            const response = await fetch('/api/attendance/punch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'clock_in',
                staff_name: name,
                date: dateStr,
                start_time: startTime,
                action: 'insert',
                anomaly_reason: '補上班核准'
              })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message || '新增考勤記錄失敗');
          }

        } else if (req.leave_type === '下班') {
          // 3. 補下班：找有沒有 "working" 的紀錄
          const workingRes = await fetch(`/api/attendance/punch?staff_name=${encodeURIComponent(name)}&date=${dateStr}&type=working`);
          const workingData = await workingRes.json();

          if (workingData.data) {
            // 找到了！結案
            const response = await fetch('/api/attendance/punch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'clock_out',
                staff_name: name,
                date: dateStr,
                start_time: workingData.data.clock_in_time,
                end_time: startTime,
                action: 'update',
                target_id: workingData.data.id,
                anomaly_reason: (workingData.data.anomaly_reason || '') + ', 補下班核准'
              })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message || '更新考勤記錄失敗');
          } else {
            // 沒找到上班紀錄，建立暫存孤兒 (in=out)
            const response = await fetch('/api/attendance/punch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'clock_out',
                staff_name: name,
                date: dateStr,
                start_time: startTime,
                end_time: startTime,
                action: 'insert',
                anomaly_reason: '單獨補下班(等待補上班)'
              })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message || '新增考勤記錄失敗');
          }
        }
      }

      // 更新申請單狀態
      const updateRes = await fetch('/api/leave', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: req.id, status: 'approved' })
      });
      const updateResult = await updateRes.json();
      if (!updateResult.success) throw new Error(updateResult.message || '更新申請單狀態失敗');

      alert("✅ 已核准，並同步至考勤系統！");
      fetchRequests();

    } catch (err: any) {
      alert("❌ 核准失敗：" + err.message);
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm("確定要駁回此申請嗎？")) return;
    try {
      const response = await fetch('/api/leave', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'rejected' })
      });
      const result = await response.json();
      if (result.success) {
        fetchRequests();
      } else {
        alert('駁回失敗: ' + result.message);
      }
    } catch (error) {
      console.error('Reject error:', error);
      alert('駁回失敗');
    }
  };

  return (
    <div className="w-full animate-fade-in p-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <CheckCircle className="text-teal-600" size={32} /> 待辦事項審核
          </h1>
          <p className="text-slate-500 mt-2">處理員工的請假與補打卡申請。</p>
        </div>
        <div className="flex bg-white rounded-lg shadow-sm p-1 border border-slate-200">
          {['pending', 'approved', 'rejected', 'all'].map(f => (
            <button 
              key={f} 
              onClick={() => setFilter(f)} 
              className={`px-4 py-2 rounded-md text-sm font-bold transition ${
                filter === f 
                  ? 'bg-teal-100 text-teal-800' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">載入中...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
          <CheckCircle className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-500 font-bold">目前沒有案件 🎉</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map((req) => (
            <div 
              key={req.id} 
              className={`bg-white p-6 rounded-xl shadow-sm border-l-4 flex justify-between items-center transition hover:shadow-md ${
                req.status === 'pending' 
                  ? 'border-yellow-400' 
                  : (req.status === 'approved' 
                      ? 'border-green-500' 
                      : 'border-red-500')
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shrink-0 ${
                  req.type === '補打卡' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'bg-purple-100 text-purple-600'
                }`}>
                  {req.type === '補打卡' ? <Clock size={24}/> : <Calendar size={24}/>}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold text-slate-800">{req.staff_name}</span>
                    <span className={`px-2 py-0.5 text-xs rounded font-bold ${
                      req.type === '補打卡' 
                        ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                        : 'bg-purple-50 text-purple-700 border border-purple-200'
                    }`}>
                      {req.type} {req.leave_type && `(${req.leave_type})`}
                    </span>
                    {req.status !== 'pending' && (
                      <span className={`px-2 py-0.5 text-xs rounded font-bold ${
                        req.status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {req.status === 'approved' ? '已通過' : '已駁回'}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <Clock size={14}/> 
                      <span className="font-mono">
                        {formatDate(req.start_time)} 
                        {req.type === '補打卡' && req.leave_type === '全天' 
                          ? ` ~ ${formatDate(req.end_time)}` 
                          : (req.type !== '補打卡' && ` ~ ${formatDate(req.end_time)}`)
                        }
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <FileText size={14}/> 原因：{req.reason || '無'}
                    </div>
                  </div>
                </div>
              </div>
              {req.status === 'pending' && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleReject(req.id)} 
                    className="px-4 py-2 text-red-600 font-bold hover:bg-red-50 rounded transition flex items-center gap-1"
                  >
                    <XCircle size={18}/> 駁回
                  </button>
                  <button 
                    onClick={() => handleApprove(req)} 
                    className="px-6 py-2 bg-teal-600 text-white font-bold rounded shadow hover:bg-teal-500 transition flex items-center gap-2 active:scale-95"
                  >
                    <CheckCircle size={18}/> 核准
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
