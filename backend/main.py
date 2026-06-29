import io
import time
import logging
import cv2
import numpy as np
from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Request

logging.basicConfig(level=logging.INFO)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from predictor              import PolypPredictor
from segmentor              import PolypSegmentor
from unet_esophagitis_segmentor import UNetEsophagitisSegmentor


app = FastAPI(title="GastroNeXia AI Server", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

predictor = PolypPredictor(weights_path="weights/yolo-final.pt")

segmentor = PolypSegmentor(
    weights_path="weights/best_model_pp_v2.pt",
    threshold=0.5,
    use_tta=True,
    img_size=256,
)

esophagitis_segmentor = UNetEsophagitisSegmentor(
    weights_path="weights/unet_esophagitis_best.pth",
    threshold=0.65,   # optimal threshold from notebook val-set tuning
)


def _read_image(data: bytes) -> np.ndarray:
    pil = Image.open(io.BytesIO(data)).convert("RGB")
    return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Only image files are supported")

    start     = time.time()
    contents  = await file.read()

    try:
        image_bgr = _read_image(contents)
    except Exception:
        raise HTTPException(400, "Could not decode image")

    result           = predictor.analyze(image_bgr)
    result["duration"] = f"{round(time.time() - start, 2)}s"
    return JSONResponse(result)


@app.post("/detect")
async def detect_fast(file: UploadFile = File(...)):
    """YOLO-only endpoint for live video monitoring — no GradCAM, no EfficientNet."""
    start    = time.time()
    contents = await file.read()

    try:
        image_bgr = _read_image(contents)
    except Exception:
        raise HTTPException(400, "Could not decode image")

    h, w     = image_bgr.shape[:2]
    raw_dets = predictor._detect(image_bgr)
    logging.info(f"[/detect] image={w}x{h}  raw_detections={len(raw_dets)}")
    detections = []

    for i, (box, score) in enumerate(raw_dets):
        x1, y1, x2, y2 = [int(v) for v in box]
        detections.append({
            "id":         i + 1,
            "label":      "Polyp",
            "yoloConf":   round(float(score), 3),
            "confidence": round(float(score) * 100, 1),
            "severity":   "high",
            "location":   f"Lesion {i + 1}",
            "bbox": {
                "x": round(x1 / w * 100, 2),
                "y": round(y1 / h * 100, 2),
                "w": round((x2 - x1) / w * 100, 2),
                "h": round((y2 - y1) / h * 100, 2),
            },
        })

    return JSONResponse({
        "detections":    detections,
        "totalDetected": len(detections),
        "overallRisk":   "high" if detections else "low",
        "modelVersion":  "YOLOv8-fast",
        "duration":      f"{round(time.time() - start, 3)}s",
    })

@app.post("/segment")
async def segment_endpoint(
    file:  UploadFile = File(...),
    boxes: str        = Form(default=""),   # JSON array of {x,y,w,h} in %
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Only image files are supported")

    start    = time.time()
    contents = await file.read()

    try:
        image_bgr = _read_image(contents)
    except Exception:
        raise HTTPException(400, "Could not decode image")

    parsed_boxes = []
    if boxes:
        try:
            import json as _json
            parsed_boxes = _json.loads(boxes)
        except Exception:
            parsed_boxes = []

    if parsed_boxes:
        result = segmentor.segment_roi(image_bgr, parsed_boxes)
    else:
        result = segmentor.segment(image_bgr)

    result["duration"] = f"{round(time.time() - start, 2)}s"
    return JSONResponse(result)


@app.post("/segment-esophagitis")
async def segment_esophagitis_endpoint(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Only image files are supported")

    start    = time.time()
    contents = await file.read()

    try:
        image_bgr = _read_image(contents)
    except Exception:
        raise HTTPException(400, "Could not decode image")

    result             = esophagitis_segmentor.segment(image_bgr)
    result["duration"] = f"{round(time.time() - start, 2)}s"
    return JSONResponse(result)
 





