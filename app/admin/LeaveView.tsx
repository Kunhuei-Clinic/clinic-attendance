'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, TrendingUp } from 'lucide-react';
import LeaveRequestsList from './leave/LeaveRequestsList';
import LeaveStatsTable from './leave/LeaveStatsTable';
import LeaveRequestModal from './leave/LeaveRequestModal';
import LeaveSettleModal from './leave/LeaveSettleModal';
import LeaveHistoryModal from './leave/LeaveHistoryModal';

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
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // ==========================================
  // Tab 2: 特休統計與結算 (新功能)
  // ==========================================
  const [leaveStats, setLeaveStats] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedStaffForSettle, setSelectedStaffForSettle] = useState<any>(null);

  // ==========================================
  // LeaveHistoryModal 狀態
  // ==========================================
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedStaffForHistory, setSelectedStaffForHistory] = useState<any>(null);

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

  const handleSubmitLeaveRequest = async (formData: {
    staff_id: string;
    type: string;
    date: string;
    start_time: string;
    end_time: string;
    hours: number;
    reason: string;
  }) => {
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
        setShowRequestModal(false);
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
    setShowSettleModal(true);
  };

  const handleOpenHistory = async (staff: any) => {
    setSelectedStaffForHistory(staff);
    setShowHistoryModal(true);
  };

  const handleSettle = async (settleForm: { days: number; pay_month: string; notes: string }) => {
    if (!selectedStaffForSettle) return;

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
        <LeaveRequestsList
          requests={requests}
          staffList={staffList}
          loading={loading}
          onDelete={handleDelete}
          onAddClick={() => setShowRequestModal(true)}
          filters={{
            useDateFilter,
            startDate,
            endDate,
            selectedStaffId,
            statusFilter,
          }}
          setFilters={(f) => {
            setUseDateFilter(f.useDateFilter);
            setStartDate(f.startDate);
            setEndDate(f.endDate);
            setSelectedStaffId(f.selectedStaffId);
            setStatusFilter(f.statusFilter);
          }}
        />
      )}

      {/* Tab 2: 特休統計與結算 */}
      {activeTab === 'stats' && (
        <LeaveStatsTable
          stats={leaveStats}
          loading={loadingStats}
          onOpenHistory={handleOpenHistory}
          onOpenSettle={handleOpenSettle}
          onRefresh={fetchLeaveStats}
        />
      )}

      {/* 新增請假彈窗 */}
      <LeaveRequestModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        staffList={staffList}
        onSubmit={handleSubmitLeaveRequest}
      />

      {/* 特休結算彈窗 */}
      <LeaveSettleModal
        isOpen={showSettleModal}
        onClose={() => setShowSettleModal(false)}
        staff={selectedStaffForSettle}
        onSubmit={handleSettle}
      />

      {/* 歷年特休詳情與設定 Modal */}
      {showHistoryModal && selectedStaffForHistory && (
        <LeaveHistoryModal
          isOpen={showHistoryModal}
          onClose={() => {
            setShowHistoryModal(false);
            setSelectedStaffForHistory(null);
          }}
          staff={selectedStaffForHistory}
          onSaved={fetchLeaveStats}
        />
      )}
    </div>
  );
}
