'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CheckCircle, XCircle, Clock, Calendar, AlertCircle, FileText, Filter } from 'lucide-react';

const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

const formatDate = (iso: string) => new Date(iso).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AdminTasks() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending'); // pending, approved, rejected

    useEffect(() => { fetchRequests(); }, [filter]);

    const fetchRequests = async () => {
        setLoading(true);
        let query = supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
        if (filter !== 'all') query = query.eq('status', filter);
        const { data, error } = await query;
        if (error) console.error(error); else setRequests(data || []);
        setLoading(false);
    };

    // 🟢 核心功能：核准案件 (智慧媒合邏輯)
    const handleApprove = async (req: any) => {
        const name = req.staff_name || '未知員工'; 
        if (!confirm(`確定要核准 ${name} 的 ${req.type} (${req.leave_type}) 申請嗎？`)) return;

        try {
            if (req.type === '補打卡') {
                const dateStr = req.start_time.split('T')[0];
                const startTime = new Date(req.start_time);
                const endTime = new Date(req.end_time);

                if (req.leave_type === '全天') {
                    // 1. 補全天：直接新增完美紀錄
                    const hours = (endTime.getTime() - startTime.getTime()) / 3600000;
                    const { error } = await supabase.from('attendance_logs').insert([{
                        staff_name: name,
                        clock_in_time: req.start_time,
                        clock_out_time: req.end_time,
                        work_hours: hours.toFixed(2),
                        status: 'completed',
                        work_type: 'work',
                        gps_lat: 0, gps_lng: 0, is_bypass: true, 
                        anomaly_reason: '補打卡核准(全天)'
                    }]);
                    if (error) throw error;

                } else if (req.leave_type === '上班') {
                    // 2. 補上班：找有沒有 "只有下班" 的孤兒紀錄
                    // 孤兒特徵：clock_out 有值，clock_in = clock_out (因為補下班時找不到上班會先暫填一樣的時間)
                    const { data: orphan } = await supabase.from('attendance_logs')
                        .select('*')
                        .eq('staff_name', name)
                        .gte('clock_out_time', `${dateStr}T00:00:00`)
                        .lte('clock_out_time', `${dateStr}T23:59:59`)
                        .eq('status', 'completed')
                        .like('anomaly_reason', '%補下班%') // 關鍵特徵
                        .single();

                    if (orphan) {
                        // 找到了！合併成一筆
                        const duration = (new Date(orphan.clock_out_time).getTime() - startTime.getTime()) / 3600000;
                        await supabase.from('attendance_logs').update({
                            clock_in_time: req.start_time,
                            work_hours: duration.toFixed(2),
                            anomaly_reason: orphan.anomaly_reason + ', 補上班核准'
                        }).eq('id', orphan.id);
                    } else {
                        // 沒找到，新增一筆 working 狀態
                        await supabase.from('attendance_logs').insert([{
                            staff_name: name,
                            clock_in_time: req.start_time,
                            status: 'working',
                            work_type: 'work',
                            gps_lat: 0, gps_lng: 0, is_bypass: true, 
                            anomaly_reason: '補上班核准'
                        }]);
                    }

                } else if (req.leave_type === '下班') {
                    // 3. 補下班：找有沒有 "working" 的紀錄
                    const { data: working } = await supabase.from('attendance_logs')
                        .select('*')
                        .eq('staff_name', name)
                        .gte('clock_in_time', `${dateStr}T00:00:00`)
                        .lte('clock_in_time', `${dateStr}T23:59:59`)
                        .eq('status', 'working')
                        .is('clock_out_time', null)
                        .single();

                    if (working) {
                        // 找到了！結案
                        const duration = (startTime.getTime() - new Date(working.clock_in_time).getTime()) / 3600000;
                        await supabase.from('attendance_logs').update({
                            clock_out_time: req.start_time,
                            work_hours: duration.toFixed(2),
                            status: 'completed',
                            anomaly_reason: (working.anomaly_reason || '') + ', 補下班核准'
                        }).eq('id', working.id);
                    } else {
                        // 沒找到上班紀錄，建立暫存孤兒 (in=out)
                        // 這樣之後補上班時就能找到它
                        await supabase.from('attendance_logs').insert([{
                            staff_name: name,
                            clock_in_time: req.start_time, // 暫時填一樣
                            clock_out_time: req.start_time,
                            work_hours: 0,
                            status: 'completed',
                            work_type: 'work',
                            gps_lat: 0, gps_lng: 0, is_bypass: true, 
                            anomaly_reason: '單獨補下班(等待補上班)'
                        }]);
                    }
                }
            }

            // 更新申請單狀態
            const { error: updateError } = await supabase.from('leave_requests').update({ status: 'approved' }).eq('id', req.id);
            if (updateError) throw updateError;

            alert("✅ 已核准，並同步至考勤系統！");
            fetchRequests();

        } catch (err: any) { alert("❌ 核准失敗：" + err.message); }
    };

    const handleReject = async (id: number) => {
        if (!confirm("確定要駁回此申請嗎？")) return;
        await supabase.from('leave_requests').update({ status: 'rejected' }).eq('id', id);
        fetchRequests();
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div><h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3"><CheckCircle className="text-teal-600" size={32} /> 待辦事項審核</h1><p className="text-slate-500 mt-2">處理員工的請假與補打卡申請。</p></div>
                <div className="flex bg-white rounded-lg shadow-sm p-1 border border-slate-200">
                    {['pending','approved','rejected','all'].map(f => (
                        <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-md text-sm font-bold capitalize transition ${filter === f ? 'bg-teal-100 text-teal-800' : 'text-slate-500 hover:bg-slate-50'}`}>{f}</button>
                    ))}
                </div>
            </div>

            {loading ? <div className="text-center py-20 text-slate-400">載入中...</div> : requests.length === 0 ? <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300"><CheckCircle className="mx-auto text-slate-300 mb-4" size={48} /><p className="text-slate-500 font-bold">目前沒有案件 🎉</p></div> : (
                <div className="grid gap-4">
                    {requests.map((req) => (
                        <div key={req.id} className={`bg-white p-6 rounded-xl shadow-sm border-l-4 flex justify-between items-center transition hover:shadow-md ${req.status === 'pending' ? 'border-yellow-400' : (req.status === 'approved' ? 'border-green-500' : 'border-red-500')}`}>
                            <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shrink-0 ${req.type === '補打卡' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>{req.type === '補打卡' ? <Clock size={24}/> : <Calendar size={24}/>}</div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-lg font-bold text-slate-800">{req.staff_name}</span>
                                        <span className={`px-2 py-0.5 text-xs rounded font-bold ${req.type === '補打卡' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'}`}>{req.type} {req.leave_type && `(${req.leave_type})`}</span>
                                        {req.status !== 'pending' && <span className={`px-2 py-0.5 text-xs rounded font-bold ${req.status==='approved'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{req.status === 'approved' ? '已通過' : '已駁回'}</span>}
                                    </div>
                                    <div className="text-slate-500 text-sm space-y-1">
                                        <div className="flex items-center gap-2"><Clock size={14}/> <span className="font-mono">{formatDate(req.start_time)} {req.type === '補打卡' && req.leave_type === '全天' ? ` ~ ${formatDate(req.end_time)}` : (req.type !== '補打卡' && ` ~ ${formatDate(req.end_time)}`)}</span></div>
                                        <div className="flex items-center gap-2 text-slate-700"><FileText size={14}/> 原因：{req.reason}</div>
                                    </div>
                                </div>
                            </div>
                            {req.status === 'pending' && (
                                <div className="flex gap-2">
                                    <button onClick={() => handleReject(req.id)} className="px-4 py-2 text-red-600 font-bold hover:bg-red-50 rounded transition flex items-center gap-1"><XCircle size={18}/> 駁回</button>
                                    <button onClick={() => handleApprove(req)} className="px-6 py-2 bg-teal-600 text-white font-bold rounded shadow hover:bg-teal-500 transition flex items-center gap-2 active:scale-95"><CheckCircle size={18}/> 核准</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
