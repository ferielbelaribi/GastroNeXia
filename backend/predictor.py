import os
import random
import base64

import cv2
import numpy as np
import torch
import torch.nn as nn
import torchvision.models as tv_models
import torchvision.transforms as T
from pytorch_grad_cam import GradCAMPlusPlus
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from scipy.ndimage import gaussian_filter
from skimage import exposure
from ultralytics import YOLO

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
CLF_SIZE = 224
CROP_MARGIN = 30
ALPHA = 0.65
SEED = 42

CLF_TRANSFORM = T.Compose([
    T.ToPILImage(),
    T.Resize((CLF_SIZE, CLF_SIZE)),
    T.ToTensor(),
    T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


def _set_deterministic(seed: int = SEED):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False
    os.environ["PYTHONHASHSEED"] = str(seed)


def _encode(img_bgr: np.ndarray) -> str:
    _, buf = cv2.imencode(".jpg", img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return "data:image/jpeg;base64," + base64.b64encode(buf).decode()


# Architecture matches the training notebook (EfficientNetPolyp — 1280→512→256→2)
class EfficientNetPolyp(nn.Module):
    def __init__(self):
        super().__init__()
        self.backbone = tv_models.efficientnet_b0(
            weights=tv_models.EfficientNet_B0_Weights.DEFAULT
        )
        num_features = self.backbone.classifier[1].in_features
        self.backbone.classifier = nn.Sequential(
            nn.Dropout(0.4),
            nn.Linear(num_features, 512),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(512, 256),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(256, 2),
        )

    def forward(self, x):
        features = self.backbone.features(x)
        pooled = self.backbone.avgpool(features)
        flattened = torch.flatten(pooled, 1)
        return self.backbone.classifier(flattened), features


class PolypPredictor:
    def __init__(self, weights_path: str):
        _set_deterministic(SEED)

        print(f"  Loading YOLO from {weights_path} ...")
        self.yolo = YOLO(weights_path)

        xai_path = os.path.join(os.path.dirname(weights_path), "efficientnet_polyp_final.pt")
        print(f"  Loading EfficientNetPolyp from {xai_path} ...")
        self.clf = EfficientNetPolyp().to(DEVICE)

        ckpt = torch.load(xai_path, map_location=DEVICE, weights_only=False)
        state_dict = ckpt.get("model_state_dict", ckpt)
        self.clf.load_state_dict(state_dict, strict=True)
        self.clf.eval()

        # Multi-layer GradCAM++ — middle layer + last layer (like training notebook)
        self.cam = GradCAMPlusPlus(
            model=self.clf.backbone,
            target_layers=[
                self.clf.backbone.features[6],
                self.clf.backbone.features[-1],
            ],
        )
        print(f"  Ready — device: {DEVICE}")

    def _detect(self, image_bgr: np.ndarray):
        res = self.yolo(image_bgr, conf=0.25, iou=0.45, imgsz=640, verbose=False)[0]
        if res.boxes is None or len(res.boxes) == 0:
            return []
        boxes = res.boxes.xyxy.cpu().numpy().astype(int)
        scores = res.boxes.conf.cpu().numpy()
        return list(zip(boxes, scores))

    def _enhance_crop(self, crop: np.ndarray) -> np.ndarray:
        try:
            lab = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
            enhanced = cv2.cvtColor(cv2.merge([clahe.apply(l), a, b]), cv2.COLOR_LAB2BGR)
            kernel = np.array([[-0.1, -0.1, -0.1],
                                [-0.1,  1.8, -0.1],
                                [-0.1, -0.1, -0.1]])
            return cv2.filter2D(enhanced, -1, kernel)
        except Exception:
            return crop

    def _heatmap_for_crop(self, crop_bgr: np.ndarray) -> np.ndarray:
        rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
        tensor = CLF_TRANSFORM(rgb).unsqueeze(0).to(DEVICE)
        self.clf.eval()

        with torch.enable_grad():
            cams = self.cam(
                input_tensor=tensor,
                targets=[ClassifierOutputTarget(1)],
                aug_smooth=True,
                eigen_smooth=True,
            )

        # Fuse middle + last layer: 0.4 / 0.6 weights (same as training notebook)
        if isinstance(cams, list) and len(cams) >= 2:
            hm = cams[0] * 0.4 + cams[1] * 0.6
        elif isinstance(cams, list):
            hm = cams[0]
        else:
            hm = cams

        if hm.ndim == 3:
            hm = hm.squeeze(0)

        hm = gaussian_filter(hm, sigma=1.2)
        p2, p98 = np.percentile(hm, (1, 99))
        hm = exposure.rescale_intensity(hm, in_range=(p2, p98), out_range=(0, 1))
        thr = np.percentile(hm, 10)
        hm = np.where(hm > thr, hm, hm * 0.1)
        hm = (hm - hm.min()) / (hm.max() - hm.min() + 1e-8)

        ch, cw = crop_bgr.shape[:2]
        return cv2.resize(hm, (cw, ch))

    def _gradcam(self, image_bgr: np.ndarray, box):
        h, w = image_bgr.shape[:2]
        x1, y1, x2, y2 = box.astype(int)
        bw, bh = x2 - x1, y2 - y1

        margin_x = max(CROP_MARGIN, int(bw * 0.3))
        margin_y = max(CROP_MARGIN, int(bh * 0.3))

        x1c = max(0, x1 - margin_x)
        y1c = max(0, y1 - margin_y)
        x2c = min(w, x2 + margin_x)
        y2c = min(h, y2 + margin_y)

        crop = image_bgr[y1c:y2c, x1c:x2c].copy()
        if crop.size == 0:
            return image_bgr, image_bgr

        crop = self._enhance_crop(crop)
        hm_crop = self._heatmap_for_crop(crop)

        # Paste onto full canvas — zeros outside crop give dark-blue (no activation) in JET
        canvas_hm = np.zeros((h, w), dtype=np.float32)
        dest_h, dest_w = y2c - y1c, x2c - x1c
        canvas_hm[y1c:y2c, x1c:x2c] = cv2.resize(hm_crop, (dest_w, dest_h))
        canvas_hm = gaussian_filter(canvas_hm, sigma=4)

        hm_u8 = (np.clip(canvas_hm, 0, 1) * 255).astype(np.uint8)

        # Pure JET colormap — classic rainbow: blue→cyan→green→yellow→red
        hm_color = cv2.applyColorMap(hm_u8, cv2.COLORMAP_JET)

        overlay = cv2.addWeighted(image_bgr, 1 - ALPHA, hm_color, ALPHA, 0)
        cv2.rectangle(overlay, (x1, y1), (x2, y2), (0, 255, 0), 3)

        return crop, overlay

    def analyze(self, image_bgr: np.ndarray) -> dict:
        h, w = image_bgr.shape[:2]
        raw_dets = self._detect(image_bgr)
        detections = []

        for i, (box, score) in enumerate(raw_dets):
            x1, y1, x2, y2 = box
            crop_bgr, overlay_bgr = self._gradcam(image_bgr, box)

            bbox = {
                "x": round(float(x1) / w * 100, 2),
                "y": round(float(y1) / h * 100, 2),
                "w": round(float(x2 - x1) / w * 100, 2),
                "h": round(float(y2 - y1) / h * 100, 2),
            }

            detections.append({
                "id":            i + 1,
                "label":         "Polyp",
                "yoloConf":      round(float(score), 3),
                "confidence":    round(float(score) * 100, 1),
                "severity":      "high",
                "location":      f"Lesion {i + 1}",
                "bbox":          bbox,
                "cropBase64":    _encode(crop_bgr),
                "gradcamBase64": _encode(overlay_bgr),
            })

        return {
            "detections":    detections,
            "totalDetected": len(detections),
            "overallRisk":   "high" if detections else "low",
            "modelVersion":  "YOLOv8 + EfficientNet-B0 + GradCAM++",
        }
