import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Globe, Loader2, Send, Trash2 } from 'lucide-react';
import { AgentProfile, ChatMessage, ChatModelId } from '../types/agent';
import { VoiceTranscribeButton } from './VoiceTranscribeButton';

interface AgentChatViewProps {
  profile: AgentProfile;
  messages: ChatMessage[];
  onAddMessage: (msg: ChatMessage) => void;
  onClearHistory: () => void;
}

const ROLE_PRESETS: Array<{ label: string; instruction: string }> = [
  {
    label: 'وكيل المهام اليومية العام',
    instruction:
      'أنت وكيل ذكاء اصطناعي تنفيذي تساعد المستخدم في تنظيم مهامه اليومية، التجارة الإلكترونية، إنتاج الفيديوهات، والاستيراد بخطوات عملية مختصرة باللغة العربية.',
  },
  {
    label: 'مخرج الفيديوهات (١-٧ دقائق)',
    instruction:
      'أنت مخرج ومؤلف فيديوهات يوتيوب ومحتوى تسويقي (من دقيقة إلى 7 دقائق). تساعد المستخدم في بناء خطافات قوية، هيكلة الفصول، وكتابة السكريبتات.',
  },
  {
    label: 'مستشار الاستيراد والموردين',
    instruction:
      'أنت خبير استيراد وسلاسل إمداد دولية. ترشد المستخدم في التفاوض مع المصانع، حساب التكلفة الواصلة، الشحن، والجمارك بدقة.',
  },
  {
    label: 'محلل المنتجات والابتكار',
    instruction:
      'أنت محلل أسواق ومنتجات. تساعد في تقييم جدوى المنتجات الجديدة، صياغة عروض البيع، واستخراج أفكار تسويقية عالية التحويل.',
  },
];

const MODEL_OPTIONS: Array<{ id: ChatModelId; label: string; hint: string }> = [
  {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen',
    hint: 'متوازن للمهام اليومية والعامة',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    hint: 'سريع جداً للأسئلة المختصرة',
  },
  {
    id: 'gemini-4-argon',
    label: 'Gemini 4 Argon',
    hint: 'للمهام التفاعلية المعقدة (مفتاح مدفوع)',
  },
  {
    id: 'gemini-4-carbon',
    label: 'Gemini 4 Carbon',
    hint: 'للتفكير العميق والتحليل الاستراتيجي (مفتاح مدفوع)',
  },
];

interface ChatMsgWithSources extends ChatMessage {
  sources?: Array<{ title: string; uri: string }>;
}

export const AgentChatView: React.FC<AgentChatViewProps> = ({
  profile,
  messages,
  onAddMessage,
  onClearHistory,
}) => {
  const [selectedModel, setSelectedModel] = useState<ChatModelId>('gemini-4-hydrogen');
  const [selectedRoleIdx, setSelectedRoleIdx] = useState<number>(0);
  const [customInstruction, setCustomInstruction] = useState<string>(
    `${ROLE_PRESETS[0].instruction}\nسياق المستخدم: المجال (${profile.niche})، السوق (${profile.targetCountry})، العملة (${profile.currency}).`
  );
  const [useSearch, setUseSearch] = useState<boolean>(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourcesByMsg, setSourcesByMsg] = useState<
    Record<string, Array<{ title: string; uri: string }>>
  >({});
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  const handleRoleChange = (idx: number) => {
    setSelectedRoleIdx(idx);
    setCustomInstruction(
      `${ROLE_PRESETS[idx].instruction}\nسياق المستخدم: المجال (${profile.niche})، السوق (${profile.targetCountry})، العملة (${profile.currency}).`
    );
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    onAddMessage(userMsg);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          systemInstruction: customInstruction,
          history: messages.map((m) => ({ role: m.role, text: m.text })),
          message: trimmed,
          useSearch,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر الحصول على رد من الوكيل');
      }
      const botId = `msg_m_${Date.now()}`;
      const botMsg: ChatMsgWithSources = {
        id: botId,
        role: 'model',
        text: data.reply || '',
        modelUsed: data.modelUsed || selectedModel,
        createdAt: new Date().toISOString(),
      };
      if (Array.isArray(data.sources) && data.sources.length > 0) {
        setSourcesByMsg((prev) => ({ ...prev, [botId]: data.sources }));
      }
      onAddMessage(botMsg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء المحادثة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">المحادثة الذكية مع {profile.agentName}</h1>
          <p className="text-sm text-slate-600">
            حوار متعدد الأدوار يحفظ سياق محادثتك مع إمكانية تغيير دور الوكيل والنموذج والتحدث
            بالميكروفون.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:text-red-700 hover:border-red-200 rounded-lg transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>مسح السجل</span>
          </button>
        )}
      </header>

      {/* Role & Model Configuration */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="chat-role" className="block text-xs font-semibold text-slate-700">
              تخصص الوكيل (System Instruction)
            </label>
            <select
              id="chat-role"
              value={selectedRoleIdx}
              onChange={(e) => handleRoleChange(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
            >
              {ROLE_PRESETS.map((role, idx) => (
                <option key={role.label} value={idx}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="chat-model" className="block text-xs font-semibold text-slate-700">
              النموذج المستخدم
            </label>
            <select
              id="chat-model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as ChatModelId)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label} — {opt.hint}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="chat-sys" className="text-xs font-semibold text-slate-700">
              تعليمات الدور المخصصة
            </label>
            <button
              type="button"
              onClick={() => setUseSearch((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer ${
                useSearch
                  ? 'bg-teal-50 border-teal-600 text-teal-900'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>{useSearch ? 'بحث جوجل الحي: مفعّل' : 'تفعيل بحث جوجل الحي'}</span>
            </button>
          </div>
          <textarea
            id="chat-sys"
            rows={2}
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600 leading-relaxed"
          />
        </div>
      </section>

      {/* Scrollable Conversation Thread */}
      <section className="bg-white border border-slate-200 rounded-xl flex flex-col h-[480px]">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-2 text-slate-500 px-4">
              <p className="text-sm font-semibold text-slate-800">
                ابدأ محادثة مستمرة مع وكيلك الذكي
              </p>
              <p className="text-xs max-w-md leading-relaxed">
                اسأله عن خطة عملك، اطلب منه تعديل سيناريو فيديو، أو استخدم زر الإدخال الصوتي
                للتحدث مباشرة.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              const sources = sourcesByMsg[msg.id];
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-900 border border-slate-200'
                    }`}
                  >
                    <div className="text-[11px] opacity-70 mb-1 flex items-center gap-2">
                      <span>{isUser ? profile.ownerName : profile.agentName}</span>
                      {!isUser && msg.modelUsed && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{msg.modelUsed}</span>
                        </>
                      )}
                    </div>
                    <div>{msg.text}</div>
                    {sources && sources.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-200 flex flex-wrap gap-2">
                        {sources.map((src, sIdx) => (
                          <a
                            key={sIdx}
                            href={src.uri}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-teal-800 hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span className="truncate max-w-[200px]">{src.title}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {loading && (
            <div className="flex justify-end">
              <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 inline-flex items-center gap-2 text-xs text-slate-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700" />
                <span>يكتب {profile.agentName} الرد...</span>
              </div>
            </div>
          )}
          <div ref={threadEndRef} />
        </div>

        {error && (
          <div className="mx-5 mb-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            {error}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={handleSend}
          className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اكتب رسالتك أو استخدم الإدخال الصوتي..."
            className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
          />
          <div className="flex items-center gap-2 shrink-0">
            <VoiceTranscribeButton
              onTranscribed={(txt) =>
                setInput((prev) => (prev ? `${prev} ${txt}` : txt))
              }
              onError={(msg) => setError(msg)}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              <span>إرسال</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
