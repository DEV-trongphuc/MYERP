
import React, { useState } from 'react';
import { BellRing, Plus, Trash2, Layout, Calendar, Clock, Check, ChevronDown, ChevronUp, MailOpen, MousePointer2, Send, Eye, Edit3, Loader2 } from 'lucide-react';
import Input from '../common/Input';
import { CampaignReminder, Template } from '../../types';
import Badge from '../common/Badge';
import TemplateSelector from '../flows/TemplateSelector';
import toast from 'react-hot-toast';

interface ReminderManagerProps {
  reminders: CampaignReminder[];
  templates: Template[];
  onChange: (reminders: CampaignReminder[]) => void;
  mainSubject: string;
  isZns?: boolean;
  mainTemplateId?: string;
  templatePreviews?: Record<string, string>;
  onEditTemplate?: (templateId: string) => void;
  onFetchPreview?: (templateId: string) => void;
}

const ReminderManager: React.FC<ReminderManagerProps> = ({ reminders, templates, onChange, mainSubject, isZns = false, mainTemplateId, templatePreviews, onEditTemplate, onFetchPreview }) => {
  const [activeTemplateDrawer, setActiveTemplateDrawer] = useState<string | null>(null);
  const MAX_REMINDERS = 3; // Industry best practice

  React.useEffect(() => {
    reminders.forEach(rem => {
      const tId = rem.templateId || mainTemplateId;
      if (tId && onFetchPreview && templatePreviews && !templatePreviews[tId]) {
        onFetchPreview(tId);
      }
    });
    if (mainTemplateId && onFetchPreview && templatePreviews && !templatePreviews[mainTemplateId]) {
      onFetchPreview(mainTemplateId);
    }
  }, [reminders, mainTemplateId, onFetchPreview, templatePreviews]);

  const add = () => {
    if (reminders.length >= MAX_REMINDERS) {
      toast.error(`Tối đa ${MAX_REMINDERS} nhắc nhở. Quá nhiều follow-up có thể khiến Khách hàng cảm thấy phiền.`);
      return;
    }

    const newRem: CampaignReminder = {
      id: crypto.randomUUID(),
      type: 'no_open',
      triggerMode: 'delay', // Default
      delayDays: 1,
      delayHours: 0,
      scheduledAt: '',
      subject: `Re: ${mainSubject}`,
      templateId: ''
    };
    onChange([...reminders, newRem]);
  };

  const update = (id: string, data: Partial<CampaignReminder>) => {
    onChange(reminders.map(r => r.id === id ? { ...r, ...data } : r));
  };

  const selectedTemplate = (id: string) => templates.find(t => t.id === id);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'no_open': return isZns ? 'Chưa xem tin nhắn' : 'Chưa mở Email';
      case 'no_click': return isZns ? 'Chưa nhấn Link' : 'Chưa Click Link';
      case 'always': return 'Tất cả mọi người';
      default: return isZns ? 'Chưa xem tin nhắn' : 'Chưa mở Email';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-5 rounded-[18px] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-50 rounded-[14px] flex items-center justify-center text-[#BD1D2D]"><BellRing className="w-6 h-6" /></div>
          <div>
            <h5 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Kế hoạch nhắc nhở</h5>
            <p className="text-[11px] text-slate-500 font-medium">{isZns ? 'Gửi tin nhắn follow-up tự động nếu khách không tương tác.' : 'Gửi email follow-up tự động nếu khách không tương tác.'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-medium">
            {reminders.length}/{MAX_REMINDERS} reminders
          </span>
          <button
            onClick={add}
            disabled={reminders.length >= MAX_REMINDERS}
            className={`flex items-center gap-2 px-5 py-3 rounded-[14px] text-[10px] font-bold uppercase transition-all shadow-lg ${reminders.length >= MAX_REMINDERS
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : 'bg-slate-900 text-white hover:bg-black hover:shadow-xl'
              }`}
          >
            <Plus className="w-3.5 h-3.5" /> Thêm nhắc nhở
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {reminders.map((rem, idx) => (
          <div key={rem.id} className="bg-white border border-slate-200 rounded-[18px] overflow-hidden shadow-sm relative transition-all hover:shadow-md animate-in slide-in-from-bottom-2 duration-300">

            {/* Header / Toolbar */}
            <div className="bg-slate-50/50 px-6 py-4 flex justify-between items-center border-b border-slate-100">
              <div className="flex items-center gap-3">
                <Badge variant="brand" className="px-3 py-1 text-[10px]">LẦN GỬI #{idx + 1}</Badge>
                <span className="text-xs font-semibold text-slate-400">Điều kiện: <span className="text-slate-700">{getTypeLabel(rem.type)}</span></span>
              </div>
              <button onClick={() => onChange(reminders.filter(r => r.id !== rem.id))} className="text-slate-400 hover:text-rose-500 p-2 hover:bg-rose-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left: Timing & Condition */}
              <div className="space-y-6 lg:col-span-1 border-r border-slate-100 pr-0 lg:pr-8">

                {/* Condition Selector */}
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest block ml-1 mb-2">Điều kiện gửi</label>
                  <div className="space-y-2">
                    {[
                      { id: 'no_open', label: isZns ? 'Chưa xem tin Zalo' : 'Chưa mở Email', icon: MailOpen },
                      { id: 'no_click', label: isZns ? 'Chưa nhấn Link' : 'Chưa Click Link', icon: MousePointer2 },
                      { id: 'always', label: 'Gửi cho tất cả', icon: Send },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => update(rem.id, { type: opt.id as any })}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${rem.type === opt.id ? 'border-[#2563eb] bg-orange-50 text-[#BD1D2D] shadow-sm' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-300'}`}
                      >
                        <div className="flex items-center gap-3">
                          <opt.icon className="w-4 h-4" />
                          <span className="text-xs font-bold">{opt.label}</span>
                        </div>
                        {rem.type === opt.id && <div className="w-2 h-2 rounded-full bg-[#2563eb]" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest block ml-1 mb-2">Thời điểm gửi</label>

                  {/* Toggle Mode */}
                  <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                    <button
                      onClick={() => update(rem.id, { triggerMode: 'delay' })}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 ${rem.triggerMode !== 'date' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <Clock className="w-3.5 h-3.5" /> Chờ đợi
                    </button>
                    <button
                      onClick={() => update(rem.id, { triggerMode: 'date' })}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 ${rem.triggerMode === 'date' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <Calendar className="w-3.5 h-3.5" /> Ngày cụ thể
                    </button>
                  </div>

                  {rem.triggerMode === 'date' ? (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                      <Input
                        type="datetime-local"
                        value={rem.scheduledAt || ''}
                        onChange={e => update(rem.id, { scheduledAt: e.target.value })}
                        className="border-slate-200 shadow-sm"
                      />
                      <p className="text-[10px] text-slate-400 italic px-1">{isZns ? 'Tin nhắn' : 'Email'} sẽ được gửi chính xác vào Thời gian này.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                      <Input
                        type="number"
                        min="0"
                        value={rem.delayDays}
                        onChange={e => update(rem.id, { delayDays: parseInt(e.target.value) || 0 })}
                        className="border-slate-200 shadow-sm"
                        placeholder="Ngày"
                      />
                      <Input
                        type="number"
                        min="0"
                        max="23"
                        value={rem.delayHours}
                        onChange={e => update(rem.id, { delayHours: parseInt(e.target.value) || 0 })}
                        className="border-slate-200 shadow-sm"
                        placeholder="Giờ"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Content */}
              <div className="lg:col-span-2 space-y-4">
                <Input label={isZns ? "Mô tả nội dung nhắc (Nội dung ZNS)" : "Tiêu đề Email nhắc"} value={rem.subject} onChange={e => update(rem.id, { subject: e.target.value })} required className="border-slate-200 shadow-sm" />

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">{isZns ? 'Giao diện Tin nhắn' : 'Giao diện Email'}</label>

                  {activeTemplateDrawer === rem.id ? (
                    <div className="bg-slate-50 p-4 rounded-[14px] border border-slate-200 animate-in zoom-in-95 duration-200 relative">
                      <button onClick={() => setActiveTemplateDrawer(null)} className="absolute top-2 right-2 p-1.5 bg-white rounded-full text-slate-400 hover:text-slate-800 shadow-sm z-10"><ChevronUp className="w-4 h-4" /></button>
                      <div className="mb-4">
                        <button
                          onClick={() => { update(rem.id, { templateId: '' }); setActiveTemplateDrawer(null); }}
                          className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between mb-2 border transition-all ${!rem.templateId ? 'bg-orange-50 border-[#2563eb] text-[#BD1D2D]' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                        >
                          {isZns ? 'Sử dụng mẫu của ZNS chính (Mặc định)' : 'Sử dụng mẫu của Email chính (Mặc định)'}
                          {!rem.templateId && <Check className="w-4 h-4" />}
                        </button>
                      </div>
                      <TemplateSelector
                        templates={templates}
                        selectedId={rem.templateId}
                        onSelect={(t) => { update(rem.id, { templateId: t.id }); setActiveTemplateDrawer(null); }}
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setActiveTemplateDrawer(rem.id)}
                      className="w-full flex items-center gap-4 p-3 bg-white border border-slate-200 rounded-[14px] hover:border-[#2563eb] hover:shadow-md transition-all group text-left"
                    >
                      {/* Mini Preview Box */}
                      <div className="w-16 h-12 rounded-lg border border-slate-200 overflow-hidden relative shrink-0 bg-slate-50 flex items-center justify-center group-hover:border-[#2563eb]/30 transition-colors">
                          {(rem.templateId && selectedTemplate(rem.templateId)?.thumbnail) ? (
                              <img src={selectedTemplate(rem.templateId)!.thumbnail} className="w-full h-full object-cover" />
                          ) : (templatePreviews && templatePreviews[rem.templateId || mainTemplateId || '']) ? (
                              <div className="absolute top-0 left-0 w-[400%] h-[400%] origin-top-left scale-[0.25]">
                                  <iframe srcDoc={templatePreviews[rem.templateId || mainTemplateId || '']} title="mini-preview" className="w-full h-full border-0 pointer-events-none" tabIndex={-1} />
                              </div>
                          ) : (
                              <Layout className="w-5 h-5 text-slate-300" />
                          )}
                      </div>

                      <div className="flex-1 min-w-0">
                          {rem.templateId && selectedTemplate(rem.templateId) ? (
                              <>
                                  <p className="text-sm font-bold text-slate-800 truncate">{selectedTemplate(rem.templateId)?.name}</p>
                                  <p className="text-[10px] text-slate-500 font-medium">đang chạy mẫu riêng</p>
                              </>
                          ) : (
                              <>
                                  <p className="text-sm font-bold text-slate-700 group-hover:text-[#BD1D2D] transition-colors truncate">Sử dụng mẫu Mặc định</p>
                                  <p className="text-[10px] text-slate-400 font-medium">{isZns ? 'Giống tin nhắn chính' : 'Giống email chính'}</p>
                              </>
                          )}
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 mr-2 shrink-0" />
                    </button>
                  )}
                </div>

                {/* Live Preview Block */}
                {!isZns && (
                  <div className="mt-6 bg-slate-100 rounded-[18px] p-4 border border-slate-200 shadow-sm animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between mb-3 min-h-[40px]">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-orange-500 shrink-0" />
                        <h4 className="text-sm font-bold text-slate-700 shrink-0">Preview Reminder</h4>
                      </div>
                      {((rem.templateId || mainTemplateId) && (rem.templateId || mainTemplateId) !== 'custom-html') ? (
                        <button
                          onClick={() => {
                            if (onEditTemplate) {
                              onEditTemplate(rem.templateId || mainTemplateId!);
                            }
                          }}
                          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-full text-xs font-bold hover:text-[#2563eb] hover:border-orange-200 hover:bg-orange-50 transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Chỉnh sửa Email
                        </button>
                      ) : null}
                    </div>

                    <div className="text-[13px] text-slate-600 font-bold bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm leading-snug mb-4">
                      <span className="text-slate-400 font-normal mr-2">Subject:</span>
                      {rem.subject}
                    </div>

                    <div className="w-full h-[400px] border border-slate-200 rounded-[20px] overflow-hidden shadow-inner bg-white relative">
                      {templatePreviews && templatePreviews[rem.templateId || mainTemplateId || ''] ? (
                          <iframe
                              srcDoc={templatePreviews[rem.templateId || mainTemplateId || '']}
                              className="absolute top-0 left-0 w-[150%] h-[150%] border-none origin-top-left"
                              style={{ transform: 'scale(0.666666)' }}
                              title="Preview"
                              sandbox="allow-same-origin"
                          />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span className="text-xs font-medium">Đang tải preview...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {reminders.length === 0 && (
          <div className="py-12 border-2 border-dashed border-slate-200 rounded-[18px] text-center bg-slate-50/50 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-300"><BellRing className="w-8 h-8" /></div>
            <div>
              <p className="text-sm font-bold text-slate-600">Chưa có nhắc nhở</p>
              <p className="text-xs text-slate-400 mt-1">{isZns ? 'Thêm tin nhắn follow-up để tăng tỷ lệ chuyển đổi.' : 'Thêm email follow-up để tăng tỷ lệ chuyển đổi.'}</p>
            </div>
            <button onClick={add} className="mt-2 text-xs font-bold text-[#BD1D2D] hover:underline uppercase tracking-wider">Thêm ngay</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReminderManager;
