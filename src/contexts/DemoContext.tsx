"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

// ─── Storage Keys ────────────────────────────────────────────
const STORAGE_KEYS = {
  MODE: 'agribud_demo_mode',
  CROPS: 'agribud_demo_crops',
  SESSIONS: 'agribud_demo_sessions',
  MESSAGES: 'agribud_demo_messages',
  RESP_IDX: 'agribud_demo_resp_idx',
};

// ─── Default Demo Data ──────────────────────────────────────
const DEFAULT_CROPS = [
  {
    id: 'demo-crop-1',
    user_id: 'demo-user',
    name: 'Basmati Rice',
    date_of_sowing: '2026-03-15',
    location: 'Karnal, Haryana',
    latitude: 29.6857,
    longitude: 76.9905,
    village_sensor_data: { rt: 31.5, rh: 68, rs: 42, rw: 75, rv: 0.3 },
    cubesat_ip: null,
    created_at: '2026-03-15T10:00:00Z',
  },
  {
    id: 'demo-crop-2',
    user_id: 'demo-user',
    name: 'Cotton (BT)',
    date_of_sowing: '2026-04-01',
    location: 'Nagpur, Maharashtra',
    latitude: 21.1458,
    longitude: 79.0882,
    village_sensor_data: null,
    cubesat_ip: null,
    created_at: '2026-04-01T10:00:00Z',
  },
  {
    id: 'demo-crop-3',
    user_id: 'demo-user',
    name: 'Wheat (HD-2967)',
    date_of_sowing: '2025-11-20',
    location: 'Ludhiana, Punjab',
    latitude: 30.9010,
    longitude: 75.8573,
    village_sensor_data: { rt: 28.2, rh: 55, rs: 38, rw: 60, rv: 0.1 },
    cubesat_ip: null,
    created_at: '2025-11-20T10:00:00Z',
  },
];

const DEFAULT_SESSIONS: Record<string, any[]> = {
  'demo-crop-1': [
    {
      id: 'demo-session-1',
      user_id: 'demo-user',
      crop_id: 'demo-crop-1',
      title: 'Brown Spots on Leaves',
      created_at: '2026-05-10T08:00:00Z',
      updated_at: '2026-05-10T08:30:00Z',
    },
  ],
  'demo-crop-2': [
    {
      id: 'demo-session-2',
      user_id: 'demo-user',
      crop_id: 'demo-crop-2',
      title: 'Whitefly Infestation',
      created_at: '2026-05-12T09:00:00Z',
      updated_at: '2026-05-12T09:45:00Z',
    },
  ],
  'demo-crop-3': [],
};

const DEFAULT_MESSAGES: Record<string, any[]> = {
  'demo-session-1': [
    {
      id: 'msg-1',
      role: 'user',
      content: 'My rice leaves are showing small brown oval spots with a yellow border. The spots are increasing day by day.',
      image_url: null,
      metadata: null,
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: `**Diagnosis/Analysis**

The symptoms — oval brown lesions with yellow halos on rice leaves — are characteristic of **Leaf Blast (*Magnaporthe oryzae*)**. This fungal pathogen thrives in warm, humid conditions (>25°C, >80% RH), consistent with your current sensor readings (31.5°C, 68% RH).

**Treatment Plan**

| Treatment | Type | Dosage | Timing |
|--------|---------|--------|--------|
| Tricyclazole 75% WP | Chemical | 0.6 g/L water | Spray at first symptom, repeat after 10 days |
| Isoprothiolane 40% EC | Chemical | 1.5 mL/L water | Alternate with Tricyclazole |
| Pseudomonas fluorescens | Organic | 10 g/L water | Foliar spray every 15 days |
| Neem Oil (1500 ppm) | Organic | 5 mL/L water | Mix with P. fluorescens |

**Precautions**
- Avoid excess nitrogen fertilizer — it increases blast susceptibility
- Maintain proper spacing (20×15 cm) to improve air circulation
- Drain standing water periodically; blast spreads faster in water-logged fields
- Monitor neighboring fields — blast is airborne and can spread rapidly
- Apply fungicide in the evening when wind is calm for better leaf adhesion`,
      metadata: {
        citations: [
          { title: 'ICAR Rice Research', url: 'https://icar.gov.in' },
          { title: 'TNAU Agritech Portal', url: 'https://agritech.tnau.ac.in' },
        ]
      },
    },
  ],
  'demo-session-2': [
    {
      id: 'msg-3',
      role: 'user',
      content: 'I am seeing tiny white flies on the underside of cotton leaves. The leaves are becoming sticky and yellow.',
      image_url: null,
      metadata: null,
    },
    {
      id: 'msg-4',
      role: 'assistant',
      content: `**Diagnosis/Analysis**

The described symptoms — tiny white flies on leaf undersides, sticky honeydew, and leaf yellowing — confirm **Whitefly (*Bemisia tabaci*)** infestation. Whiteflies excrete honeydew that leads to sooty mold development, blocking photosynthesis. In BT Cotton, whitefly is the primary pest vector for Cotton Leaf Curl Virus (CLCuV).

**Treatment Plan**

| Treatment | Type | Dosage | Timing |
|--------|---------|--------|--------|
| Diafenthiuron 50% WP | Chemical | 1 g/L water | Spray when whitefly count > 6/leaf |
| Spiromesifen 22.9% SC | Chemical | 0.5 mL/L water | Rotate with Diafenthiuron |
| Pyriproxyfen 10% EC | Chemical | 1 mL/L water | IGR - targets nymphs specifically |
| Yellow Sticky Traps | Organic | 10 traps/acre | Install at canopy height |
| Neem Seed Kernel Extract | Organic | 50 g/L water | Spray early morning |

**Precautions**
- Remove and destroy heavily infested bottom leaves to reduce nymph population
- Avoid continuous use of same chemical — whitefly develops resistance rapidly
- Do NOT spray synthetic pyrethroids — they kill natural predators and cause resurgence
- Install yellow sticky traps at field borders for early warning
- Intercrop with marigold or coriander to attract natural enemies`,
      metadata: {
        citations: [
          { title: 'Central Institute for Cotton Research', url: 'https://cicr.org.in' },
          { title: 'Krishi Jagran', url: 'https://krishijagran.com' },
        ]
      },
    },
  ],
};

const DEMO_AI_RESPONSES = [
  {
    response: `**Diagnosis/Analysis**

Based on your description, the symptoms are consistent with **early-stage nutrient deficiency** — likely nitrogen or potassium. Yellowing of older leaves starting from the tips is a classic sign of potassium deficiency, while uniform yellowing suggests nitrogen shortage.

**Treatment Plan**

| Treatment | Type | Dosage | Timing |
|--------|---------|--------|--------|
| Urea (46% N) | Chemical | 30 kg/acre | Top dress at 30 DAS |
| MOP (60% K₂O) | Chemical | 20 kg/acre | Basal application |
| Vermicompost | Organic | 2 tons/acre | Apply during field preparation |
| Jeevamrut | Organic | 200 L/acre | Drench at 15-day intervals |

**Precautions**
- Get a soil test done to confirm exact deficiency before heavy fertilization
- Split nitrogen doses — don't apply everything at once
- Ensure adequate moisture before fertilizer application
- Yellowing can also indicate waterlogging — check drainage
- Monitor for next 7 days after treatment to confirm recovery`,
    citations: [
      { title: 'ICAR Soil Health Portal', url: 'https://soilhealth.dac.gov.in' },
      { title: 'AgriTech TNAU', url: 'https://agritech.tnau.ac.in' },
    ]
  },
  {
    response: `**Diagnosis/Analysis**

The curling and crinkling of leaves combined with stunted growth points toward a **viral infection** — most likely transmitted by aphids or whiteflies acting as vectors. The mosaic pattern on leaves further supports a viral etiology.

**Treatment Plan**

| Treatment | Type | Dosage | Timing |
|--------|---------|--------|--------|
| Imidacloprid 17.8% SL | Chemical | 0.3 mL/L water | Spray to control vector insects |
| Thiamethoxam 25% WG | Chemical | 0.3 g/L water | Alternate with Imidacloprid |
| Neem Oil (1500 ppm) | Organic | 5 mL/L water | Weekly spray as repellent |
| Yellow Sticky Traps | Organic | 12/acre | For vector monitoring |

**Precautions**
- Remove and burn infected plants immediately — viral diseases have no cure
- Control the insect vector population to prevent further spread
- Wash hands and tools after handling infected plants
- Use virus-resistant varieties in next season
- Maintain field hygiene — remove weed hosts around the field`,
    citations: [
      { title: 'Plant Quarantine India', url: 'https://ppqs.gov.in' },
    ]
  },
  {
    response: `**Diagnosis/Analysis**

The white powdery coating on the upper surface of leaves is characteristic of **Powdery Mildew** caused by *Erysiphe* species. This fungal disease is favored by moderate temperatures (20-25°C) and high relative humidity, though it does NOT require free water on the leaf surface.

**Treatment Plan**

| Treatment | Type | Dosage | Timing |
|--------|---------|--------|--------|
| Sulphur 80% WP | Chemical | 2.5 g/L water | Spray at first appearance |
| Hexaconazole 5% EC | Chemical | 1 mL/L water | Spray at 15-day intervals |
| Azoxystrobin 23% SC | Chemical | 1 mL/L water | Systemic action, use for severe cases |
| Milk Spray (10%) | Organic | 100 mL milk/L water | Weekly preventive spray |
| Potassium Bicarbonate | Organic | 5 g/L water | Disrupts fungal cell walls |

**Precautions**
- Improve air circulation by proper plant spacing and pruning
- Avoid overhead irrigation — use drip or furrow irrigation
- Remove heavily infected leaves and destroy them
- Apply sulphur-based sprays in the evening to avoid leaf burn
- Rotate crops to break the disease cycle`,
    citations: [
      { title: 'IARI New Delhi', url: 'https://iari.res.in' },
      { title: 'Indian Phytopathological Society', url: 'https://ipsdis.org' },
    ]
  },
];

// ─── localStorage Helpers ────────────────────────────────────
function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.warn(`Failed to load ${key} from localStorage:`, e);
  }
  return fallback;
}

function saveToStorage(key: string, value: any) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to save ${key} to localStorage:`, e);
  }
}

function removeFromStorage(key: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

// ─── Context ─────────────────────────────────────────────────
interface DemoContextType {
  isDemoMode: boolean;
  enableDemoMode: () => void;
  disableDemoMode: () => void;
  demoCrops: any[];
  setDemoCrops: React.Dispatch<React.SetStateAction<any[]>>;
  demoSessions: Record<string, any[]>;
  setDemoSessions: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
  demoMessages: Record<string, any[]>;
  setDemoMessages: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
  getDemoAIResponse: () => { response: string; citations: any[] };
  addDemoCrop: (crop: any) => any;
  deleteDemoCrop: (cropId: string) => void;
  addDemoSession: (cropId: string, title: string) => any;
  deleteDemoSession: (sessionId: string, cropId: string) => void;
  renameDemoSession: (sessionId: string, cropId: string, newTitle: string) => void;
  addDemoMessage: (sessionId: string, msg: any) => void;
  getCropName: (cropId: string) => string;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export function DemoProvider({ children }: { children: ReactNode }) {
  // ── Initialize all state from localStorage (persisted) ────
  const [isDemoMode, setIsDemoMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEYS.MODE) === 'true';
    }
    return false;
  });

  const [demoCrops, setDemoCrops] = useState<any[]>(() =>
    loadFromStorage(STORAGE_KEYS.CROPS, DEFAULT_CROPS)
  );

  const [demoSessions, setDemoSessions] = useState<Record<string, any[]>>(() =>
    loadFromStorage(STORAGE_KEYS.SESSIONS, DEFAULT_SESSIONS)
  );

  const [demoMessages, setDemoMessages] = useState<Record<string, any[]>>(() =>
    loadFromStorage(STORAGE_KEYS.MESSAGES, DEFAULT_MESSAGES)
  );

  const [responseIndex, setResponseIndex] = useState(() =>
    loadFromStorage(STORAGE_KEYS.RESP_IDX, 0)
  );

  // ── Persist to localStorage whenever state changes ────────
  useEffect(() => {
    if (isDemoMode) {
      saveToStorage(STORAGE_KEYS.CROPS, demoCrops);
    }
  }, [demoCrops, isDemoMode]);

  useEffect(() => {
    if (isDemoMode) {
      saveToStorage(STORAGE_KEYS.SESSIONS, demoSessions);
    }
  }, [demoSessions, isDemoMode]);

  useEffect(() => {
    if (isDemoMode) {
      saveToStorage(STORAGE_KEYS.MESSAGES, demoMessages);
    }
  }, [demoMessages, isDemoMode]);

  useEffect(() => {
    if (isDemoMode) {
      saveToStorage(STORAGE_KEYS.RESP_IDX, responseIndex);
    }
  }, [responseIndex, isDemoMode]);

  // ── Mode Control ──────────────────────────────────────────
  const enableDemoMode = useCallback(() => {
    setIsDemoMode(true);
    localStorage.setItem(STORAGE_KEYS.MODE, 'true');
    // Set cookie so middleware can detect demo mode
    document.cookie = 'agribud_demo_mode=true; path=/; max-age=604800; SameSite=Lax'; // 7 days

    // Check if user has existing demo data — if not, seed defaults
    const existingCrops = loadFromStorage(STORAGE_KEYS.CROPS, null);
    if (!existingCrops) {
      // First time — seed with default demo data
      setDemoCrops([...DEFAULT_CROPS]);
      setDemoSessions({ ...DEFAULT_SESSIONS });
      setDemoMessages({ ...DEFAULT_MESSAGES });
      saveToStorage(STORAGE_KEYS.CROPS, DEFAULT_CROPS);
      saveToStorage(STORAGE_KEYS.SESSIONS, DEFAULT_SESSIONS);
      saveToStorage(STORAGE_KEYS.MESSAGES, DEFAULT_MESSAGES);
    } else {
      // Returning user — load their persisted data
      setDemoCrops(existingCrops);
      setDemoSessions(loadFromStorage(STORAGE_KEYS.SESSIONS, DEFAULT_SESSIONS));
      setDemoMessages(loadFromStorage(STORAGE_KEYS.MESSAGES, DEFAULT_MESSAGES));
    }
  }, []);

  const disableDemoMode = useCallback(() => {
    setIsDemoMode(false);
    // Remove all demo data from storage
    removeFromStorage(STORAGE_KEYS.MODE);
    removeFromStorage(STORAGE_KEYS.CROPS);
    removeFromStorage(STORAGE_KEYS.SESSIONS);
    removeFromStorage(STORAGE_KEYS.MESSAGES);
    removeFromStorage(STORAGE_KEYS.RESP_IDX);
    // Remove cookie
    document.cookie = 'agribud_demo_mode=; path=/; max-age=0';
  }, []);

  // ── Data Operations ───────────────────────────────────────
  const getDemoAIResponse = useCallback(() => {
    const resp = DEMO_AI_RESPONSES[responseIndex % DEMO_AI_RESPONSES.length];
    setResponseIndex(prev => prev + 1);
    return resp;
  }, [responseIndex]);

  const addDemoCrop = useCallback((cropData: { name: string; date_of_sowing?: string; location?: string }) => {
    const newCrop = {
      id: `demo-crop-${uuidv4().slice(0, 8)}`,
      user_id: 'demo-user',
      name: cropData.name,
      date_of_sowing: cropData.date_of_sowing || null,
      location: cropData.location || null,
      latitude: null,
      longitude: null,
      village_sensor_data: null,
      cubesat_ip: null,
      created_at: new Date().toISOString(),
    };
    setDemoCrops(prev => [newCrop, ...prev]);
    setDemoSessions(prev => ({ ...prev, [newCrop.id]: [] }));
    return newCrop;
  }, []);

  const deleteDemoCrop = useCallback((cropId: string) => {
    setDemoCrops(prev => prev.filter(c => c.id !== cropId));
    setDemoSessions(prev => {
      const next = { ...prev };
      delete next[cropId];
      return next;
    });
    // Also clean up messages for any sessions under this crop
    setDemoMessages(prev => {
      const next = { ...prev };
      // We need to find sessions for this crop
      const sessions = loadFromStorage<Record<string, any[]>>(STORAGE_KEYS.SESSIONS, {});
      (sessions[cropId] || []).forEach(s => delete next[s.id]);
      return next;
    });
  }, []);

  const addDemoSession = useCallback((cropId: string, title: string) => {
    const newSession = {
      id: `demo-session-${uuidv4().slice(0, 8)}`,
      user_id: 'demo-user',
      crop_id: cropId,
      title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setDemoSessions(prev => ({
      ...prev,
      [cropId]: [newSession, ...(prev[cropId] || [])],
    }));
    setDemoMessages(prev => ({ ...prev, [newSession.id]: [] }));
    return newSession;
  }, []);

  const deleteDemoSession = useCallback((sessionId: string, cropId: string) => {
    setDemoSessions(prev => ({
      ...prev,
      [cropId]: (prev[cropId] || []).filter(s => s.id !== sessionId),
    }));
    setDemoMessages(prev => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
  }, []);

  const renameDemoSession = useCallback((sessionId: string, cropId: string, newTitle: string) => {
    setDemoSessions(prev => ({
      ...prev,
      [cropId]: (prev[cropId] || []).map(s => s.id === sessionId ? { ...s, title: newTitle } : s),
    }));
  }, []);

  const addDemoMessage = useCallback((sessionId: string, msg: any) => {
    setDemoMessages(prev => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] || []), msg],
    }));
  }, []);

  const getCropName = useCallback((cropId: string) => {
    const crop = demoCrops.find(c => c.id === cropId);
    return crop?.name || 'Crop';
  }, [demoCrops]);

  return (
    <DemoContext.Provider value={{
      isDemoMode,
      enableDemoMode,
      disableDemoMode,
      demoCrops,
      setDemoCrops,
      demoSessions,
      setDemoSessions,
      demoMessages,
      setDemoMessages,
      getDemoAIResponse,
      addDemoCrop,
      deleteDemoCrop,
      addDemoSession,
      deleteDemoSession,
      renameDemoSession,
      addDemoMessage,
      getCropName,
    }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
}
