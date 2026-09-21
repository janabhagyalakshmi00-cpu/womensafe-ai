# WomenSafe AI

**Intelligent CCTV Safety Monitoring — Phase 1 MVP**

WomenSafe AI is a hackathon-ready prototype that makes existing CCTV footage more useful without adding facial recognition or identity tracking. The application accepts a recorded CCTV-style video, runs real YOLO person detection through OpenCV, evaluates a small set of explainable risk rules, and presents the result as an attention queue for responsible human review.

> **Safety framing:** the application produces **risk indicators**, **potential blind-spot representations**, and **attention alerts**. It does not determine crimes, intent, gender, identity, or whether a person is actually in danger. Every alert requires human verification.

## What is implemented

The MVP implements the full demo path:

```text
Recorded CCTV video
  → FastAPI upload
  → OpenCV frame processing
  → YOLOv8n person detection
  → basic centroid movement/counting
  → configurable monitoring zone
  → explainable risk rules
  → SQLite alerts and event history
  → React dashboard with annotated result video
```

The dashboard includes live backend status, upload and processing controls, real detection statistics, configurable monitoring rules, an annotated result-video player, alert history, camera coverage representation, and a conceptual potential blind-spot gap between Camera 1 / Zone A and Camera 2 / Zone B.

## Architecture

| Layer | Implementation | Responsibility |
| --- | --- | --- |
| Frontend | React 19, Vite, TypeScript, Tailwind-compatible CSS, Lucide | Dashboard, upload workflow, monitoring configuration, result playback |
| API | FastAPI, Uvicorn, Pydantic | Uploads, processing lifecycle, configuration, alerts, events, media delivery |
| Computer vision | OpenCV + Ultralytics YOLOv8n | Person-only detection, confidence scores, bounding boxes, zone checks |
| Risk layer | Python rule module | High-risk time, high activity, prolonged activity, sudden-increase indicators |
| Persistence | SQLite | Settings, camera map, analysis runs, alerts, event history |

The WebDev project scaffold supplies the React development server and standard app shell. The Python service intentionally runs as a separate local process because this MVP requires a Python runtime and CPU-bound computer-vision dependencies.

## Project structure

```text
womensafe-ai/
├── backend/
│   ├── app/
│   │   ├── db.py             # SQLite schema and persistence helpers
│   │   ├── detector.py       # OpenCV + YOLO pipeline and annotated output
│   │   ├── main.py           # FastAPI routes and media endpoints
│   │   ├── risk.py           # Explainable risk-indicator rules
│   │   └── schemas.py        # Pydantic request models
│   ├── data/
│   │   └── sample_cctv.mp4  # Small bundled demo clip with visible people
│   ├── tests/test_risk.py    # Risk-rule tests
│   └── requirements.txt
├── client/src/
│   ├── lib/api.ts            # Typed API client
│   ├── pages/Home.tsx        # Main WomenSafe AI dashboard
│   ├── App.tsx
│   └── index.css             # Product visual system
├── tools/
│   ├── create_sample.py      # Rebuilds the small demo clip if needed
│   └── verify_detection.py   # End-to-end real YOLO verification helper
├── README.md
└── package.json
```

Generated SQLite data, uploaded videos, processed videos, the local Python virtual environment, and downloaded reference images are ignored by Git. The demo MP4 is kept in the project so the first run is easy to demonstrate.

## Requirements

- Python 3.10+ (Python 3.11 or 3.12 recommended)
- Node.js 20+
- pnpm 9+
- A CPU-capable laptop is sufficient for the MVP. A GPU is not required.
- At least 2 GB free disk space for Python packages and the Torch runtime; the actual YOLOv8n weights are downloaded automatically on first analysis.

## Installation

From the project root:

```bash
cd /home/ubuntu/womensafe-ai

# Frontend dependencies
pnpm install

# Python environment and ML/API dependencies
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
```

The first processing run downloads `yolov8n.pt` automatically through Ultralytics. No API key is needed. The model is the lightweight YOLOv8 nano detection model and the detector is restricted to the `person` class.

## Run the backend

Open terminal 1:

```bash
cd /home/ubuntu/womensafe-ai
source backend/.venv/bin/activate
PYTHONPATH=backend uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Check the service:

```bash
curl http://localhost:8000/api/health
```

FastAPI interactive documentation is available at <http://localhost:8000/docs>.

## Run the frontend

Open terminal 2:

```bash
cd /home/ubuntu/womensafe-ai
VITE_API_URL=http://localhost:8000 pnpm dev
```

Open the Vite URL printed in the terminal. If `VITE_API_URL` is omitted, the dashboard defaults to `http://localhost:8000`.

For a browser running on a different machine, set `VITE_API_URL` to a reachable URL for the FastAPI service. CORS is intentionally permissive for this local hackathon prototype; tighten it before production deployment.

## Judge/demo workflow

1. Start the FastAPI backend and the React frontend.
2. Open the dashboard and confirm the top-right pill says **FastAPI connected**.
3. Click **Choose video** or **Select file** and choose `backend/data/sample_cctv.mp4`.
4. Click **Start AI analysis**. The button starts the real background processing task; it does not only change UI text.
5. Wait for the progress state to finish. The annotated result video will show YOLO person boxes, confidence values, the configured green monitoring zone, and the detected-person count.
6. Review the **Alerts requiring review** panel. The sample normally triggers a `high activity` indicator because multiple people are detected in Zone A.
7. Use **Risk configuration** to change the high-risk window, zone name, activity threshold, prolonged-activity threshold, model confidence, or frame stride. Save the rules and rerun a video.
8. Use the download control to save the annotated result video.
9. Point out the **Coverage model** panel: Camera 1 / Zone A and Camera 2 / Zone B are shown with a clearly labelled **Potential blind spot** between them. This is a conceptual coverage-gap representation, not geometric reconstruction.
10. Use the event history and SQLite-backed alert list to show that detections and alerts persist beyond the current component render.

## Backend API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Service and model metadata |
| `GET` | `/api/config` | Current monitoring and model settings |
| `PUT` | `/api/config` | Save monitoring settings |
| `GET` | `/api/cameras` | Camera / zone coverage model |
| `POST` | `/api/upload` | Upload a supported video and create an analysis run |
| `POST` | `/api/runs/{run_id}/process` | Start real YOLO/OpenCV analysis |
| `GET` | `/api/runs/{run_id}` | Poll run status and completed result statistics |
| `GET` | `/api/runs/{run_id}/video` | Stream/download the annotated MP4 |
| `GET` | `/api/runs/{run_id}/preview` | Serve the generated preview frame |
| `GET` | `/api/alerts` | Read persisted attention alerts |
| `GET` | `/api/events` | Read persisted event history |
| `GET` | `/api/summary` | Dashboard overview metrics |

Supported upload extensions are `.mp4`, `.avi`, `.mov`, `.mkv`, `.webm`, `.mpeg`, and `.mpg`.

## How the risk rules work

Risk analysis runs after actual detections are collected. It does not replace the detector and it does not infer intent. The default rules are:

| Rule | Default trigger | Alert meaning |
| --- | --- | --- |
| High-risk zone presence | At least one person is detected in Zone A during 19:00–23:00 | Ask a responsible person to verify the scene during the configured monitoring period |
| High activity | At least 3 people are detected in the zone | Activity met the configured attention threshold |
| Prolonged activity | Zone activity lasts at least 12 seconds | Activity persisted longer than the configured threshold |
| Sudden activity increase | Current count is at least 1.8× the recent count baseline | Activity increased sharply relative to the recent run baseline |

Each alert stores its type, severity, zone, timestamp, and a plain-language reason in SQLite. A run with no detected people reports a meaningful `no_detection` info indicator rather than displaying invented statistics.

## Verification commands

Frontend typecheck and build:

```bash
pnpm check
pnpm build
```

Backend tests and import smoke check:

```bash
PYTHONPATH=backend backend/.venv/bin/pytest -q backend/tests
PYTHONPATH=backend backend/.venv/bin/python -m compileall -q backend/app backend/tests
```

Real YOLO end-to-end check using the bundled clip:

```bash
PYTHONPATH=backend backend/.venv/bin/python tools/verify_detection.py
```

The verification helper creates a run, executes YOLOv8n on the video, writes the annotated result and preview image, persists generated alerts and events, and fails if the detector completes without detecting any people. It is a developer check; the generated runtime files are ignored by Git.

Rebuild the small bundled demo video if it is removed:

```bash
backend/.venv/bin/python tools/create_sample.py
```

The clip is derived from a public Ultralytics reference image with visible people and is processed by the real detector. It is not a synthetic stream of fake detections.

## Limitations and safety boundaries

This is a Phase 1 prototype, not a production surveillance system. The detector can miss people, produce false positives, or degrade with low light, occlusion, camera angle, compression, and unusual scenes. Basic centroid movement is not persistent multi-object tracking. The high-risk clock uses the processing machine's local time. The conceptual blind-spot display does not estimate camera geometry, depth, or real-world coverage. The worker runs in-process as a local demo service; long videos should be processed asynchronously by a production queue or edge worker.

The system deliberately does **not** implement facial recognition, individual identification, gender classification, crime prediction, intent inference, emergency dispatch, notification delivery, real CCTV hardware integration, or automatic decisions about people. Operators should minimize retention, restrict access, review alerts in context, and follow applicable privacy and safety requirements.

## Future scope

Possible future work includes multiple real CCTV streams, stronger multi-camera coverage analysis, more sophisticated anomaly detection, edge deployment, cloud deployment, real-time camera integration, notification services, historical analytics, and privacy-preserving processing. Those items are intentionally not required for this Phase 1 MVP.
