import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import { DailyMission, FollowUpStep } from '../types/agent';
import {
  dispatchBrowserNotification,
  playAlertChime,
} from '../utils/notifications';

interface FocusModeViewProps {
  mission: DailyMission;
  stepId: string;
  soundEnabled: boolean;
  onSelectStep: (stepId: string) => void;
  onCompleteAndAdvance: (stepId: string) => void;
  onExit: () => void;
}

function formatTimer(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const FocusModeView: React.FC<FocusModeViewProps> = ({
  mission,
  stepId,
  soundEnabled,
  onSelectStep,
  onCompleteAndAdvance,
  onExit,
}) => {
  const stepIndex = mission.steps.findIndex((s) => s.id === stepId);
  const currentStep: FollowUpStep | undefined =
    mission.steps[stepIndex] ?? mission.steps[0];

  const initialSeconds = (currentStep?.estimatedMinutes || 20) * 60;
  const [totalDuration, setTotalDuration] = useState<number>(initialSeconds);
  const [secondsLeft, setSecondsLeft] = useState<number>(initialSeconds);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [timerFinished, setTimerFinished] = useState<boolean>(false);
  const finishedHandledRef = useRef<boolean>(false);

  // Reset timer when focused step changes
  useEffect(() => {
    const nextTotal = (currentStep?.estimatedMinutes || 20) * 60;
    setTotalDuration(nextTotal);
    setSecondsLeft(nextTotal);
    setIsRunning(false);
    setTimerFinished(false);
    finishedHandledRef.current = false;
  }, [currentStep?.id, currentStep?.estimatedMinutes]);

  // Escape key exits Focus Mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onExit]);

  // Countdown tick
  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          setIsRunning(false);
          setTimerFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  // Notify on timer completion
  useEffect(() => {
    if (timerFinished && !finishedHandledRef.current && currentStep) {
      finishedHandledRef.current = true;
      if (soundEnabled) {
        playAlertChime();
      }
      dispatchBrowserNotification({
        title: `انتهى مؤقت التركيز: ${currentStep.title}`,
        body: 'يمكنك اعتماد إتمام الخطوة والانتقال للخطوة التالية، أو تمديد المؤقت ٥ دقائق.',
        tag: `focus-done-${currentStep.id}`,
      });
    }
  }, [timerFinished, currentStep, soundEnabled]);

  const handleSetPresetMinutes = (minutes: number) => {
    const secs = minutes * 60;
    setTotalDuration(secs);
    setSecondsLeft(secs);
    setIsRunning(false);
    setTimerFinished(false);
    finishedHandledRef.current = false;
  };

  const handleAddFiveMinutes = () => {
    setTotalDuration((prev) => prev + 300);
    setSecondsLeft((prev) => prev + 300);
    setTimerFinished(false);
    finishedHandledRef.current = false;
  };

  const handleReset = () => {
    setSecondsLeft(totalDuration);
    setIsRunning(false);
    setTimerFinished(false);
    finishedHandledRef.current = false;
  };

  const allCompleted = mission.steps.every((s) => s.completed);
  const completedCount = mission.steps.filter((s) => s.completed).length;

  const progressRatio =
    totalDuration > 0 ? Math.max(0, Math.min(1, secondsLeft / totalDuration)) : 0;
  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progressRatio);

  const prevStep = stepIndex > 0 ? mission.steps[stepIndex - 1] : null;
  const nextStep =
    stepIndex >= 0 && stepIndex < mission.steps.length - 1
      ? mission.steps[stepIndex + 1]
      : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between px-4 sm:px-8 py-6">
      {/* Minimal Focus Top Bar */}
      <header className="max-w-3xl w-full mx-auto flex items-center justify-between gap-4">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
            <span>وضع التركيز</span>
            <span aria-hidden="true">·</span>
            <span>
              الخطوة {Math.max(1, stepIndex + 1)} من {mission.steps.length}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              المنجز {completedCount}/{mission.steps.length}
            </span>
          </div>
          <p className="text-xs font-medium text-slate-700 truncate">
            {mission.goalTitle}
          </p>
        </div>

        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <X className="w-3.5 h-3.5" />
          <span>الخروج من وضع التركيز</span>
        </button>
      </header>

      {/* Centered Enlarged Task + Visual Countdown Timer */}
      <main className="flex-1 flex items-center justify-center py-8">
        <div className="max-w-2xl w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 space-y-8 text-center">
          {allCompleted ? (
            <div className="space-y-4 py-6">
              <div className="w-12 h-12 mx-auto rounded-full bg-teal-50 text-teal-700 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 [text-wrap:balance]">
                أحسنت! تم إنجاز جميع خطوات هذه المهمة
              </h1>
              <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                أكملت جميع الخطوات ({mission.steps.length} خطوات) بنجاح. يمكنك العودة لقائمة
                المتابعة لإضافة هدف جديد أو مراجعة توجيه الوكيل.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onExit}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer"
                >
                  العودة إلى واجهة المتابعة
                </button>
              </div>
            </div>
          ) : currentStep ? (
            <>
              {/* Enlarged Task Header */}
              <div className="space-y-3">
                <div className="text-xs font-medium text-teal-800 tabular-nums">
                  المهمة الحالية · الوقت المقدر {currentStep.estimatedMinutes} دقيقة
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug [text-wrap:balance]">
                  {currentStep.title}
                </h1>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl mx-auto">
                  {currentStep.detail}
                </p>
              </div>

              {/* Visual Circular Countdown Timer */}
              <div className="flex flex-col items-center space-y-5">
                <div className="relative w-52 h-52 flex items-center justify-center">
                  <svg
                    className="w-full h-full -rotate-90"
                    viewBox="0 0 200 200"
                    aria-hidden="true"
                  >
                    <circle
                      cx="100"
                      cy="100"
                      r={radius}
                      fill="none"
                      stroke="#e2e8f0"
                      strokeWidth="8"
                    />
                    <circle
                      cx="100"
                      cy="100"
                      r={radius}
                      fill="none"
                      stroke={timerFinished ? '#d97706' : '#0f766e'}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      className="transition-[stroke-dashoffset] duration-700 ease-linear"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span
                      dir="ltr"
                      className="font-mono text-4xl font-semibold tracking-tight text-slate-900 tabular-nums"
                    >
                      {formatTimer(secondsLeft)}
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      {timerFinished
                        ? 'انتهى الوقت المحدد'
                        : isRunning
                        ? 'التركيز نشط'
                        : 'جاهز للبدء'}
                    </span>
                  </div>
                </div>

                {/* Timer Controls */}
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (secondsLeft === 0) {
                        handleReset();
                        setIsRunning(true);
                      } else {
                        setIsRunning((prev) => !prev);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {isRunning ? (
                      <>
                        <Pause className="w-4 h-4" />
                        <span>إيقاف مؤقت</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>{secondsLeft < totalDuration && secondsLeft > 0 ? 'استئناف' : 'ابدأ المؤقت'}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleAddFiveMinutes}
                    className="inline-flex items-center gap-1 px-3.5 py-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap tabular-nums"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>٥ دقائق</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    aria-label="إعادة ضبط المؤقت"
                    className="inline-flex items-center gap-1 px-3.5 py-2.5 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>إعادة</span>
                  </button>
                </div>

                {/* Quick Duration Presets */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
                  <span className="text-slate-400 ml-1">مدة الجلسة:</span>
                  {[10, 15, 20, 30, 45].map((mins) => {
                    const active = totalDuration === mins * 60;
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => handleSetPresetMinutes(mins)}
                        className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer tabular-nums ${
                          active
                            ? 'bg-teal-50 text-teal-900 font-semibold border border-teal-600'
                            : 'text-slate-600 hover:bg-slate-100 border border-transparent'
                        }`}
                      >
                        {mins} د
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Primary Completion & Step Navigation */}
              <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={!prevStep}
                  onClick={() => prevStep && onSelectStep(prevStep.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer disabled:cursor-default whitespace-nowrap"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>الخطوة السابقة</span>
                </button>

                <button
                  type="button"
                  onClick={() => onCompleteAndAdvance(currentStep.id)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {currentStep.completed
                      ? 'الانتقال للخطوة التالية'
                      : 'إتمام الخطوة والانتقال للتالية'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={!nextStep}
                  onClick={() => nextStep && onSelectStep(nextStep.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer disabled:cursor-default whitespace-nowrap"
                >
                  <span>الخطوة التالية</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : null}
        </div>
      </main>

      {/* Subtle Bottom Hint */}
      <footer className="max-w-3xl w-full mx-auto text-center text-xs text-slate-400">
        اضغط على مفتاح Esc في أي وقت للخروج من وضع التركيز
      </footer>
    </div>
  );
};
