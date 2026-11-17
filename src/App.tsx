import React, { useCallback, useEffect, useState } from 'react';
import {
  BellRing,
  Box,
  Check,
  CheckSquare,
  Compass,
  Film,
  Layers,
  Lightbulb,
  MessageSquare,
  Ship,
  Sparkles,
  X,
} from 'lucide-react';
import {
  AgentBlueprint,
  AgentProfile,
  ChatMessage,
  DailyIdea,
  DailyMission,
  GeneratedVideoClip,
  ImportPlan,
  ModuleId,
  ProductsSearchResult,
  ScheduledAlert,
  VideoPackage,
} from './types/agent';
import { AgentArchitectView } from './components/AgentArchitectView';
import { FollowUpCoachView } from './components/FollowUpCoachView';
import { VideoStudioView } from './components/VideoStudioView';
import { ImportSourcingView } from './components/ImportSourcingView';
import { ProductsDiscoveryView } from './components/ProductsDiscoveryView';
import { IdeasLabView } from './components/IdeasLabView';
import { AgentChatView } from './components/AgentChatView';
import { ThreeDProductStudioView } from './components/ThreeDProductStudioView';
import { ProfileModal } from './components/ProfileModal';
import { FocusModeView } from './components/FocusModeView';
import {
  BrowserNotificationSupport,
  dispatchBrowserNotification,
  getCurrentTimeHHMM,
  getNotificationStatus,
  getTodayDateKey,
  playAlertChime,
  registerNotificationWorker,
  requestBrowserNotificationPermission,
} from './utils/notifications';

const STORAGE_KEYS = {
  profile: 'sanad_agent_profile_v1',
  blueprint: 'sanad_agent_blueprint_v1',
  missions: 'sanad_agent_missions_v1',
  videos: 'sanad_agent_videos_v1',
  clips: 'sanad_agent_clips_v1',
  imports: 'sanad_agent_imports_v1',
  products: 'sanad_agent_products_v1',
  ideas: 'sanad_agent_ideas_v1',
  chat: 'sanad_agent_chat_v1',
  sound: 'sanad_agent_sound_v1',
};

const DEFAULT_PROFILE: AgentProfile = {
  agentName: 'سَند',
  ownerName: 'رائد الأعمال',
  niche: 'التجارة الإلكترونية والمنتجات الذكية',
  targetCountry: 'السعودية والخليج',
  currency: 'SAR',
  budgetTier: 'متوسطة (500$ - 2000$)',
  dailyHours: 'ساعتان يومياً',
};

const STARTER_MISSION: DailyMission = {
  id: 'mis_starter_1',
  goalTitle: 'تشغيل وكيلي الذكي وإطلاق أول منتج وفيديو تسويقي خلال اليوم',
  createdAt: new Date().toISOString(),
  steps: [
    {
      id: 'st_1',
      title: 'تخصيص بيانات مشروعك ومجالك',
      detail: 'اضغط على «تخصيص الوكيل» وحدد المجال التجاري والسوق المستهدف والميزانية.',
      estimatedMinutes: 5,
      completed: false,
    },
    {
      id: 'st_2',
      title: 'توليد مخطط الوكيل وتعليمات النظام',
      detail: 'افتح قسم «دليل البناء» واضغط على «صمّم مخطط وكيلي المخصص» للحصول على البرومبت والجدول اليومي.',
      estimatedMinutes: 10,
      completed: false,
    },
    {
      id: 'st_3',
      title: 'اختيار منتج جديد من مكتشف المنتجات',
      detail: 'ابحث عن منتج يحل مشكلة واضحة، ثم اضغط «احسب تكلفة الاستيراد» لمعرفة الهامش المتوقع.',
      estimatedMinutes: 15,
      completed: false,
    },
    {
      id: 'st_4',
      title: 'توليد سيناريو ومشاهد أول فيديو',
      detail: 'أرسل المنتج إلى استوديو الفيديو واحصل على ٣ خطافات افتتاحية وأوامر التصوير بالذكاء الاصطناعي.',
      estimatedMinutes: 20,
      completed: false,
    },
  ],
  agentAdvice:
    'ابدأ بالخطوة الأولى لمدة ٥ دقائق فقط لتثبيت بيانات السوق والعملة؛ بعدها ستعمل كل أدوات الفيديو والاستيراد والمنتجات بناءً على وضعك الحقيقي.',
  nextQuestion: 'هل انتهيت من ضبط مجال مشروعك والسوق المستهدف أم تحتاج مساعدة في اختياره؟',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>('blueprint');
  const [profile, setProfile] = useState<AgentProfile>(() =>
    loadFromStorage(STORAGE_KEYS.profile, DEFAULT_PROFILE)
  );
  const [blueprint, setBlueprint] = useState<AgentBlueprint | null>(() =>
    loadFromStorage(STORAGE_KEYS.blueprint, null)
  );
  const [missions, setMissions] = useState<DailyMission[]>(() =>
    loadFromStorage(STORAGE_KEYS.missions, [STARTER_MISSION])
  );
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoPackage[]>(() =>
    loadFromStorage(STORAGE_KEYS.videos, [])
  );
  const [clips, setClips] = useState<GeneratedVideoClip[]>(() =>
    loadFromStorage(STORAGE_KEYS.clips, [])
  );
  const [importPlans, setImportPlans] = useState<ImportPlan[]>(() =>
    loadFromStorage(STORAGE_KEYS.imports, [])
  );
  const [productsResult, setProductsResult] = useState<ProductsSearchResult | null>(() =>
    loadFromStorage(STORAGE_KEYS.products, null)
  );
  const [ideas, setIdeas] = useState<DailyIdea[]>(() =>
    loadFromStorage(STORAGE_KEYS.ideas, [])
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() =>
    loadFromStorage(STORAGE_KEYS.chat, [])
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() =>
    loadFromStorage(STORAGE_KEYS.sound, true)
  );

  const [notificationStatus, setNotificationStatus] = useState<BrowserNotificationSupport>(() =>
    getNotificationStatus()
  );
  const [activeAlerts, setActiveAlerts] = useState<ScheduledAlert[]>([]);
  const [focusTarget, setFocusTarget] = useState<{
    missionId: string;
    stepId: string;
  } | null>(null);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [videoPrefill, setVideoPrefill] = useState('');
  const [importPrefill, setImportPrefill] = useState('');
  const [emblemError, setEmblemError] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.blueprint, JSON.stringify(blueprint));
  }, [blueprint]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.missions, JSON.stringify(missions));
  }, [missions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.videos, JSON.stringify(videos));
  }, [videos]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.clips, JSON.stringify(clips.slice(0, 6)));
    } catch {
      // Ignore quota exceeded for large base64 video clips
    }
  }, [clips]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.imports, JSON.stringify(importPlans));
  }, [importPlans]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(productsResult));
  }, [productsResult]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ideas, JSON.stringify(ideas));
  }, [ideas]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.chat, JSON.stringify(chatMessages.slice(-60)));
  }, [chatMessages]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sound, JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    setNotificationStatus(getNotificationStatus());
    if (getNotificationStatus() === 'granted') {
      registerNotificationWorker();
    }
  }, []);

  const handleRequestNotificationPermission = useCallback(async () => {
    const status = await requestBrowserNotificationPermission();
    setNotificationStatus(status);
  }, []);

  const handleTestNotification = useCallback(async () => {
    const nowTime = getCurrentTimeHHMM();
    const agentLabel = profile.agentName || 'سَند';
    if (soundEnabled) {
      playAlertChime();
    }
    await dispatchBrowserNotification({
      title: `تذكير تجريبي من وكيل ${agentLabel}`,
      body: 'نظام التنبيهات اليومية يعمل بنجاح؛ سيصلك إشعار عند حلول موعد كل خطوة مجدولة.',
      tag: 'sanad-test-notification',
    });
    setActiveAlerts((prev) => [
      {
        id: `alert_test_${Date.now()}`,
        missionId: missions[0]?.id ?? '',
        missionTitle: 'اختبار نظام التنبيهات',
        stepId: '',
        stepTitle: 'التنبيهات الفورية جاهزة للعمل',
        stepDetail: 'ستظهر تنبيهاتك المجدولة هنا وفي إشعارات المتصفح عند حلول وقتها.',
        scheduledTime: nowTime,
        firedAt: new Date().toISOString(),
      },
      ...prev.slice(0, 3),
    ]);
  }, [missions, profile.agentName, soundEnabled]);

  // Background scheduler checking scheduled task reminders every 10 seconds
  useEffect(() => {
    const checkDueReminders = () => {
      const nowHHMM = getCurrentTimeHHMM();
      const todayKey = getTodayDateKey();
      const dueAlerts: ScheduledAlert[] = [];
      let changed = false;

      const updatedMissions = missions.map((mission) => {
        const updatedSteps = mission.steps.map((step) => {
          if (
            !step.completed &&
            step.reminderTime &&
            step.reminderTime === nowHHMM &&
            step.lastNotifiedDate !== todayKey
          ) {
            changed = true;
            dueAlerts.push({
              id: `alert_${mission.id}_${step.id}_${Date.now()}`,
              missionId: mission.id,
              missionTitle: mission.goalTitle,
              stepId: step.id,
              stepTitle: step.title,
              stepDetail: step.detail,
              scheduledTime: step.reminderTime,
              firedAt: new Date().toISOString(),
            });
            return {
              ...step,
              lastNotifiedDate: todayKey,
            };
          }
          return step;
        });
        return { ...mission, steps: updatedSteps };
      });

      if (changed) {
        setMissions(updatedMissions);
        if (soundEnabled) {
          playAlertChime();
        }
        dueAlerts.forEach((alert) => {
          dispatchBrowserNotification({
            title: `موعد مهمتك (${alert.scheduledTime}): ${alert.stepTitle}`,
            body: `${alert.missionTitle} — ${alert.stepDetail}`,
            tag: `step-${alert.stepId}-${todayKey}`,
          });
        });
        setActiveAlerts((prev) => [...dueAlerts, ...prev].slice(0, 4));
      }
    };

    checkDueReminders();
    const timer = window.setInterval(checkDueReminders, 10_000);
    return () => window.clearInterval(timer);
  }, [missions, soundEnabled]);

  const handleDismissAlert = (alertId: string) => {
    setActiveAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  const handleCompleteStepFromAlert = (alert: ScheduledAlert) => {
    if (alert.missionId && alert.stepId) {
      setMissions((prev) =>
        prev.map((m) =>
          m.id === alert.missionId
            ? {
                ...m,
                steps: m.steps.map((s) =>
                  s.id === alert.stepId ? { ...s, completed: true } : s
                ),
              }
            : m
        )
      );
    }
    handleDismissAlert(alert.id);
  };

  const handleOpenMissionFromAlert = (alert: ScheduledAlert) => {
    if (alert.missionId) {
      setActiveMissionId(alert.missionId);
    }
    setFocusTarget(null);
    setActiveModule('followup');
    handleDismissAlert(alert.id);
  };

  const handleEnterFocusMode = (missionId: string, stepId?: string) => {
    const mission = missions.find((m) => m.id === missionId);
    if (!mission || mission.steps.length === 0) return;
    const chosenStep =
      (stepId ? mission.steps.find((s) => s.id === stepId) : undefined) ??
      mission.steps.find((s) => !s.completed) ??
      mission.steps[0];
    if (!chosenStep) return;
    setActiveMissionId(mission.id);
    setFocusTarget({ missionId: mission.id, stepId: chosenStep.id });
  };

  const handleCompleteAndAdvanceFromFocus = (completedStepId: string) => {
    if (!focusTarget) return;
    const currentMission = missions.find((m) => m.id === focusTarget.missionId);
    if (!currentMission) return;

    const updatedSteps = currentMission.steps.map((s) =>
      s.id === completedStepId ? { ...s, completed: true } : s
    );
    const updatedMission: DailyMission = {
      ...currentMission,
      steps: updatedSteps,
    };

    setMissions((prev) =>
      prev.map((m) => (m.id === updatedMission.id ? updatedMission : m))
    );

    const currentIdx = updatedSteps.findIndex((s) => s.id === completedStepId);
    const nextUncompletedAfter =
      updatedSteps.slice(currentIdx + 1).find((s) => !s.completed) ??
      updatedSteps.find((s) => !s.completed);

    if (nextUncompletedAfter) {
      setFocusTarget({
        missionId: updatedMission.id,
        stepId: nextUncompletedAfter.id,
      });
    }
  };

  const navItems: Array<{
    id: ModuleId;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    count?: number;
  }> = [
    {
      id: 'blueprint',
      label: 'دليل إنشاء الوكيل',
      shortLabel: 'دليل البناء',
      icon: <Layers className="w-4 h-4" />,
    },
    {
      id: 'followup',
      label: 'المتابعة خطوة بخطوة',
      shortLabel: 'المتابعة',
      icon: <CheckSquare className="w-4 h-4" />,
      count: missions.length,
    },
    {
      id: 'video',
      label: 'استوديو الفيديوهات (١-٧ د)',
      shortLabel: 'الفيديوهات',
      icon: <Film className="w-4 h-4" />,
      count: videos.length + clips.length || undefined,
    },
    {
      id: 'import',
      label: 'الاستيراد والخرائط',
      shortLabel: 'الاستيراد',
      icon: <Ship className="w-4 h-4" />,
      count: importPlans.length || undefined,
    },
    {
      id: 'chat',
      label: 'محادثة الوكيل الذكي',
      shortLabel: 'المحادثة',
      icon: <MessageSquare className="w-4 h-4" />,
      count: chatMessages.length || undefined,
    },
    {
      id: 'studio3d',
      label: 'معاينة المنتج ثلاثي الأبعاد',
      shortLabel: 'ثلاثي الأبعاد',
      icon: <Box className="w-4 h-4" />,
    },
    {
      id: 'products',
      label: 'منتجات جديدة',
      shortLabel: 'المنتجات',
      icon: <Compass className="w-4 h-4" />,
      count: productsResult?.products.length || undefined,
    },
    {
      id: 'ideas',
      label: 'أفكار جديدة',
      shortLabel: 'الأفكار',
      icon: <Lightbulb className="w-4 h-4" />,
      count: ideas.length || undefined,
    },
  ];

  const handleSendToVideo = (productName: string) => {
    setVideoPrefill(productName);
    setActiveModule('video');
  };

  const handleSendToImport = (productName: string) => {
    setImportPrefill(productName);
    setActiveModule('import');
  };

  const handleConvertIdeaToMission = async (goalTitle: string) => {
    setActiveModule('followup');
    try {
      const res = await fetch('/api/agent/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'create_plan',
          goalTitle,
          niche: profile.niche,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const newMission: DailyMission = {
        id: `mis_${Date.now()}`,
        goalTitle,
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
      setMissions((prev) => [newMission, ...prev]);
      setActiveMissionId(newMission.id);
    } catch {
      // User is already on FollowUpCoachView and can retry if needed
    }
  };

  const scheduledRemindersCount = missions.reduce(
    (acc, m) => acc + m.steps.filter((s) => !s.completed && Boolean(s.reminderTime)).length,
    0
  );

  const focusedMission = focusTarget
    ? missions.find((m) => m.id === focusTarget.missionId) ?? null
    : null;

  const activeAlertsOverlay =
    activeAlerts.length > 0 ? (
      <div
        aria-live="polite"
        className="fixed bottom-4 left-4 right-4 sm:right-auto sm:w-96 z-50 space-y-2.5"
      >
        {activeAlerts.map((alert) => (
          <div
            key={alert.id}
            className="bg-white border border-slate-300 shadow-lg rounded-xl p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700 shrink-0 mt-0.5">
                  <BellRing className="w-4 h-4" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 text-[11px] text-teal-800 font-medium tabular-nums">
                    <span>موعد المهمة {alert.scheduledTime}</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">
                    {alert.stepTitle}
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {alert.stepDetail}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDismissAlert(alert.id)}
                aria-label="إغلاق التنبيه"
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
              {alert.stepId && (
                <button
                  type="button"
                  onClick={() => handleCompleteStepFromAlert(alert)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>تم التنفيذ</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleOpenMissionFromAlert(alert)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                فتح المتابعة
              </button>
            </div>
          </div>
        ))}
      </div>
    ) : null;

  if (focusTarget && focusedMission) {
    return (
      <>
        <FocusModeView
          mission={focusedMission}
          stepId={focusTarget.stepId}
          soundEnabled={soundEnabled}
          onSelectStep={(nextStepId) =>
            setFocusTarget({ missionId: focusedMission.id, stepId: nextStepId })
          }
          onCompleteAndAdvance={handleCompleteAndAdvanceFromFocus}
          onExit={() => setFocusTarget(null)}
        />
        {activeAlertsOverlay}
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="bg-white border-b border-slate-200 px-4 lg:px-8 py-3.5 flex items-center justify-between gap-8">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveModule('blueprint');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          {profile.agentName || 'سَند'}
        </a>

        <nav
          aria-label="التنقل الرئيسي"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          {navItems.slice(0, 5).map((item) => {
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModule(item.id)}
                className={`whitespace-nowrap shrink-0 pb-0.5 border-b-2 transition-colors cursor-pointer ${
                  active
                    ? 'text-slate-900 border-teal-700 font-semibold'
                    : 'border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.shortLabel}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            تخصيص الوكيل
          </button>
        </div>
      </header>

      {/* Mobile Module Switcher */}
      <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-2.5 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {navItems.map((item) => {
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModule(item.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-teal-700 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {item.icon}
                <span>{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-4 lg:px-8 py-6 lg:py-8 flex flex-col lg:flex-row gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex lg:w-64 shrink-0 flex-col gap-6">
          {/* Agent Identity Summary */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
              {!emblemError ? (
                <img
                  src="/src/assets/images/agent_core_emblem_1794942432249.jpg"
                  alt="شعار الوكيل الذكي"
                  referrerPolicy="no-referrer"
                  onError={() => setEmblemError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-teal-700">
                  <Sparkles className="w-5 h-5" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 truncate">
                وكيل {profile.agentName}
              </div>
              <div className="text-xs text-slate-500 truncate">{profile.niche}</div>
              <div className="text-[11px] text-teal-800 truncate">{profile.targetCountry}</div>
            </div>
          </div>

          {/* Navigation List */}
          <nav
            aria-label="أقسام الوكيل"
            className="bg-white border border-slate-200 rounded-xl p-2 space-y-1"
          >
            {navItems.map((item) => {
              const active = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveModule(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-teal-50 text-teal-950 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <span className={active ? 'text-teal-700' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Daily Summary Note */}
          <div className="border-t border-slate-200 pt-4 px-2 space-y-1.5 text-xs text-slate-500">
            <div className="font-semibold text-slate-700">ملخص يومك</div>
            <p className="leading-relaxed">
              الوقت المخصص: <span className="text-slate-800">{profile.dailyHours}</span>
            </p>
            <p className="leading-relaxed">
              الميزانية: <span className="text-slate-800">{profile.budgetTier}</span>
            </p>
            <p className="leading-relaxed tabular-nums">
              تنبيهات مجدولة: <span className="text-teal-800 font-medium">{scheduledRemindersCount}</span>
            </p>
          </div>
        </aside>

        {/* Active Module Viewport */}
        <main className="flex-1 min-w-0">
          {activeModule === 'blueprint' && (
            <AgentArchitectView
              profile={profile}
              blueprint={blueprint}
              onSaveBlueprint={setBlueprint}
              onNavigate={setActiveModule}
              onOpenProfileModal={() => setIsProfileOpen(true)}
            />
          )}

          {activeModule === 'followup' && (
            <FollowUpCoachView
              profile={profile}
              missions={missions}
              activeMissionId={activeMissionId}
              notificationStatus={notificationStatus}
              soundEnabled={soundEnabled}
              onRequestNotificationPermission={handleRequestNotificationPermission}
              onTestNotification={handleTestNotification}
              onToggleSound={() => setSoundEnabled((prev) => !prev)}
              onEnterFocusMode={handleEnterFocusMode}
              onSelectMission={setActiveMissionId}
              onAddMission={(mission) => {
                setMissions((prev) => [mission, ...prev]);
                setActiveMissionId(mission.id);
              }}
              onUpdateMission={(updated) => {
                setMissions((prev) =>
                  prev.map((m) => (m.id === updated.id ? updated : m))
                );
              }}
              onDeleteMission={(id) => {
                setMissions((prev) => prev.filter((m) => m.id !== id));
              }}
            />
          )}

          {activeModule === 'video' && (
            <VideoStudioView
              profile={profile}
              videos={videos}
              clips={clips}
              prefillTopic={videoPrefill}
              onClearPrefill={() => setVideoPrefill('')}
              onSaveVideo={(v) => setVideos((prev) => [v, ...prev])}
              onDeleteVideo={(id) =>
                setVideos((prev) => prev.filter((v) => v.id !== id))
              }
              onSaveClip={(clip) => setClips((prev) => [clip, ...prev])}
              onDeleteClip={(id) =>
                setClips((prev) => prev.filter((c) => c.id !== id))
              }
            />
          )}

          {activeModule === 'import' && (
            <ImportSourcingView
              profile={profile}
              plans={importPlans}
              prefillProduct={importPrefill}
              onClearPrefill={() => setImportPrefill('')}
              onSavePlan={(p) => setImportPlans((prev) => [p, ...prev])}
              onDeletePlan={(id) =>
                setImportPlans((prev) => prev.filter((p) => p.id !== id))
              }
            />
          )}

          {activeModule === 'chat' && (
            <AgentChatView
              profile={profile}
              messages={chatMessages}
              onAddMessage={(msg) => setChatMessages((prev) => [...prev, msg])}
              onClearHistory={() => setChatMessages([])}
            />
          )}

          {activeModule === 'studio3d' && <ThreeDProductStudioView />}

          {activeModule === 'products' && (
            <ProductsDiscoveryView
              profile={profile}
              result={productsResult}
              onSaveResult={setProductsResult}
              onSendToVideo={handleSendToVideo}
              onSendToImport={handleSendToImport}
            />
          )}

          {activeModule === 'ideas' && (
            <IdeasLabView
              profile={profile}
              ideas={ideas}
              onSaveIdeas={setIdeas}
              onConvertToMission={handleConvertIdeaToMission}
            />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-4 lg:px-8 mt-auto">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>{profile.agentName} — منصة بناء وتشغيل الوكيل الذكي الشخصي</span>
          <span>الفيديوهات · الاستيراد والخرائط · المحادثة · المعاينة ثلاثية الأبعاد</span>
        </div>
      </footer>

      {/* Active In-Browser Push Alerts Stack */}
      {activeAlertsOverlay}

      <ProfileModal
        isOpen={isProfileOpen}
        profile={profile}
        onClose={() => setIsProfileOpen(false)}
        onSave={setProfile}
      />
    </div>
  );
}
