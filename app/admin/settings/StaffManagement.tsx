'use client';

import React, { useState, useEffect } from 'react';
import { Plus, User, UserX, UserCheck, Stethoscope, Eye, EyeOff } from 'lucide-react';
import StaffEditModal from './StaffEditModal';

export default function StaffManagement() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [showResigned, setShowResigned] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setLoadingStaff(true);
    try {
      const response = await fetch('/api/staff');
      const result = await response.json();
      if (result.data) {
        setStaffList(result.data || []);
      }
    } catch (error) {
      console.error('Fetch staff error:', error);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleEditStaff = (staff: any) => {
    setEditData(staff);
    setShowStaffModal(true);
  };

  const handleAddStaff = () => {
    setEditData(null); // null 表示新增模式
    setShowStaffModal(true);
  };

  const handleSaveSuccess = () => {
    fetchStaff(); // 重新載入列表
  };

  const toggleStaffStatus = async (staff: any) => {
    const newStatus = !staff.is_active;
    const action = newStatus ? '復職' : '離職';
    if (!confirm(`確定要將 ${staff.name} 設定為「${action}」嗎？`)) return;
    
    try {
      const response = await fetch('/api/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: staff.id, is_active: newStatus })
      });
      const result = await response.json();
      if (result.success) {
        fetchStaff();
      } else {
        alert('更新失敗: ' + result.message);
      }
    } catch (error) {
      console.error('Toggle staff status error:', error);
      alert('更新失敗');
    }
  };

  const displayedStaff = staffList.filter(s => showResigned ? true : s.is_active);

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowResigned(!showResigned)} 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition border ${
                showResigned 
                  ? 'bg-gray-200 text-gray-700 border-gray-300' 
                  : 'bg-white text-slate-400 border-dashed border-slate-300 hover:border-slate-400'
              }`}
            >
              {showResigned ? <Eye size={14}/> : <EyeOff size={14}/>} 
              {showResigned ? '隱藏離職人員' : '顯示離職人員'}
            </button>
          </div>
          <button 
            onClick={handleAddStaff} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm transition shadow-sm"
          >
            <Plus size={16}/> 新增人員
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-4 w-20 text-center">狀態</th>
                <th className="p-4">姓名</th>
                <th className="p-4">職稱</th>
                <th className="p-4">到職日</th>
                <th className="p-4 text-right">基本薪資/時薪</th>
                <th className="p-4 text-right">勞健保自付額</th>
                <th className="p-4 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingStaff ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">載入中...</td>
                </tr>
              ) : (
                displayedStaff.map((staff) => (
                  <tr 
                    key={staff.id} 
                    className={`hover:bg-slate-50 transition ${
                      !staff.is_active ? 'bg-gray-100/80 grayscale opacity-70' : ''
                    }`}
                  >
                    <td className="p-4 text-center">
                      {!staff.is_active ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-gray-200 text-gray-500">
                          離職
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700">
                          在職
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-bold text-slate-800 flex items-center gap-2">
                      {staff.role === '醫師' ? (
                        <Stethoscope size={16} className="text-teal-600"/>
                      ) : (
                        <User size={16} className="text-blue-400"/>
                      )}
                      {staff.name}
                    </td>
                    <td className="p-4 text-slate-600">{staff.role}</td>
                    <td className="p-4 font-mono text-slate-500">{staff.start_date || '-'}</td>
                    <td className="p-4 text-right font-mono">
                      {staff.role === '醫師' ? '-' : `$${staff.base_salary?.toLocaleString()}`}
                    </td>
                    <td className="p-4 text-right font-mono text-xs text-slate-500">
                      勞 ${staff.insurance_labor} / 健 ${staff.insurance_health}
                    </td>
                    <td className="p-4 flex justify-center gap-2">
                      <button 
                        onClick={() => handleEditStaff(staff)} 
                        className="px-3 py-1.5 border border-blue-200 text-blue-600 rounded hover:bg-blue-50 text-xs font-bold transition"
                      >
                        編輯
                      </button>
                      <button 
                        onClick={() => toggleStaffStatus(staff)} 
                        className={`px-3 py-1.5 border rounded text-xs font-bold transition flex items-center gap-1 ${
                          !staff.is_active 
                            ? 'border-green-200 text-green-600 hover:bg-green-50' 
                            : 'border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                        }`}
                      >
                        {!staff.is_active ? (
                          <>
                            <UserCheck size={12}/> 復職
                          </>
                        ) : (
                          <>
                            <UserX size={12}/> 離職
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 員工編輯 Modal */}
      <StaffEditModal
        isOpen={showStaffModal}
        onClose={() => {
          setShowStaffModal(false);
          setEditData(null);
        }}
        initialData={editData}
        onSave={handleSaveSuccess}
      />
    </>
  );
}
