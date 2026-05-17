import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

// ---- Types ----
export type Pyme = {
  id: string;
  name: string;
  website: string;
  owner_email: string | null;
  pushname: string | null;
  created_at: string;
  last_scan_at: string | null;
  last_score: number | null;
};

export type Finding = {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  fix: string;
  fix_time_min: number;
};

export type Scan = {
  id: string;
  pyme_id: string | null;
  url: string;
  domain: string | null;
  score: number;
  summary: string | null;
  findings: Finding[];
  raw: Record<string, unknown>;
  created_at: string;
};

export type PhishingDetection = {
  id: string;
  pyme_id: string | null;
  user_jid: string | null;
  pushname: string | null;
  kind: "text" | "image" | "url";
  risk: "rojo" | "amarillo" | "verde";
  confidence: number | null;
  category: string | null;
  red_flags: string[];
  explanation: string | null;
  recommended_action: string | null;
  raw_content: string | null;
  created_at: string;
};

export type PymeOverview = Pyme & {
  red_count: number;
  yellow_count: number;
  total_detections: number;
};
