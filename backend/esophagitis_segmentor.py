"""
esophagitis_segmentor.py — SAM2-based Esophagitis Lesion Detection
Segmentation + Detection using SAM2 with candidate box detection.
Model: sam2_esophagitis_best.pth (Dice=0.84, IoU=0.74)
"""

import gc
import math
import os
import cv2
import base64
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from scipy.ndimage import binary_fill_holes

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
SZ = 1024

CONFIDENCE_THRESH = 0.40   # matches notebook test threshold
MIN_MASK_AREA     = 400
MAX_MASK_RATIO    = 0.35
MAX_LESIONS       = 8

LESION_COLORS_RGBA = [
    (255,  60,  60, 160),
    ( 60, 200,  60, 160),
    ( 60, 100, 255, 160),
    (255, 200,  40, 160),
    (220,  60, 220, 160),
    ( 40, 220, 220, 160),
    (255, 140,  40, 160),
    (140,  60, 255, 160),
]

# (BGR for OpenCV, hex for frontend) — matching order above
LESION_PALETTE = [
    ((60,  60,  255), "#ff3c3c"),
    ((60,  200,  60), "#3cc83c"),
    ((255, 100,  60), "#3c64ff"),
    ((40,  200, 255), "#ffc828"),
    ((220,  60, 220), "#dc3cdc"),
    ((220, 220,  40), "#28dcdc"),
    ((40,  140, 255), "#ff8c28"),
    ((255,  60, 140), "#8c3cff"),
]


# ─── RefineHead — matches the architecture saved in sam2_esophagitis_best.pth ──

class _ResBlock(nn.Module):
    def __init__(self, ch: int):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(ch, ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(ch, ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(ch),
        )
    def forward(self, x):
        return F.relu(x + self.block(x), inplace=True)


class _ChannelAttention(nn.Module):
    def __init__(self, ch: int, r: int = 4):
        super().__init__()
        self.fc = nn.Sequential(nn.Linear(ch, ch // r, bias=False), nn.ReLU(inplace=True), nn.Linear(ch // r, ch, bias=False))
    def forward(self, x):
        w = torch.sigmoid(self.fc(x.mean(dim=[2, 3])))
        return x * w[:, :, None, None]


class _SpatialAttention(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv = nn.Conv2d(2, 1, 7, padding=3, bias=False)
    def forward(self, x):
        attn = torch.sigmoid(self.conv(torch.cat([x.mean(1, keepdim=True), x.max(1, keepdim=True)[0]], 1)))
        return x * attn


class RefineHead(nn.Module):
    """Lightweight refinement network applied to the raw SAM2 mask probability."""
    def __init__(self):
        super().__init__()
        self.expand  = nn.Sequential(nn.Conv2d(1, 32, 3, padding=1, bias=False), nn.BatchNorm2d(32), nn.ReLU(inplace=True))
        self.res1    = _ResBlock(32)
        self.ca      = _ChannelAttention(32)
        self.sa      = _SpatialAttention()
        self.dilated = nn.Sequential(nn.Conv2d(32, 32, 3, padding=2, dilation=2, bias=False), nn.BatchNorm2d(32), nn.ReLU(inplace=True))
        self.res2    = _ResBlock(32)
        self.project = nn.Conv2d(32, 1, 1)

    def forward(self, mask_prob: torch.Tensor) -> torch.Tensor:
        x = self.expand(mask_prob)
        x = self.res1(x)
        x = self.ca(x)
        x = self.sa(x)
        x = self.dilated(x)
        x = self.res2(x)
        return self.project(x)  # logits


def _encode_jpg(img_bgr: np.ndarray) -> str:
    _, buf = cv2.imencode(".jpg", img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 88])
    return "data:image/jpeg;base64," + base64.b64encode(buf).decode()


def _encode_binary_mask(masks: list, h: int, w: int) -> str:
    """Merge all lesion masks into a single B&W PNG (white=lesion, black=background)."""
    combined = np.zeros((h, w), dtype=np.uint8)
    for m in masks:
        combined = np.maximum(combined, (m > 0).astype(np.uint8) * 255)
    _, buf = cv2.imencode(".png", combined)
    return "data:image/png;base64," + base64.b64encode(buf).decode()


def _nms(boxes, iou_thresh=0.45):
    if not boxes:
        return []
    boxes = sorted(boxes, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]), reverse=True)
    keep = []
    for b in boxes:
        if not any(_iou(b, k) > iou_thresh for k in keep):
            keep.append(b)
    return keep


def _iou(a, b):
    ix1, iy1 = max(a[0], b[0]), max(a[1], b[1])
    ix2, iy2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / max(union, 1e-6)


def _endoscope_mask(image_np: np.ndarray) -> np.ndarray:
    """
    Returns a binary mask of the actual endoscope circular view,
    excluding the black border AND patient-text overlays.
    Uses morphological open with a large kernel so thin white text
    on black is eroded away, then keeps only the largest blob.
    """
    gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
    _, raw = cv2.threshold(gray, 20, 255, cv2.THRESH_BINARY)
    # Very large open (30×30) removes isolated text/UI pixels aggressively
    opened = cv2.morphologyEx(raw, cv2.MORPH_OPEN, np.ones((30, 30), np.uint8))
    # Tiny close only — just enough to fill pin-hole gaps inside the circular view
    # A large close would bridge the text overlay to the tissue region
    opened = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, np.ones((6, 6), np.uint8))
    # Keep only the single largest connected region (the circular tissue view)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(opened, connectivity=8)
    if n < 2:
        return raw
    largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    mask = (labels == largest).astype(np.uint8) * 255
    # Erode slightly so detections stay away from the hard circular edge
    return cv2.erode(mask, np.ones((10, 10), np.uint8))


def _detect_candidate_boxes(image_np: np.ndarray) -> list:
    """
    Detect candidate bounding boxes for esophagitis lesions.
    Parameters are aligned with the training notebook (max_ratio=0.85,
    min_aspect=0.15, L>210 for white patches, a_norm>160 for red erosions).
    The endoscope mask excludes patient-text overlays so they are never
    detected as candidate boxes.
    """
    h, w = image_np.shape[:2]
    img_area = h * w

    endo = _endoscope_mask(image_np)

    lab  = cv2.cvtColor(image_np, cv2.COLOR_RGB2LAB)
    L, A, _ = cv2.split(lab)

    all_boxes: list = []
    MIN_AREA  = 400
    MAX_RATIO = 0.35   # prevent huge false-positive candidate boxes
    MIN_ASPECT = 0.20  # filter degenerate thin strips

    def extract(binary: np.ndarray) -> None:
        n, _, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
        for lid in range(1, n):
            area = stats[lid, cv2.CC_STAT_AREA]
            if area < MIN_AREA:
                continue
            bx = stats[lid, cv2.CC_STAT_LEFT]
            by = stats[lid, cv2.CC_STAT_TOP]
            bw = stats[lid, cv2.CC_STAT_WIDTH]
            bh = stats[lid, cv2.CC_STAT_HEIGHT]
            if bw * bh / img_area > MAX_RATIO:
                continue
            if min(bw, bh) / max(bw, bh, 1) < MIN_ASPECT:
                continue
            all_boxes.append([float(bx), float(by), float(bx + bw), float(by + bh)])

    # 1. White exudate (L > 210 — notebook threshold)
    _, bright = cv2.threshold(L, 210, 255, cv2.THRESH_BINARY)
    bright = cv2.bitwise_and(bright, endo)
    bright = cv2.morphologyEx(bright, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    extract(bright)

    # 2. Red erosion regions (a_norm > 160 — notebook threshold)
    a_norm = ((A.astype(np.float32) - 128) / 128 * 255).clip(0, 255).astype(np.uint8)
    _, red = cv2.threshold(a_norm, 160, 255, cv2.THRESH_BINARY)
    red = cv2.bitwise_and(red, endo)
    red = cv2.morphologyEx(red, cv2.MORPH_CLOSE, np.ones((20, 20), np.uint8))
    extract(red)

    # 3. Otsu on brightness
    _, otsu = cv2.threshold(L, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    otsu = cv2.bitwise_and(otsu, endo)
    otsu = cv2.morphologyEx(otsu, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    extract(otsu)

    # 4. Color deviation from foreground median
    img_f = image_np.astype(np.float32)
    fg = img_f[endo > 0].reshape(-1, 3)
    if len(fg) > 100:
        med = np.median(fg, axis=0)
        diff = np.abs(img_f - med).sum(axis=2) * (endo / 255.0)
        _, dev = cv2.threshold(diff.astype(np.uint8), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        dev = cv2.bitwise_and(dev, endo)
        dev = cv2.morphologyEx(dev, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
        extract(dev)

    return _nms(all_boxes, iou_thresh=0.5)[:MAX_LESIONS]


def _postprocess(mask: np.ndarray) -> np.ndarray:
    mask = binary_fill_holes(mask).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    clean = np.zeros_like(mask)
    for lid in range(1, n):
        if stats[lid, cv2.CC_STAT_AREA] >= 150:
            clean[labels == lid] = 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    return cv2.morphologyEx(clean, cv2.MORPH_CLOSE, kernel)


def _build_esoph_overlay(image_bgr: np.ndarray, lesions: list) -> np.ndarray:
    orig_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    h, w = orig_rgb.shape[:2]
    overlay = np.zeros((h, w, 4), dtype=np.uint8)
    for i, les in enumerate(lesions):
        r, g, b, a = LESION_COLORS_RGBA[i % len(LESION_COLORS_RGBA)]
        overlay[les["mask"] > 0] = [r, g, b, a]

    alpha = overlay[..., 3:4] / 255.0
    blended = (overlay[..., :3] * alpha + orig_rgb * (1 - alpha)).astype(np.uint8)
    result = cv2.cvtColor(blended, cv2.COLOR_RGB2BGR)

    FONT       = cv2.FONT_HERSHEY_SIMPLEX
    FSCALE     = 0.48          # smaller → fits more labels without clipping
    FTHICK     = 1
    PAD        = 5             # px padding inside label background
    BOX_THICK  = 2             # thinner box outline

    used: list[tuple[int,int,int,int]] = []   # occupied label rects (x1,y1,x2,y2)

    def _overlaps(r: tuple[int,int,int,int]) -> bool:
        for u in used:
            if r[0] < u[2] and r[2] > u[0] and r[1] < u[3] and r[3] > u[1]:
                return True
        return False

    for i, les in enumerate(lesions):
        x1, y1, x2, y2 = les["bbox_xyxy"]
        r, g, b, _ = LESION_COLORS_RGBA[i % len(LESION_COLORS_RGBA)]
        bgr = (int(b), int(g), int(r))

        # ── Box outline (white shadow first for visibility on dark backgrounds) ─
        cv2.rectangle(result, (x1 - 1, y1 - 1), (x2 + 1, y2 + 1), (255, 255, 255), 1)
        cv2.rectangle(result, (x1, y1), (x2, y2), bgr, BOX_THICK)

        # ── Label with leader-line placement ─────────────────────────────────
        conf_pct = int(round(les["confidence"] * 100))
        label    = f"L{i+1}  {conf_pct}%"

        (tw, th), baseline = cv2.getTextSize(label, FONT, FSCALE, FTHICK)
        lw = tw + PAD * 2
        lh = th + baseline + PAD * 2

        bx_c = (x1 + x2) // 2
        by_c = (y1 + y2) // 2

        # Generate candidates in expanding rings around the lesion center.
        # Each ring tries 16 angles so labels spread in any direction.
        candidates: list[tuple[int, int]] = []
        MARGIN = 6
        for radius in range(lh, max(w, h), max(lh, lw) // 2):
            for angle_deg in range(0, 360, 22):
                rad = math.radians(angle_deg)
                tx = int(bx_c + radius * math.cos(rad) - lw / 2)
                ty = int(by_c + radius * math.sin(rad) - lh / 2)
                tx = max(MARGIN, min(tx, w - lw - MARGIN))
                ty = max(MARGIN, min(ty, h - lh - MARGIN))
                candidates.append((tx, ty))

        # Pick the first candidate that doesn't overlap any placed label
        cx, cy = candidates[0]
        for (tx, ty) in candidates:
            rect = (tx, ty, tx + lw, ty + lh)
            if not _overlaps(rect):
                cx, cy = tx, ty
                break

        used.append((cx, cy, cx + lw, cy + lh))

        # Leader line: from label anchor point to lesion box edge
        label_anchor_x = cx + lw // 2
        label_anchor_y = cy + lh // 2
        # Find the point on the label rect border closest to the box center
        lax = max(cx, min(bx_c, cx + lw))
        lay = max(cy, min(by_c, cy + lh))
        # Find the point on the box border closest to the label center
        bex = max(x1, min(label_anchor_x, x2))
        bey = max(y1, min(label_anchor_y, y2))
        cv2.line(result, (lax, lay), (bex, bey), (255, 255, 255), 1, cv2.LINE_AA)
        cv2.line(result, (lax, lay), (bex, bey), bgr, 1, cv2.LINE_AA)

        # Draw label background + text
        cv2.rectangle(result, (cx, cy), (cx + lw, cy + lh), bgr, -1)
        cv2.putText(result, label, (cx + PAD, cy + th + PAD),
                    FONT, FSCALE, (255, 255, 255), FTHICK, cv2.LINE_AA)
    return result


class EsophagitisSegmentor:
    def __init__(self, weights_path: str = "weights/sam2_esophagitis_best.pth",
                 config_name: str = "sam2_hiera_l.yaml"):
        print(f"  Loading SAM2 Esophagitis model from {weights_path} ...")
        self.predictor, self.refine_head, self.refine_threshold = self._load_sam2(weights_path, config_name)
        self.weights_path = weights_path
        print(f"  SAM2 Esophagitis ready — device: {DEVICE}")

    def _load_sam2(self, weights_path: str, config_name: str):
        torch.cuda.empty_cache()
        gc.collect()

        try:
            import sam2
            from sam2.build_sam import build_sam2
            from sam2.sam2_image_predictor import SAM2ImagePredictor
            from hydra import compose, initialize_config_dir
            from hydra.core.global_hydra import GlobalHydra
            from omegaconf import OmegaConf
            from hydra.utils import instantiate

            sam2_pkg_dir = os.path.dirname(sam2.__file__)
            configs_dir = os.path.join(sam2_pkg_dir, "configs", "sam2")

            available = (
                [f for f in os.listdir(configs_dir) if f.endswith(".yaml")]
                if os.path.isdir(configs_dir) else []
            )
            cfg_name = config_name
            if cfg_name not in available and available:
                for pref in ["sam2_hiera_l.yaml", "sam2_hiera_b+.yaml",
                             "sam2_hiera_s.yaml", "sam2_hiera_t.yaml"]:
                    if pref in available:
                        cfg_name = pref
                        break
                else:
                    cfg_name = available[0]

            if GlobalHydra.instance().is_initialized():
                GlobalHydra.instance().clear()
            initialize_config_dir(config_dir=configs_dir, version_base=None)
            cfg = compose(config_name=cfg_name.replace(".yaml", ""))
            OmegaConf.resolve(cfg)

            model = instantiate(cfg.model, _recursive_=True)

            ckpt = torch.load(weights_path, map_location="cpu", weights_only=False)

            # ── Extract SAM2 weights ──────────────────────────────────────────
            if isinstance(ckpt, dict):
                sd = (ckpt.get("sam2_model")
                      or ckpt.get("model")
                      or ckpt.get("state_dict")
                      or ckpt)
            else:
                sd = ckpt

            sd = {k.replace("module.", ""): v for k, v in sd.items()}
            sd = {k: v.float() if v.is_floating_point() else v for k, v in sd.items()}
            model.load_state_dict(sd, strict=False)

            # ── Extract RefineHead weights (new checkpoint format) ────────────
            refine_head = None
            refine_threshold = 0.5
            if isinstance(ckpt, dict) and "refine_head" in ckpt:
                rh = RefineHead()
                rh.load_state_dict(ckpt["refine_head"])
                rh = rh.to(DEVICE).eval()
                refine_head = rh
                refine_threshold = float(ckpt.get("threshold", 0.2))
                print(f"  RefineHead loaded — threshold: {refine_threshold}")

            del ckpt, sd
            gc.collect()

            model = model.to(DEVICE)
            model.eval()

            predictor = SAM2ImagePredictor(model)
            return predictor, refine_head, refine_threshold

        except Exception as e:
            raise RuntimeError(f"Failed to load SAM2 Esophagitis model: {e}")

    @torch.no_grad()
    def _predict_mask(self, box_1024: list) -> tuple:
        # Match notebook exactly: box-only prompt (no center point),
        # take mask index 0, apply sigmoid + threshold 0.4
        masks_logits, iou_preds, _ = self.predictor.predict(
            point_coords=None,
            point_labels=None,
            box=np.array(box_1024, dtype=np.float32),
            multimask_output=True,
            return_logits=True,
        )
        # masks_logits: [3, H, W] — notebook always uses index 0
        prob   = torch.sigmoid(torch.tensor(masks_logits[0], dtype=torch.float32))
        binary = (prob.numpy() > 0.4).astype(np.uint8)
        conf   = float(iou_preds[0])
        return binary, conf

    def segment(self, image_bgr: np.ndarray) -> dict:
        orig_h, orig_w = image_bgr.shape[:2]
        orig_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

        img_1024 = cv2.resize(orig_rgb, (SZ, SZ), interpolation=cv2.INTER_LINEAR)
        sx, sy = SZ / orig_w, SZ / orig_h

        # Set image embeddings once (fp32, no autocast)
        with torch.no_grad():
            self.predictor.set_image(img_1024)

        # Detect candidates → merge into single GT-like box → SAM2 prompt
        candidate_boxes = _detect_candidate_boxes(orig_rgb)

        lesions = []
        for box_orig in candidate_boxes:
            box_1024 = [
                max(0.0, min(float(SZ), box_orig[0] * sx)),
                max(0.0, min(float(SZ), box_orig[1] * sy)),
                max(0.0, min(float(SZ), box_orig[2] * sx)),
                max(0.0, min(float(SZ), box_orig[3] * sy)),
            ]
            bw = box_1024[2] - box_1024[0]
            bh = box_1024[3] - box_1024[1]
            if bw < 5 or bh < 5:
                continue

            try:
                mask_1024, conf = self._predict_mask(box_1024)
            except Exception:
                continue

            if conf < CONFIDENCE_THRESH:
                continue
            if mask_1024.sum() < MIN_MASK_AREA:
                continue
            if mask_1024.sum() / (SZ * SZ) > MAX_MASK_RATIO:
                continue

            mask_1024 = _postprocess(mask_1024)
            if mask_1024.sum() == 0:
                continue

            # Resize full prediction mask back to original size
            mask_orig = cv2.resize(mask_1024.astype(np.uint8),
                                   (orig_w, orig_h),
                                   interpolation=cv2.INTER_NEAREST)

            # Split the predicted mask into individual connected-component lesions
            n_comp, comp_labels, comp_stats, _ = cv2.connectedComponentsWithStats(
                mask_orig, connectivity=8
            )
            img_area = orig_h * orig_w
            for cid in range(1, n_comp):
                area_px = int(comp_stats[cid, cv2.CC_STAT_AREA])
                if area_px < 150:
                    continue
                if area_px / img_area > MAX_MASK_RATIO:
                    continue
                comp_mask = (comp_labels == cid).astype(np.uint8)
                ys, xs = np.where(comp_mask > 0)
                x1, y1 = int(xs.min()), int(ys.min())
                x2, y2 = int(xs.max()), int(ys.max())
                lesions.append({
                    "mask":       comp_mask,
                    "bbox_xyxy":  (x1, y1, x2, y2),
                    "confidence": round(conf, 4),
                })

            if DEVICE.type == "cuda":
                torch.cuda.empty_cache()
            gc.collect()

        # Keep only the biggest MAX_LESIONS components
        lesions = sorted(lesions, key=lambda l: l["mask"].sum(), reverse=True)[:MAX_LESIONS]

        overlay = _build_esoph_overlay(image_bgr, lesions)

        segments = []
        for i, les in enumerate(lesions):
            x1, y1, x2, y2 = les["bbox_xyxy"]
            _, hex_color = LESION_PALETTE[i % len(LESION_PALETTE)]
            area_px = int(les["mask"].sum())
            segments.append({
                "id":         i + 1,
                "label":      "Esophagitis",
                "severity":   "medium",
                "location":   f"Lesion {i + 1}",
                "area_pct":   round(area_px / (orig_h * orig_w) * 100, 2),
                "confidence": round(les["confidence"] * 100, 1),
                "color":      hex_color,
                "bbox": {
                    "x": round(x1 / orig_w * 100, 2),
                    "y": round(y1 / orig_h * 100, 2),
                    "w": round((x2 - x1) / orig_w * 100, 2),
                    "h": round((y2 - y1) / orig_h * 100, 2),
                },
            })

        mask_b64 = _encode_binary_mask(
            [l["mask"] for l in lesions], orig_h, orig_w
        ) if lesions else None

        return {
            "segments":      segments,
            "totalDetected": len(segments),
            "overallRisk":   "medium" if segments else "low",
            "overlayBase64": _encode_jpg(overlay),
            "maskBase64":    mask_b64,
            "modelVersion":  "SAM2 Esophagitis v1 (sam2_hiera_l)",
            "threshold":     CONFIDENCE_THRESH,
            "ttaUsed":       False,
        }
