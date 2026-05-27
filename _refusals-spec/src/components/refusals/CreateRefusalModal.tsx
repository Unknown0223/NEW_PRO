import { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { agentOptions, reasonOptions } from '../../data/mockRefusals';

interface CreateRefusalModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface FormState {
  client: string;
  reason: string;
  comment: string;
  agent: string;
}

export default function CreateRefusalModal({ open, onClose, onCreated }: CreateRefusalModalProps) {
  const [form, setForm] = useState<FormState>({
    client: '',
    reason: '',
    comment: '',
    agent: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<FormState>>({});

  if (!open) return null;

  const set = (key: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const validate = () => {
    const e: Partial<FormState> = {};
    if (!form.client.trim()) e.client = 'Обязательное поле';
    if (!form.reason) e.reason = 'Выберите причину';
    if (!form.agent) e.agent = 'Выберите агента';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    // Simulate API call: POST /refusals/create
    await new Promise((res) => setTimeout(res, 800));
    setSaving(false);
    setForm({ client: '', reason: '', comment: '', agent: '' });
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Создать отказ</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-4">
          {/* Client */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Клиент <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.client}
              onChange={(e) => set('client')(e.target.value)}
              placeholder="Введите имя клиента..."
              className={`w-full border rounded-lg px-3 py-2 text-sm outline-none transition-colors ${
                errors.client
                  ? 'border-red-400 focus:ring-2 focus:ring-red-400/30'
                  : 'border-gray-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/30'
              }`}
            />
            {errors.client && (
              <p className="text-xs text-red-500 mt-1">{errors.client}</p>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Причина отказа <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={form.reason}
                onChange={(e) => set('reason')(e.target.value)}
                className={`w-full appearance-none border rounded-lg px-3 py-2 text-sm outline-none transition-colors pr-8 ${
                  errors.reason
                    ? 'border-red-400 focus:ring-2 focus:ring-red-400/30'
                    : 'border-gray-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/30'
                }`}
              >
                <option value="">Выберите причину...</option>
                {reasonOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                <ChevronDown size={14} className="text-gray-400" />
              </div>
            </div>
            {errors.reason && (
              <p className="text-xs text-red-500 mt-1">{errors.reason}</p>
            )}
          </div>

          {/* Agent */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Агент <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={form.agent}
                onChange={(e) => set('agent')(e.target.value)}
                className={`w-full appearance-none border rounded-lg px-3 py-2 text-sm outline-none transition-colors pr-8 ${
                  errors.agent
                    ? 'border-red-400 focus:ring-2 focus:ring-red-400/30'
                    : 'border-gray-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/30'
                }`}
              >
                <option value="">Выберите агента...</option>
                {agentOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                <ChevronDown size={14} className="text-gray-400" />
              </div>
            </div>
            {errors.agent && (
              <p className="text-xs text-red-500 mt-1">{errors.agent}</p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Комментарий
            </label>
            <textarea
              value={form.comment}
              onChange={(e) => set('comment')(e.target.value)}
              placeholder="Дополнительная информация..."
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/30 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            )}
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
