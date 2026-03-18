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
  ScanLine,
  ChevronDown
} from 'lucide-react';
import { saveAs } from 'file-saver';
import ScannerModal from './ocr-scanner/ScannerModal';
import AttendanceToolbar from './AttendanceView/AttendanceToolbar';
import AttendanceTable from './AttendanceView/AttendanceTable';

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

  // 🟢 新增：批次選取與寫入時間篩選狀態
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [writeTimeFilter, setWriteTimeFilter] = useState<string>('all'); // 'all', '1h', 'today'

  // 🟢 批次刪除密碼鎖狀態
  const [showSudoModal, setShowSudoModal] = useState(false);
  const [sudoPassword, setSudoPassword] = useState('');
  
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

  // 🟢 點擊工具列的刪除按鈕時，先檢查並開啟密碼鎖
  const handleBatchDeleteClick = () => {
    if (selectedIds.size === 0) return;
    setSudoPassword('');
    setShowSudoModal(true);
  };

  // 🟢 在密碼鎖內點擊「確認刪除」時，發送單一批次 API
  const executeBatchDelete = async () => {
    if (!sudoPassword) {
      alert('請輸入登入密碼！');
      return;
    }

    setIsSubmitting(true);
    try {
      // 🟢 改為發送單一的 PATCH 請求，讓後端去驗證密碼並執行批次軟刪除
      const response = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch_delete',
          ids: Array.from(selectedIds),
          sudoPassword: sudoPassword,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`✅ 成功刪除 ${selectedIds.size} 筆紀錄！`);
        setSelectedIds(new Set());
        setShowSudoModal(false);
        fetchLogs();
      } else {
        alert('刪除失敗: ' + (result.message || result.error));
      }
    } catch (err: any) {
      alert('批次刪除過程發生錯誤: ' + err.message);
    } finally {
      setIsSubmitting(false);
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

    // 🟢 新增：強制要求填寫備註
    if (!formData.note || formData.note.trim() === '') {
      alert("⚠️ 系統稽核要求：\n請務必填寫「備註」說明補登或修改的原因（例如：忘記帶手機、系統異常等），以利日後查核。");
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

  // 🟢 新增：根據「寫入時間 (created_at)」在前端進行二次過濾
  const displayLogs = logs.filter((log) => {
    if (writeTimeFilter === 'all') return true;
    if (!log.created_at) return false;
    const createdTime = new Date(log.created_at).getTime();
    const now = new Date().getTime();
    if (writeTimeFilter === '1h') return now - createdTime < 3600000; // 1小時內
    if (writeTimeFilter === 'today')
      return new Date(log.created_at).toDateString() === new Date().toDateString(); // 今日寫入
    return true;
  });

  // 計算過濾後的總工時
  const displayTotalHours = displayLogs.reduce(
    (sum, log) => sum + (Number(log.work_hours) || 0),
    0
  );

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
      <AttendanceToolbar
        useDateFilter={useDateFilter}
        setUseDateFilter={setUseDateFilter}
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        uniqueRoles={uniqueRoles}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
        selectedStaffId={selectedStaffId}
        setSelectedStaffId={setSelectedStaffId}
        filteredStaffList={filteredStaffList}
        totalHours={displayTotalHours}
        writeTimeFilter={writeTimeFilter}
        setWriteTimeFilter={setWriteTimeFilter}
        selectedCount={selectedIds.size}
        onBatchDelete={handleBatchDeleteClick} // 🟢 改為開啟密碼鎖
        isSubmitting={isSubmitting}
        onAddClick={openAddModal}
        onOpenOcr={() => setIsOcrModalOpen(true)}
        onExportCSV={exportToCSV}
        onExportTimecard={exportToTimecardCSV}
        onExportFullMonth={exportFullMonthTimecardCSV}
      />

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
                        <label className="block text-sm font-bold text-slate-600 mb-1">備註 (Note) <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            value={formData.note} 
                            onChange={(e) => setFormData({...formData, note: e.target.value})}
                            placeholder="必填！例：忘記帶手機補登、補休調整..."
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-yellow-50 focus:bg-white transition placeholder:text-orange-300"
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
      <AttendanceTable
        logs={displayLogs}
        loading={loading}
        staffList={staffList}
        onOvertimeApproval={handleOvertimeApproval}
        onEdit={openEditModal}
        onDelete={handleDelete}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
      />

      {/* OCR 實體卡補登 (預備) */}
      <ScannerModal
        isOpen={isOcrModalOpen}
        onClose={() => setIsOcrModalOpen(false)}
      />

      {/* 🟢 批次刪除密碼鎖 Modal */}
      {showSudoModal && (
        <div className="fixed inset-0 bg-slate-900/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl border-4 border-red-500">
            <h3 className="text-xl font-bold text-center mb-2 text-red-600 flex items-center justify-center gap-2">
              <AlertCircle size={24} /> 敏感操作確認
            </h3>
            <p className="text-xs text-slate-600 text-center mb-6 bg-red-50 p-3 rounded-lg border border-red-100">
              您即將批次刪除{' '}
              <strong className="text-red-600 text-lg">{selectedIds.size}</strong>{' '}
              筆考勤紀錄。
              <br />
              <br />
              為保護診所資訊安全，請輸入
              <strong className="text-red-600">「您的登入密碼」</strong>
              以驗證身分：
            </p>
            <input
              type="password"
              value={sudoPassword}
              onChange={(e) => setSudoPassword(e.target.value)}
              className="w-full border-2 border-slate-300 p-3 rounded-xl mb-6 text-center text-lg focus:border-red-500 outline-none font-mono tracking-widest"
              placeholder="請輸入密碼"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowSudoModal(false)}
                className="flex-1 py-2.5 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                取消
              </button>
              <button
                onClick={executeBatchDelete}
                disabled={isSubmitting}
                className="flex-1 py-2.5 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition disabled:opacity-50 flex justify-center items-center gap-2 shadow-md"
              >
                {isSubmitting ? '刪除中...' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
