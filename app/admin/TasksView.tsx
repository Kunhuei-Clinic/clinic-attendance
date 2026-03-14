'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Calendar, FileText, Filter, AlertCircle } from 'lucide-react';

const formatDate = (iso: string) => new Date(iso).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

const FILTER_LABELS: Record<string, string> = {
  pending: '待審核',
  approved: '已通過',
  rejected: '已駁回',
  all: '全部'
};

const TYPE_LABELS: Record<string, string> = {
  leave: '請假',
  missed_punch: '補打卡',
  overtime: '加班',
  anomaly: '異常'
};

export default function TasksView() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState<'all' | 'leave' | 'missed_punch' | 'overtime' | 'anomaly'>('all');

  useEffect(() => { fetchTasks(); }, [filter, typeFilter]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/tasks');
      const result = await response.json();
      if (result.error) {
        console.error('Error:', result.error);
        setTasks([]);
      } else {
        let filtered = result.data || [];

        // 🟢 1. 修復狀態篩選 (相容 anomaly_status 與 status)
        if (filter !== 'all') {
          filtered = filtered.filter((task: any) => {
            const currentStatus = task.status || task.anomaly_status || 'pending';
            if (filter === 'approved' && currentStatus === 'resolved') return true;
            return currentStatus === filter;
          });
        }

        // 🟢 2. 修復類型篩選 (將請假與補打卡徹底分開)
        if (typeFilter !== 'all') {
          if (typeFilter === 'leave') {
            filtered = filtered.filter((task: any) =>
              task.type !== 'overtime' &&
              task.type !== 'anomaly' &&
              task.type !== 'missed_punch' &&
              task.type !== '補打卡' &&
              task._raw?.type !== '補打卡'
            );
          } else if (typeFilter === 'missed_punch') {
            filtered = filtered.filter((task: any) =>
              task.type === 'missed_punch' ||
              task.type === '補打卡' ||
              task._raw?.type === '補打卡'
            );
          } else {
            filtered = filtered.filter((task: any) => task.type === typeFilter);
          }
        }

        // 將待審核 (pending) 排在最上面
        filtered.sort((a: any, b: any) => {
          const aStatus = a.status || a.anomaly_status || 'pending';
          const bStatus = b.status || b.anomaly_status || 'pending';
          if (aStatus === 'pending' && bStatus !== 'pending') return -1;
          if (aStatus !== 'pending' && bStatus === 'pending') return 1;
          return 0;
        });

        setTasks(filtered);
      }
    } catch (error) {
      console.error('Fetch tasks error:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  // 🟢 全新統一審核邏輯 (對接後端 API)
  const handleAction = async (task: any, action: 'approve' | 'reject') => {
    let actionText = action === 'approve' ? '核准' : '駁回';
    if (task.type === 'anomaly' && action === 'approve') actionText = '標記為已解決';

    const name = task.staff_name || '未知員工';

    if (!confirm(`確定要 ${actionText} ${name} 的申請嗎？`)) return;

    try {
      // 判斷要傳給 API 的精確 taskType
      let apiTaskType = task.type;
      if (task.type === '補打卡' || (task._raw && task._raw.type === '補打卡')) {
        apiTaskType = 'missed_punch';
      }

      // 提取日期 (相容不同資料結構)
      const taskDate = task.date || (task.start_time ? task.start_time.split('T')[0] : null);

      const response = await fetch('/api/admin/tasks/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          taskType: apiTaskType,
          action,
          leaveType: task.leave_type,
          staffName: task.staff_name,
          date: taskDate,
          startTime: task.start_time || task.clock_in_time,
          endTime: task.end_time || task.clock_out_time,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`✅ ${actionText}成功！`);
        fetchTasks();
      } else {
        alert(`❌ ${actionText}失敗: ${result.message || '未知錯誤'}`);
      }
    } catch (error: any) {
      console.error('Task action error:', error);
      alert(`❌ ${actionText}失敗: ${error.message}`);
    }
  };

  return (
    <div className="w-full animate-fade-in p-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <CheckCircle className="text-teal-600" size={32} /> 待辦事項審核
          </h1>
          <p className="text-slate-500 mt-2">處理員工的請假、加班與異常打卡申請。</p>
        </div>
        <div className="flex flex-col gap-2">
          {/* 🟢 新增：類型篩選 */}
          <div className="flex bg-white rounded-lg shadow-sm p-1 border border-slate-200">
            {['all', 'leave', 'missed_punch', 'overtime', 'anomaly'].map(t => (
              <button 
                key={t} 
                onClick={() => setTypeFilter(t as any)} 
                className={`px-4 py-2 rounded-md text-sm font-bold transition whitespace-nowrap ${
                  typeFilter === t 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {t === 'all' ? '全部' : TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          {/* 狀態篩選 */}
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
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">載入中...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
          <CheckCircle className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-500 font-bold">目前沒有案件 🎉</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {tasks.map((task) => {
            // 🟢 新增：根據類型決定顯示內容
            const getTypeIcon = () => {
              if (task.type === 'overtime') return <Clock size={24} className="text-orange-600"/>;
              if (task.type === 'anomaly') return <AlertCircle size={24} className="text-red-600"/>;
              if (task.type === 'missed_punch') return <Clock size={24} className="text-amber-600"/>;
              return <Calendar size={24} className="text-purple-600"/>;
            };

            const getTypeColor = () => {
              if (task.type === 'overtime') return 'bg-orange-100 text-orange-600 border-orange-200';
              if (task.type === 'anomaly') return 'bg-red-100 text-red-600 border-red-200';
              if (task.type === 'missed_punch') return 'bg-amber-100 text-amber-600 border-amber-200';
              return 'bg-purple-100 text-purple-600 border-purple-200';
            };
            
            return (
              <div 
                key={`${task.type}-${task.id}`} 
                className={`bg-white p-6 rounded-xl shadow-sm border-l-4 flex justify-between items-center transition hover:shadow-md ${
                  (task.status || task.anomaly_status || 'pending') === 'pending'
                    ? 'border-yellow-400'
                    : (task.status || task.anomaly_status) === 'approved' || (task.status || task.anomaly_status) === 'resolved'
                      ? 'border-green-500'
                      : 'border-red-500'
                }`}
              >
                <div className="flex items-start gap-4 flex-1">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                    task.type === 'overtime'
                      ? 'bg-orange-100'
                      : task.type === 'anomaly'
                        ? 'bg-red-100'
                        : task.type === 'missed_punch'
                          ? 'bg-amber-100'
                          : 'bg-purple-100'
                  }`}>
                    {getTypeIcon()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-lg font-bold text-slate-800">{task.staff_name}</span>
                      <span className={`px-2 py-0.5 text-xs rounded font-bold border ${getTypeColor()}`}>
                        {task.type === 'overtime' ? '加班' : task.type === 'anomaly' ? '異常' : (task._raw?.type || task.type)}
                      </span>
                      {((task.status || task.anomaly_status) !== 'pending' && (task.status || task.anomaly_status) != null) && (
                        <span className={`px-2 py-0.5 text-xs rounded font-bold ${
                          (task.status || task.anomaly_status) === 'approved' || (task.status || task.anomaly_status) === 'resolved'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {(task.status || task.anomaly_status) === 'approved' || (task.status || task.anomaly_status) === 'resolved' ? '已通過' : '已駁回'}
                        </span>
                      )}
                    </div>
                    <div className="text-slate-500 text-sm space-y-1">
                      {/* 🟢 新增：加班顯示 */}
                      {task.type === 'overtime' && (
                        <>
                          <div className="flex items-center gap-2">
                            <Calendar size={14}/> 
                            <span className="font-bold">日期：{task.date}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock size={14}/> 
                            <span className="font-mono">
                              上班：{task.clock_in_time ? formatTime(task.clock_in_time) : '--'} 
                              {' → '}
                              下班：{task.clock_out_time ? formatTime(task.clock_out_time) : '--'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-orange-600 font-bold">
                            <Clock size={14}/> 
                            <span>總工時：{task.work_hours?.toFixed(1) || '0'} 小時</span>
                            {task.overtime_hours > 0 && (
                              <span className="text-orange-700">
                                (加班：{task.overtime_hours.toFixed(1)} 小時)
                              </span>
                            )}
                          </div>
                        </>
                      )}
                      
                      {/* 請假 / 補打卡顯示 */}
                      {(task.type === 'leave' || task.type === 'missed_punch') && (
                        <>
                          <div className="flex items-center gap-2">
                            <Clock size={14}/> 
                            <span className="font-mono">
                              {formatDate(task.start_time)} 
                              {task.end_time && ` ~ ${formatDate(task.end_time)}`}
                            </span>
                            {task.type === 'missed_punch' && task.leave_type && (
                              <span className="text-amber-600 font-bold">({task.leave_type})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-slate-700">
                            <FileText size={14}/> 原因：{task.reason || '無'}
                          </div>
                        </>
                      )}
                      
                      {/* 異常顯示 */}
                      {task.type === 'anomaly' && (
                        <>
                          <div className="flex items-center gap-2">
                            <Calendar size={14}/> 
                            <span className="font-bold">日期：{task.date || (task.clock_in_time ? task.clock_in_time.split('T')[0] : '')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock size={14}/> 
                            <span className="font-mono">
                              {task.clock_in_time ? formatTime(task.clock_in_time) : '--'} 
                              {' → '}
                              {task.clock_out_time ? formatTime(task.clock_out_time) : '--'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-red-600 font-bold bg-red-50 p-2 rounded-lg mt-1">
                            <AlertCircle size={14}/> 
                            原因：{task.anomaly_reason || task.description || '無詳細說明'}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {(task.status || task.anomaly_status || 'pending') === 'pending' && (
                  <div className="flex gap-2 shrink-0 mt-4 sm:mt-0">
                    <button
                      onClick={() => handleAction(task, 'reject')}
                      className="px-4 py-2 text-red-600 font-bold hover:bg-red-50 rounded transition flex items-center gap-1"
                    >
                      <XCircle size={18} /> 駁回
                    </button>
                    <button
                      onClick={() => handleAction(task, 'approve')}
                      className={`px-6 py-2 text-white font-bold rounded shadow transition flex items-center gap-2 active:scale-95 ${
                        task.type === 'anomaly' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-teal-600 hover:bg-teal-500'
                      }`}
                    >
                      <CheckCircle size={18} />
                      {task.type === 'anomaly' ? '標記已解決' : '核准'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
