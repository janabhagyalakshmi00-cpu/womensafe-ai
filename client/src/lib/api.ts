function resolveApiBase() {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window === "undefined") return "http://localhost:8000";
  const current = new URL(window.location.href);
  if (current.hostname === "localhost" || current.hostname === "127.0.0.1") {
    current.port = "8000";
    return current.origin;
  }
  if (current.hostname.startsWith("3000-")) {
    current.hostname = `8000-${current.hostname.slice(5)}`;
    return current.origin;
  }
  return "http://localhost:8000";
}

export const API_BASE = resolveApiBase();

export type Settings = {
  high_risk_start: string;
  high_risk_end: string;
  zone_name: string;
  zone_x: number;
  zone_y: number;
  zone_width: number;
  zone_height: number;
  high_activity_count: number;
  prolonged_seconds: number;
  sudden_increase_ratio: number;
  confidence: number;
  frame_stride: number;
};

export type Alert = {
  id: number;
  run_id: string;
  alert_type: string;
  severity: "high" | "medium" | "info";
  zone_name: string;
  reason: string;
  created_at: string;
  status: string;
};

export type Camera = {
  id: number;
  name: string;
  zone_name: string;
  status: string;
  position: "left" | "right";
  coverage: string;
};

export type Run = {
  id: string;
  filename: string;
  input_path: string;
  status: "uploaded" | "processing" | "completed" | "failed";
  uploaded_at: string;
  started_at?: string;
  completed_at?: string;
  progress: number;
  frame_count: number;
  processed_frames: number;
  total_people: number;
  max_people: number;
  error?: string | null;
  results?: {
    stats: {
      model: string;
      fps: number;
      duration_seconds: number;
      processed_frames: number;
      frame_stride: number;
      total_people_detections: number;
      max_people: number;
      max_zone_count: number;
      zone_presence_frames: number;
      max_consecutive_zone_frames: number;
      movement_events: number;
      sudden_increase: boolean;
      last_frame_detections: Array<{
        confidence: number;
        bbox: number[];
        centroid: number[];
        in_zone: boolean;
      }>;
      timeline: Array<{ time_seconds: number; people: number; zone_people: number }>;
      zone: { name: string; x: number; y: number; width: number; height: number };
    };
    alerts: Array<{ alert_type: string; severity: string; reason: string }>;
  } | null;
};

export type Summary = {
  cameras_active: number;
  people_detected: number;
  active_alerts: number;
  potential_blind_spots: number;
  latest_run: Run | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || `Request failed with status ${response.status}`);
  }
  return payload as T;
}

export const api = {
  health: () => request<{ status: string; model: string }>("/api/health"),
  summary: () => request<Summary>("/api/summary"),
  config: () => request<Settings>("/api/config"),
  updateConfig: (settings: Settings) => request<Settings>("/api/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) }),
  cameras: () => request<Camera[]>("/api/cameras"),
  alerts: () => request<Alert[]>("/api/alerts?limit=20"),
  events: () => request<Array<Record<string, unknown>>>("/api/events?limit=30"),
  run: (id: string) => request<Run>(`/api/runs/${id}`),
  upload: async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<{ run: Run; message: string }>("/api/upload", { method: "POST", body });
  },
  detect: async (file: File) => {
  const body = new FormData();
  body.append("file", file);
  return request<any>("/api/detect", {
    method: "POST",
    body,
  });
},
  process: (id: string) => request<{ run: Run; message: string }>(`/api/runs/${id}/process`, { method: "POST" }),
};
