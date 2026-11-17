import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Film,
  ImagePlus,
  Loader2,
  Trash2,
  Video,
} from 'lucide-react';
import { AgentProfile, GeneratedVideoClip, VideoPackage } from '../types/agent';
import { VoiceTranscribeButton } from './VoiceTranscribeButton';

interface VideoStudioViewProps {
  profile: AgentProfile;
  videos: VideoPackage[];
  clips: GeneratedVideoClip[];
  prefillTopic: string;
  onClearPrefill: () => void;
  onSaveVideo: (video: VideoPackage) => void;
  onDeleteVideo: (id: string) => void;
  onSaveClip: (clip: GeneratedVideoClip) => void;
  onDeleteClip: (id: string) => void;
}

const PLATFORMS = ['YouTube (١–٧ دقائق)', 'TikTok / Reels', 'Snapchat / محتوى تعليمي', 'إعلان مفصّل للمنتج'];
const MINUTE_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const TONES = [
  'عملي ومقنع يركز على حل المشكلة',
  'أسلوب UGC عفوي كأنه تجربة عميل',
  'فاخر ومختصر يبرز جودة المنتج',
  'تعليمي تفصيلي يزيد الثقة قبل الشراء',
];

function formatDurationLabel(mins: number): string {
  if (mins === 1) return '1 دقيقة';
  if (mins === 2) return '2 دقائق';
  return `${mins} دقائق`;
}

export const VideoStudioView: React.FC<VideoStudioViewProps> = ({
  profile,
  videos,
  clips,
  prefillTopic,
  onClearPrefill,
  onSaveVideo,
  onDeleteVideo,
  onSaveClip,
  onDeleteClip,
}) => {
  const [topic, setTopic] = useState(prefillTopic || '');
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [durationMinutes, setDurationMinutes] = useState<number>(3);
  const [tone, setTone] = useState(TONES[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(videos[0]?.id ?? null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Direct Video Render Studio (gemini-omni-1.2-flash via Interactions API)
  const [renderMode, setRenderMode] = useState<'text' | 'image'>('text');
  const [renderPrompt, setRenderPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [uploadedImageBase64, setUploadedImageBase64] = useState<string | null>(null);
  const [uploadedImageMime, setUploadedImageMime] = useState<string>('image/png');
  const [renderingClip, setRenderingClip] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (prefillTopic) {
      setTopic(prefillTopic);
      onClearPrefill();
    }
  }, [prefillTopic, onClearPrefill]);

  const activeVideo =
    videos.find((v) => v.id === selectedVideoId) ?? videos[0] ?? null;

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      setCopiedKey(null);
    }
  };

  const handleGenerateScript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/agent/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productOrTopic: topic.trim(),
          platform,
          duration: formatDurationLabel(durationMinutes),
          durationMinutes,
          tone,
          targetCountry: profile.targetCountry,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر إنتاج حزمة الفيديو');
      }
      const created = data as VideoPackage;
      onSaveVideo(created);
      setSelectedVideoId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء توليد الفيديو');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = dataUrl.indexOf(',');
      if (commaIdx >= 0) {
        setUploadedImagePreview(dataUrl);
        setUploadedImageBase64(dataUrl.slice(commaIdx + 1));
        setUploadedImageMime(file.type || 'image/png');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRenderVideoClip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renderPrompt.trim()) return;
    if (renderMode === 'image' && !uploadedImageBase64) {
      setRenderError('يرجى رفع صورة أولاً لتحريكها إلى فيديو.');
      return;
    }
    setRenderingClip(true);
    setRenderError(null);
    try {
      const res = await fetch('/api/agent/video-render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: renderMode,
          prompt: renderPrompt.trim(),
          aspectRatio,
          imageBase64: renderMode === 'image' ? uploadedImageBase64 : undefined,
          imageMimeType: renderMode === 'image' ? uploadedImageMime : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر توليد مقطع الفيديو');
      }
      onSaveClip(data as GeneratedVideoClip);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : 'حدث خطأ أثناء توليد المقطع');
    } finally {
      setRenderingClip(false);
    }
  };

  const handleUseScenePrompt = (promptText: string) => {
    setRenderMode('text');
    setRenderPrompt(promptText);
    const el = document.getElementById('omni-video-studio');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">استوديو إنتاج الفيديوهات (١ – ٧ دقائق)</h1>
        <p className="text-sm text-slate-600">
          أنشئ سيناريوهات وفصول فيديوهات كاملة من دقيقة إلى ٧ دقائق، وحوّل النصوص أو الصور
          المرفوعة إلى مقاطع فيديو فعلية بنسبة ١٦:٩ أو ٩:١٦.
        </p>
      </header>

      {/* 1. Script & Storyboard Generator (1 to 7 Minutes) */}
      <form
        onSubmit={handleGenerateScript}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="video-topic" className="block text-xs font-semibold text-slate-700">
              المنتج أو موضوع الفيديو
            </label>
            <VoiceTranscribeButton
              label="إملاء صوتي"
              onTranscribed={(txt) =>
                setTopic((prev) => (prev ? `${prev} ${txt}` : txt))
              }
              onError={(msg) => setError(msg)}
              disabled={loading}
            />
          </div>
          <input
            id="video-topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="مثال: مراجعة شاملة لفواحة السيارة الذكية أو شرح خطوات الاستيراد من الصين..."
            className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
          />
        </div>

        {/* Duration Slider / Buttons (1 to 7 Minutes) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">مدة الفيديو (من ١ إلى ٧ دقائق)</span>
            <span className="font-semibold text-teal-800 tabular-nums">
              {formatDurationLabel(durationMinutes)}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {MINUTE_OPTIONS.map((mins) => {
              const active = durationMinutes === mins;
              return (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMinutes(mins)}
                  className={`py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer tabular-nums ${
                    active
                      ? 'bg-teal-700 border-teal-700 text-white font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {mins} د
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="video-platform" className="block text-xs font-semibold text-slate-700">
              المنصة
            </label>
            <select
              id="video-platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="video-tone" className="block text-xs font-semibold text-slate-700">
              أسلوب الفيديو
            </label>
            <select
              id="video-tone"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
            >
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 pt-1">
          <span className="text-xs text-slate-500">
            السوق المستهدف: {profile.targetCountry}
          </span>
          <button
            type="submit"
            disabled={loading || !topic.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري إعداد مشاهد الفيديو...</span>
              </>
            ) : (
              <>
                <Film className="w-4 h-4" />
                <span>أنشئ خطة فيديو ({formatDurationLabel(durationMinutes)})</span>
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

      {/* 2. Direct Text-to-Video & Image-to-Video Generator (gemini-omni-1.2-flash) */}
      <section
        id="omni-video-studio"
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              توليد مقطع فيديو فعلي (نص إلى فيديو / صورة إلى فيديو)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              يدعم نسبة ١٦:٩ (أفقي) و٩:١٦ (عمودي) عبر نموذج gemini-omni-1.2-flash.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setRenderMode('text')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                renderMode === 'text'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              من النص
            </button>
            <button
              type="button"
              onClick={() => setRenderMode('image')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                renderMode === 'image'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              تحريك صورة
            </button>
          </div>
        </div>

        <form onSubmit={handleRenderVideoClip} className="space-y-4">
          {renderMode === 'image' && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <label className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer">
                <ImagePlus className="w-4 h-4 text-teal-700" />
                <span>{uploadedImagePreview ? 'تغيير الصورة المرفوعة' : 'رفع صورة للمنتج أو المشهد'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
              {uploadedImagePreview && (
                <img
                  src={uploadedImagePreview}
                  alt="معاينة الصورة المرفوعة"
                  className="w-24 h-16 object-cover rounded-lg border border-slate-200"
                />
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="omni-prompt" className="block text-xs font-semibold text-slate-700">
                {renderMode === 'image'
                  ? 'وصف الحركة المطلوبة داخل الصورة'
                  : 'وصف المشهد المطلوب توليده'}
              </label>
              <VoiceTranscribeButton
                label="وصف صوتي"
                onTranscribed={(txt) =>
                  setRenderPrompt((prev) => (prev ? `${prev} ${txt}` : txt))
                }
                onError={(msg) => setRenderError(msg)}
                disabled={renderingClip}
              />
            </div>
            <textarea
              id="omni-prompt"
              rows={2}
              value={renderPrompt}
              onChange={(e) => setRenderPrompt(e.target.value)}
              placeholder={
                renderMode === 'image'
                  ? 'مثال: الكاميرا تدور ببطء حول المنتج مع إضاءة استوديو ناعمة...'
                  : 'مثال: لقطة سينمائية قريبة لفواحة عطرية معدنية على مكتب رخامي مع بخار خفيف...'
              }
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700">الأبعاد:</span>
              <button
                type="button"
                onClick={() => setAspectRatio('16:9')}
                className={`px-3 py-1.5 rounded-lg border cursor-pointer tabular-nums ${
                  aspectRatio === '16:9'
                    ? 'bg-teal-50 border-teal-600 text-teal-900 font-semibold'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                16:9 أفقي
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio('9:16')}
                className={`px-3 py-1.5 rounded-lg border cursor-pointer tabular-nums ${
                  aspectRatio === '9:16'
                    ? 'bg-teal-50 border-teal-600 text-teal-900 font-semibold'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                9:16 عمودي
              </button>
            </div>

            <button
              type="submit"
              disabled={renderingClip || !renderPrompt.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              {renderingClip ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري توليد الفيديو (قد يستغرق دقيقة)...</span>
                </>
              ) : (
                <>
                  <Video className="w-4 h-4" />
                  <span>توليد مقطع الفيديو الآن</span>
                </>
              )}
            </button>
          </div>

          {renderError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {renderError}
            </div>
          )}
        </form>

        {clips.length > 0 && (
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h3 className="text-xs font-semibold text-slate-500">المقاطع المولّدة</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clips.map((clip) => (
                <div
                  key={clip.id}
                  className="border border-slate-200 rounded-lg p-3 space-y-2.5"
                >
                  <video
                    controls
                    src={clip.videoSrc}
                    className="w-full max-h-64 rounded-lg bg-slate-900"
                  />
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-700 truncate">
                      {clip.mode === 'image' ? 'تحريك صورة' : 'من النص'} · {clip.aspectRatio}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={clip.videoSrc}
                        download={`sanad-clip-${clip.id}.mp4`}
                        className="inline-flex items-center gap-1 text-teal-800 hover:underline"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>تحميل</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => onDeleteClip(clip.id)}
                        aria-label="حذف المقطع"
                        className="text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Saved Video Scripts Library */}
      {videos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">الخطط المحفوظة:</span>
          {videos.map((v) => {
            const isSelected = activeVideo?.id === v.id;
            return (
              <div
                key={v.id}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${
                  isSelected
                    ? 'bg-teal-50 border-teal-600 text-teal-950 font-semibold'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedVideoId(v.id)}
                  className="cursor-pointer truncate max-w-[180px]"
                >
                  {v.title || v.productOrTopic}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteVideo(v.id)}
                  aria-label="حذف الفيديو"
                  className="text-slate-400 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Video Script Output */}
      {activeVideo ? (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{activeVideo.platform}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-teal-800">{activeVideo.duration}</span>
                <span aria-hidden="true">·</span>
                <span>{activeVideo.productOrTopic}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1">{activeVideo.title}</h2>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                خطافات البداية (Hooks)
              </h3>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {activeVideo.hooks.map((hook, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 flex items-center justify-between gap-3 text-sm text-slate-800"
                  >
                    <span>
                      <span className="font-mono text-xs text-teal-700 ml-2 tabular-nums">
                        0{idx + 1}.
                      </span>
                      {hook}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(`hook_${idx}`, hook)}
                      className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {copiedKey === `hook_${idx}` ? (
                        <Check className="w-3.5 h-3.5 text-teal-700" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === `hook_${idx}` ? 'تم' : 'نسخ'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                فصول ومشاهد الفيديو ({activeVideo.duration})
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {activeVideo.scenes.map((scene) => (
                <div key={scene.sceneNumber} className="p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <span className="font-mono text-teal-700 tabular-nums">
                        المشهد {scene.sceneNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-xs font-medium text-slate-500 tabular-nums">
                        {scene.timeRange}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUseScenePrompt(scene.aiVideoPromptEn)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>توليد مقطع للمشهد</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(`scene_${scene.sceneNumber}`, scene.aiVideoPromptEn)
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        {copiedKey === `scene_${scene.sceneNumber}` ? (
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
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="font-semibold text-slate-500">التصوير والحركة</span>
                      <p className="text-slate-800 leading-relaxed">{scene.visualDescription}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="font-semibold text-slate-500">التعليق الصوتي</span>
                      <p className="text-slate-900 font-medium leading-relaxed">
                        «{scene.arabicVoiceover}»
                      </p>
                      <p className="text-teal-800 pt-1">
                        نص الشاشة: {scene.onScreenText}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="font-semibold text-slate-500">
                        أمر توليد الفيديو (EN)
                      </span>
                      <p
                        dir="ltr"
                        className="font-mono text-[11px] leading-relaxed bg-slate-900 text-slate-100 p-3 rounded-lg text-left"
                      >
                        {scene.aiVideoPromptEn}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">النهاية والوصف للنشر</h3>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      'caption_all',
                      `${activeVideo.caption}\n\n${activeVideo.hashtags.join(' ')}`
                    )
                  }
                  className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  {copiedKey === 'caption_all' ? (
                    <Check className="w-3.5 h-3.5 text-teal-700" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>نسخ الوصف والوسوم</span>
                </button>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-semibold text-slate-500">دعوة الإجراء (CTA): </span>
                  <span className="text-slate-900 font-medium">{activeVideo.callToAction}</span>
                </div>
                <p className="text-slate-700 leading-relaxed pt-2 border-t border-slate-100">
                  {activeVideo.caption}
                </p>
                <p className="text-teal-800 pt-1">{activeVideo.hashtags.join(' ')}</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">نصائح التصوير والمونتاج</h3>
              <ul className="list-disc list-inside space-y-2 text-xs text-slate-700 leading-relaxed">
                {activeVideo.productionTips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      ) : (
        <section className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
          <h2 className="text-base font-semibold text-slate-900">لم تُنشئ خطة فيديو بعد</h2>
          <p className="text-xs text-slate-500">
            اختر المدة من ١ إلى ٧ دقائق وأدخل موضوع الفيديو ليجهز الوكيل السيناريو والمشاهد وأوامر
            التوليد.
          </p>
        </section>
      )}
    </div>
  );
};
