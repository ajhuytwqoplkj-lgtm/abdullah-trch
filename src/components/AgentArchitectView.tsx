import React, { useState } from 'react';
import {
  Check,
  Copy,
  Layers,
  Loader2,
  Play,
  SlidersHorizontal,
  Workflow,
  Wrench,
  CalendarDays,
} from 'lucide-react';
import { AgentBlueprint, AgentProfile, ModuleId } from '../types/agent';

interface AgentArchitectViewProps {
  profile: AgentProfile;
  blueprint: AgentBlueprint | null;
  onSaveBlueprint: (bp: AgentBlueprint) => void;
  onNavigate: (module: ModuleId) => void;
  onOpenProfileModal: () => void;
}

const ARCHITECTURE_LAYERS = [
  {
    index: '01',
    title: 'النواة والتعليمات (System Prompt)',
    description:
      'تحديد شخصية الوكيل، مجالك التجاري، بلدك، العملة، ونبرة التخاطب حتى لا يعيد طرح الأسئلة الأساسية في كل محادثة.',
  },
  {
    index: '02',
    title: 'الأدوات والتكاملات (Tools & Grounding)',
    description:
      'ربط النموذج اللغوي بأدوات البحث الحي في السوق، وحاسبات التكلفة، ومنصات إنتاج الفيديو مثل Veo و Kling.',
  },
  {
    index: '03',
    title: 'الذاكرة اليومية (Persistent Memory)',
    description:
      'حفظ المهام المنجزة، خطط الاستيراد، والمنتجات المختارة في قاعدة بيانات أو جدول عمل يقرأه الوكيل قبل بدء يومك.',
  },
  {
    index: '04',
    title: 'حلقة المتابعة (Step-by-Step Loop)',
    description:
      'تقسيم كل هدف كبير إلى خطوات بمدة 15–30 دقيقة، مع مراجعة مسائية لتحديد الخطوة التالية بدقة.',
  },
];

const FOCUS_OPTIONS = [
  'إنتاج الفيديوهات القصيرة',
  'الاستيراد والبحث عن الموردين',
  'اكتشاف المنتجات الجديدة',
  'المتابعة اليومية خطوة بخطوة',
  'توليد أفكار المحتوى والتسويق',
];

export const AgentArchitectView: React.FC<AgentArchitectViewProps> = ({
  profile,
  blueprint,
  onSaveBlueprint,
  onNavigate,
  onOpenProfileModal,
}) => {
  const [selectedGoals, setSelectedGoals] = useState<string[]>([
    'إنتاج الفيديوهات القصيرة',
    'الاستيراد والبحث عن الموردين',
    'اكتشاف المنتجات الجديدة',
    'المتابعة اليومية خطوة بخطوة',
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [imageError, setImageError] = useState(false);

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((item) => item !== goal) : [...prev, goal]
    );
  };

  const handleGenerateBlueprint = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/agent/architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          focusGoals: selectedGoals,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر توليد مخطط الوكيل');
      }
      onSaveBlueprint(data as AgentBlueprint);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!blueprint?.systemPrompt) return;
    try {
      await navigator.clipboard.writeText(blueprint.systemPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      setCopiedPrompt(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Split Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="lg:col-span-7 p-6 lg:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>دليل البناء العملي</span>
              <span aria-hidden="true">·</span>
              <span>{profile.niche}</span>
              <span aria-hidden="true">·</span>
              <span>{profile.targetCountry}</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 leading-tight [text-wrap:balance]">
              كيف تنشئ وكيلك الذكي لإدارة المهام اليومية والتجارة والمحتوى
            </h1>
            <p className="text-sm lg:text-base text-slate-600 leading-relaxed max-w-2xl">
              الوكيل الذكي الفعّال ليس مجرد نافذة دردشة؛ بل منظومة من ٤ طبقات تجمع بين
              التعليمات المخصصة، أدوات التنفيذ (الفيديو والاستيراد والبحث)، وذاكرة متابعة
              تقودك خطوة بخطوة. يمكنك تصميم مخطط وكيلك هنا أو تشغيله مباشرة عبر الأقسام
              الجانبية.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleGenerateBlueprint}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري تصميم مخطط الوكيل...</span>
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4" />
                  <span>صمّم مخطط وكيلي المخصص</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onOpenProfileModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>تعديل بيانات المشروع</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('followup')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-teal-800 hover:text-teal-900 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Play className="w-4 h-4" />
              <span>ابدأ المتابعة اليومية الآن</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 min-h-[220px] bg-slate-100 relative">
          {!imageError ? (
            <img
              src="/src/assets/images/agent_studio_banner_1794942432188.jpg"
              alt="مكتب استوديو العمل والإدارة اليومية للوكيل الذكي"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="w-full h-full lg:h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-100 text-slate-500">
              <Layers className="w-10 h-10 mb-2 text-teal-700" />
              <span className="text-sm font-medium">استوديو تصميم الوكيل الذكي</span>
            </div>
          )}
        </div>
      </section>

      {/* 4-Layer Architecture Strip */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {ARCHITECTURE_LAYERS.map((layer) => (
          <div
            key={layer.index}
            className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <span className="font-mono text-xs font-medium text-teal-700 tabular-nums">
                {layer.index}.
              </span>
              <h2 className="text-base font-semibold text-slate-900">{layer.title}</h2>
              <p className="text-xs leading-relaxed text-slate-600">{layer.description}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Configuration Selector */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">تحديد أولويات الوكيل قبل التوليد</h2>
            <p className="text-xs text-slate-500 mt-1">
              الوكيل الحالي: <span className="font-medium text-slate-800">{profile.agentName}</span>
              {' · '}
              الميزانية: <span className="font-medium text-slate-800">{profile.budgetTier}</span>
              {' · '}
              الوقت المتاح: <span className="font-medium text-slate-800">{profile.dailyHours}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerateBlueprint}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0 self-start md:self-auto"
          >
            {loading ? 'جاري البناء...' : 'تحديث مخطط الوكيل'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {FOCUS_OPTIONS.map((goal) => {
            const active = selectedGoals.includes(goal);
            return (
              <button
                key={goal}
                type="button"
                onClick={() => toggleGoal(goal)}
                className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-teal-50 border-teal-600 text-teal-900'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {goal}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            {error}
          </div>
        )}
      </section>

      {/* Generated Blueprint Results */}
      {blueprint ? (
        <div className="space-y-6">
          {/* Summary + System Prompt */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900">١. ملخص معمارية وكيلك</h2>
              <p className="text-sm text-slate-700 leading-relaxed">
                {blueprint.architectureSummary}
              </p>
            </div>

            <div className="border-t border-slate-100 pt-5 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    نص التعليمات التأسيسية (System Prompt جاهز للنسخ)
                  </h3>
                  <p className="text-xs text-slate-500">
                    انسخ هذا النص وضعه في تعليمات الوكيل المخصص في أي أداة تستخدمها لتثبيت أسلوبه.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-teal-700" />
                      <span>تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ البرومبت</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto font-sans">
                {blueprint.systemPrompt}
              </pre>
            </div>
          </section>

          {/* Daily Schedule Table */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-teal-700" />
              <h2 className="text-base font-bold text-slate-900">
                ٢. جدول التشغيل اليومي المقترح ({profile.dailyHours})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-3 px-4 font-medium">الفترة</th>
                    <th className="py-3 px-4 font-medium">المهمة</th>
                    <th className="py-3 px-4 font-medium">دور الوكيل الذكي</th>
                    <th className="py-3 px-4 font-medium">دورك التنفيذي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {blueprint.dailySchedule.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-medium text-teal-800 whitespace-nowrap tabular-nums">
                        {row.timeWindow}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{row.taskTitle}</td>
                      <td className="py-3 px-4 text-slate-600 leading-relaxed">{row.agentRole}</td>
                      <td className="py-3 px-4 text-slate-700 leading-relaxed">{row.humanAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Tool Stack & Automation Workflows */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-teal-700" />
                <h2 className="text-base font-bold text-slate-900">٣. حزمة الأدوات الموصى بها</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {blueprint.toolStack.map((tool, idx) => (
                  <div key={idx} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{tool.capability}</span>
                      <span className="text-xs font-medium text-teal-700">{tool.recommendedTools}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{tool.whyThisTool}</p>
                    <p className="text-xs text-slate-500">خطوة الإعداد: {tool.setupSteps}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Workflow className="w-4 h-4 text-teal-700" />
                <h2 className="text-base font-bold text-slate-900">٤. مسارات الأتمتة (Workflows)</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {blueprint.automationFlows.map((flow, idx) => (
                  <div key={idx} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{flow.flowName}</span>
                      <span className="text-xs text-slate-500">المحفز: {flow.trigger}</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-slate-600">
                      {flow.steps.map((step, sIdx) => (
                        <li key={sIdx}>{step}</li>
                      ))}
                    </ol>
                    <p className="text-xs font-medium text-teal-800">المخرج النهائي: {flow.output}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* First Week Plan */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">٥. خطة تفعيل الوكيل خلال أول ٧ أيام</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {blueprint.firstWeekPlan.map((item, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-4 space-y-1.5">
                  <div className="text-xs font-semibold text-teal-700">{item.day}</div>
                  <div className="text-sm font-semibold text-slate-900">{item.focus}</div>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.deliverable}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <section className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
          <h2 className="text-base font-semibold text-slate-900">
            جاهز لبناء مخطط وكيلك المخصص؟
          </h2>
          <p className="text-xs text-slate-600 max-w-xl mx-auto leading-relaxed">
            اضغط على زر «صمّم مخطط وكيلي المخصص» أعلاه ليقوم الوكيل بإنشاء تعليمات النظام،
            الجدول اليومي، خطوات الربط، وخطة ٧ أيام مخصصة لمجال ({profile.niche}) في ({profile.targetCountry}).
          </p>
        </section>
      )}
    </div>
  );
};
