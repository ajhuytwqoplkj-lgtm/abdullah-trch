import React, { useState } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Maximize2,
  Plus,
  Send,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AgentProfile, DailyMission } from '../types/agent';
import {
  BrowserNotificationSupport,
  getMinutesFromNowHHMM,
} from '../utils/notifications';
import { VoiceTranscribeButton } from './VoiceTranscribeButton';

interface FollowUpCoachViewProps {
  profile: AgentProfile;
  missions: DailyMission[];
  activeMissionId: string | null;
  notificationStatus: BrowserNotificationSupport;
  soundEnabled: boolean;
  onRequestNotificationPermission: () => Promise<void>;
  onTestNotification: () => Promise<void>;
  onToggleSound: () => void;
  onEnterFocusMode: (missionId: string, stepId?: string) => void;
  onSelectMission: (id: string) => void;
  onAddMission: (mission: DailyMission) => void;
  onUpdateMission: (mission: DailyMission) => void;
  onDeleteMission: (id: string) => void;
}

const GOAL_TEMPLATES = [
  'إطلاق منتج جديد وتصوير ٣ فيديوهات قصيرة له اليوم',
  'البحث عن ٣ موردين موثوقين وحساب تكلفة استيراد أول ١٠٠ قطعة',
  'بناء خطة محتوى ومبيعات لأسبوع كامل في متجري الإلكتروني',
];

function getStatusLabel(status: BrowserNotificationSupport): string {
  switch (status) {
    case 'granted':
      return 'تنبيهات المتصفح مفعّلة';
    case 'denied':
      return 'محظورة من إعدادات المتصفح (التنبيهات الداخلية نشطة)';
    case 'unsupported':
      return 'المتصفح لا يدعم إشعارات النظام (التنبيهات الداخلية نشطة)';
    default:
      return 'بانتظار السماح بتنبيهات المتصفح';
  }
}

export const FollowUpCoachView: React.FC<FollowUpCoachViewProps> = ({
  profile,
  missions,
  activeMissionId,
  notificationStatus,
  soundEnabled,
  onRequestNotificationPermission,
  onTestNotification,
  onToggleSound,
  onEnterFocusMode,
  onSelectMission,
  onAddMission,
  onUpdateMission,
  onDeleteMission,
}) => {
  const [goalInput, setGoalInput] = useState('');
  const [checkinInput, setCheckinInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [testingNotice, setTestingNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeMission = missions.find((m) => m.id === activeMissionId) ?? missions[0] ?? null;

  const handleCreateMission = async (goalOverride?: string) => {
    const targetGoal = (goalOverride ?? goalInput).trim();
    if (!targetGoal) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/agent/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'create_plan',
          goalTitle: targetGoal,
          niche: profile.niche,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر إنشاء خطة المتابعة');
      }
      const newMission: DailyMission = {
        id: `mis_${Date.now()}`,
        goalTitle: targetGoal,
        createdAt: new Date().toISOString(),
        steps: (data.steps ?? []).map(
          (s: { title: string; detail: string; estimatedMinutes: number }, i: number) => ({
            id: `step_${Date.now()}_${i}`,
            title: s.title,
            detail: s.detail,
            estimatedMinutes: s.estimatedMinutes || 20,
            completed: false,
          })
        ),
        agentAdvice: data.agentAdvice || '',
        nextQuestion: data.nextQuestion || '',
      };
      onAddMission(newMission);
      setGoalInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء إنشاء الخطة');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStep = (stepId: string) => {
    if (!activeMission) return;
    const updated: DailyMission = {
      ...activeMission,
      steps: activeMission.steps.map((s) =>
        s.id === stepId ? { ...s, completed: !s.completed } : s
      ),
    };
    onUpdateMission(updated);
  };

  const handleUpdateStepReminder = (stepId: string, reminderTime?: string) => {
    if (!activeMission) return;
    const updated: DailyMission = {
      ...activeMission,
      steps: activeMission.steps.map((s) =>
        s.id === stepId
          ? {
              ...s,
              reminderTime: reminderTime || undefined,
              lastNotifiedDate: undefined,
            }
          : s
      ),
    };
    onUpdateMission(updated);
  };

  const handleTestClick = async () => {
    setTestingNotice(true);
    await onTestNotification();
    setTimeout(() => setTestingNotice(false), 600);
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMission || !checkinInput.trim()) return;
    setCheckingIn(true);
    setError(null);
    try {
      const res = await fetch('/api/agent/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'checkin',
          goalTitle: activeMission.goalTitle,
          steps: activeMission.steps.map((s) => ({ title: s.title, completed: s.completed })),
          userUpdate: checkinInput.trim(),
          niche: profile.niche,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر تحديث المتابعة');
      }
      const nextSteps = [...activeMission.steps];
      if (data.suggestedExtraStep?.title) {
        nextSteps.push({
          id: `step_${Date.now()}_extra`,
          title: data.suggestedExtraStep.title,
          detail: data.suggestedExtraStep.detail || '',
          estimatedMinutes: data.suggestedExtraStep.estimatedMinutes || 15,
          completed: false,
        });
      }
      onUpdateMission({
        ...activeMission,
        steps: nextSteps,
        agentAdvice: data.agentAdvice || activeMission.agentAdvice,
        nextQuestion: data.nextQuestion || activeMission.nextQuestion,
      });
      setCheckinInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء المتابعة');
    } finally {
      setCheckingIn(false);
    }
  };

  const completedCount = activeMission
    ? activeMission.steps.filter((s) => s.completed).length
    : 0;
  const totalCount = activeMission ? activeMission.steps.length : 0;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const scheduledCount = missions.reduce(
    (acc, m) => acc + m.steps.filter((s) => !s.completed && Boolean(s.reminderTime)).length,
    0
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">المتابعة اليومية خطوة بخطوة</h1>
        <p className="text-sm text-slate-600">
          حدد هدفك اليومي ليقسمه الوكيل إلى خطوات متسلسلة، واضبط موعد التنبيه لكل خطوة ليصلك
          إشعار دفع في المتصفح في وقتها المحدد.
        </p>
      </header>

      {/* Browser Push Notification Control Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-slate-100 text-teal-700 shrink-0">
            {notificationStatus === 'denied' ? (
              <BellOff className="w-4 h-4 text-amber-700" />
            ) : (
              <BellRing className="w-4 h-4" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="text-sm font-semibold text-slate-900">
              تنبيهات المواعيد اليومية داخل المتصفح
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span
                className={
                  notificationStatus === 'granted'
                    ? 'text-teal-800 font-medium'
                    : notificationStatus === 'denied'
                    ? 'text-amber-800 font-medium'
                    : 'text-slate-600'
                }
              >
                {getStatusLabel(notificationStatus)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">التنبيهات المجدولة النشطة: {scheduledCount}</span>
            </div>
            {notificationStatus === 'denied' && (
              <p className="text-xs text-slate-500 pt-0.5">
                لتفعيل إشعارات سطح المكتب، اسمح بالإشعارات من أيقونة الأذونات بجانب شريط عنوان
                المتصفح؛ ستستمر التنبيهات الفورية بالظهور داخل التطبيق تلقائياً.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {notificationStatus === 'default' && (
            <button
              type="button"
              onClick={onRequestNotificationPermission}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>تفعيل تنبيهات المتصفح</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleTestClick}
            disabled={testingNotice}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <BellRing className="w-3.5 h-3.5 text-teal-700" />
            <span>{testingNotice ? 'تم إرسال التنبيه' : 'اختبار التنبيه الآن'}</span>
          </button>
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'كتم صوت التنبيه' : 'تفعيل صوت التنبيه'}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-teal-700" />
                <span>الصوت مفعّل</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                <span>صامت</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* New Goal Form */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateMission();
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              placeholder="اكتب هدفك لليوم (مثال: تجهيز حملة فيديو وإيجاد مورد لمنتج جديد)..."
              className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
            />
            <VoiceTranscribeButton
              onTranscribed={(text) =>
                setGoalInput((prev) => (prev ? `${prev} ${text}` : text))
              }
            />
          </div>
          <button
            type="submit"
            disabled={creating || !goalInput.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري التقسيم...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>أنشئ خطة متابعة</span>
              </>
            )}
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">قوالب سريعة:</span>
          {GOAL_TEMPLATES.map((tpl) => (
            <button
              key={tpl}
              type="button"
              disabled={creating}
              onClick={() => handleCreateMission(tpl)}
              className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              {tpl}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            {error}
          </div>
        )}
      </section>

      {/* Main Mission Workspace */}
      {activeMission ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Missions List Sidebar */}
          {missions.length > 1 && (
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <h2 className="text-xs font-semibold text-slate-500 px-2 pb-1">
                المهام المحفوظة ({missions.length})
              </h2>
              <div className="space-y-1">
                {missions.map((m) => {
                  const done = m.steps.filter((s) => s.completed).length;
                  const isActive = m.id === activeMission.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between gap-2 p-2.5 rounded-lg transition-colors ${
                        isActive ? 'bg-teal-50 text-teal-950' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectMission(m.id)}
                        className="flex-1 text-right text-xs font-medium truncate cursor-pointer"
                      >
                        {m.goalTitle}
                      </button>
                      <span className="text-xs text-slate-500 tabular-nums shrink-0">
                        {done}/{m.steps.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteMission(m.id)}
                        aria-label="حذف المهمة"
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Mission Details */}
          <div
            className={`${
              missions.length > 1 ? 'lg:col-span-8' : 'lg:col-span-12'
            } space-y-6`}
          >
            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-slate-900">{activeMission.goalTitle}</h2>
                  <p className="text-xs text-slate-500 tabular-nums">
                    تم إنجاز {completedCount} من {totalCount} خطوات ({progressPct}%)
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-32 sm:w-36 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-600 transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onEnterFocusMode(activeMission.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>وضع التركيز</span>
                  </button>
                </div>
              </div>

              {/* Ordered Steps with Per-Step Notification Scheduler */}
              <div className="divide-y divide-slate-100">
                {activeMission.steps.map((step, index) => (
                  <div
                    key={step.id}
                    className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleStep(step.id)}
                      className="flex-1 text-right flex items-start gap-3.5 group cursor-pointer"
                    >
                      <span className="mt-0.5 text-teal-700 shrink-0">
                        {step.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-teal-700" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-300 group-hover:text-teal-600" />
                        )}
                      </span>
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-sm font-semibold ${
                              step.completed ? 'line-through text-slate-400' : 'text-slate-900'
                            }`}
                          >
                            {index + 1}. {step.title}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500 tabular-nums">
                            <Clock className="w-3.5 h-3.5" />
                            {step.estimatedMinutes} دقيقة
                          </span>
                        </div>
                        <p
                          className={`text-xs leading-relaxed ${
                            step.completed ? 'text-slate-400' : 'text-slate-600'
                          }`}
                        >
                          {step.detail}
                        </p>
                      </div>
                    </button>

                    {/* Reminder Time & Focus Controls */}
                    {!step.completed && (
                      <div className="flex items-center gap-1.5 pr-8 sm:pr-0 shrink-0">
                        <button
                          type="button"
                          onClick={() => onEnterFocusMode(activeMission.id, step.id)}
                          title="بدء وضع التركيز لهذه الخطوة"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Maximize2 className="w-3 h-3" />
                          <span>تركيز</span>
                        </button>
                        <label
                          htmlFor={`rem-${step.id}`}
                          className="sr-only"
                        >
                          موعد التنبيه للخطوة {index + 1}
                        </label>
                        <input
                          id={`rem-${step.id}`}
                          type="time"
                          value={step.reminderTime || ''}
                          onChange={(e) =>
                            handleUpdateStepReminder(step.id, e.target.value)
                          }
                          aria-label={`تحديد موعد التنبيه للخطوة ${index + 1}`}
                          className={`px-2 py-1 text-xs rounded-lg border tabular-nums focus:outline-none focus:border-teal-600 ${
                            step.reminderTime
                              ? 'bg-teal-50 border-teal-600 text-teal-900 font-medium'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        />
                        {!step.reminderTime ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateStepReminder(
                                step.id,
                                getMinutesFromNowHHMM(1)
                              )
                            }
                            title="جدولة تنبيه بعد دقيقة واحدة"
                            className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap tabular-nums"
                          >
                            +١ د
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUpdateStepReminder(step.id, undefined)}
                            aria-label="إلغاء التنبيه"
                            className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Interactive Coach Check-in */}
            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">
                  توجيه {profile.agentName} للخطوة الحالية
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {activeMission.agentAdvice}
                </p>
                {activeMission.nextQuestion && (
                  <p className="text-xs font-medium text-teal-800 pt-1">
                    سؤال المتابعة: {activeMission.nextQuestion}
                  </p>
                )}
              </div>

              <form
                onSubmit={handleCheckIn}
                className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100"
              >
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={checkinInput}
                    onChange={(e) => setCheckinInput(e.target.value)}
                    placeholder="أخبر الوكيل أين وصلت أو ما العقبة التي واجهتك..."
                    className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                  />
                  <VoiceTranscribeButton
                    onTranscribed={(text) =>
                      setCheckinInput((prev) => (prev ? `${prev} ${text}` : text))
                    }
                  />
                </div>
                <button
                  type="submit"
                  disabled={checkingIn || !checkinInput.trim()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {checkingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري التوجيه...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>أرسل التحديث</span>
                    </>
                  )}
                </button>
              </form>
            </section>
          </div>
        </div>
      ) : (
        <section className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
          <h2 className="text-base font-semibold text-slate-900">لا توجد خطة متابعة نشطة حالياً</h2>
          <p className="text-xs text-slate-500">
            اكتب هدفك في الحقل أعلاه أو اختر أحد القوالب السريعة ليبدأ الوكيل بمرافقتك خطوة بخطوة.
          </p>
        </section>
      )}
    </div>
  );
};
