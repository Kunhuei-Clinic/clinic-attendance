'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, Plus, User, UserX, UserCheck, Stethoscope, Briefcase, Eye, EyeOff, Building, Clock, CalendarDays, LayoutGrid, Trash2 } from 'lucide-react';

type Entity = { id: string; name: string };
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function SettingsView() {
    const [activeTab, setActiveTab] = useState<'staff' | 'system'>('staff'); // 預設顯示人員管理
    
    // ----------- 👨‍⚕️ 人員管理狀態 -----------
    const [staffList, setStaffList] = useState<any[]>([]);
    const [loadingStaff, setLoadingStaff] = useState(false);
    const [showResigned, setShowResigned] = useState(false);
    const [showStaffModal, setShowStaffModal] = useState(false);
    const [editData, setEditData] = useState<any>(null);

    // ----------- ⚙️ 系統設定狀態 -----------
    const [entities, setEntities] = useState<Entity[]>([]);
    const [specialClinics, setSpecialClinics] = useState<string[]>([]);
    const [businessHours, setBusinessHours] = useState({
        openDays: [1,2,3,4,5,6], 
        shifts: {
            AM: { start: '08:00', end: '12:30' },
            PM: { start: '14:00', end: '17:30' },
            NIGHT: { start: '18:00', end: '21:30' }
        }
    });
    const [leaveCalculationSystem, setLeaveCalculationSystem] = useState<'anniversary' | 'calendar'>('anniversary');
    const [loadingSystem, setLoadingSystem] = useState(false);
    const [systemMessage, setSystemMessage] = useState('');

    // 初始載入
    useEffect(() => {
        fetchStaff();
        fetchSystemSettings();
    }, []);

    // ==========================================
    // 🟢 功能 A: 人員管理 (Logic)
    // ==========================================
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
        setEditData({
            name: '',
            role: '護理師',
            entity: 'clinic',
            is_active: true,
            start_date: new Date().toISOString().slice(0, 10),
            salary_mode: 'hourly',
            base_salary: 0,
            insurance_labor: 0,
            insurance_health: 0
        });
        setShowStaffModal(true);
    };

    const handleSaveStaff = async () => {
        if (!editData.name) return alert("請輸入姓名");
        const payload = {
            name: editData.name,
            role: editData.role,
            entity: editData.entity,
            is_active: editData.is_active,
            start_date: editData.start_date || null,
            salary_mode: editData.salary_mode || 'hourly',
            base_salary: Number(editData.base_salary) || 0,
            insurance_labor: Number(editData.insurance_labor) || 0,
            insurance_health: Number(editData.insurance_health) || 0
        };

        try {
            let response;
            if (editData.id) {
                response = await fetch('/api/staff', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editData.id, ...payload })
                });
            } else {
                response = await fetch('/api/staff', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            const result = await response.json();
            if (result.success) {
                alert("儲存成功！");
                setShowStaffModal(false);
                fetchStaff();
            } else {
                alert("儲存失敗: " + result.message);
            }
        } catch (error) {
            console.error('Save staff error:', error);
            alert("儲存失敗");
        }
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

    // ==========================================
    // 🟢 功能 B: 系統設定 (Logic)
    // ==========================================
    // 🟢 新增：加班設定
    const [overtimeThreshold, setOvertimeThreshold] = useState(9);
    const [overtimeApprovalRequired, setOvertimeApprovalRequired] = useState(true);

    const fetchSystemSettings = async () => {
        try {
            // 取得系統設定
            const response = await fetch('/api/settings');
            const result = await response.json();
            if (result.data) {
                result.data.forEach((item: any) => {
                    if (item.key === 'org_entities') {
                        try { setEntities(JSON.parse(item.value)); } catch (e) { }
                    }
                    if (item.key === 'special_clinic_types') {
                        try { setSpecialClinics(JSON.parse(item.value)); } catch (e) { }
                    }
                    if (item.key === 'clinic_business_hours') {
                        try { setBusinessHours(JSON.parse(item.value)); } catch (e) { }
                    }
                    if (item.key === 'leave_calculation_system') {
                        setLeaveCalculationSystem(item.value === 'calendar' ? 'calendar' : 'anniversary');
                    }
                });
            }

            // 🟢 新增：取得診所設定（加班設定）
            const clinicResponse = await fetch('/api/settings?type=clinic');
            const clinicResult = await clinicResponse.json();
            if (clinicResult.data) {
                setOvertimeThreshold(clinicResult.data.overtime_threshold ?? 9);
                setOvertimeApprovalRequired(clinicResult.data.overtime_approval_required !== false);
            }
        } catch (error) {
            console.error('Fetch system settings error:', error);
        }
    };

    const handleSaveSystem = async () => {
        setLoadingSystem(true);
        try {
            // 系統設定
            const updates = [
                { key: 'org_entities', value: JSON.stringify(entities) },
                { key: 'special_clinic_types', value: JSON.stringify(specialClinics) },
                { key: 'clinic_business_hours', value: JSON.stringify(businessHours) },
                { key: 'leave_calculation_system', value: leaveCalculationSystem }
            ];
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            const result = await response.json();
            
            // 🟢 新增：儲存診所設定（加班設定）
            const clinicResponse = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'clinic',
                    settings: {
                        overtime_threshold: overtimeThreshold,
                        overtime_approval_required: overtimeApprovalRequired
                    }
                })
            });
            const clinicResult = await clinicResponse.json();
            
            if (result.success && clinicResult.success) {
                setSystemMessage('✅ 設定已更新，排班表將套用新時間');
                setTimeout(() => setSystemMessage(''), 3000);
            } else {
                setSystemMessage('❌ 儲存失敗: ' + (result.message || clinicResult.message));
            }
        } catch (error) {
            console.error('Save system settings error:', error);
            setSystemMessage('❌ 儲存失敗');
        } finally {
            setLoadingSystem(false);
        }
    };

    const addEntity = () => setEntities([...entities, { id: 'unit_' + Date.now(), name: '' }]);
    const removeEntity = (idx: number) => {
        if (entities.length <= 1) return alert("至少保留一個單位");
        const newArr = [...entities]; newArr.splice(idx, 1); setEntities(newArr);
    };
    const updateEntityName = (idx: number, val: string) => {
        const newArr = [...entities]; newArr[idx].name = val; setEntities(newArr);
    };

    const addSpecial = () => setSpecialClinics([...specialClinics, '新門診']);
    const removeSpecial = (idx: number) => {
        const newArr = [...specialClinics]; newArr.splice(idx, 1); setSpecialClinics(newArr);
    };
    const updateSpecial = (idx: number, val: string) => {
        const newArr = [...specialClinics]; newArr[idx] = val; setSpecialClinics(newArr);
    };

    const toggleDay = (dayIndex: number) => {
        const newDays = businessHours.openDays.includes(dayIndex) 
            ? businessHours.openDays.filter(d => d !== dayIndex)
            : [...businessHours.openDays, dayIndex].sort();
        setBusinessHours({ ...businessHours, openDays: newDays });
    };

    const updateShiftTime = (shift: 'AM'|'PM'|'NIGHT', field: 'start'|'end', val: string) => {
        setBusinessHours({
            ...businessHours,
            shifts: {
                ...businessHours.shifts,
                [shift]: { ...businessHours.shifts[shift], [field]: val }
            }
        });
    };

    // ==========================================
    // 🎨 UI 渲染
    // ==========================================
    return (
        <div className="w-full animate-fade-in space-y-6 pb-20">
            
            {/* 🟢 主選單切換 */}
            <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="text-gray-600"/> 
                    {activeTab === 'staff' ? '人員檔案管理' : '系統設定中心'}
                </h2>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('staff')} className={`flex items-center gap-2 px-6 py-2 text-sm font-bold rounded-md transition ${activeTab === 'staff' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                        <User size={16}/> 人員管理
                    </button>
                    <button onClick={() => setActiveTab('system')} className={`flex items-center gap-2 px-6 py-2 text-sm font-bold rounded-md transition ${activeTab === 'system' ? 'bg-white shadow text-purple-700' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Building size={16}/> 系統設定
                    </button>
                </div>
            </div>

            {/* 🟢 頁面 A: 人員管理 */}
            {activeTab === 'staff' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setShowResigned(!showResigned)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition border ${showResigned ? 'bg-gray-200 text-gray-700 border-gray-300' : 'bg-white text-slate-400 border-dashed border-slate-300 hover:border-slate-400'}`}>
                                {showResigned ? <Eye size={14}/> : <EyeOff size={14}/>} {showResigned ? '隱藏離職人員' : '顯示離職人員'}
                            </button>
                        </div>
                        <button onClick={handleAddStaff} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm transition shadow-sm"><Plus size={16}/> 新增人員</button>
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
                                {loadingStaff ? <tr><td colSpan={7} className="p-8 text-center text-slate-400">載入中...</td></tr> : 
                                displayedStaff.map((staff) => (
                                    <tr key={staff.id} className={`hover:bg-slate-50 transition ${!staff.is_active ? 'bg-gray-100/80 grayscale opacity-70' : ''}`}>
                                        <td className="p-4 text-center">{!staff.is_active ? <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-gray-200 text-gray-500">離職</span> : <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700">在職</span>}</td>
                                        <td className="p-4 font-bold text-slate-800 flex items-center gap-2">{staff.role === '醫師' ? <Stethoscope size={16} className="text-teal-600"/> : <User size={16} className="text-blue-400"/>}{staff.name}</td>
                                        <td className="p-4 text-slate-600">{staff.role}</td>
                                        <td className="p-4 font-mono text-slate-500">{staff.start_date || '-'}</td>
                                        <td className="p-4 text-right font-mono">{staff.role === '醫師' ? '-' : `$${staff.base_salary?.toLocaleString()}`}</td>
                                        <td className="p-4 text-right font-mono text-xs text-slate-500">勞 ${staff.insurance_labor} / 健 ${staff.insurance_health}</td>
                                        <td className="p-4 flex justify-center gap-2">
                                            <button onClick={() => handleEditStaff(staff)} className="px-3 py-1.5 border border-blue-200 text-blue-600 rounded hover:bg-blue-50 text-xs font-bold transition">編輯</button>
                                            <button onClick={() => toggleStaffStatus(staff)} className={`px-3 py-1.5 border rounded text-xs font-bold transition flex items-center gap-1 ${!staff.is_active ? 'border-green-200 text-green-600 hover:bg-green-50' : 'border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}>
                                                {!staff.is_active ? <><UserCheck size={12}/> 復職</> : <><UserX size={12}/> 離職</>}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 🟢 頁面 B: 系統設定 */}
            {activeTab === 'system' && (
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 animate-fade-in">
                    <div className="space-y-10">
                        {/* 組織單位 */}
                        <div>
                            <h3 className="text-lg font-bold text-slate-700 border-b pb-2 mb-4 flex items-center gap-2"><LayoutGrid size={20}/> 組織單位管理</h3>
                            <div className="space-y-3">
                                {entities.map((ent, idx) => (
                                    <div key={ent.id} className="flex gap-3 items-center">
                                        <div className="bg-slate-100 px-3 py-2 rounded text-xs font-mono text-slate-400 w-24 text-center">ID: {ent.id}</div>
                                        <input type="text" value={ent.name} onChange={(e) => updateEntityName(idx, e.target.value)} className="flex-1 p-3 border rounded-lg text-lg font-bold outline-none focus:ring-2 focus:ring-blue-200" placeholder="單位名稱"/>
                                        <button onClick={() => removeEntity(idx)} className="p-3 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={20}/></button>
                                    </div>
                                ))}
                                <button onClick={addEntity} className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 rounded-xl hover:bg-blue-50 font-bold flex items-center justify-center gap-2"><Plus size={20}/> 新增單位</button>
                            </div>
                        </div>

                        {/* 診所營業時間 */}
                        <div>
                            <h3 className="text-lg font-bold text-slate-700 border-b pb-2 mb-4 flex items-center gap-2"><Clock size={20}/> 診所營業時間設定 (全域預設值)</h3>
                            <div className="bg-yellow-50 p-4 mb-4 rounded-lg text-sm text-yellow-800 border border-yellow-200">
                                ⚠️ 注意：修改此處僅會影響「未來」排入的班表。已經排好的班表不會自動更新時間，以保障歷史工時計算的正確性。
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-500 mb-2 flex items-center gap-2"><CalendarDays size={16}/> 每週營業日</label>
                                    <div className="flex gap-2">
                                        {WEEKDAYS.map((day, idx) => (
                                            <button key={idx} onClick={() => toggleDay(idx)} className={`w-10 h-10 rounded-full font-bold transition ${businessHours.openDays.includes(idx) ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>{day}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    {(['AM', 'PM', 'NIGHT'] as const).map(shift => (
                                        <div key={shift} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            <h4 className="font-bold text-slate-700 mb-3 flex justify-between">{shift === 'AM' ? '早診' : shift === 'PM' ? '午診' : '晚診'}<span className="text-xs text-slate-400 bg-white px-2 py-0.5 rounded border">{shift}</span></h4>
                                            <div className="flex gap-1 items-center">
                                                <input type="time" value={businessHours.shifts[shift].start} onChange={(e) => updateShiftTime(shift, 'start', e.target.value)} className="w-full border p-1 rounded text-center font-mono text-sm"/>
                                                <span className="text-slate-400">-</span>
                                                <input type="time" value={businessHours.shifts[shift].end} onChange={(e) => updateShiftTime(shift, 'end', e.target.value)} className="w-full border p-1 rounded text-center font-mono text-sm"/>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 特殊門診類型 */}
                        <div>
                            <h3 className="text-lg font-bold text-slate-700 border-b pb-2 mb-4 flex items-center gap-2"><Stethoscope size={20}/> 特殊門診類型</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {specialClinics.map((name, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <input type="text" value={name} onChange={(e) => updateSpecial(idx, e.target.value)} className="flex-1 p-2 border rounded-lg font-bold outline-none focus:ring-2 focus:ring-purple-200" placeholder="門診名稱"/>
                                        <button onClick={() => removeSpecial(idx)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                                    </div>
                                ))}
                                <button onClick={addSpecial} className="py-2 border-2 border-dashed border-slate-300 text-slate-500 rounded-xl hover:bg-purple-50 font-bold flex items-center justify-center gap-2"><Plus size={18}/> 新增類型</button>
                            </div>
                        </div>

                        {/* 特休計算制 */}
                        <div>
                            <h3 className="text-lg font-bold text-slate-700 border-b pb-2 mb-4 flex items-center gap-2"><CalendarDays size={20}/> 特休計算制 (Annual Leave Calculation System)</h3>
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                                <p className="text-sm text-blue-800 mb-2">
                                    <strong>週年制 (Anniversary)</strong>：以員工到職日為基準，每年週年日重新計算特休天數。
                                </p>
                                <p className="text-sm text-blue-800">
                                    <strong>曆年制 (Calendar)</strong>：以日曆年度為基準，每年1月1日重新計算特休天數，按比例分配。
                                </p>
                            </div>
                            <div className="flex gap-4">
                                <button 
                                    onClick={() => setLeaveCalculationSystem('anniversary')} 
                                    className={`flex-1 p-4 rounded-xl border-2 transition ${
                                        leaveCalculationSystem === 'anniversary' 
                                            ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' 
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                                    }`}
                                >
                                    <div className="text-lg font-bold mb-1">週年制</div>
                                    <div className="text-xs opacity-80">Anniversary System</div>
                                </button>
                                <button 
                                    onClick={() => setLeaveCalculationSystem('calendar')} 
                                    className={`flex-1 p-4 rounded-xl border-2 transition ${
                                        leaveCalculationSystem === 'calendar' 
                                            ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' 
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                                    }`}
                                >
                                    <div className="text-lg font-bold mb-1">曆年制</div>
                                    <div className="text-xs opacity-80">Calendar System</div>
                                </button>
                            </div>
                        </div>

                        {/* 🟢 新增：加班設定 */}
                        <div>
                            <h3 className="text-lg font-bold text-slate-700 border-b pb-2 mb-4 flex items-center gap-2"><Clock size={20}/> 加班設定 (Overtime Settings)</h3>
                            <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 mb-4">
                                <p className="text-sm text-orange-800">
                                    當員工每日工時超過設定門檻時，系統會自動提示員工確認是否申請加班。
                                </p>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        加班門檻 (小時)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="24"
                                        step="0.5"
                                        value={overtimeThreshold}
                                        onChange={(e) => setOvertimeThreshold(Number(e.target.value))}
                                        className="w-full border p-3 rounded-lg bg-white text-lg font-bold"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">
                                        當日工時超過此門檻時，系統會提示員工確認是否申請加班
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="overtime_approval"
                                        checked={overtimeApprovalRequired}
                                        onChange={(e) => setOvertimeApprovalRequired(e.target.checked)}
                                        className="w-5 h-5"
                                    />
                                    <label htmlFor="overtime_approval" className="text-sm font-bold text-slate-700">
                                        需要主管審核
                                    </label>
                                </div>
                                <p className="text-xs text-slate-400">
                                    {overtimeApprovalRequired 
                                        ? '✓ 加班申請需要主管審核後才會生效' 
                                        : '✓ 加班申請將自動核准，無需審核'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 pt-6 border-t flex justify-between items-center">
                        <span className="text-sm font-bold text-green-600">{systemMessage}</span>
                        <button onClick={handleSaveSystem} disabled={loadingSystem} className="flex items-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition disabled:opacity-50">
                            <Save size={20}/> {loadingSystem ? '儲存中...' : '儲存設定'}
                        </button>
                    </div>
                </div>
            )}

            {/* 編輯人員 Modal */}
            {showStaffModal && editData && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                            <h3 className="font-bold text-lg flex items-center gap-2">{editData.id ? <Settings size={18}/> : <Plus size={18}/>} {editData.id ? '編輯人員資料' : '新增人員'}</h3>
                            <button onClick={() => setShowStaffModal(false)} className="hover:bg-white/20 p-1 rounded-full"><Settings size={18} className="rotate-45"/></button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-1"><label className="block text-xs font-bold text-slate-500 mb-1">姓名</label><input type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="w-full border p-2 rounded focus:ring-2 ring-blue-200 outline-none" placeholder="真實姓名"/></div>
                                <div className="col-span-1"><label className="block text-xs font-bold text-slate-500 mb-1">職稱</label><select value={editData.role} onChange={e => setEditData({...editData, role: e.target.value})} className="w-full border p-2 rounded bg-white"><option value="護理師">護理師</option><option value="醫師">醫師</option><option value="行政">行政</option><option value="藥師">藥師</option><option value="清潔">清潔</option></select></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">所屬單位</label><div className="flex gap-2"><button onClick={() => setEditData({...editData, entity: 'clinic'})} className={`flex-1 py-2 rounded border text-sm font-bold ${editData.entity === 'clinic' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-gray-50'}`}>診所</button><button onClick={() => setEditData({...editData, entity: 'pharmacy'})} className={`flex-1 py-2 rounded border text-sm font-bold ${editData.entity === 'pharmacy' ? 'bg-green-50 border-green-500 text-green-700' : 'hover:bg-gray-50'}`}>藥局</button></div></div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">到職日期</label><input type="date" value={editData.start_date || ''} onChange={e => setEditData({...editData, start_date: e.target.value})} className="w-full border p-2 rounded"/></div>
                            </div>
                            {editData.role !== '醫師' && (
                                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-yellow-800 mb-2 flex items-center gap-1"><Briefcase size={12}/> 薪資計算模式</label>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => setEditData({...editData, salary_mode: 'monthly'})} 
                                                className={`flex-1 py-2 rounded border text-sm font-bold transition ${
                                                    editData.salary_mode === 'monthly' 
                                                        ? 'bg-slate-800 text-white border-slate-800' 
                                                        : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'
                                                }`}
                                            >
                                                月薪制
                                            </button>
                                            <button 
                                                onClick={() => setEditData({...editData, salary_mode: 'hourly'})} 
                                                className={`flex-1 py-2 rounded border text-sm font-bold transition ${
                                                    editData.salary_mode === 'hourly' 
                                                        ? 'bg-slate-800 text-white border-slate-800' 
                                                        : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'
                                                }`}
                                            >
                                                時薪制
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-yellow-800 mb-1">
                                            基礎薪資 {editData.salary_mode === 'monthly' ? '(月薪)' : '(時薪)'}
                                        </label>
                                        <input 
                                            type="number" 
                                            value={editData.base_salary} 
                                            onChange={e => setEditData({...editData, base_salary: e.target.value})} 
                                            className="w-full border p-2 rounded font-mono font-bold text-right"
                                        />
                                        <p className="text-[10px] text-yellow-600 mt-1">
                                            * {editData.salary_mode === 'monthly' ? '月薪制：用於計算每日薪資 (月薪 ÷ 30)' : '時薪制：用於計算工時薪資'}
                                        </p>
                                    </div>
                                </div>
                            )}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200"><h4 className="text-xs font-bold text-slate-500 mb-3 border-b pb-1">保險設定 (每月固定扣除)</h4><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs text-slate-400 mb-1">勞保自付額</label><input type="number" value={editData.insurance_labor} onChange={e => setEditData({...editData, insurance_labor: e.target.value})} className="w-full border p-2 rounded text-right text-red-500 font-bold"/></div><div><label className="block text-xs text-slate-400 mb-1">健保自付額</label><input type="number" value={editData.insurance_health} onChange={e => setEditData({...editData, insurance_health: e.target.value})} className="w-full border p-2 rounded text-right text-red-500 font-bold"/></div></div></div>
                            <div className="flex justify-end gap-3 pt-4 border-t"><button onClick={() => setShowStaffModal(false)} className="px-5 py-2.5 rounded-lg text-slate-500 hover:bg-slate-100 font-bold text-sm">取消</button><button onClick={handleSaveStaff} className="px-6 py-2.5 rounded-lg bg-slate-900 text-white hover:bg-black font-bold text-sm shadow-lg flex items-center gap-2"><Save size={16}/> 儲存資料</button></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
