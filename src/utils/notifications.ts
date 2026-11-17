export type BrowserNotificationSupport = 'unsupported' | 'default' | 'granted' | 'denied';

let swRegistration: ServiceWorkerRegistration | null = null;

export function getNotificationStatus(): BrowserNotificationSupport {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as BrowserNotificationSupport;
}

export async function registerNotificationWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    if (!swRegistration) {
      swRegistration = await navigator.serviceWorker.register('/sw.js');
    }
    return swRegistration;
  } catch {
    return null;
  }
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationSupport> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    await registerNotificationWorker();
    const result = await Notification.requestPermission();
    return result as BrowserNotificationSupport;
  } catch {
    return getNotificationStatus();
  }
}

export function playAlertChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.setValueAtTime(880, now + 0.12); // A5

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.36);
  } catch {
    // Ignore audio context restrictions if user has not interacted yet
  }
}

export async function dispatchBrowserNotification(options: {
  title: string;
  body: string;
  tag?: string;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    const reg = await registerNotificationWorker();
    if (reg && 'showNotification' in reg) {
      await reg.showNotification(options.title, {
        body: options.body,
        tag: options.tag || `sanad-${Date.now()}`,
        dir: 'rtl',
        lang: 'ar',
        requireInteraction: true,
      });
      return true;
    }

    const n = new Notification(options.title, {
      body: options.body,
      tag: options.tag || `sanad-${Date.now()}`,
      dir: 'rtl',
      lang: 'ar',
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

export function getTodayDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentTimeHHMM(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function getMinutesFromNowHHMM(offsetMinutes: number): string {
  const target = new Date(Date.now() + offsetMinutes * 60_000);
  return getCurrentTimeHHMM(target);
}
