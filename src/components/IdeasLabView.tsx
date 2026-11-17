import React, { useState } from 'react';
import { ArrowLeft, Lightbulb, Loader2 } from 'lucide-react';
import { AgentProfile, DailyIdea } from '../types/agent';

interface IdeasLabViewProps {
  profile: AgentProfile;
  ideas: DailyIdea[];
  onSaveIdeas: (ideas: DailyIdea[]) => void;
  onConvertToMission: (goalTitle: string) => void;
}

const FOCUS_AREAS = [
  'أفكار فيديوهات قصيرة سريعة الانتشار',
  'أفكار عروض وباقات لزيادة المبيعات',
  'أفكار منتجات جديدة بميزانية صغيرة',
  'أفكار أتمتة لتوفير الوقت اليومي',
];

export const IdeasLabView: React.FC<IdeasLabViewProps> = ({
  profile,
  ideas,
  onSaveIdeas,
  onConvertToMission,
}) => {
  const [focusArea, setFocusArea] = useState(FOCUS_AREAS[0]);
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/agent/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: profile.niche,
          focusArea,
          targetCountry: profile.targetCountry,
          goal: goal.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر توليد الأفكار الجديدة');
      }
      onSaveIdeas(Array.isArray(data.ideas) ? data.ideas : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء توليد الأفكار');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">مختبر الأفكار الجديدة</h1>
        <p className="text-sm text-slate-600">
          يولّد الوكيل أفكاراً عملية مخصصة لمشروعك ويمكنك تحويل أي فكرة مباشرة إلى خطة متابعة
          خطوة بخطوة.
        </p>
      </header>

      <form
        onSubmit={handleGenerate}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
      >
        <div className="space-y-2">
          <span className="block text-xs font-semibold text-slate-700">نوع الأفكار المطلوب</span>
          <div className="flex flex-wrap gap-2">
            {FOCUS_AREAS.map((area) => {
              const active = focusArea === area;
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => setFocusArea(area)}
                  className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    active
                      ? 'bg-teal-50 border-teal-600 text-teal-900'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {area}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="هدف إضافي اختياري (مثال: رفع مبيعات متجر الإكسسوارات قبل نهاية الشهر)..."
            className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري توليد الأفكار...</span>
              </>
            ) : (
              <>
                <Lightbulb className="w-4 h-4" />
                <span>ولّد ٤ أفكار جديدة</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            {error}
          </div>
        )}
      </form>

      {ideas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ideas.map((idea, idx) => (
            <article
              key={idx}
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono text-teal-700 tabular-nums">0{idx + 1}</span>
                  <span aria-hidden="true">·</span>
                  <span>{idea.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{idea.estimatedTime}</span>
                </div>
                <h2 className="text-base font-bold text-slate-900">{idea.title}</h2>
                <p className="text-xs text-slate-700 leading-relaxed">{idea.concept}</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <span className="font-semibold text-slate-800">سبب فعاليتها: </span>
                  {idea.whyItWorks}
                </p>
                <div className="pt-2 border-t border-slate-100 text-xs">
                  <span className="font-semibold text-teal-800">أول خطوة اليوم: </span>
                  <span className="text-slate-800">{idea.firstActionStep}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onConvertToMission(idea.title)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <span>حوّلها لخطة متابعة خطوة بخطوة</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
          <h2 className="text-base font-semibold text-slate-900">مختبر الأفكار جاهز</h2>
          <p className="text-xs text-slate-500">
            اختر مجال الأفكار واضغط على زر التوليد لتحصل على أفكار قابلة للتنفيذ الفوري.
          </p>
        </section>
      )}
    </div>
  );
};
