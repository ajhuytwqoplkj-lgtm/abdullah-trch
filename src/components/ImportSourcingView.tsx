import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  PackageCheck,
  Ship,
  Trash2,
} from 'lucide-react';
import { AgentProfile, ImportPlan, MapsSearchResponse } from '../types/agent';

interface ImportSourcingViewProps {
  profile: AgentProfile;
  plans: ImportPlan[];
  prefillProduct: string;
  onClearPrefill: () => void;
  onSavePlan: (plan: ImportPlan) => void;
  onDeletePlan: (id: string) => void;
}

export const ImportSourcingView: React.FC<ImportSourcingViewProps> = ({
  profile,
  plans,
  prefillProduct,
  onClearPrefill,
  onSavePlan,
  onDeletePlan,
}) => {
  const [productName, setProductName] = useState(prefillProduct || '');
  const [targetCountry, setTargetCountry] = useState(profile.targetCountry);
  const [quantity, setQuantity] = useState('100 قطعة');
  const [budget, setBudget] = useState('1500 دولار');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(plans[0]?.id ?? null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [mapsQuery, setMapsQuery] = useState('شركات شحن دولي ومخلصين جمركيين');
  const [mapsCity, setMapsCity] = useState(profile.targetCountry);
  const [mapsLoading, setMapsLoading] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [mapsResult, setMapsResult] = useState<MapsSearchResponse | null>(null);
  const [useMyLocation, setUseMyLocation] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (prefillProduct) {
      setProductName(prefillProduct);
      onClearPrefill();
    }
  }, [prefillProduct, onClearPrefill]);

  const activePlan = plans.find((p) => p.id === selectedPlanId) ?? plans[0] ?? null;

  const handleToggleLocation = () => {
    if (useMyLocation) {
      setUseMyLocation(false);
      setCoords(null);
      return;
    }
    if (!navigator.geolocation) {
      setMapsError('المتصفح لا يدعم تحديد الموقع الجغرافي تلقائياً.');
      return;
    }
    setMapsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setUseMyLocation(true);
      },
      () => {
        setMapsError('تعذر قراءة موقعك الحالي. يمكنك البحث باسم المدينة يدوياً.');
        setUseMyLocation(false);
      },
      { timeout: 8000 }
    );
  };

  const handleSearchMaps = async (e?: React.FormEvent, presetQuery?: string) => {
    e?.preventDefault();
    const targetQuery = (presetQuery ?? mapsQuery).trim();
    if (!targetQuery) return;
    if (presetQuery) {
      setMapsQuery(presetQuery);
    }
    setMapsLoading(true);
    setMapsError(null);
    try {
      const res = await fetch('/api/agent/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: targetQuery,
          cityOrCountry: mapsCity.trim() || profile.targetCountry,
          latitude: useMyLocation && coords ? coords.latitude : undefined,
          longitude: useMyLocation && coords ? coords.longitude : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر البحث في خرائط جوجل');
      }
      setMapsResult(data as MapsSearchResponse);
    } catch (err) {
      setMapsError(err instanceof Error ? err.message : 'حدث خطأ أثناء البحث على خرائط جوجل');
    } finally {
      setMapsLoading(false);
    }
  };

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      setCopiedKey(null);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/agent/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: productName.trim(),
          targetCountry: targetCountry.trim() || profile.targetCountry,
          quantity: quantity.trim(),
          budget: budget.trim(),
          currency: profile.currency,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر إعداد خطة الاستيراد');
      }
      const created = data as ImportPlan;
      onSavePlan(created);
      setSelectedPlanId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء إعداد خطة الاستيراد');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">مستشار الاستيراد والموردين</h1>
        <p className="text-sm text-slate-600">
          يخطط الوكيل رحلة الاستيراد من البحث عن المصانع وحساب التكلفة الواصلة حتى صياغة رسالة
          التفاوض بالإنجليزية وقائمة فحص المورد.
        </p>
      </header>

      {/* Form */}
      <form
        onSubmit={handleGenerate}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5 lg:col-span-2">
            <label htmlFor="imp-product" className="block text-xs font-semibold text-slate-700">
              المنتج المطلوب استيراده
            </label>
            <input
              id="imp-product"
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="مثال: خلاط محمول قابل للشحن USB-C أو منظم مكتبي مغناطيسي..."
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="imp-country" className="block text-xs font-semibold text-slate-700">
              بلد الوصول
            </label>
            <input
              id="imp-country"
              type="text"
              value={targetCountry}
              onChange={(e) => setTargetCountry(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="imp-qty" className="block text-xs font-semibold text-slate-700">
              الكمية المبدئية
            </label>
            <input
              id="imp-qty"
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-3">
            <label htmlFor="imp-budget" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              الميزانية التقريبية:
            </label>
            <input
              id="imp-budget"
              type="text"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-40 px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !productName.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري إعداد خطة الاستيراد...</span>
              </>
            ) : (
              <>
                <Ship className="w-4 h-4" />
                <span>أعد خطة الاستيراد والتكلفة</span>
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

      {/* Saved Plans Tabs */}
      {plans.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">خطط الاستيراد المحفوظة:</span>
          {plans.map((plan) => {
            const isSelected = activePlan?.id === plan.id;
            return (
              <div
                key={plan.id}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${
                  isSelected
                    ? 'bg-teal-50 border-teal-600 text-teal-950 font-semibold'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className="cursor-pointer truncate max-w-[180px]"
                >
                  {plan.productName}
                </button>
                <button
                  type="button"
                  onClick={() => onDeletePlan(plan.id)}
                  aria-label="حذف الخطة"
                  className="text-slate-400 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {activePlan ? (
        <div className="space-y-6">
          {/* Header Metrics Strip */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <span className="text-xs text-slate-500">رمز الجمارك والمطابقة الاسترشادي</span>
              <div className="text-sm font-semibold text-slate-900">{activePlan.hsCodeHint}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <span className="text-xs text-slate-500">سعر البيع المتوقع في السوق</span>
              <div className="text-lg font-bold text-slate-900 tabular-nums">
                {activePlan.expectedSellingPrice}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <span className="text-xs text-slate-500">الهامش الصافي التقديري</span>
              <div className="text-lg font-bold text-teal-700 tabular-nums">
                {activePlan.estimatedNetMargin}
              </div>
            </div>
          </section>

          {/* Sourcing Hubs */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">١. مراكز ومنصات البحث عن الموردين</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {activePlan.sourcingHubs.map((hub, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-4 space-y-2">
                  <div className="text-sm font-bold text-slate-900">{hub.platformOrCity}</div>
                  <p className="text-xs text-slate-600 leading-relaxed">{hub.specialty}</p>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span dir="ltr" className="font-mono text-[11px] text-teal-800 truncate">
                      {hub.searchKeywordsEn}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(`kw_${idx}`, hub.searchKeywordsEn)}
                      className="text-xs text-slate-500 hover:text-slate-900 shrink-0 cursor-pointer"
                    >
                      {copiedKey === `kw_${idx}` ? (
                        <Check className="w-3.5 h-3.5 text-teal-700" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Cost Breakdown & Shipping Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">٢. تقدير التكلفة الواصلة (Landed Cost)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                      <th className="py-2.5 px-4 font-medium">البند</th>
                      <th className="py-2.5 px-4 font-medium">التكلفة التقديرية</th>
                      <th className="py-2.5 px-4 font-medium">ملاحظة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {activePlan.costBreakdown.map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-3 px-4 font-semibold text-slate-900">{row.item}</td>
                        <td className="py-3 px-4 font-medium text-teal-800 whitespace-nowrap tabular-nums">
                          {row.estimatedCost}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{row.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">٣. مقارنة خيارات الشحن</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                      <th className="py-2.5 px-4 font-medium">الطريقة</th>
                      <th className="py-2.5 px-4 font-medium">المدة</th>
                      <th className="py-2.5 px-4 font-medium">التكلفة</th>
                      <th className="py-2.5 px-4 font-medium">الأنسب لـ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {activePlan.shippingOptions.map((opt, idx) => (
                      <tr key={idx}>
                        <td className="py-3 px-4 font-semibold text-slate-900">{opt.method}</td>
                        <td className="py-3 px-4 text-slate-700 whitespace-nowrap tabular-nums">
                          {opt.transitDays}
                        </td>
                        <td className="py-3 px-4 font-medium text-teal-800 whitespace-nowrap tabular-nums">
                          {opt.estimatedCost}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{opt.bestFor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Supplier Outreach & Checklist */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-base font-bold text-slate-900">
                  ٤. رسالة جاهزة لمراسلة الموردين
                </h2>
                <button
                  type="button"
                  onClick={() => handleCopy('outreach_en', activePlan.outreachMessageEn)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  {copiedKey === 'outreach_en' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-teal-700" />
                      <span>تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ الرسالة الإنجليزية</span>
                    </>
                  )}
                </button>
              </div>
              <pre
                dir="ltr"
                className="p-4 rounded-lg bg-slate-900 text-slate-100 text-xs leading-relaxed whitespace-pre-wrap text-left font-mono"
              >
                {activePlan.outreachMessageEn}
              </pre>
              <div className="pt-2 border-t border-slate-100 space-y-1">
                <span className="text-xs font-semibold text-slate-500">الترجمة العربية للمعنى:</span>
                <p className="text-xs text-slate-700 leading-relaxed">{activePlan.outreachMessageAr}</p>
              </div>
            </section>

            <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-teal-700" />
                  <h2 className="text-base font-bold text-slate-900">قائمة فحص المورد قبل الدفع</h2>
                </div>
                <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
                  {activePlan.supplierChecklist.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="font-mono text-teal-700 tabular-nums">{idx + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-2">
                <h3 className="text-xs font-bold text-amber-800">تنبيهات ومخاطر يجب التحقق منها</h3>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-600 leading-relaxed">
                  {activePlan.riskNotes.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        </div>
      ) : (
        <section className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
          <h2 className="text-base font-semibold text-slate-900">لا توجد خطة استيراد محددة بعد</h2>
          <p className="text-xs text-slate-500">
            أدخل اسم المنتج وبلد الوصول أعلاه ليحسب لك الوكيل التكلفة التقديرية ويجدول لك خطوات
            البحث والتفاوض.
          </p>
        </section>
      )}

      {/* Google Maps Grounding Section: Freight, Customs & Wholesale Hubs */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-700" />
              <h2 className="text-base font-bold text-slate-900">
                دليل شركات الشحن والمخلصين الجمركيين عبر خرائط جوجل
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              ابحث عن مكاتب الشحن، التخليص الجمركي، والمناطق التجارية القريبة مع روابط مباشرة
              على خرائط جوجل.
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleLocation}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer shrink-0 ${
              useMyLocation
                ? 'bg-teal-50 border-teal-600 text-teal-900'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{useMyLocation ? 'يستخدم موقعك الحالي' : 'استخدام موقعي الحالي'}</span>
          </button>
        </div>

        <form onSubmit={(e) => handleSearchMaps(e)} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <input
            type="text"
            value={mapsQuery}
            onChange={(e) => setMapsQuery(e.target.value)}
            placeholder="مثال: مكتب تخليص جمركي، شركة شحن بحري، سوق جملة..."
            className="md:col-span-6 px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
          />
          <input
            type="text"
            value={mapsCity}
            onChange={(e) => setMapsCity(e.target.value)}
            placeholder="المدينة أو الدولة (مثال: جدة، الرياض، دبي)"
            className="md:col-span-4 px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
          />
          <button
            type="submit"
            disabled={mapsLoading || !mapsQuery.trim()}
            className="md:col-span-2 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            {mapsLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>جاري البحث...</span>
              </>
            ) : (
              <>
                <MapPin className="w-3.5 h-3.5" />
                <span>بحث الخرائط</span>
              </>
            )}
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">عمليات بحث سريعة:</span>
          {[
            'شركات شحن دولي بحري وجوي',
            'مكاتب تخليص جمركي موثوقة',
            'مستودعات خدمات لوجستية وتخزين',
          ].map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={mapsLoading}
              onClick={() => handleSearchMaps(undefined, preset)}
              className="text-xs px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              {preset}
            </button>
          ))}
        </div>

        {mapsError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            {mapsError}
          </div>
        )}

        {mapsResult && (
          <div className="space-y-4 pt-2 border-t border-slate-100">
            {mapsResult.text && (
              <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-lg p-4">
                {mapsResult.text}
              </div>
            )}

            {mapsResult.places.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {mapsResult.places.map((place, idx) => (
                  <a
                    key={`${place.uri}_${idx}`}
                    href={place.uri}
                    target="_blank"
                    rel="noreferrer"
                    className="border border-slate-200 hover:border-teal-600 rounded-lg p-3.5 space-y-2 transition-colors bg-white block"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 leading-snug">
                        {place.title}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
                    </div>
                    {place.snippets.length > 0 && (
                      <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                        {place.snippets[0]}
                      </p>
                    )}
                    <div className="text-[11px] font-medium text-teal-800">
                      فتح الموقع في خرائط جوجل
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
