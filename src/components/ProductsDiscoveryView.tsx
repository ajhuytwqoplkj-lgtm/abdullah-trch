import React, { useState } from 'react';
import { ExternalLink, Film, Loader2, Search, Ship } from 'lucide-react';
import { AgentProfile, ProductOpportunity, ProductsSearchResult } from '../types/agent';

interface ProductsDiscoveryViewProps {
  profile: AgentProfile;
  result: ProductsSearchResult | null;
  onSaveResult: (res: ProductsSearchResult) => void;
  onSendToVideo: (productName: string) => void;
  onSendToImport: (productName: string) => void;
}

const PRESET_NICHES = [
  'أدوات المنزل والمطبخ الذكية',
  'إكسسوارات السيارات والسفر',
  'العناية الشخصية والجمال',
  'معدات المكتب وصناع المحتوى',
  'مستلزمات الحيوانات الأليفة',
];

export const ProductsDiscoveryView: React.FC<ProductsDiscoveryViewProps> = ({
  profile,
  result,
  onSaveResult,
  onSendToVideo,
  onSendToImport,
}) => {
  const [niche, setNiche] = useState(profile.niche);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDiscover = async (overrideNiche?: string) => {
    const queryNiche = (overrideNiche ?? niche).trim() || profile.niche;
    if (overrideNiche) {
      setNiche(overrideNiche);
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/agent/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: queryNiche,
          targetCountry: profile.targetCountry,
          budgetTier: profile.budgetTier,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر البحث عن منتجات جديدة');
      }
      onSaveResult(data as ProductsSearchResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء البحث عن المنتجات');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">مكتشف المنتجات الجديدة</h1>
        <p className="text-sm text-slate-600">
          يبحث الوكيل في اتجاهات السوق الحالية ليقترح لك منتجات قابلة للاستيراد والتصوير، مع
          إمكانية تحويل أي منتج مباشرة إلى استوديو الفيديو أو خطة الاستيراد.
        </p>
      </header>

      {/* Search & Filter Panel */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleDiscover();
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <input
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="اكتب المجال أو الفئة التي تبحث عن منتجات فيها..."
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
                <span>جاري البحث في السوق...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>ابحث عن منتجات جديدة</span>
              </>
            )}
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">مجالات مقترحة:</span>
          {PRESET_NICHES.map((item) => (
            <button
              key={item}
              type="button"
              disabled={loading}
              onClick={() => handleDiscover(item)}
              className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              {item}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => handleDiscover()}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-semibold text-red-900 bg-white border border-red-200 hover:bg-red-100 rounded-lg cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              إعادة المحاولة
            </button>
          </div>
        )}
      </section>

      {/* Results */}
      {result && result.products.length > 0 ? (
        <div className="space-y-6">
          {result.marketSummary && (
            <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-semibold text-teal-800">قراءة الوكيل للسوق الآن</h2>
                <span className="text-[11px] text-slate-500">
                  {result.groundingUsed ? 'مدعوم بنتائج البحث الحي' : 'تحليل مباشر للفرص'}
                </span>
              </div>
              <p className="text-sm text-slate-800 leading-relaxed">{result.marketSummary}</p>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {result.products.map((product: ProductOpportunity, idx: number) => (
              <article
                key={idx}
                className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-5"
              >
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono text-teal-700 tabular-nums">0{idx + 1}</span>
                      <span aria-hidden="true">·</span>
                      <span>{product.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{product.targetAudience}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{product.name}</h3>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">
                    <span className="font-semibold text-slate-900">المشكلة التي يحلها: </span>
                    {product.problemSolved}
                  </p>

                  <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-500 block">التكلفة من المصدر</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {product.estimatedSourcingCost}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">سعر البيع المقترح</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {product.suggestedSellingPrice}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">الهامش التقديري</span>
                      <span className="font-bold text-teal-700 tabular-nums">
                        {product.profitMarginEstimate}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <p className="text-slate-700 leading-relaxed">
                      <span className="font-semibold text-slate-900">زاوية الفيديو المقترحة: </span>
                      {product.viralVideoAngle}
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                      <span className="font-semibold text-slate-800">لماذا الآن: </span>
                      {product.whyNow}
                    </p>
                    <p dir="ltr" className="font-mono text-[11px] text-slate-500 text-left pt-1">
                      Keywords: {product.sourcingKeywordsEn}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() =>
                      onSendToVideo(`${product.name} — ${product.viralVideoAngle}`)
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>أنشئ فيديو للمنتج</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSendToImport(product.name)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <Ship className="w-3.5 h-3.5" />
                    <span>احسب تكلفة الاستيراد</span>
                  </button>
                </div>
              </article>
            ))}
          </div>

          {result.sources && result.sources.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-semibold text-slate-500">مصادر البحث الحي المستخدمة</h3>
              <div className="flex flex-wrap gap-3">
                {result.sources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.uri}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-teal-800 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[260px]">{src.title}</span>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <section className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
          <h2 className="text-base font-semibold text-slate-900">اكتشف دفعة منتجات جديدة اليوم</h2>
          <p className="text-xs text-slate-500">
            اختر مجالاً من الأزرار أعلاه أو اكتب مجالاً محدداً ليقوم الوكيل باقتراح ٤ منتجات عملية
            مع تقدير التكلفة وزاوية التصوير.
          </p>
        </section>
      )}
    </div>
  );
};
