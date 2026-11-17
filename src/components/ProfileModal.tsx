import React, { useState } from 'react';
import { X } from 'lucide-react';
import { AgentProfile } from '../types/agent';

interface ProfileModalProps {
  isOpen: boolean;
  profile: AgentProfile;
  onClose: () => void;
  onSave: (profile: AgentProfile) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  profile,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState<AgentProfile>(profile);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 id="profile-modal-title" className="text-base font-bold text-slate-900">
            تخصيص هوية وكيلك الذكي
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="prof-agent-name" className="block text-xs font-semibold text-slate-700">
                اسم الوكيل
              </label>
              <input
                id="prof-agent-name"
                type="text"
                value={form.agentName}
                onChange={(e) => setForm({ ...form, agentName: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="prof-owner-name" className="block text-xs font-semibold text-slate-700">
                اسمك
              </label>
              <input
                id="prof-owner-name"
                type="text"
                value={form.ownerName}
                onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="prof-niche" className="block text-xs font-semibold text-slate-700">
              المجال أو التخصص التجاري
            </label>
            <input
              id="prof-niche"
              type="text"
              value={form.niche}
              onChange={(e) => setForm({ ...form, niche: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="prof-country" className="block text-xs font-semibold text-slate-700">
                السوق / بلد الاستيراد
              </label>
              <input
                id="prof-country"
                type="text"
                value={form.targetCountry}
                onChange={(e) => setForm({ ...form, targetCountry: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="prof-currency" className="block text-xs font-semibold text-slate-700">
                العملة المحلية
              </label>
              <input
                id="prof-currency"
                type="text"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="prof-budget" className="block text-xs font-semibold text-slate-700">
                الميزانية المبدئية
              </label>
              <input
                id="prof-budget"
                type="text"
                value={form.budgetTier}
                onChange={(e) => setForm({ ...form, budgetTier: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="prof-hours" className="block text-xs font-semibold text-slate-700">
                الوقت المتاح يومياً
              </label>
              <input
                id="prof-hours"
                type="text"
                value={form.dailyHours}
                onChange={(e) => setForm({ ...form, dailyHours: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer"
            >
              حفظ الإعدادات
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
