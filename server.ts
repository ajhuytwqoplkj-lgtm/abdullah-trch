import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  GenerateContentParameters,
  GenerateContentResponse,
  GoogleGenAI,
  ThinkingLevel,
  Type,
} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(apiVersion?: string): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isQuotaOrRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.toLowerCase().includes('quota') ||
    msg.toLowerCase().includes('rate limit')
  );
}

function isTransientError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('503') || msg.includes('UNAVAILABLE') || isQuotaOrRateLimitError(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithResilience(
  ai: GoogleGenAI,
  params: Omit<GenerateContentParameters, 'model'>,
  options?: {
    preferredModel?: string;
    fallbackModel?: string;
    withoutToolsFallbackConfig?: GenerateContentParameters['config'];
  }
): Promise<{ response: GenerateContentResponse; usedTools: boolean; modelUsed: string }> {
  const primaryModel = options?.preferredModel ?? 'gemini-4-hydrogen';
  const secondaryModel = options?.fallbackModel ?? 'gemini-3.1-flash-lite';

  try {
    const response = await ai.models.generateContent({
      model: primaryModel,
      ...params,
    });
    return {
      response,
      usedTools: Boolean(params.config?.tools?.length),
      modelUsed: primaryModel,
    };
  } catch (err) {
    if (!isTransientError(err)) {
      throw err;
    }

    if (params.config?.tools?.length && options?.withoutToolsFallbackConfig) {
      try {
        await sleep(600);
        const response = await ai.models.generateContent({
          model: primaryModel,
          contents: params.contents,
          config: options.withoutToolsFallbackConfig,
        });
        return {
          response,
          usedTools: false,
          modelUsed: primaryModel,
        };
      } catch (noToolErr) {
        if (!isTransientError(noToolErr)) {
          throw noToolErr;
        }
      }
    }

    await sleep(1200);
    const fallbackConfig = options?.withoutToolsFallbackConfig
      ? { ...options.withoutToolsFallbackConfig }
      : { ...(params.config ?? {}) };
    delete fallbackConfig.tools;
    delete fallbackConfig.thinkingConfig;

    const fallbackResponse = await ai.models.generateContent({
      model: secondaryModel,
      contents: params.contents,
      config: fallbackConfig,
    });
    return {
      response: fallbackResponse,
      usedTools: false,
      modelUsed: secondaryModel,
    };
  }
}

function handleApiError(res: Response, error: unknown, context: string) {
  console.error(`[API Error - ${context}]:`, error);
  const msg = error instanceof Error ? error.message : String(error);

  if (msg === 'GEMINI_API_KEY_MISSING') {
    return res.status(500).json({
      error:
        'مفتاح Gemini API غير مهيأ في البيئة الحالية. يرجى التحقق منه في لوحة الإعدادات (Settings > Secrets).',
    });
  }

  if (isQuotaOrRateLimitError(error)) {
    return res.status(429).json({
      error:
        'تم الوصول إلى حد الحصة الحالية (Quota) لمفتاح Gemini API، أو أن هذا النموذج يتطلب مفتاحاً مدفوعاً. يمكنك الانتظار قليلاً أو اختيار مفتاح مدفوع من Settings > Secrets.',
    });
  }

  if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID')) {
    return res.status(403).json({
      error:
        'يتطلب هذا النموذج صلاحية أو مفتاح API مدفوعاً مفعّلاً. يرجى مراجعة Settings > Secrets.',
    });
  }

  if (msg.includes('404') || msg.includes('not_found') || msg.includes('NotFoundError')) {
    return res.status(404).json({
      error:
        'تعذر العثور على النموذج المطلوب أو أنه غير متاح في صلاحيات المفتاح الحالي. يرجى التحقق من إعدادات المفتاح في Settings > Secrets.',
      details: msg,
    });
  }

  return res.status(500).json({
    error: 'حدث خطأ أثناء معالجة طلب الوكيل الذكي. يرجى المحاولة مرة أخرى.',
    details: msg,
  });
}

function extractJsonBlock(rawText: string): unknown {
  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
  const firstBrace = candidate.indexOf('{');
  const firstBracket = candidate.indexOf('[');
  let start = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    start = Math.min(firstBrace, firstBracket);
  } else {
    start = Math.max(firstBrace, firstBracket);
  }
  if (start === -1) {
    throw new Error('No JSON structure found in model response');
  }
  const lastBrace = candidate.lastIndexOf('}');
  const lastBracket = candidate.lastIndexOf(']');
  const end = Math.max(lastBrace, lastBracket);
  return JSON.parse(candidate.slice(start, end + 1));
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // 1. Agent Architect
  app.post('/api/agent/architect', async (req: Request, res: Response) => {
    try {
      const { profile, focusGoals } = req.body as {
        profile: {
          agentName: string;
          ownerName: string;
          niche: string;
          targetCountry: string;
          currency: string;
          budgetTier: string;
          dailyHours: string;
        };
        focusGoals?: string[];
      };

      const ai = getAiClient();
      const prompt = `
أنت مهندس أنظمة ذكاء اصطناعي (AI Agent Architect) متخصص في مساعدة رواد الأعمال وصناع المحتوى وتجار التجارة الإلكترونية.
المستخدم يريد إنشاء وكيل ذكاء اصطناعي خاص به اسمه "${profile.agentName || 'سند'}" لمساعدته يومياً في:
- إنشاء الفيديوهات التسويقية والطويلة (من دقيقة إلى 7 دقائق)
- الاستيراد والبحث عن الموردين وحساب التكلفة
- المتابعة اليومية خطوة بخطوة
- توليد أفكار جديدة
- اقتراح منتجات جديدة رابحة

بيانات المستخدم:
- الاسم: ${profile.ownerName || 'صاحب المشروع'}
- المجال/النيتش: ${profile.niche || 'التجارة الإلكترونية والمنتجات الذكية'}
- السوق المستهدف: ${profile.targetCountry || 'السعودية والخليج'}
- العملة: ${profile.currency || 'SAR'}
- الميزانية التقريبية: ${profile.budgetTier || 'متوسطة (500$ - 2000$)'}
- الوقت المتاح يومياً: ${profile.dailyHours || 'ساعتان يومياً'}
- الأولويات المختارة: ${(focusGoals && focusGoals.length ? focusGoals : ['الفيديوهات', 'الاستيراد', 'المنتجات الجديدة', 'المتابعة اليومية']).join('، ')}

صمّم للمستخدم مخططاً عملياً دقيقاً باللغة العربية الفصحى الواضحة يشرح له بالضبط كيف يبني هذا الوكيل ويديره يومياً، متضمناً:
1. ملخص معمارية الوكيل.
2. نص برومبت النظام الكامل (System Prompt) الجاهز للنسخ.
3. جدول التشغيل اليومي (4 فترات زمنية).
4. حزمة الأدوات الموصى بها لكل مهمة مع خطوات الربط.
5. 3 مسارات أتمتة عملية (Workflows).
6. خطة أول 7 أيام لتفعيل الوكيل.
`;

      const { response } = await generateWithResilience(ai, {
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              architectureSummary: { type: Type.STRING },
              systemPrompt: { type: Type.STRING },
              dailySchedule: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    timeWindow: { type: Type.STRING },
                    taskTitle: { type: Type.STRING },
                    agentRole: { type: Type.STRING },
                    humanAction: { type: Type.STRING },
                  },
                  required: ['timeWindow', 'taskTitle', 'agentRole', 'humanAction'],
                },
              },
              toolStack: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    capability: { type: Type.STRING },
                    recommendedTools: { type: Type.STRING },
                    whyThisTool: { type: Type.STRING },
                    setupSteps: { type: Type.STRING },
                  },
                  required: ['capability', 'recommendedTools', 'whyThisTool', 'setupSteps'],
                },
              },
              automationFlows: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    flowName: { type: Type.STRING },
                    trigger: { type: Type.STRING },
                    steps: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    output: { type: Type.STRING },
                  },
                  required: ['flowName', 'trigger', 'steps', 'output'],
                },
              },
              firstWeekPlan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    day: { type: Type.STRING },
                    focus: { type: Type.STRING },
                    deliverable: { type: Type.STRING },
                  },
                  required: ['day', 'focus', 'deliverable'],
                },
              },
            },
            required: [
              'architectureSummary',
              'systemPrompt',
              'dailySchedule',
              'toolStack',
              'automationFlows',
              'firstWeekPlan',
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text ?? '{}');
      return res.json(parsed);
    } catch (error) {
      return handleApiError(res, error, 'architect');
    }
  });

  // 2. Video Script & Storyboard Agent (1 to 7 minutes)
  app.post('/api/agent/video', async (req: Request, res: Response) => {
    try {
      const { productOrTopic, platform, duration, durationMinutes, tone, targetCountry } =
        req.body as {
          productOrTopic: string;
          platform: string;
          duration: string;
          durationMinutes?: number;
          tone: string;
          targetCountry?: string;
        };

      if (!productOrTopic?.trim()) {
        return res.status(400).json({ error: 'يرجى كتابة اسم المنتج أو موضوع الفيديو.' });
      }

      const minutes = Math.min(7, Math.max(1, Number(durationMinutes) || 3));
      const sceneTarget = minutes <= 2 ? 5 : minutes <= 4 ? 7 : 9;

      const ai = getAiClient();
      const prompt = `
أنت مخرج إبداعي وكاتب سيناريو فيديوهات يوتيوب ومحتوى تسويقي وشرح منتجات في السوق العربي (${targetCountry || 'الخليج والشرق الأوسط'}).
أنشئ حزمة إنتاج فيديو متكاملة بمدة دقيقة واحدة إلى 7 دقائق (المدة المطلوبة هنا: ${minutes} دقيقة / ${duration || `${minutes} دقائق`}) حول:
- المنتج أو الموضوع: ${productOrTopic}
- المنصة: ${platform || 'YouTube'}
- المدة المستهدفة بدقة: ${minutes} دقيقة (من 00:00 حتى 0${minutes}:00)
- الأسلوب والنبرة: ${tone || 'عملي ومقنع يركز على القيمة وحل المشكلة'}

المطلوب بدقة:
1. عنوان جذاب للفيديو.
2. 3 خطافات افتتاحية (Hooks) لأول 10 ثوانٍ تمنع خروج المشاهد.
3. تقسيم الفيديو إلى ${sceneTarget} فصول/مشاهد متسلسلة تغطي كامل المدة الزمنية من 00:00 إلى 0${minutes}:00، كل مشهد يحتوي على:
   - التوقيت الدقيق (timeRange مثل 00:00 - 00:40 وهكذا حتى نهاية الـ ${minutes} دقائق)
   - الوصف البصري ولقطات B-Roll بالعربية
   - النص الصوتي الكامل والمفصّل للمشهد بالعربية (arabicVoiceover) بحيث يكفي لإلقاء حقيقي يملأ زمن المشهد
   - النص الظاهر على الشاشة (onScreenText)
   - برومبت توليد فيديو بالذكاء الاصطناعي بالإنجليزية (aiVideoPromptEn) احترافي ودقيق يناسب gemini-omni-1.2-flash / Veo / Kling (يصف الإضاءة، حركة الكاميرا، واللقطة بدون نصوص عشوائية).
4. دعوة لاتخاذ إجراء (Call to Action) قوية في النهاية.
5. وصف المنشور (Caption) + 5 وسوم (Hashtags) + 3 نصائح تنفيذية للتصوير أو المونتاج.
`;

      const { response } = await generateWithResilience(ai, {
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              hooks: { type: Type.ARRAY, items: { type: Type.STRING } },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sceneNumber: { type: Type.INTEGER },
                    timeRange: { type: Type.STRING },
                    visualDescription: { type: Type.STRING },
                    arabicVoiceover: { type: Type.STRING },
                    onScreenText: { type: Type.STRING },
                    aiVideoPromptEn: { type: Type.STRING },
                  },
                  required: [
                    'sceneNumber',
                    'timeRange',
                    'visualDescription',
                    'arabicVoiceover',
                    'onScreenText',
                    'aiVideoPromptEn',
                  ],
                },
              },
              callToAction: { type: Type.STRING },
              caption: { type: Type.STRING },
              hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
              productionTips: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: [
              'title',
              'hooks',
              'scenes',
              'callToAction',
              'caption',
              'hashtags',
              'productionTips',
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text ?? '{}');
      return res.json({
        id: `vid_${Date.now()}`,
        createdAt: new Date().toISOString(),
        productOrTopic,
        platform: platform || 'YouTube',
        duration: `${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'}`,
        ...parsed,
      });
    } catch (error) {
      return handleApiError(res, error, 'video');
    }
  });

  // 2b. Video Generation (Text-to-Video & Image-to-Video) via Interactions API (gemini-omni-1.2-flash)
  app.post('/api/agent/video-render', async (req: Request, res: Response) => {
    try {
      const { mode, prompt, aspectRatio, imageBase64, imageMimeType } = req.body as {
        mode: 'text' | 'image';
        prompt: string;
        aspectRatio: '16:9' | '9:16';
        imageBase64?: string;
        imageMimeType?: string;
      };

      if (!prompt?.trim()) {
        return res.status(400).json({ error: 'يرجى كتابة وصف المشهد المطلوب توليده.' });
      }
      if (mode === 'image' && !imageBase64) {
        return res.status(400).json({ error: 'يرجى رفع صورة أولاً لتحريكها إلى فيديو.' });
      }

      const ratio: '16:9' | '9:16' = aspectRatio === '9:16' ? '9:16' : '16:9';
      const ai = getAiClient('v1beta');

      const inputPayload =
        mode === 'image' && imageBase64
          ? [
              {
                type: 'image' as const,
                mime_type: imageMimeType || 'image/png',
                data: imageBase64,
              },
              {
                type: 'text' as const,
                text: prompt.trim(),
              },
            ]
          : prompt.trim();

      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.2-flash',
          api_version: 'v1beta',
          input: inputPayload,
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: ratio,
            duration: '10s',
            resolution: '720p',
          },
        },
        { timeout: 300000 }
      );

      const videoPart = interaction.output_video;
      if (!videoPart || (!videoPart.data && !videoPart.uri)) {
        return res.status(502).json({
          error: 'لم يُرجع نموذج الفيديو ملف فيديو صالحاً. يرجى المحاولة بوصف أوضح.',
        });
      }

      const mimeType = videoPart.mime_type || 'video/mp4';
      const videoSrc = videoPart.data
        ? `data:${mimeType};base64,${videoPart.data}`
        : (videoPart.uri as string);

      return res.json({
        id: `clip_${Date.now()}`,
        createdAt: new Date().toISOString(),
        mode: mode === 'image' ? 'image' : 'text',
        prompt: prompt.trim(),
        aspectRatio: ratio,
        videoSrc,
        mimeType,
      });
    } catch (error) {
      return handleApiError(res, error, 'video-render');
    }
  });

  // 3. Import & Sourcing Agent
  app.post('/api/agent/import', async (req: Request, res: Response) => {
    try {
      const { productName, targetCountry, quantity, budget, currency } = req.body as {
        productName: string;
        targetCountry: string;
        quantity: string;
        budget: string;
        currency?: string;
      };

      if (!productName?.trim()) {
        return res.status(400).json({ error: 'يرجى تحديد المنتج المراد استيراده.' });
      }

      const ai = getAiClient();
      const prompt = `
أنت مستشار استيراد وسلاسل إمداد دولية متخصص في الاستيراد من الصين (1688، Alibaba، Yiwu، Shenzhen، Guangzhou) وتركيا إلى العالم العربي.
أعد خطة استيراد عملية ومنظمة للمنتج التالي:
- المنتج: ${productName}
- بلد الوصول: ${targetCountry || 'المملكة العربية السعودية'}
- الكمية المبدئية: ${quantity || '100 قطعة'}
- الميزانية المرصودة: ${budget || '1500 دولار'}
- عملة البيع المحلية: ${currency || 'SAR'}

قدّم أرقاماً تقديرية واقعية مع توضيح أنها تقديرات مبدئية تحتاج تأكيد المخلص الجمركي وشركة الشحن.
`;

      const { response } = await generateWithResilience(ai, {
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              hsCodeHint: { type: Type.STRING },
              sourcingHubs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    platformOrCity: { type: Type.STRING },
                    specialty: { type: Type.STRING },
                    searchKeywordsEn: { type: Type.STRING },
                  },
                  required: ['platformOrCity', 'specialty', 'searchKeywordsEn'],
                },
              },
              costBreakdown: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    item: { type: Type.STRING },
                    estimatedCost: { type: Type.STRING },
                    notes: { type: Type.STRING },
                  },
                  required: ['item', 'estimatedCost', 'notes'],
                },
              },
              expectedSellingPrice: { type: Type.STRING },
              estimatedNetMargin: { type: Type.STRING },
              shippingOptions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    method: { type: Type.STRING },
                    transitDays: { type: Type.STRING },
                    estimatedCost: { type: Type.STRING },
                    bestFor: { type: Type.STRING },
                  },
                  required: ['method', 'transitDays', 'estimatedCost', 'bestFor'],
                },
              },
              supplierChecklist: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              outreachMessageEn: { type: Type.STRING },
              outreachMessageAr: { type: Type.STRING },
              riskNotes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'hsCodeHint',
              'sourcingHubs',
              'costBreakdown',
              'expectedSellingPrice',
              'estimatedNetMargin',
              'shippingOptions',
              'supplierChecklist',
              'outreachMessageEn',
              'outreachMessageAr',
              'riskNotes',
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text ?? '{}');
      return res.json({
        id: `imp_${Date.now()}`,
        createdAt: new Date().toISOString(),
        productName,
        targetCountry: targetCountry || 'المملكة العربية السعودية',
        quantity: quantity || '100 قطعة',
        ...parsed,
      });
    } catch (error) {
      return handleApiError(res, error, 'import');
    }
  });

  // 3b. Google Maps Grounding for nearby freight forwarders, customs brokers & wholesale markets
  app.post('/api/agent/maps', async (req: Request, res: Response) => {
    try {
      const { query, cityOrCountry, latitude, longitude } = req.body as {
        query: string;
        cityOrCountry?: string;
        latitude?: number;
        longitude?: number;
      };

      if (!query?.trim()) {
        return res.status(400).json({ error: 'يرجى كتابة ما تبحث عنه على الخريطة.' });
      }

      const ai = getAiClient();
      const prompt = `ابحث في خرائط جوجل عن: "${query.trim()}" ${
        cityOrCountry ? `في ${cityOrCountry}` : ''
      }. قدّم ملخصاً عملياً باللغة العربية لأبرز الجهات أو المواقع المناسبة للاستيراد والخدمات اللوجستية.`;

      const config: GenerateContentParameters['config'] = {
        tools: [{ googleMaps: {} }],
      };

      if (typeof latitude === 'number' && typeof longitude === 'number') {
        config.toolConfig = {
          retrievalConfig: {
            latLng: { latitude, longitude },
          },
        };
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config,
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const places = chunks
        .map((chunk) => {
          if (!chunk.maps?.uri || !chunk.maps?.title) return null;
          const rawSnippets =
            chunk.maps.placeAnswerSources?.reviewSnippets ??
            chunk.maps.placeAnswerSources?.reviewSnippet ??
            [];
          const snippets = rawSnippets
            .map((s) => s.title || s.review)
            .filter((c): c is string => Boolean(c))
            .slice(0, 2);
          return {
            title: chunk.maps.title,
            uri: chunk.maps.uri,
            snippets,
          };
        })
        .filter((p): p is { title: string; uri: string; snippets: string[] } => Boolean(p));

      return res.json({
        text: response.text ?? '',
        places,
      });
    } catch (error) {
      return handleApiError(res, error, 'maps');
    }
  });

  // 4. New Products Discovery Agent (Google Search Grounding + Resilient Fallback)
  app.post('/api/agent/products', async (req: Request, res: Response) => {
    try {
      const { niche, targetCountry, budgetTier } = req.body as {
        niche: string;
        targetCountry: string;
        budgetTier: string;
      };

      const ai = getAiClient();
      const prompt = `
ابحث في الاتجاهات الحديثة للمنتجات المطلوبة في عام 2026، واقترح 4 منتجات جديدة وعملية قابلة للاستيراد والتسويق عبر الفيديوهات في السوق: "${targetCountry || 'الخليج والعالم العربي'}" ضمن مجال: "${niche || 'الأدوات الذكية والمنزل واللايف ستايل'}" وبميزانية: "${budgetTier || 'متوسطة'}".

تجنب المنتجات المستهلكة أو العامة جداً، واختر منتجات تحل مشكلة واضحة ولها قابلية للتصوير البصري.

أعد الإجابة بصيغة JSON صالحة فقط بدون أي نص إضافي خارج كائن JSON، وفق الهيكل التالي تماماً:
{
  "marketSummary": "ملخص قصير من سطرين لاتجاه السوق الحالي في هذا المجال",
  "products": [
    {
      "name": "اسم المنتج بالعربية",
      "category": "التصنيف",
      "problemSolved": "المشكلة التي يحلها بوضوح",
      "targetAudience": "الجمهور المستهدف",
      "estimatedSourcingCost": "التكلفة التقريبية من المصدر بالدولار",
      "suggestedSellingPrice": "سعر البيع المقترح",
      "profitMarginEstimate": "الهامش التقريبي",
      "viralVideoAngle": "فكرة زاوية تصوير تجذب الانتباه",
      "sourcingKeywordsEn": "English search keywords for Alibaba / 1688",
      "whyNow": "لماذا هذا المنتج مناسب الآن"
    }
  ]
}
`;

      const structuredFallbackConfig: GenerateContentParameters['config'] = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            marketSummary: { type: Type.STRING },
            products: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  category: { type: Type.STRING },
                  problemSolved: { type: Type.STRING },
                  targetAudience: { type: Type.STRING },
                  estimatedSourcingCost: { type: Type.STRING },
                  suggestedSellingPrice: { type: Type.STRING },
                  profitMarginEstimate: { type: Type.STRING },
                  viralVideoAngle: { type: Type.STRING },
                  sourcingKeywordsEn: { type: Type.STRING },
                  whyNow: { type: Type.STRING },
                },
                required: [
                  'name',
                  'category',
                  'problemSolved',
                  'targetAudience',
                  'estimatedSourcingCost',
                  'suggestedSellingPrice',
                  'profitMarginEstimate',
                  'viralVideoAngle',
                  'sourcingKeywordsEn',
                  'whyNow',
                ],
              },
            },
          },
          required: ['marketSummary', 'products'],
        },
      };

      const { response, usedTools } = await generateWithResilience(
        ai,
        {
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        },
        {
          preferredModel: 'gemini-4-hydrogen',
          fallbackModel: 'gemini-3.1-flash-lite',
          withoutToolsFallbackConfig: structuredFallbackConfig,
        }
      );

      const rawText = response.text ?? '{}';
      const parsed = extractJsonBlock(rawText) as {
        marketSummary?: string;
        products?: unknown[];
      };

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const sources = chunks
        .map((chunk: { web?: { uri?: string; title?: string } }) => chunk.web)
        .filter((w): w is { uri: string; title: string } => Boolean(w?.uri && w?.title))
        .slice(0, 6);

      return res.json({
        marketSummary: parsed.marketSummary ?? '',
        products: Array.isArray(parsed.products) ? parsed.products : [],
        sources,
        groundingUsed: usedTools,
      });
    } catch (error) {
      return handleApiError(res, error, 'products');
    }
  });

  // 5. Daily Ideas & Growth Lab
  app.post('/api/agent/ideas', async (req: Request, res: Response) => {
    try {
      const { niche, focusArea, targetCountry, goal } = req.body as {
        niche: string;
        focusArea: string;
        targetCountry: string;
        goal?: string;
      };

      const ai = getAiClient();
      const prompt = `
أنت مستشار نمو وإبداع يومي لصاحب مشروع يعمل في: "${niche || 'التجارة الإلكترونية وصناعة المحتوى'}" داخل "${targetCountry || 'السوق العربي'}".
مجال الأفكار المطلوب الآن: "${focusArea || 'أفكار محتوى وتسويق ومنتجات'}".
${goal ? `الهدف الحالي للمستخدم: ${goal}` : ''}

قدّم 4 أفكار جديدة، غير تقليدية، وعملية يمكن البدء في تنفيذ أول خطوة منها اليوم خلال 30 إلى 60 دقيقة.
`;

      const { response } = await generateWithResilience(ai, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ideas: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    category: { type: Type.STRING },
                    concept: { type: Type.STRING },
                    whyItWorks: { type: Type.STRING },
                    firstActionStep: { type: Type.STRING },
                    estimatedTime: { type: Type.STRING },
                  },
                  required: [
                    'title',
                    'category',
                    'concept',
                    'whyItWorks',
                    'firstActionStep',
                    'estimatedTime',
                  ],
                },
              },
            },
            required: ['ideas'],
          },
        },
      });

      const parsed = JSON.parse(response.text ?? '{"ideas":[]}');
      return res.json(parsed);
    } catch (error) {
      return handleApiError(res, error, 'ideas');
    }
  });

  // 6. Step-by-Step Daily Follow-Up Coach
  app.post('/api/agent/coach', async (req: Request, res: Response) => {
    try {
      const { mode, goalTitle, steps, userUpdate, niche } = req.body as {
        mode: 'create_plan' | 'checkin';
        goalTitle: string;
        steps?: Array<{ title: string; completed: boolean }>;
        userUpdate?: string;
        niche?: string;
      };

      if (!goalTitle?.trim()) {
        return res.status(400).json({ error: 'يرجى كتابة الهدف الذي تريد متابعته خطوة بخطوة.' });
      }

      const ai = getAiClient();

      if (mode === 'create_plan') {
        const prompt = `
أنت وكيل متابعة يومية صارم ولطيف يقود المستخدم خطوة بخطوة لإنجاز هدفه بدون تشتت.
مجال المستخدم: ${niche || 'التجارة الإلكترونية والمحتوى'}
الهدف المطلوب إنجازه: "${goalTitle}"

قسّم هذا الهدف إلى 5 خطوات عملية متسلسلة واضحة، مع تقدير واقعي بالدقائق لكل خطوة، ورسالة توجيهية مختصرة تشرح الخطوة الأولى تحديداً، وسؤال متابعة مباشر للمستخدم.
`;
        const { response } = await generateWithResilience(ai, {
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                steps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      detail: { type: Type.STRING },
                      estimatedMinutes: { type: Type.INTEGER },
                    },
                    required: ['title', 'detail', 'estimatedMinutes'],
                  },
                },
                agentAdvice: { type: Type.STRING },
                nextQuestion: { type: Type.STRING },
              },
              required: ['steps', 'agentAdvice', 'nextQuestion'],
            },
          },
        });

        const parsed = JSON.parse(response.text ?? '{}');
        return res.json(parsed);
      } else {
        const completedList = (steps ?? [])
          .filter((s) => s.completed)
          .map((s) => `- [مكتمل] ${s.title}`)
          .join('\n');
        const pendingList = (steps ?? [])
          .filter((s) => !s.completed)
          .map((s) => `- [قيد الانتظار] ${s.title}`)
          .join('\n');

        const prompt = `
أنت وكيل متابعة يومية يتابع المستخدم خطوة بخطوة في مشروعه (${niche || 'التجارة الإلكترونية والمحتوى'}).
الهدف الحالي: "${goalTitle}"

الخطوات المنجزة:
${completedList || 'لا توجد خطوات منجزة بعد'}

الخطوات المتبقية:
${pendingList || 'تم إنجاز جميع الخطوات'}

تحديث المستخدم الآن:
"${userUpdate || 'أريد معرفة خطوتي التالية الآن'}"

أجب بتوجيه مباشر وعملي ومختصر للـ 20 دقيقة القادمة، ثم اسأل سؤال متابعة واحداً فقط.
`;
        const { response } = await generateWithResilience(ai, {
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                agentAdvice: { type: Type.STRING },
                nextQuestion: { type: Type.STRING },
                suggestedExtraStep: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    detail: { type: Type.STRING },
                    estimatedMinutes: { type: Type.INTEGER },
                  },
                },
              },
              required: ['agentAdvice', 'nextQuestion'],
            },
          },
        });

        const parsed = JSON.parse(response.text ?? '{}');
        return res.json(parsed);
      }
    } catch (error) {
      return handleApiError(res, error, 'coach');
    }
  });

  // 7. Audio Transcription (gemini-3.5-transcribe)
  app.post('/api/agent/transcribe', async (req: Request, res: Response) => {
    try {
      const { audioBase64, mimeType } = req.body as {
        audioBase64: string;
        mimeType?: string;
      };

      if (!audioBase64) {
        return res.status(400).json({ error: 'لم يتم استلام بيانات الصوت.' });
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'audio/webm',
                data: audioBase64,
              },
            },
            {
              text: 'Transcribe this audio accurately in the spoken language (Arabic or English). Output only the clean transcript without extra commentary.',
            },
          ],
        },
      });

      return res.json({ text: (response.text ?? '').trim() });
    } catch (error) {
      return handleApiError(res, error, 'transcribe');
    }
  });

  // 8. Multi-turn Gemini Chatbot (supports Hydrogen, Flash Lite, Argon, Carbon + Search Grounding)
  app.post('/api/agent/chat', async (req: Request, res: Response) => {
    try {
      const { model, systemInstruction, history, message, useSearch } = req.body as {
        model?: string;
        systemInstruction?: string;
        history?: Array<{ role: 'user' | 'model'; text: string }>;
        message: string;
        useSearch?: boolean;
      };

      if (!message?.trim()) {
        return res.status(400).json({ error: 'يرجى كتابة رسالتك أولاً.' });
      }

      const allowedModels = [
        'gemini-4-hydrogen',
        'gemini-3.1-flash-lite',
        'gemini-4-argon',
        'gemini-4-carbon',
      ];
      const chosenModel = allowedModels.includes(model || '')
        ? (model as string)
        : 'gemini-4-hydrogen';

      const ai = getAiClient();
      const formattedHistory = (history ?? [])
        .filter((m) => m.text?.trim())
        .map((m) => ({
          role: m.role,
          parts: [{ text: m.text }],
        }));

      const chatConfig: {
        systemInstruction: string;
        tools?: Array<{ googleSearch: Record<string, never> }>;
      } = {
        systemInstruction:
          systemInstruction?.trim() ||
          'أنت وكيل ذكاء اصطناعي عملي باللغة العربية تساعد المستخدم خطوة بخطوة في مهامه اليومية وإنتاج الفيديوهات والاستيراد والمنتجات.',
      };

      if (useSearch) {
        chatConfig.tools = [{ googleSearch: {} }];
      }

      const chat = ai.chats.create({
        model: chosenModel,
        config: chatConfig,
        history: formattedHistory,
      });

      const response = await chat.sendMessage({ message: message.trim() });
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const sources = chunks
        .map((chunk: { web?: { uri?: string; title?: string } }) => chunk.web)
        .filter((w): w is { uri: string; title: string } => Boolean(w?.uri && w?.title))
        .slice(0, 4);

      return res.json({
        reply: response.text ?? '',
        modelUsed: chosenModel,
        sources,
      });
    } catch (error) {
      return handleApiError(res, error, 'chat');
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
