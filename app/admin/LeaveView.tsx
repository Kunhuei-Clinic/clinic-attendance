'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Calendar, Plus, Trash2, CheckCircle, Clock, ToggleLeft, ToggleRight, User, Filter, XCircle } from 'lucide-react';

const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

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
  const range = getInitialRange();
  const [useDateFilter, setUseDateFilter] = useState(false);
  const [startDate, setStartDate] = useState(range.start);
  const [endDate, setEndDate] = useState(range.end);
  const [selectedStaffId, setSelectedStaffId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 新增狀態篩選

  const [requests, setRequests] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // 表單狀態
  const [formData, setFormData] = useState({
    staff_id: '',
    type: '事假', // 預設中文
    date: new Date().toISOString().slice(0, 10),
    start_time: '09:00',
    end_time: '18:00',
    hours: 8,
    reason: ''
  });

  useEffect(() => { fetchStaff(); }, []);
  useEffect(() => { fetchRequests(); }, [useDateFilter, startDate, endDate, selectedStaffId, statusFilter]);

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
    const { data } = await supabase.from('staff').select('id, name, entity').order('entity');
    if (data) setStaffList(data);
  };

  const fetchRequests = async () => {
    setLoading(true);
    let query = supabase.from('leave_requests').select('*').order('start_time', { ascending: false });

    if (useDateFilter) {
      query = query.lte('start_time', `${endDate}T23:59:59`).gte('end_time', `${startDate}T00:00:00`);
    }
    if (selectedStaffId !== 'all') {
        query = query.eq('staff_id', Number(selectedStaffId));
    }
    if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
    }
    if (!useDateFilter && statusFilter === 'all' && selectedStaffId === 'all') {
        query = query.limit(200);
    }
      
    const { data } = await query;
    setRequests(data || []);
    setLoading(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('確定要刪除這筆請假紀錄嗎？')) return;
    await supabase.from('leave_requests').delete().eq('id', id);
    fetchRequests();
  };

  const handleSubmit = async () => {
    if (!formData.staff_id) { alert('請選擇員工'); return; }
    
    // 補上 staff_name
    const staff = staffList.find(s => s.id === Number(formData.staff_id));
    const startFull = `${formData.date}T${formData.start_time}:00`;
    const endFull = `${formData.date}T${formData.end_time}:00`;

    const { error } = await supabase.from('leave_requests').insert([{
      staff_id: Number(formData.staff_id),
      staff_name: staff?.name, // ✅ 補上姓名
      type: formData.type,     // ✅ 存入中文假別
      start_time: startFull,
      end_time: endFull,
      hours: Number(formData.hours),
      reason: formData.reason,
      status: 'approved' // 管理者直接新增視為已核准
    }]);

    if (error) alert('新增失敗: ' + error.message);
    else {
      setShowModal(false);
      fetchRequests();
    }
  };

  return (
    <div className="w-full animate-fade-in p-4">
      
      {/* 工具列 */}
      <div className="flex flex-wrap justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 shrink-0">
            <Calendar className="text-orange-500"/> 請假管理
          </h2>
          <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>
          
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
                    const staffName = staff?.name || req.staff_name || '未知'; // 優先用即時資料
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

      {/* 新增彈窗 */}
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
    </div>
  );
}
