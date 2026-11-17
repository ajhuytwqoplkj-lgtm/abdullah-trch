export type ModuleId =
  | 'blueprint'
  | 'followup'
  | 'video'
  | 'import'
  | 'products'
  | 'ideas'
  | 'chat'
  | 'studio3d';

export type ChatModelId =
  | 'gemini-4-hydrogen'
  | 'gemini-3.1-flash-lite'
  | 'gemini-4-argon'
  | 'gemini-4-carbon';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelUsed?: ChatModelId;
  createdAt: string;
}

export interface AgentProfile {
  agentName: string;
  ownerName: string;
  niche: string;
  targetCountry: string;
  currency: string;
  budgetTier: string;
  dailyHours: string;
}

export interface AgentBlueprint {
  architectureSummary: string;
  systemPrompt: string;
  dailySchedule: Array<{
    timeWindow: string;
    taskTitle: string;
    agentRole: string;
    humanAction: string;
  }>;
  toolStack: Array<{
    capability: string;
    recommendedTools: string;
    whyThisTool: string;
    setupSteps: string;
  }>;
  automationFlows: Array<{
    flowName: string;
    trigger: string;
    steps: string[];
    output: string;
  }>;
  firstWeekPlan: Array<{
    day: string;
    focus: string;
    deliverable: string;
  }>;
}

export interface VideoScene {
  sceneNumber: number;
  timeRange: string;
  visualDescription: string;
  arabicVoiceover: string;
  onScreenText: string;
  aiVideoPromptEn: string;
}

export interface VideoPackage {
  id: string;
  createdAt: string;
  productOrTopic: string;
  platform: string;
  duration: string;
  title: string;
  hooks: string[];
  scenes: VideoScene[];
  callToAction: string;
  caption: string;
  hashtags: string[];
  productionTips: string[];
}

export interface GeneratedVideoClip {
  id: string;
  createdAt: string;
  mode: 'text' | 'image';
  prompt: string;
  aspectRatio: '16:9' | '9:16';
  videoSrc: string;
  mimeType: string;
}

export interface CostBreakdownItem {
  item: string;
  estimatedCost: string;
  notes: string;
}

export interface ShippingOption {
  method: string;
  transitDays: string;
  estimatedCost: string;
  bestFor: string;
}

export interface ImportPlan {
  id: string;
  createdAt: string;
  productName: string;
  targetCountry: string;
  quantity: string;
  hsCodeHint: string;
  sourcingHubs: Array<{
    platformOrCity: string;
    specialty: string;
    searchKeywordsEn: string;
  }>;
  costBreakdown: CostBreakdownItem[];
  expectedSellingPrice: string;
  estimatedNetMargin: string;
  shippingOptions: ShippingOption[];
  supplierChecklist: string[];
  outreachMessageEn: string;
  outreachMessageAr: string;
  riskNotes: string[];
}

export interface MapsPlaceResult {
  title: string;
  uri: string;
  snippets: string[];
}

export interface MapsSearchResponse {
  text: string;
  places: MapsPlaceResult[];
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ProductOpportunity {
  name: string;
  category: string;
  problemSolved: string;
  targetAudience: string;
  estimatedSourcingCost: string;
  suggestedSellingPrice: string;
  profitMarginEstimate: string;
  viralVideoAngle: string;
  sourcingKeywordsEn: string;
  whyNow: string;
}

export interface ProductsSearchResult {
  products: ProductOpportunity[];
  marketSummary: string;
  sources: GroundingSource[];
  groundingUsed?: boolean;
}

export interface DailyIdea {
  title: string;
  category: string;
  concept: string;
  whyItWorks: string;
  firstActionStep: string;
  estimatedTime: string;
}

export interface FollowUpStep {
  id: string;
  title: string;
  detail: string;
  estimatedMinutes: number;
  completed: boolean;
  reminderTime?: string;
  lastNotifiedDate?: string;
}

export interface ScheduledAlert {
  id: string;
  missionId: string;
  missionTitle: string;
  stepId: string;
  stepTitle: string;
  stepDetail: string;
  scheduledTime: string;
  firedAt: string;
}

export interface DailyMission {
  id: string;
  goalTitle: string;
  createdAt: string;
  steps: FollowUpStep[];
  agentAdvice: string;
  nextQuestion: string;
}
