'use client';

import React, { useState, useEffect } from 'react';
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
  Trash2,
  CheckCircle,
  ScanLine
} from 'lucide-react';
import { saveAs } from 'file-saver';
import ScannerModal from './ocr-scanner/ScannerModal';

const formatLocalDate = (isoString?: string) => {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

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
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
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
    try {
      const response = await fetch('/api/staff');
      const result = await response.json();
      if (result.data) {
        // 權重排序：依照職類分組排序
        const roleWeight: Record<string, number> = { 
          '醫師': 1, 
          '主管': 2, 
          '櫃台': 3, 
          '護理師': 4, 
          '營養師': 5, 
          '診助': 6, 
          '藥師': 7, 
          '藥局助理': 8 
        };
        const sorted = [...result.data].sort((a, b) => {
          const aWeight = roleWeight[a.role || ''] ?? 999;
          const bWeight = roleWeight[b.role || ''] ?? 999;
          if (aWeight !== bWeight) return aWeight - bWeight;
          // 同職類內按姓名排序
          return (a.name || '').localeCompare(b.name || '');
        });
        setStaffList(sorted);
        if (sorted.length > 0 && !formData.staffId) {
          setFormData(prev => ({...prev, staffId: String(sorted[0].id)}));
        }
      }
    } catch (error) {
      console.error('Fetch staff error:', error);
      alert('載入員工列表失敗');
    }
  };

  const uniqueRoles = Array.from(new Set(staffList.map(s => s.role || '未分類'))).filter(Boolean);

  const filteredStaffList = selectedRole === 'all' 
    ? staffList 
    : staffList.filter(s => (s.role || '未分類') === selectedRole);

  const fetchLogs = async () => {
    setLoading(true);
    
    try {
      const params = new URLSearchParams({
        useDateFilter: String(useDateFilter),
        selectedStaffId: selectedStaffId,
        selectedRole: selectedRole,
      });

      if (useDateFilter) {
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      }

      const response = await fetch(`/api/attendance?${params.toString()}`);
      const result = await response.json();

      if (result.error) {
        console.error('Error fetching logs:', result.error);
        alert('載入考勤紀錄失敗: ' + result.error);
        setLogs([]);
      } else {
        setLogs(result.data || []);
      }
    } catch (error) {
      console.error('Fetch logs error:', error);
      alert('載入考勤紀錄失敗');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // 刪除紀錄功能
  // 🟢 新增：處理加班審核
  const handleOvertimeApproval = async (logId: number, status: 'approved' | 'rejected') => {
    if (!confirm(`確定要${status === 'approved' ? '核准' : '駁回'}這筆加班申請嗎？`)) {
      return;
    }

    try {
      const response = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: logId,
          overtime_status: status
        })
      });

      const result = await response.json();

      if (result.success) {
        alert(`加班申請已${status === 'approved' ? '核准' : '駁回'}`);
        fetchLogs();
      } else {
        alert('操作失敗: ' + (result.message || result.error));
      }
    } catch (error: any) {
      console.error('Overtime approval error:', error);
      alert('操作失敗: ' + error.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('確定要永久刪除這筆打卡紀錄嗎？此操作無法復原。')) return;

    try {
      const response = await fetch(`/api/attendance?id=${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (result.success) {
        alert(result.message || '刪除成功');
        fetchLogs();
      } else {
        alert(result.message || '刪除失敗');
      }
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
        formatLocalDate(log.clock_in_time),
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
    const logDate = log.clock_in_time
      ? formatLocalDate(log.clock_in_time)
      : new Date().toISOString().split('T')[0];
    // 直接從 ISO 字符串提取時間部分，避免時區轉換問題
    // 如果數據庫存的是 UTC，需要轉換為本地時間顯示
    let startTime = '08:00';
    let endTime = '17:00';
    
    if (log.clock_in_time) {
      const dateObj = new Date(log.clock_in_time);
      // 使用本地時間格式化，確保顯示的是本地時區的時間
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      startTime = `${hours}:${minutes}`;
    }
    
    if (log.clock_out_time) {
      const dateObj = new Date(log.clock_out_time);
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      endTime = `${hours}:${minutes}`;
    }

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
      if (!staff) {
        alert("找不到員工資料");
        setIsSubmitting(false);
        return;
      }

      // 驗證時間邏輯
      if (formData.endTime) {
        const endDateTime = new Date(`${formData.date}T${formData.endTime}:00`);
        const startDateTime = new Date(`${formData.date}T${formData.startTime}:00`);
        if (endDateTime < startDateTime) {
          if (!confirm("下班時間早於上班時間，確認要送出嗎？")) {
            setIsSubmitting(false);
            return;
          }
        }
      }

      const payload = {
        id: editingLogId || undefined,
        staffId: formData.staffId,
        staffName: staff.name,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime || undefined,
        workType: formData.workType,
        note: formData.note || undefined,
      };

      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        alert(result.message || (editingLogId ? "修改成功！" : "補打卡成功！"));
        setIsModalOpen(false);
        fetchLogs();
      } else {
        alert(result.message || '處理失敗');
      }
    } catch (err: any) {
      console.error(err);
      alert(`處理失敗: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalHours = logs.reduce((sum, log) => sum + (Number(log.work_hours) || 0), 0);

  const exportToTimecardCSV = () => {
    if (logs.length === 0) return alert("無資料可匯出");

    const grouped: Record<string, any> = {};

    logs.forEach(log => {
      if (!log.clock_in_time) return;
      const staff = log.staff_name;
      const dateObj = new Date(log.clock_in_time);
      const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
      const key = `${staff}_${dateStr}`;

      if (!grouped[key]) {
        grouped[key] = {
          staff,
          date: dateStr,
          weekday: ['日', '一', '二', '三', '四', '五', '六'][dateObj.getDay()],
          amIn: '', amOut: '', amHrs: 0,
          pmIn: '', pmOut: '', pmHrs: 0,
          otIn: '', otOut: '', otHrs: 0,
          notes: [] as string[],
        };
      }

      const timeStr = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      const outTimeStr = log.clock_out_time
        ? new Date(log.clock_out_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        : '';
      const hrs = Number(log.work_hours) || 0;
      const note = log.note || '';
      if (note) grouped[key].notes.push(note);

      if (note.includes('早') || dateObj.getHours() < 12) {
        grouped[key].amIn = timeStr;
        grouped[key].amOut = outTimeStr;
        grouped[key].amHrs = hrs;
      } else if (note.includes('午') || (dateObj.getHours() >= 12 && dateObj.getHours() < 17)) {
        grouped[key].pmIn = timeStr;
        grouped[key].pmOut = outTimeStr;
        grouped[key].pmHrs = hrs;
      } else {
        grouped[key].otIn = timeStr;
        grouped[key].otOut = outTimeStr;
        grouped[key].otHrs = hrs;
      }
    });

    const headers = ["員工姓名", "日期", "星期", "早上班", "早下班", "早時數", "午上班", "午下班", "午時數", "晚上班", "晚下班", "晚時數", "單日總時數", "備註"];
    const rows = Object.values(grouped).map((r: any) => {
      const total = (r.amHrs || 0) + (r.pmHrs || 0) + (r.otHrs || 0);
      const uniqueNotes = Array.from(new Set(r.notes)).join('; ');
      return [
        r.staff,
        r.date,
        r.weekday,
        r.amIn, r.amOut, r.amHrs ? r.amHrs.toFixed(2) : '',
        r.pmIn, r.pmOut, r.pmHrs ? r.pmHrs.toFixed(2) : '',
        r.otIn, r.otOut, r.otHrs ? r.otHrs.toFixed(2) : '',
        total ? total.toFixed(2) : '',
        uniqueNotes,
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `打卡表排班格式_${useDateFilter ? startDate+'_'+endDate : '全部'}.csv`);
  };

  const exportFullMonthTimecardCSV = () => {
    if (selectedStaffId === 'all') {
      return alert('請先在上方選擇「特定員工」，再執行全月報表匯出！');
    }
    if (!useDateFilter || !startDate) {
      return alert('請開啟「日期篩選」並選擇您要匯出的月份 (系統將以您設定的起始日期月份為主)！');
    }

    const staff = staffList.find((s) => String(s.id) === selectedStaffId);
    if (!staff) return alert('找不到該員工資料');

    const startD = new Date(startDate);
    const year = startD.getFullYear();
    const month = startD.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    const grouped: Record<string, any> = {};

    logs.forEach((log) => {
      if (!log.clock_in_time) return;

      const logStaffId = log.staff_id ?? log.staffId;
      const matchesStaff =
        (logStaffId != null && String(logStaffId) === selectedStaffId) ||
        log.staff_name === staff.name;
      if (!matchesStaff) return;

      const dateObj = new Date(log.clock_in_time);
      if (dateObj.getFullYear() !== year || dateObj.getMonth() + 1 !== month) return;

      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(
        dateObj.getDate()
      ).padStart(2, '0')}`;

      if (!grouped[dateStr]) {
        grouped[dateStr] = {
          amIn: '',
          amOut: '',
          amHrs: 0,
          pmIn: '',
          pmOut: '',
          pmHrs: 0,
          otIn: '',
          otOut: '',
          otHrs: 0,
          notes: [] as string[],
        };
      }

      const timeStr = dateObj.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const outTimeStr = log.clock_out_time
        ? new Date(log.clock_out_time).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';
      const hrs = Number(log.work_hours) || 0;
      const note = log.note || '';
      if (note) grouped[dateStr].notes.push(note);

      if (note.includes('早') || dateObj.getHours() < 12) {
        grouped[dateStr].amIn = timeStr;
        grouped[dateStr].amOut = outTimeStr;
        grouped[dateStr].amHrs = hrs;
      } else if (
        note.includes('午') ||
        (dateObj.getHours() >= 12 && dateObj.getHours() < 17)
      ) {
        grouped[dateStr].pmIn = timeStr;
        grouped[dateStr].pmOut = outTimeStr;
        grouped[dateStr].pmHrs = hrs;
      } else {
        grouped[dateStr].otIn = timeStr;
        grouped[dateStr].otOut = outTimeStr;
        grouped[dateStr].otHrs = hrs;
      }
    });

    const headers = [
      '日期',
      '星期',
      '早上班',
      '早下班',
      '早時數',
      '午上班',
      '午下班',
      '午時數',
      '晚上班',
      '晚下班',
      '晚時數',
      '單日總時數',
      '備註',
    ];
    const rows: string[][] = [];
    let totalMonthHours = 0;

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(
        2,
        '0'
      )}`;
      const dObj = new Date(year, month - 1, i);
      const weekday = ['日', '一', '二', '三', '四', '五', '六'][dObj.getDay()];

      if (grouped[dateStr]) {
        const r = grouped[dateStr];
        const total = (r.amHrs || 0) + (r.pmHrs || 0) + (r.otHrs || 0);
        totalMonthHours += total;
        const uniqueNotes = Array.from(new Set(r.notes)).join('; ');
        rows.push([
          `${month}/${i}`,
          weekday,
          r.amIn,
          r.amOut,
          r.amHrs ? r.amHrs.toFixed(2) : '',
          r.pmIn,
          r.pmOut,
          r.pmHrs ? r.pmHrs.toFixed(2) : '',
          r.otIn,
          r.otOut,
          r.otHrs ? r.otHrs.toFixed(2) : '',
          total ? total.toFixed(2) : '',
          uniqueNotes,
        ]);
      } else {
        rows.push([`${month}/${i}`, weekday, '', '', '', '', '', '', '', '', '', '', '']);
      }
    }

    rows.push([]);
    rows.push([
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '本月總工時',
      totalMonthHours.toFixed(2),
      '',
    ]);

    const titleRow = [`${year}年${month}月 考勤表 - ${staff.name}`];
    const csvContent =
      '\uFEFF' +
      titleRow.join(',') +
      '\n' +
      headers.join(',') +
      '\n' +
      rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${year}年${month}月_${staff.name}_完整打卡表.csv`);
  };

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
          <button
              onClick={() => setIsOcrModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition text-sm shadow-sm"
          >
              <ScanLine size={18}/> 實體卡 OCR 辨識
          </button>
          
          <div className="text-right hidden sm:block">
              <span className="block text-xs text-slate-400">總工時合計</span>
              <span className="text-xl font-bold text-blue-600 font-mono">{totalHours.toFixed(1)} <span className="text-sm">hr</span></span>
          </div>
          <div className="flex gap-2">
            <button onClick={exportToCSV} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition text-sm">
                <FileSpreadsheet size={18}/> 匯出 CSV
            </button>
            <button onClick={exportToTimecardCSV} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition text-sm">
                <FileSpreadsheet size={18}/> 匯出打卡表 (排班格式)
            </button>
            <button onClick={exportFullMonthTimecardCSV} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition text-sm">
                <FileSpreadsheet size={18}/> 匯出單人全月表格
            </button>
          </div>
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
                        <td className="p-4 text-slate-500 font-mono">{formatLocalDate(log.clock_in_time)}</td>
                        <td className="p-4">
                            <div className="flex flex-col gap-1">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${log.work_type === 'overtime' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {log.work_type === 'overtime' ? '加班' : '正常班'}
                                </span>
                                {/* 🟢 新增：加班狀態標籤 */}
                                {log.is_overtime && (
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        log.overtime_status === 'approved' 
                                            ? 'bg-green-100 text-green-700' 
                                            : log.overtime_status === 'rejected'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                        {log.overtime_status === 'approved' ? '已核准' 
                                         : log.overtime_status === 'rejected' ? '已駁回'
                                         : '待審核'}
                                    </span>
                                )}
                            </div>
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
                            {/* 🟢 新增：加班審核按鈕 */}
                            {log.is_overtime && log.overtime_status === 'pending' && (
                                <>
                                    <button 
                                        onClick={() => handleOvertimeApproval(log.id, 'approved')}
                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                                        title="核准加班"
                                    >
                                        <CheckCircle size={16}/>
                                    </button>
                                    <button 
                                        onClick={() => handleOvertimeApproval(log.id, 'rejected')}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                        title="駁回加班"
                                    >
                                        <X size={16}/>
                                    </button>
                                </>
                            )}
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

      {/* OCR 實體卡補登 (預備) */}
      <ScannerModal
        isOpen={isOcrModalOpen}
        onClose={() => setIsOcrModalOpen(false)}
      />
    </div>
  );
}
