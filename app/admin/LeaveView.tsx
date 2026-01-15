'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, CheckCircle, Clock, ToggleLeft, ToggleRight, User, Filter, XCircle, DollarSign, TrendingUp, X } from 'lucide-react';

// 🟢 中文假別列表 (供新增時選單使用)
const LEAVE_OPTIONS = ['事假', '病假', '特休', '補休', '公假', '喪假', '婚假', '產假'];

const getInitialRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1); 
    const end = new Date(now.getFullYear(), 11, 31);
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    return { start: fmt(start), end: fmt(end) };
};

export default function LeaveView() {
  const [activeTab, setActiveTab] = useState<'requests' | 'stats'>('requests');
  
  // ==========================================
  // Tab 1: 請假申請列表 (原有功能)
  // ==========================================
  const range = getInitialRange();
  const [useDateFilter, setUseDateFilter] = useState(false);
  const [startDate, setStartDate] = useState(range.start);
  const [endDate, setEndDate] = useState(range.end);
  const [selectedStaffId, setSelectedStaffId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [requests, setRequests] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // 表單狀態
  const [formData, setFormData] = useState({
    staff_id: '',
    type: '事假',
    date: new Date().toISOString().slice(0, 10),
    start_time: '09:00',
    end_time: '18:00',
    hours: 8,
    reason: ''
  });

  // ==========================================
  // Tab 2: 特休統計與結算 (新功能)
  // ==========================================
  const [leaveStats, setLeaveStats] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedStaffForSettle, setSelectedStaffForSettle] = useState<any>(null);
  const [settleForm, setSettleForm] = useState({
    days: 0,
    pay_month: new Date().toISOString().slice(0, 7),
    notes: ''
  });

  useEffect(() => { 
    fetchStaff(); 
    if (activeTab === 'stats') {
      fetchLeaveStats();
    }
  }, [activeTab]);
  
  useEffect(() => { 
    if (activeTab === 'requests') {
      fetchRequests(); 
    }
  }, [useDateFilter, startDate, endDate, selectedStaffId, statusFilter, activeTab]);

  // 自動計算時數
  useEffect(() => {
      if (formData.start_time && formData.end_time) {
          const s = new Date(`2000-01-01T${formData.start_time}`);
          const e = new Date(`2000-01-01T${formData.end_time}`);
          const diff = (e.getTime() - s.getTime()) / 3600000;
          if (diff > 0) setFormData(prev => ({ ...prev, hours: diff }));
      }
  }, [formData.start_time, formData.end_time]);

  const fetchStaff = async () => {
    try {
      const response = await fetch('/api/staff');
      const result = await response.json();
      if (result.data) {
        setStaffList(result.data.map((s: any) => ({ id: s.id, name: s.name, entity: s.entity })));
      }
    } catch (error) {
      console.error('Fetch staff error:', error);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        useDateFilter: String(useDateFilter),
        selectedStaffId: selectedStaffId,
        statusFilter: statusFilter,
      });

      if (useDateFilter) {
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      }

      const response = await fetch(`/api/leave?${params.toString()}`);
      const result = await response.json();

      if (result.error) {
        console.error('Error:', result.error);
        setRequests([]);
      } else {
        setRequests(result.data || []);
      }
    } catch (error) {
      console.error('Fetch requests error:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveStats = async () => {
    setLoadingStats(true);
    try {
      const response = await fetch('/api/leave/stats');
      const result = await response.json();
      if (result.error) {
        console.error('Error:', result.error);
        setLeaveStats([]);
      } else {
        setLeaveStats(result.data || []);
      }
    } catch (error) {
      console.error('Fetch leave stats error:', error);
      setLeaveStats([]);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('確定要刪除這筆請假紀錄嗎？')) return;
    try {
      const response = await fetch(`/api/leave?id=${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        fetchRequests();
      } else {
        alert('刪除失敗: ' + result.message);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('刪除失敗');
    }
  };

  const handleSubmit = async () => {
    if (!formData.staff_id) {
      alert('請選擇員工');
      return;
    }

    try {
      const staff = staffList.find(s => s.id === Number(formData.staff_id));
      if (!staff) {
        alert('找不到員工資料');
        return;
      }

      const response = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: Number(formData.staff_id),
          staff_name: staff.name,
          type: formData.type,
          date: formData.date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          hours: Number(formData.hours),
          reason: formData.reason,
          status: 'approved'
        })
      });

      const result = await response.json();
      if (result.success) {
        setShowModal(false);
        fetchRequests();
      } else {
        alert('新增失敗: ' + result.message);
      }
    } catch (error) {
      console.error('Submit error:', error);
      alert('新增失敗');
    }
  };

  const handleOpenSettle = (staff: any) => {
    setSelectedStaffForSettle(staff);
    setSettleForm({
      days: Math.min(staff.remaining, 1), // 預設1天或剩餘天數
      pay_month: new Date().toISOString().slice(0, 7),
      notes: ''
    });
    setShowSettleModal(true);
  };

  const handleSettle = async () => {
    if (!selectedStaffForSettle) return;
    
    if (settleForm.days <= 0) {
      alert('結算天數必須大於0');
      return;
    }
    
    if (settleForm.days > selectedStaffForSettle.remaining) {
      alert(`剩餘特休不足 (剩餘: ${selectedStaffForSettle.remaining} 天)`);
      return;
    }

    try {
      const response = await fetch('/api/leave/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: selectedStaffForSettle.staff_id,
          days: Number(settleForm.days),
          pay_month: settleForm.pay_month,
          notes: settleForm.notes
        })
      });

      const result = await response.json();
      if (result.success) {
        alert('結算紀錄已建立！');
        setShowSettleModal(false);
        fetchLeaveStats();
      } else {
        alert('結算失敗: ' + result.message);
      }
    } catch (error) {
      console.error('Settle error:', error);
      alert('結算失敗');
    }
  };

  const calculateSettleAmount = () => {
    if (!selectedStaffForSettle) return 0;
    const baseSalary = selectedStaffForSettle.base_salary || 0;
    return Math.round((baseSalary / 30) * settleForm.days * 100) / 100;
  };

  return (
    <div className="w-full animate-fade-in p-4">
      
      {/* 標題與 Tab 切換 */}
      <div className="flex flex-wrap justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 shrink-0">
            <Calendar className="text-orange-500"/> 請假管理系統
          </h2>
          <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>
          
          {/* Tab 切換 */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('requests')} 
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition ${
                activeTab === 'requests' 
                  ? 'bg-white shadow text-blue-700' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Clock size={16}/> 請假申請列表
            </button>
            <button 
              onClick={() => setActiveTab('stats')} 
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition ${
                activeTab === 'stats' 
                  ? 'bg-white shadow text-purple-700' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <TrendingUp size={16}/> 特休統計與結算
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: 請假申請列表 */}
      {activeTab === 'requests' && (
        <>
          {/* 工具列 */}
          <div className="flex flex-wrap justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <button onClick={() => setUseDateFilter(!useDateFilter)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold transition ${useDateFilter ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    {useDateFilter ? <ToggleRight size={20} className="text-blue-600"/> : <ToggleLeft size={20} className="text-slate-400"/>} 日期篩選
              </button>

              {useDateFilter && (
                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border text-sm animate-fade-in">
                        <span className="text-slate-500 pl-1">區間:</span>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent font-bold text-slate-700 outline-none"/>
                        <span className="text-slate-400">~</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent font-bold text-slate-700 outline-none"/>
                    </div>
              )}

              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border text-sm">
                    <User size={16} className="text-slate-400 ml-1"/>
                    <select value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)} className="bg-transparent font-bold text-slate-700 outline-none w-32">
                        <option value="all">所有員工</option>
                        {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
              </div>

              {/* 狀態篩選 */}
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border text-sm">
                    <Filter size={16} className="text-slate-400 ml-1"/>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-transparent font-bold text-slate-700 outline-none w-24">
                        <option value="all">不限狀態</option>
                        <option value="pending">待審核</option>
                        <option value="approved">已通過</option>
                        <option value="rejected">已駁回</option>
                    </select>
              </div>
            </div>

            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-600 transition shrink-0">
              <Plus size={18}/> 新增請假
            </button>
          </div>

          {/* 列表 */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-600 text-sm">
                    <tr><th className="p-4">日期</th><th className="p-4">員工</th><th className="p-4">假別</th><th className="p-4">時數</th><th className="p-4">事由</th><th className="p-4 text-center">狀態</th><th className="p-4"></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                    {loading ? (<tr><td colSpan={7} className="p-8 text-center text-slate-400">載入中...</td></tr>) : requests.length === 0 ? (<tr><td colSpan={7} className="p-8 text-center text-slate-400">無符合條件的紀錄</td></tr>) : requests.map((req) => {
                        const staff = staffList.find(s => s.id === req.staff_id);
                        const staffName = staff?.name || req.staff_name || '未知';
                        const isPending = req.status === 'pending';
                        const isRejected = req.status === 'rejected';
                        
                        return (
                            <tr key={req.id} className="hover:bg-slate-50 transition">
                                <td className="p-4 font-mono text-slate-600">{req.start_time?.slice(0, 10)}<br/><span className="text-xs text-slate-400">{req.start_time?.slice(11, 16)} ~ {req.end_time?.slice(11, 16)}</span></td>
                                <td className="p-4 font-bold text-slate-800">{staffName}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${req.type==='補打卡'?'bg-blue-100 text-blue-600':(req.type==='事假'?'bg-slate-200 text-slate-600':'bg-purple-100 text-purple-600')}`}>
                                        {req.type} {req.leave_type && `(${req.leave_type})`}
                                    </span>
                                </td>
                                <td className="p-4 font-mono font-bold">{req.hours} hr</td>
                                <td className="p-4 text-slate-500 max-w-xs truncate" title={req.reason}>{req.reason || '-'}</td>
                                <td className="p-4 text-center">
                                    {isPending ? <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold">待審核</span> : (isRejected ? <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">已駁回</span> : <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">已通過</span>)}
                                </td>
                                <td className="p-4 text-right">
                                    <button onClick={() => handleDelete(req.id)} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-full transition"><Trash2 size={18}/></button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                </table>
            </div>
          </div>
        </>
      )}

      {/* Tab 2: 特休統計與結算 */}
      {activeTab === 'stats' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <TrendingUp size={18}/> 特休統計與結算
            </h3>
            <button 
              onClick={fetchLeaveStats} 
              className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition"
            >
              重新整理
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 text-sm font-bold">
                <tr>
                  <th className="p-4">員工</th>
                  <th className="p-4">到職日</th>
                  <th className="p-4 text-center">年資</th>
                  <th className="p-4 text-center">制度</th>
                  <th className="p-4 text-center">結算區間</th>
                  <th className="p-4 text-right">法定天數</th>
                  <th className="p-4 text-right">已休</th>
                  <th className="p-4 text-right">已結算</th>
                  <th className="p-4 text-right font-bold text-green-600">剩餘</th>
                  <th className="p-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loadingStats ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">載入中...</td>
                  </tr>
                ) : leaveStats.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">無資料</td>
                  </tr>
                ) : (
                  leaveStats.map((stat: any) => (
                    <tr key={stat.staff_id} className="hover:bg-slate-50 transition">
                      <td className="p-4 font-bold text-slate-800">{stat.staff_name}</td>
                      <td className="p-4 font-mono text-slate-600">{stat.start_date || '-'}</td>
                      <td className="p-4 text-center font-mono">{stat.years_of_service.toFixed(1)} 年</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          stat.calculation_system === 'calendar' 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {stat.calculation_system === 'calendar' ? '曆年制' : '週年制'}
                        </span>
                      </td>
                      <td className="p-4 text-center text-xs font-mono text-slate-500">
                        {stat.period_start && stat.period_end ? (
                          <div>
                            {stat.period_start}<br/>
                            <span className="text-slate-400">~</span><br/>
                            {stat.period_end}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="p-4 text-right font-mono font-bold">{stat.entitlement.toFixed(1)}</td>
                      <td className="p-4 text-right font-mono">{stat.used.toFixed(1)}</td>
                      <td className="p-4 text-right font-mono text-orange-600">{stat.settled.toFixed(1)}</td>
                      <td className="p-4 text-right font-mono font-bold text-green-600 text-lg">
                        {stat.remaining.toFixed(1)}
                      </td>
                      <td className="p-4 text-center">
                        {stat.remaining > 0 ? (
                          <button
                            onClick={() => handleOpenSettle(stat)}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition flex items-center gap-1"
                          >
                            <DollarSign size={14}/> 結算兌現
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs">無可結算</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 新增請假彈窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">新增請假單 (管理員代填)</h3>
            <div className="space-y-4">
              <div><label className="block text-sm font-bold text-slate-600 mb-1">員工</label><select className="w-full p-2 border rounded" value={formData.staff_id} onChange={e => setFormData({...formData, staff_id: e.target.value})}><option value="">請選擇...</option>{staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.entity === 'pharmacy' ? '藥局' : '診所'})</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-bold text-slate-600 mb-1">日期</label><input type="date" className="w-full p-2 border rounded" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})}/></div>
                <div><label className="block text-sm font-bold text-slate-600 mb-1">假別</label><select className="w-full p-2 border rounded" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>{LEAVE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="block text-sm font-bold text-slate-600 mb-1">開始</label><input type="time" className="w-full p-2 border rounded text-sm" value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})}/></div>
                <div><label className="block text-sm font-bold text-slate-600 mb-1">結束</label><input type="time" className="w-full p-2 border rounded text-sm" value={formData.end_time} onChange={e => setFormData({...formData, end_time: e.target.value})}/></div>
                <div><label className="block text-sm font-bold text-slate-600 mb-1">時數</label><input type="number" step="0.5" className="w-full p-2 border rounded font-bold" value={formData.hours} onChange={e => setFormData({...formData, hours: Number(e.target.value)})}/></div>
              </div>
              <div><label className="block text-sm font-bold text-slate-600 mb-1">事由</label><input type="text" className="w-full p-2 border rounded" placeholder="選填" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})}/></div>
            </div>
            <div className="mt-6 flex justify-end gap-3 border-t pt-4">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">取消</button>
              <button onClick={handleSubmit} className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-black font-bold">送出</button>
            </div>
          </div>
        </div>
      )}

      {/* 特休結算彈窗 */}
      {showSettleModal && selectedStaffForSettle && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <DollarSign className="text-green-600"/> 特休結算兌現
              </h3>
              <button onClick={() => setShowSettleModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X size={20}/>
              </button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="bg-slate-50 p-4 rounded-lg border">
                <div className="text-sm text-slate-600 mb-2">員工</div>
                <div className="text-lg font-bold text-slate-800">{selectedStaffForSettle.staff_name}</div>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="text-sm text-green-700 mb-1">剩餘特休</div>
                <div className="text-2xl font-bold text-green-700">{selectedStaffForSettle.remaining.toFixed(1)} 天</div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">欲結算天數</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max={selectedStaffForSettle.remaining}
                  className="w-full p-3 border rounded-lg font-bold text-lg text-center"
                  value={settleForm.days}
                  onChange={e => setSettleForm({...settleForm, days: Number(e.target.value)})}
                />
                <p className="text-xs text-slate-400 mt-1">最多可結算 {selectedStaffForSettle.remaining.toFixed(1)} 天</p>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">發放月份</label>
                <input
                  type="month"
                  className="w-full p-3 border rounded-lg font-bold"
                  value={settleForm.pay_month}
                  onChange={e => setSettleForm({...settleForm, pay_month: e.target.value})}
                />
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="text-sm text-blue-700 mb-1">試算金額</div>
                <div className="text-2xl font-bold text-blue-700">
                  ${calculateSettleAmount().toLocaleString()}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  計算公式: (底薪 ${selectedStaffForSettle.base_salary?.toLocaleString() || 0} / 30) × {settleForm.days} 天
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">備註 (選填)</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  placeholder="例如：員工申請結算"
                  value={settleForm.notes}
                  onChange={e => setSettleForm({...settleForm, notes: e.target.value})}
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 border-t pt-4">
              <button onClick={() => setShowSettleModal(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">
                取消
              </button>
              <button
                onClick={handleSettle}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold flex items-center gap-2"
              >
                <DollarSign size={18}/> 確認結算
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
