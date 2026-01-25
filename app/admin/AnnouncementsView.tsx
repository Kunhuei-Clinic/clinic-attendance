'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Plus, Edit2, Trash2, X, Save } from 'lucide-react';

export default function AnnouncementsView() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);
  const [form, setForm] = useState({ title: '', content: '', is_active: true });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/announcements');
      const result = await response.json();
      if (result.data) {
        setAnnouncements(result.data);
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingAnnouncement(null);
    setForm({ title: '', content: '', is_active: true });
    setShowModal(true);
  };

  const handleEdit = (ann: any) => {
    setEditingAnnouncement(ann);
    setForm({
      title: ann.title || '',
      content: ann.content || '',
      is_active: ann.is_active !== undefined ? ann.is_active : true
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('確定要刪除這則公告嗎？')) return;

    try {
      const response = await fetch(`/api/announcements?id=${id}`, {
        method: 'DELETE'
      });
      const result = await response.json();

      if (result.success) {
        alert('公告已刪除');
        fetchAnnouncements();
      } else {
        alert('刪除失敗: ' + (result.error || '未知錯誤'));
      }
    } catch (error: any) {
      console.error('Error deleting announcement:', error);
      alert('刪除失敗: ' + error.message);
    }
  };

  const handleSubmit = async () => {
    if (!form.title || !form.content) {
      alert('請填寫標題和內容');
      return;
    }

    try {
      const url = '/api/announcements';
      const method = editingAnnouncement ? 'PATCH' : 'POST';
      const body = editingAnnouncement
        ? { id: editingAnnouncement.id, ...form }
        : form;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await response.json();

      if (result.success) {
        alert(editingAnnouncement ? '公告已更新' : '公告已建立');
        setShowModal(false);
        fetchAnnouncements();
      } else {
        alert('操作失敗: ' + (result.error || '未知錯誤'));
      }
    } catch (error: any) {
      console.error('Error saving announcement:', error);
      alert('操作失敗: ' + error.message);
    }
  };

  const toggleActive = async (ann: any) => {
    try {
      const response = await fetch('/api/announcements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: ann.id,
          is_active: !ann.is_active
        })
      });

      const result = await response.json();

      if (result.success) {
        fetchAnnouncements();
      } else {
        alert('更新失敗: ' + (result.error || '未知錯誤'));
      }
    } catch (error: any) {
      console.error('Error toggling announcement:', error);
      alert('更新失敗: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">載入中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Bell size={20}/>
          公告管理
        </h2>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-teal-700 transition"
        >
          <Plus size={16}/>
          新增公告
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-200">
          {announcements.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              尚無公告，點擊上方按鈕新增
            </div>
          ) : (
            announcements.map((ann) => (
              <div key={ann.id} className="p-4 hover:bg-slate-50 transition">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-slate-800">{ann.title}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-bold ${
                          ann.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {ann.is_active ? '啟用中' : '已下架'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-2 whitespace-pre-wrap">
                      {ann.content}
                    </p>
                    <div className="text-xs text-slate-400">
                      建立時間: {new Date(ann.created_at).toLocaleString('zh-TW')}
                      {ann.updated_at !== ann.created_at && (
                        <span className="ml-2">
                          更新時間: {new Date(ann.updated_at).toLocaleString('zh-TW')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(ann)}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                        ann.is_active
                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {ann.is_active ? '下架' : '啟用'}
                    </button>
                    <button
                      onClick={() => handleEdit(ann)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                      title="編輯"
                    >
                      <Edit2 size={16}/>
                    </button>
                    <button
                      onClick={() => handleDelete(ann.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                      title="刪除"
                    >
                      <Trash2 size={16}/>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 新增/編輯 Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center rounded-t-xl">
              <h3 className="font-bold text-lg">
                {editingAnnouncement ? '編輯公告' : '新增公告'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-slate-300 transition"
              >
                <X size={20}/>
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1 block">
                  標題 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border p-2 rounded-lg bg-slate-50 text-sm"
                  placeholder="請輸入公告標題"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1 block">
                  內容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="w-full border p-2 rounded-lg bg-slate-50 text-sm min-h-[200px]"
                  placeholder="請輸入公告內容"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="is_active" className="text-sm font-bold text-slate-700">
                  立即啟用
                </label>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-teal-700 transition"
              >
                <Save size={16}/>
                {editingAnnouncement ? '更新' : '建立'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
