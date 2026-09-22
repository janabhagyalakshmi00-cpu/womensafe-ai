import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Camera,
  CheckCircle2,
  Clock3,
  Download,
  FileVideo,
  Info,
  Loader2,
  MapPin,
  Play,
  ScanLine,
  Settings2,
  ShieldCheck,
  Upload,
  Users,
  Video,
  Wifi,
  XCircle,
} from "lucide-react";
import { API_BASE, Alert, Camera as CameraType, Run, Settings, Summary, api } from "@/lib/api";

const emptySettings: Settings = {
  high_risk_start: "19:00",
  high_risk_end: "23:00",
  zone_name: "Zone A",
  zone_x: 0.2,
  zone_y: 0.18,
  zone_width: 0.6,
  zone_height: 0.64,
  high_activity_count: 3,
  prolonged_seconds: 12,
  sudden_increase_ratio: 1.8,
  confidence: 0.35,
  frame_stride: 2,
};

function formatTime(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(seconds?: number) {
  if (!seconds) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins ? `${mins}m ${secs}s` : `${secs}s`;
}

function statusLabel(run: Run | null, backendOnline: boolean) {
  if (!backendOnline) return { label: "Backend offline", tone: "offline" };
  if (!run) return { label: "Ready for video", tone: "ready" };
  if (run.status === "processing") return { label: "AI processing", tone: "processing" };
  if (run.status === "completed") return { label: "Analysis complete", tone: "complete" };
  if (run.status === "failed") return { label: "Processing failed", tone: "failed" };
  return { label: "Video uploaded", tone: "ready" };
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "high") return <AlertTriangle size={16} />;
  if (severity === "medium") return <Activity size={16} />;
  return <Info size={16} />;
}

export default function Home() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [run, setRun] = useState<Run | null>(null);
  const [detections, setDetections] = useState<any[]>([]);
  const [backendOnline, setBackendOnline] = useState(false);
  const [backendError, setBackendError] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
  try {
    const health = await api.health();

    setBackendOnline(health.status === "ok");
    setBackendError("");

    const [nextSummary, nextAlerts, nextCameras] = await Promise.all([
      api.summary(),
      api.alerts(),
      api.cameras(),
    ]);

    setSummary(nextSummary);

    if (nextSummary.latest_run) {
      setRun(nextSummary.latest_run);
    }

    setAlerts(nextAlerts);
    setCameras(nextCameras);
  } catch (error) {
    setBackendOnline(false);
    setBackendError(
      error instanceof Error
        ? error.message
        : "Could not reach the FastAPI service."
    );
  }
};

  useEffect(() => {
    refresh();
    api.config().then(setSettings).catch(() => undefined);
    const interval = window.setInterval(() => {
      if (run?.status === "processing") {
        api.run(run.id).then(setRun).catch(() => undefined);
      } else {
        refresh();
      }
    }, 2500);
    return () => window.clearInterval(interval);
  }, [run?.id, run?.status]);

  const currentStatus = statusLabel(run, backendOnline);
  const currentAlerts = useMemo(() => alerts.slice(0, 5), [alerts]);
  const stats = run?.results?.stats;
  const latestDetections = stats?.last_frame_detections || [];

  const handleFile = async (file?: File) => {
  if (!file) return;

  setBusy(true);
  setBackendError("");
  setFileName(file.name);

  try {
    const result = await api.upload(file);
    await refresh();
    setRun(result.run);
  } catch (error) {
    setBackendError(
      error instanceof Error ? error.message : "Video upload failed."
    );
  } finally {
    setBusy(false);
  }
};

const startAnalysis = async () => {
  if (!run) {
    setBackendError("Please select the video again.");
    return;
  }

  setBusy(true);
  setBackendError("");

  try {
    const result = await api.process(run.id);

    setRun(result.run);

    await refresh();
  } catch (error) {
    console.error("ANALYSIS ERROR:", error);

    setBackendError(
      error instanceof Error ? error.message : "AI analysis failed."
    );
  } finally {
    setBusy(false);
  }
};

  const saveConfig = async () => {
    setSavingConfig(true);
    setConfigSaved(false);
    try {
      const nextSettings = await api.updateConfig(settings);
      setSettings(nextSettings);
      setConfigSaved(true);
      window.setTimeout(() => setConfigSaved(false), 2500);
    } catch (error) {
      setBackendError(error instanceof Error ? error.message : "Could not save monitoring rules.");
    } finally {
      setSavingConfig(false);
    }
  };

  const activePeople = stats?.max_people ?? summary?.people_detected;
  const alertCount = summary?.active_alerts ?? 0;
  const blindSpots = summary?.potential_blind_spots ?? 0;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><ShieldCheck size={22} strokeWidth={2.4} /></div>
          <div>
            <div className="brand-name">WomenSafe <span>AI</span></div>
            <div className="brand-subtitle">Intelligent CCTV safety monitoring</div>
          </div>
        </div>
        <div className="topbar-actions">
          <div className={`service-pill ${backendOnline ? "online" : "offline"}`}><span className="service-dot" /> {backendOnline ? "FastAPI connected" : "FastAPI offline"}</div>
          <button className="icon-button" onClick={refresh} title="Refresh monitoring data" aria-label="Refresh monitoring data"><Wifi size={17} /></button>
          <div className="operator-chip"><div className="operator-avatar">RM</div><div><strong>Demo operator</strong><span>Monitoring desk</span></div></div>
        </div>
      </header>

      <main className="page-content">
        <section className="hero-row">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> SAFETY OPERATIONS / PHASE 1 MVP</div>
            <h1>Make existing cameras <em>smarter.</em></h1>
            <p className="hero-copy">A risk-aware monitoring layer that turns CCTV video into explainable attention alerts — without facial recognition or identity tracking.</p>
          </div>
          <div className="hero-status-card">
            <div className="hero-status-top"><span className="status-kicker">CURRENT MONITORING STATE</span><span className={`state-dot ${currentStatus.tone}`} /></div>
            <div className={`hero-state ${currentStatus.tone}`}>{currentStatus.label}</div>
            <div className="hero-status-meta">{run ? `${run.filename} · ${run.status}` : "Upload a CCTV-style recording to begin"}</div>
          </div>
        </section>

        <section className="metric-grid" aria-label="Monitoring overview">
          <MetricCard icon={<Camera size={18} />} label="Cameras active" value={backendOnline ? String(summary?.cameras_active ?? 0).padStart(2, "0") : "—"} detail="Connected to monitoring map" accent="teal" />
          <MetricCard icon={<Users size={18} />} label="Person detections" value={detections.length > 0 ? String(detections.length).padStart(2, "0") : "00"} detail={`${detections.length} detections across analyzed frames`} accent="blue" />
          <MetricCard icon={<AlertTriangle size={18} />} label="Active alerts" value={backendOnline ? String(alertCount).padStart(2, "0") : "—"} detail="Requires human verification" accent="amber" />
          <MetricCard icon={<MapPin size={18} />} label="Potential blind spots" value={backendOnline ? String(blindSpots).padStart(2, "0") : "—"} detail="Prototype coverage gap" accent="rose" />
        </section>

        {backendError && <div className="system-banner error"><XCircle size={17} /><span>{backendError}</span><button onClick={refresh}>Retry connection</button></div>}

        <section className="workspace-grid">
          <div className="panel analysis-panel">
            <div className="panel-heading">
              <div><div className="section-label">LIVE ANALYSIS WORKSPACE</div><h2>Camera 1 <span>·</span> Zone A</h2></div>
              <div className={`analysis-badge ${currentStatus.tone}`}><span className="status-dot" /> {currentStatus.label}</div>
            </div>
            <div className="video-stage">
              {run?.status === "completed" ? (
                <video key={run.id} src={`${API_BASE}/api/runs/${run.id}/video`} poster={`${API_BASE}/api/runs/${run.id}/preview`} controls className="result-video"><track kind="captions" /></video>
              ) : run?.status === "processing" ? (
                <div className="processing-state"><div className="scan-graphic"><ScanLine size={52} /><div className="scan-beam" /></div><h3>Running YOLO person detection</h3><p>OpenCV is analyzing frames on the FastAPI worker. This can take a moment on CPU.</p><div className="progress-track"><div className="progress-value" style={{ width: `${Math.max(8, (run.progress || 0) * 100)}%` }} /></div><span>{Math.round((run.progress || 0) * 100)}% of frames scanned</span></div>
              ) : (
                <div className="video-empty"><div className="empty-icon"><FileVideo size={30} /></div><h3>Upload a CCTV-style video</h3><p>The processed video will appear here with real person bounding boxes, confidence scores, and the configured monitoring zone.</p><button className="primary-button" onClick={() => fileInputRef.current?.click()} disabled={!backendOnline || busy}><Upload size={17} /> Choose video</button><span className="file-hint">MP4, AVI, MOV, MKV, WEBM · local processing only</span></div>
              )}
              {run?.status === "completed" && <div className="video-overlay-chip"><span className="live-dot" /> ANNOTATED RESULT <span>·</span> YOLOv8n</div>}
            </div>
            <div className="analysis-footer">
              <div className="file-context"><div className="file-icon"><Video size={17} /></div><div><strong>{fileName || run?.filename || "No video selected"}</strong><span>{run ? `${formatDuration(stats?.duration_seconds)} · ${stats?.processed_frames ?? 0} inference frames` : "Awaiting upload"}</span></div></div>
              <div className="analysis-actions">
                {run?.status === "completed" && <a className="secondary-button" href={`${API_BASE}/api/runs/${run.id}/video`} download><Download size={16} /> Download result</a>}
                {run && run.status !== "processing" && run.status !== "completed" && <button
  type="button"
  className="primary-button compact"
  onClick={startAnalysis}
  disabled={busy}
>
  <Play size={16} />
  {busy ? "Analyzing…" : "Start AI analysis"}
</button>}
                {!run && <button className="secondary-button" onClick={() => fileInputRef.current?.click()} disabled={!backendOnline || busy}><Upload size={16} /> Select file</button>}
              </div>
            </div>
            <input
  ref={fileInputRef}
  type="file"
  hidden
  accept="video/*,.mkv"
  onChange={(event) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }}
/>
          </div>

          <div className="panel rule-panel">
            <div className="panel-heading"><div><div className="section-label">RISK CONFIGURATION</div><h2>Rules that explain the why</h2></div><Settings2 size={19} className="muted-icon" /></div>
            <p className="panel-intro">Adjust the attention indicators for this monitoring zone. These rules do not predict crimes or intent.</p>
            <div className="rule-grid">
              <label>High-risk window<div className="time-fields"><input type="time" value={settings.high_risk_start} onChange={(e) => setSettings({ ...settings, high_risk_start: e.target.value })} /><span>to</span><input type="time" value={settings.high_risk_end} onChange={(e) => setSettings({ ...settings, high_risk_end: e.target.value })} /></div></label>
              <label>Monitored zone<input value={settings.zone_name} onChange={(e) => setSettings({ ...settings, zone_name: e.target.value })} /></label>
              <label>High activity threshold<input type="number" min="1" value={settings.high_activity_count} onChange={(e) => setSettings({ ...settings, high_activity_count: Number(e.target.value) })} /><small>people in zone</small></label>
              <label>Prolonged activity<input type="number" min="1" value={settings.prolonged_seconds} onChange={(e) => setSettings({ ...settings, prolonged_seconds: Number(e.target.value) })} /><small>seconds</small></label>
              <label>Model confidence<input type="number" min="0.05" max="0.99" step="0.05" value={settings.confidence} onChange={(e) => setSettings({ ...settings, confidence: Number(e.target.value) })} /><small>YOLO threshold</small></label>
              <label>Frame stride<input type="number" min="1" max="10" value={settings.frame_stride} onChange={(e) => setSettings({ ...settings, frame_stride: Number(e.target.value) })} /><small>lower = more frames</small></label>
            </div>
            <button className="secondary-button save-button" onClick={saveConfig} disabled={savingConfig || !backendOnline}>{savingConfig ? <Loader2 size={16} className="spin" /> : configSaved ? <CheckCircle2 size={16} /> : <Settings2 size={16} />} {configSaved ? "Rules saved" : "Save monitoring rules"}</button>
            <div className="rule-note"><Info size={15} /><span>Every attention alert includes the detection condition and asks a responsible person to verify the situation.</span></div>
          </div>
        </section>

        <section className="lower-grid">
          <div className="panel alerts-panel">
            <div className="panel-heading"><div><div className="section-label">ATTENTION QUEUE</div><h2>Alerts requiring review</h2></div><span className="count-badge">{alertCount} open</span></div>
            {currentAlerts.length ? <div className="alert-list">{currentAlerts.map((alert) => <div className="alert-row" key={alert.id}><div className={`alert-severity ${alert.severity}`}><SeverityIcon severity={alert.severity} /></div><div className="alert-copy"><div className="alert-title">{alert.alert_type.replaceAll("_", " ")}<span className={`severity-label ${alert.severity}`}>{alert.severity}</span></div><p>{alert.reason}</p><span className="alert-meta"><Clock3 size={12} /> {formatTime(alert.created_at)} <span>·</span> <MapPin size={12} /> {alert.zone_name}</span></div><ArrowUpRight size={17} className="alert-arrow" /></div>)}</div> : <div className="empty-list"><CheckCircle2 size={24} /><strong>No generated alerts yet</strong><span>Run an analysis to evaluate the configured rules against actual detections.</span></div>}
          </div>

          <div className="panel coverage-panel">
            <div className="panel-heading"><div><div className="section-label">COVERAGE MODEL</div><h2>Where the cameras see</h2></div><span className="prototype-tag">PROTOTYPE</span></div>
            <div className="coverage-map">
              <div className="coverage-line left-line" /><div className="coverage-line right-line" /><div className="gap-label"><span className="gap-dash" /><strong>Potential blind spot</strong><small>coverage gap between zones</small></div>
              {cameras.map((camera) => <div className={`camera-node ${camera.position}`} key={camera.id}><div className="camera-icon"><Camera size={17} /></div><div><strong>{camera.name}</strong><span>{camera.zone_name}</span></div><i /></div>)}
            </div>
            <div className="coverage-disclaimer"><Info size={14} /> This is a conceptual coverage representation, not real-world camera geometry.</div>
          </div>
        </section>

        <section className="panel history-panel">
          <div className="panel-heading"><div><div className="section-label">EVENT HISTORY</div><h2>Recent system activity</h2></div><div className="history-meta"><Activity size={16} /> Persistent in SQLite</div></div>
          <div className="history-table"><div className="history-head"><span>Event</span><span>Run</span><span>Time</span><span>Status</span></div>{alerts.slice(0, 4).map((alert) => <div className="history-row" key={`history-${alert.id}`}><span><span className={`history-dot ${alert.severity}`} />{alert.alert_type.replaceAll("_", " ")}</span><span className="mono">{alert.run_id.slice(0, 8)}</span><span>{formatTime(alert.created_at)}</span><span className={`status-text ${alert.status}`}>{alert.status}</span></div>)}{!alerts.length && <div className="history-empty">Event history will populate from actual video analysis runs.</div>}</div>
        </section>

        <footer className="privacy-footer"><ShieldCheck size={15} /><span><strong>Privacy by design.</strong> No facial recognition. No identity tracking. Outputs are risk indicators only and must be reviewed by responsible monitoring personnel.</span><span className="footer-model">YOLOv8n · OpenCV · FastAPI</span></footer>
      </main>
    </div>
  );
}

function MetricCard({ icon, label, value, detail, accent }: { icon: React.ReactNode; label: string; value: string; detail: string; accent: string }) {
  return <div className={`metric-card ${accent}`}><div className="metric-top"><span className="metric-icon">{icon}</span><span className="metric-label">{label}</span></div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></div>;
}
