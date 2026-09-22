from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import os
import shutil

app = FastAPI(title="WomenSafe AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:3000",
    "http://localhost:3001",
    "https://womensafe-ai-frontend.onrender.com",
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = YOLO("../yolov8n.pt")


@app.get("/api/health")
def health():
    return {"status": "ok", "model": "YOLOv8n"}


@app.get("/api/model-status")
def model_status():
    return {"model": "YOLOv8n", "status": "loaded"}


@app.get("/api/summary")
def summary():
    return {
        "latest_run": None,
        "people_detected": 0,
        "active_alerts": 0,
        "cameras_active": 1
    }


@app.get("/api/cameras")
def cameras():
    return [
        {
            "id": "camera-1",
            "name": "Camera 1",
            "status": "active"
        }
    ]


@app.get("/api/alerts")
def alerts(limit: int = 20):
    return []


@app.get("/api/events")
def events(limit: int = 30):
    return []

DEFAULT_CONFIG = {
    "high_risk_start": "18:00",
    "high_risk_end": "22:00",
    "zone_name": "Zone A",
    "zone_x": 0,
    "zone_y": 0,
    "zone_width": 100,
    "zone_height": 100,
    "high_activity_count": 5,
    "prolonged_seconds": 30,
    "sudden_increase_ratio": 2.0,
    "confidence": 0.5,
    "frame_stride": 5
}


@app.get("/api/config")
def get_config():
    return DEFAULT_CONFIG


@app.put("/api/config")
def update_config(settings: dict):
    DEFAULT_CONFIG.update(settings)
    return DEFAULT_CONFIG

@app.post("/api/upload")
async def upload_video(file: UploadFile = File(...)):
    os.makedirs("uploads", exist_ok=True)

    file_path = os.path.join("uploads", file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    run = {
        "id": file.filename,
        "status": "uploaded",
        "filename": file.filename,
    }

    return {
        "run": run,
        "message": "Video uploaded successfully"
    }

@app.post("/api/detect")
async def detect(file: UploadFile = File(...)):
    os.makedirs("uploads", exist_ok=True)

    path = os.path.join("uploads", file.filename)

    with open(path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    results = model(
        path,
        stream=True,
        vid_stride=10,
        imgsz=320,
        conf=0.6
    )

    detections = []
    total_people = 0
    max_people_in_frame = 0

    for result in results:
        frame_people = 0

        if result.boxes is not None:
            for box in result.boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                class_name = model.names[class_id]

                # Only count person detections
                if class_name == "person":
                    frame_people += 1
                    total_people += 1

                    detections.append({
                        "class": "person",
                        "confidence": round(confidence, 2)
                    })

        max_people_in_frame = max(
            max_people_in_frame,
            frame_people
        )

    # Phase-1 alert rule
    alert = None

    if max_people_in_frame >= 10:
        alert = {
            "severity": "high",
            "title": "High activity detected",
            "message": f"{max_people_in_frame} people detected in a single analyzed frame.",
            "requires_review": True
        }

    return {
        "filename": file.filename,
        "detections": detections,
        "total_people_detections": total_people,
        "max_people_in_frame": max_people_in_frame,
        "alert": alert
    }