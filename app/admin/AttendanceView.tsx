'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Clock, 
  User, 
  Calendar as CalendarIcon, 
  ToggleLeft, 
  ToggleRight, 
  FileSpreadsheet, 
  Plus, 
  X, 
  Save,
  Pencil,
  AlertCircle,
  Briefcase,
  Trash2 // 🟢 新增：刪除圖示
} from 'lucide-react';
import { saveAs } from 'file-saver';

// --- Supabase Config ---
const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

const getInitialRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    return { start: fmt(start), end: fmt(end) };
};

export default function AttendanceView() {
  const range = getInitialRange();
  
  // 狀態管理
  const [logs, setLogs] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 篩選器
  const [useDateFilter, setUseDateFilter] = useState(false);
  const [startDate, setStartDate] = useState(range.start);
  const [endDate, setEndDate] = useState(range.end);
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');

  // Modal 狀態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    staffId: '',
    workType: '正常班',
    date: new Date().toISOString().split('T')[0],
    startTime: '08:00',
    endTime: '17:00',
    note: '' // 🟢 新增：備註欄位
  });

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [useDateFilter, startDate, endDate, selectedStaffId, selectedRole]);

  const fetchStaff = async () => {
    const { data } = await supabase.from('staff').select('id, name, role').order('id');
    if (data) {
        setStaffList(data);
        if(data.length > 0 && !formData.staffId) {
            setFormData(prev => ({...prev, staffId: String(data[0].id)}));
        }
    }
  };

  const uniqueRoles = Array.from(new Set(staffList.map(s => s.role || '未分類'))).filter(Boolean);

  const filteredStaffList = selectedRole === 'all' 
    ? staffList 
    : staffList.filter(s => (s.role || '未分類') === selectedRole);

  const fetchLogs = async () => {
    setLoading(true);
    
    let query = supabase.from('attendance_logs')
        .select('*')
        .order('clock_in_time', { ascending: false });

    // 日期篩選
    if (useDateFilter) {
        query = query.gte('clock_in_time', `${startDate}T00:00:00`).lte('clock_in_time', `${endDate}T23:59:59`);
    }

    // 姓名/職位篩選
    let targetNames: string[] = [];
    if (selectedStaffId !== 'all') {
        const target = staffList.find(s => String(s.id) === selectedStaffId);
        if (target) targetNames = [target.name];
    } else if (selectedRole !== 'all') {
        targetNames = staffList
            .filter(s => (s.role || '未分類') === selectedRole)
            .map(s => s.name);
    }

    if (targetNames.length > 0) {
        query = query.in('staff_name', targetNames);
    } else if (selectedRole !== 'all' && targetNames.length === 0) {
        query = query.eq('staff_name', 'NO_MATCH'); 
    }

    if (!useDateFilter) {
        query = query.limit(300);
    }

    const { data, error } = await query;
    if (error) console.error('Error fetching logs:', error);
    else setLogs(data || []);
    
    setLoading(false);
  };

  // 🟢 新增：刪除紀錄功能
  const handleDelete = async (id: number) => {
    if (!confirm('確定要永久刪除這筆打卡紀錄嗎？此操作無法復原。')) return;

    try {
        const { error } = await supabase.from('attendance_logs').delete().eq('id', id);
        if (error) throw error;
        alert('刪除成功');
        fetchLogs();
    } catch (err: any) {
        alert('刪除失敗: ' + err.message);
    }
  };

  const exportToCSV = () => {
    if (logs.length === 0) return alert("無資料可匯出");

    const headers = ["員工姓名", "打卡類型", "日期", "上班時間", "下班時間", "工時(hr)", "備註"];
    const rows = logs.map(log => [
        log.staff_name,
        log.work_type === 'overtime' ? '加班' : '上班',
        log.clock_in_time?.slice(0, 10) || '',
        log.clock_in_time ? new Date(log.clock_in_time).toLocaleTimeString() : '',
        log.clock_out_time ? new Date(log.clock_out_time).toLocaleTimeString() : '',
        log.work_hours ? Number(log.work_hours).toFixed(2) : '0',
        log.note || ''
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `考勤紀錄_${useDateFilter ? startDate+'_'+endDate : '全部'}.csv`);
  };

  const openAddModal = () => {
    setEditingLogId(null);
    setFormData({
        staffId: staffList.length > 0 ? String(staffList[0].id) : '',
        workType: '正常班',
        date: new Date().toISOString().split('T')[0],
        startTime: '08:00',
        endTime: '17:00',
        note: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (log: any) => {
    setEditingLogId(log.id);
    const logDate = log.clock_in_time ? log.clock_in_time.split('T')[0] : new Date().toISOString().split('T')[0];
    const startTime = log.clock_in_time ? new Date(log.clock_in_time).toTimeString().slice(0, 5) : '08:00';
    const endTime = log.clock_out_time ? new Date(log.clock_out_time).toTimeString().slice(0, 5) : '17:00';

    let targetStaffId = log.staff_id;
    if (!targetStaffId) {
        const s = staffList.find(s => s.name === log.staff_name);
        if (s) targetStaffId = s.id;
    }

    setFormData({
        staffId: targetStaffId ? String(targetStaffId) : '', 
        workType: log.work_type || '正常班',
        date: logDate,
        startTime: startTime,
        endTime: endTime,
        note: log.note || '' // 載入現有備註
    });
    setIsModalOpen(true);
  };

  const handleManualSubmit = async () => {
    if (!formData.staffId || !formData.date || !formData.startTime) {
        alert("請填寫完整資訊");
        return;
    }

    setIsSubmitting(true);

    try {
        const staff = staffList.find(s => String(s.id) === formData.staffId);
        if (!staff) throw new Error("找不到員工資料");

        const startDateTime = new Date(`${formData.date}T${formData.startTime}:00`);
        let endDateTime = null;
        let workHours = 0;

        if (formData.endTime) {
            endDateTime = new Date(`${formData.date}T${formData.endTime}:00`);
            if (endDateTime < startDateTime) {
               if(!confirm("下班時間早於上班時間，確認要送出嗎？")) {
                 setIsSubmitting(false);
                 return;
               }
            }
            workHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
        }

        const payload = {
            staff_id: Number(formData.staffId),
            staff_name: staff.name,
            clock_in_time: startDateTime.toISOString(),
            clock_out_time: endDateTime ? endDateTime.toISOString() : null,
            work_type: formData.workType,
            work_hours: workHours > 0 ? workHours : 0,
            note: formData.note, // 🟢 寫入備註
            status: endDateTime ? 'completed' : 'pending'
        };

        let error;
        if (editingLogId) {
            const { error: updateError } = await supabase
                .from('attendance_logs')
                .update(payload)
                .eq('id', editingLogId);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('attendance_logs')
                .insert(payload);
            error = insertError;
        }

        if (error) throw error;

        alert(editingLogId ? "修改成功！" : "補打卡成功！");
        setIsModalOpen(false);
        fetchLogs(); 

    } catch (err: any) {
        console.error(err);
        alert(`處理失敗: ${err.message}`);
    } finally {
        setIsSubmitting(false);
    }
  };

  const totalHours = logs.reduce((sum, log) => sum + (Number(log.work_hours) || 0), 0);

  return (
    <div className="w-full animate-fade-in space-y-6 relative">
      
      {/* 工具列 */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
        
        <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 shrink-0">
                <Clock className="text-blue-600"/> 考勤紀錄
            </h2>
            <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>
            
            <button 
                onClick={() => setUseDateFilter(!useDateFilter)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold transition ${useDateFilter ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
            >
                {useDateFilter ? <ToggleRight size={20} className="text-blue-600"/> : <ToggleLeft size={20} className="text-slate-400"/>}
                日期篩選
            </button>

            {useDateFilter && (
                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border text-sm animate-fade-in">
                    <CalendarIcon size={16} className="text-slate-400 ml-1"/>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent font-bold text-slate-700 outline-none"/>
                    <span className="text-slate-400">~</span>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent font-bold text-slate-700 outline-none"/>
                </div>
            )}

            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border text-sm w-40">
                <Briefcase size={16} className="text-slate-400 ml-1"/>
                <select value={selectedRole} onChange={(e) => { setSelectedRole(e.target.value); setSelectedStaffId('all'); }} className="bg-transparent font-bold text-slate-700 outline-none w-full">
                    <option value="all">所有職位</option>
                    {uniqueRoles.map(role => (
                        <option key={role} value={role}>{role}</option>
                    ))}
                </select>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border text-sm w-40">
                <User size={16} className="text-slate-400 ml-1"/>
                <select value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)} className="bg-transparent font-bold text-slate-700 outline-none w-full">
                    <option value="all">所有員工</option>
                    {filteredStaffList.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
            </div>
        </div>

        <div className="flex gap-4 items-center">
            <button 
                onClick={openAddModal}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition text-sm shadow-sm"
            >
                <Plus size={18}/> 補登打卡
            </button>

            <div className="text-right hidden sm:block">
                <span className="block text-xs text-slate-400">總工時合計</span>
                <span className="text-xl font-bold text-blue-600 font-mono">{totalHours.toFixed(1)} <span className="text-sm">hr</span></span>
            </div>
            <button onClick={exportToCSV} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition text-sm">
                <FileSpreadsheet size={18}/> 匯出 CSV
            </button>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        {editingLogId ? <Pencil className="text-orange-600" size={20}/> : <Plus className="text-blue-600" size={20}/>}
                        {editingLogId ? '修改打卡紀錄' : '補登打卡紀錄'}
                    </h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                        <X size={20}/>
                    </button>
                </div>
                
                <div className="p-6 space-y-4">
                    {editingLogId && (
                        <div className="bg-orange-50 text-orange-700 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                            <AlertCircle size={14}/> 若是忘記打卡下班，請填寫正確下班時間並儲存。
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-slate-600 mb-1">員工姓名</label>
                        <select 
                            value={formData.staffId} 
                            onChange={(e) => setFormData({...formData, staffId: e.target.value})}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            disabled={!!editingLogId}
                        >
                            <option value="" disabled>請選擇員工</option>
                            {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role || '無'})</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-1">日期</label>
                            <input 
                                type="date" 
                                value={formData.date} 
                                onChange={(e) => setFormData({...formData, date: e.target.value})}
                                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-1">班別類型</label>
                            <select 
                                value={formData.workType} 
                                onChange={(e) => setFormData({...formData, workType: e.target.value})}
                                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            >
                                <option value="正常班">正常班</option>
                                <option value="加班">加班</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-1">上班時間</label>
                            <input 
                                type="time" 
                                value={formData.startTime} 
                                onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-1">下班時間</label>
                            <input 
                                type="time" 
                                value={formData.endTime} 
                                onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                            />
                        </div>
                    </div>

                    {/* 🟢 新增：備註輸入框 */}
                    <div>
                        <label className="block text-sm font-bold text-slate-600 mb-1">備註 (Note)</label>
                        <input 
                            type="text" 
                            value={formData.note} 
                            onChange={(e) => setFormData({...formData, note: e.target.value})}
                            placeholder="例：忘記帶手機補登、補休調整..."
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
                    <button 
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition"
                    >
                        取消
                    </button>
                    <button 
                        onClick={handleManualSubmit}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save size={18}/>
                        {isSubmitting ? '處理中...' : (editingLogId ? '更新紀錄' : '確認新增')}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* 列表顯示 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 font-bold text-sm border-b">
                <tr>
                <th className="p-4">員工姓名</th>
                <th className="p-4">日期</th>
                <th className="p-4">班別</th>
                <th className="p-4">上班時間</th>
                <th className="p-4">下班時間</th>
                <th className="p-4 text-right">工時 (hr)</th>
                <th className="p-4">狀態</th>
                <th className="p-4 text-center">備註</th>
                <th className="p-4 text-center">操作</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                    <tr><td colSpan={9} className="p-8 text-center text-slate-400">載入中...</td></tr>
                ) : logs.length === 0 ? (
                    <tr><td colSpan={9} className="p-8 text-center text-slate-400">無符合資料</td></tr>
                ) : (
                    logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition group">
                        <td className="p-4 font-bold text-slate-700 flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs">
                                {log.staff_name?.slice(0,1)}
                            </div>
                            <div>
                                <div>{log.staff_name}</div>
                                <div className="text-[10px] text-slate-400 font-normal">
                                    {staffList.find(s=>s.name === log.staff_name)?.role}
                                </div>
                            </div>
                        </td>
                        <td className="p-4 text-slate-500 font-mono">{log.clock_in_time?.slice(0, 10)}</td>
                        <td className="p-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${log.work_type === 'overtime' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                {log.work_type === 'overtime' ? '加班' : '正常班'}
                            </span>
                        </td>
                        <td className="p-4 font-mono text-slate-700 font-bold">
                            {log.clock_in_time ? new Date(log.clock_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                        </td>
                        <td className="p-4 font-mono text-slate-700 font-bold">
                            {log.clock_out_time ? new Date(log.clock_out_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                        </td>
                        <td className="p-4 text-right font-bold font-mono text-blue-600">
                            {log.work_hours ? Number(log.work_hours).toFixed(1) : '-'}
                        </td>
                        <td className="p-4">
                            {log.clock_out_time ? (
                                <span className="text-green-600 flex items-center gap-1 text-xs"><div className="w-2 h-2 rounded-full bg-green-500"></div> 完成</span>
                            ) : (
                                <span className="text-red-500 flex items-center gap-1 text-xs animate-pulse"><div className="w-2 h-2 rounded-full bg-red-500"></div> 工作中</span>
                            )}
                        </td>
                        <td className="p-4 text-center text-xs text-slate-500 max-w-[150px] truncate">
                            {log.note || log.anomaly_reason || '-'}
                        </td>
                        <td className="p-4 text-center flex items-center justify-center gap-2">
                            <button 
                                onClick={() => openEditModal(log)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="修改"
                            >
                                <Pencil size={16}/>
                            </button>
                            {/* 🟢 新增：刪除按鈕 */}
                            <button 
                                onClick={() => handleDelete(log.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="刪除"
                            >
                                <Trash2 size={16}/>
                            </button>
                        </td>
                    </tr>
                    ))
                )}
            </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
