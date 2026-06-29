"""
segmentor.py — DeepLabV3++ v2 Inference
يستخدم نفس الـ architecture بالضبط من كود التدريب
"""

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision.models import efficientnet_v2_s, EfficientNet_V2_S_Weights
import base64

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ── Inference transforms (بدون albumentations) ───────────────────────────────
import torchvision.transforms as T

INFER_TRANSFORM = T.Compose([
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]),
])

MASK_COLOR_BGR = np.array([0, 255, 170], dtype=np.uint8)   # chartreuse — ICG fluorescence green

# Endoscopy-optimised palette inspired by real clinical fluorescence imaging.
# Chartreuse (#aaff00) is the de-facto color in ICG/autofluorescence endoscopy systems
# (Olympus EVIS, Karl Storz). Avoids red/orange/pink which merge with mucosal tissue.
# Stored as (BGR, "#RRGGBB") — BGR for OpenCV, hex for the frontend.
SEGMENT_PALETTE = [
    ((  0, 255, 170), "#aaff00"),   # chartreuse  — ICG fluorescence standard, primary lesion
    ((255, 170,   0), "#00aaff"),   # sky blue    — clean, clinical
    ((  0, 204, 255), "#ffcc00"),   # gold        — warm, distinct from tissue
    ((204,   0, 255), "#ff00cc"),   # magenta     — vivid, clearly artificial
    ((  0, 255, 204), "#ccff00"),   # yellow-green — bright accent
    ((170,   0, 255), "#ff00aa"),   # hot pink    — neon, separable
    ((255,   0, 170), "#aa00ff"),   # violet      — deep contrast
    ((  0, 170, 255), "#ffaa00"),   # amber       — warm secondary
]


# ══════════════════════════════════════════════════════════════
# Architecture — نسخة طابق 1:1 مع كود التدريب
# ══════════════════════════════════════════════════════════════
def _gn_relu(c, groups=16):
    g = min(groups, c)
    while c % g != 0:
        g //= 2
    return nn.Sequential(nn.GroupNorm(g, c), nn.ReLU(inplace=True))


class PAAB(nn.Module):
    def __init__(self, channels):
        super().__init__()
        self.dw3 = nn.Sequential(
            nn.Conv2d(2, 2, 3, padding=1, groups=2, bias=False),
            nn.Conv2d(2, 1, 1, bias=False)
        )
        self.dw5 = nn.Sequential(
            nn.Conv2d(2, 2, 5, padding=2, groups=2, bias=False),
            nn.Conv2d(2, 1, 1, bias=False)
        )
        self.dw7 = nn.Sequential(
            nn.Conv2d(2, 2, 7, padding=3, groups=2, bias=False),
            nn.Conv2d(2, 1, 1, bias=False)
        )
        self.spatial_conv = nn.Sequential(
            nn.Conv2d(3, 1, 1, bias=False),
            nn.Sigmoid()
        )
        r = max(channels // 8, 8)
        self.channel_mlp = nn.Sequential(
            nn.Linear(channels * 2, r),
            nn.ReLU(inplace=True),
            nn.Linear(r, channels),
            nn.Sigmoid()
        )

    def forward(self, x):
        B, C, H, W = x.shape
        avg_c = x.mean(dim=1, keepdim=True)
        max_c = x.max(dim=1, keepdim=True)[0]
        f_cat = torch.cat([avg_c, max_c], dim=1)
        Ms = self.spatial_conv(torch.cat(
            [self.dw3(f_cat), self.dw5(f_cat), self.dw7(f_cat)], dim=1))
        gap = F.adaptive_avg_pool2d(x, 1).view(B, C)
        gmp = F.adaptive_max_pool2d(x, 1).view(B, C)
        Mc  = self.channel_mlp(torch.cat([gap, gmp], dim=1)).view(B, C, 1, 1)
        return x * Ms + x * Mc


class SepConv(nn.Module):
    def __init__(self, in_c, out_c, k, padding=0, dilation=1):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(in_c, in_c, k, padding=padding,
                      dilation=dilation, groups=in_c, bias=False),
            nn.Conv2d(in_c, out_c, 1, bias=False),
            *_gn_relu(out_c)
        )
    def forward(self, x): return self.net(x)


class MSPPBranch(nn.Module):
    def __init__(self, in_c, out_c, conv_layer):
        super().__init__()
        self.conv = conv_layer
        self.skip = nn.Sequential(nn.Conv2d(in_c, out_c, 1, bias=False),
                                  *_gn_relu(out_c))
        self.paab = PAAB(out_c)
    def forward(self, x):
        return self.paab(self.conv(x) + self.skip(x))


class MSPP(nn.Module):
    def __init__(self, in_channels, out_channels=256):
        super().__init__()
        mid = out_channels
        self.b1 = MSPPBranch(in_channels, mid,
            nn.Sequential(SepConv(in_channels, mid, 5, padding=2),
                          SepConv(mid, mid, 3, padding=1)))
        self.b2 = MSPPBranch(in_channels, mid,
            nn.Sequential(nn.Conv2d(in_channels, mid, 1, bias=False),
                          *_gn_relu(mid)))
        self.b3 = MSPPBranch(in_channels, mid,
            SepConv(in_channels, mid, 3, padding=4,  dilation=4))
        self.b4 = MSPPBranch(in_channels, mid,
            SepConv(in_channels, mid, 3, padding=8,  dilation=8))
        self.b5 = MSPPBranch(in_channels, mid,
            SepConv(in_channels, mid, 3, padding=12, dilation=12))
        self.b6 = MSPPBranch(in_channels, mid,
            nn.Sequential(SepConv(in_channels, mid, (5,1), padding=(2,0)),
                          SepConv(mid, mid, (1,5), padding=(0,2))))
        self.pool_avg  = nn.AdaptiveAvgPool2d(1)
        self.pool_max  = nn.AdaptiveMaxPool2d(1)
        self.pool_proj = nn.Sequential(
            nn.Conv2d(in_channels*2, mid, 1, bias=False), *_gn_relu(mid))
        self.pool_paab = PAAB(mid)
        self.project   = nn.Sequential(
            nn.Conv2d(mid*7, out_channels, 1, bias=False),
            *_gn_relu(out_channels), nn.Dropout(0.5))

    def forward(self, x):
        size = x.shape[2:]
        b1=self.b1(x); b2=self.b2(x); b3=self.b3(x)
        b4=self.b4(x); b5=self.b5(x); b6=self.b6(x)
        pool = torch.cat([self.pool_avg(x), self.pool_max(x)], dim=1)
        pool = self.pool_paab(self.pool_proj(pool))
        pool = F.interpolate(pool, size=size, mode='bilinear', align_corners=False)
        return self.project(torch.cat([b1,b2,b3,b4,b5,b6,pool], dim=1))


class DeepLabV3PP(nn.Module):
    def __init__(self, num_classes=1):
        super().__init__()
        eff   = efficientnet_v2_s(weights=EfficientNet_V2_S_Weights.IMAGENET1K_V1)
        feats = eff.features

        self.stage0 = feats[0]
        self.stage1 = feats[1]
        self.stage2 = feats[2]
        self.stage3 = feats[3]
        self.stage4 = feats[4]
        self.stage5 = feats[5]
        self.stage6 = feats[6]
        self.stage7 = feats[7]

        self.mspp = MSPP(1280, 256)

        self.low1_proj = nn.Sequential(
            nn.Conv2d(48, 64, 1, bias=False), *_gn_relu(64))
        self.low2_proj = nn.Sequential(
            nn.Conv2d(64, 64, 1, bias=False), *_gn_relu(64))
        self.low_fuse = nn.Sequential(
            nn.Conv2d(128, 96, 1, bias=False), *_gn_relu(96))

        self.dec_a1 = nn.Sequential(
            nn.Conv2d(352, 256, 3, padding=1, bias=False), *_gn_relu(256))
        self.dec_a2 = nn.Sequential(
            nn.Conv2d(256, 256, 3, padding=1, bias=False), *_gn_relu(256))
        self.dec_a_skip = nn.Sequential(
            nn.Conv2d(352, 256, 1, bias=False), *_gn_relu(256))

        self.dec_b1 = nn.Sequential(
            nn.Conv2d(256, 128, 3, padding=1, bias=False), *_gn_relu(128))
        self.dec_b2 = nn.Sequential(
            nn.Conv2d(128, 128, 3, padding=1, bias=False), *_gn_relu(128))
        self.dec_b_skip = nn.Sequential(
            nn.Conv2d(256, 128, 1, bias=False), *_gn_relu(128))

        self.aux_head   = nn.Conv2d(256, num_classes, 1)
        self.classifier = nn.Conv2d(128, num_classes, 3, padding=1)

    def forward(self, x):
        size = x.shape[2:]
        x0   = self.stage0(x)
        x1   = self.stage1(x0)
        low1 = self.stage2(x1)
        low2 = self.stage3(low1)
        x4   = self.stage4(low2)
        x5   = self.stage5(x4)
        x6   = self.stage6(x5)
        high = self.stage7(x6)

        enc          = self.mspp(high)
        target_size  = low1.shape[2:]
        enc          = F.interpolate(enc, size=target_size,
                                     mode='bilinear', align_corners=False)
        low2_up      = F.interpolate(low2, size=target_size,
                                     mode='bilinear', align_corners=False)
        p1           = self.low1_proj(low1)
        p2           = self.low2_proj(low2_up)
        low_fused    = self.low_fuse(torch.cat([p1, p2], dim=1))

        cat_a = torch.cat([enc, low_fused], dim=1)
        a1    = self.dec_a1(cat_a)
        a2    = self.dec_a2(a1)
        dec_a = a2 + self.dec_a_skip(cat_a)

        b1    = self.dec_b1(dec_a)
        b2    = self.dec_b2(b1)
        dec_b = b2 + self.dec_b_skip(dec_a)

        out = self.classifier(dec_b)
        out = F.interpolate(out, size=size, mode='bilinear', align_corners=False)
        return out   # eval mode: single output


# ══════════════════════════════════════════════════════════════
# TTA (4 augmentations)
# ══════════════════════════════════════════════════════════════
def _tta_predict(model: nn.Module, tensor: torch.Tensor) -> torch.Tensor:
    """tensor: (1,3,H,W) على DEVICE. يرجع (1,1,H,W) probs."""
    augments = [
        lambda x: x,
        lambda x: torch.flip(x, dims=[-1]),
        lambda x: torch.flip(x, dims=[-2]),
        lambda x: torch.flip(x, dims=[-1, -2]),
    ]
    de_augs = [
        lambda x: x,
        lambda x: torch.flip(x, dims=[-1]),
        lambda x: torch.flip(x, dims=[-2]),
        lambda x: torch.flip(x, dims=[-1, -2]),
    ]
    preds = []
    with torch.no_grad():
        for aug, de_aug in zip(augments, de_augs):
            out  = torch.sigmoid(model(aug(tensor)))
            preds.append(de_aug(out))
    return torch.stack(preds).mean(dim=0)


# ══════════════════════════════════════════════════════════════
# Helper utils
# ══════════════════════════════════════════════════════════════
def _encode_jpg(img_bgr: np.ndarray) -> str:
    _, buf = cv2.imencode(".jpg", img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 88])
    return "data:image/jpeg;base64," + base64.b64encode(buf).decode()


def _encode_png(img_bgr: np.ndarray) -> str:
    _, buf = cv2.imencode(".png", img_bgr)
    return "data:image/png;base64," + base64.b64encode(buf).decode()


def _build_overlay(image_bgr: np.ndarray, labels_arr: np.ndarray, num_labels: int) -> np.ndarray:
    """Pure mask: black background + vivid colored lesion regions + contours.
    Black (0,0,0) → transparent under CSS mixBlendMode:screen on the frontend.
    Saved as PNG so blacks stay exactly 0 — JPEG compression would corrupt them."""
    h, w = image_bgr.shape[:2]
    mask = np.zeros((h, w, 3), dtype=np.uint8)   # pure black background
    for i in range(1, num_labels):
        bgr, _ = SEGMENT_PALETTE[(i - 1) % len(SEGMENT_PALETTE)]
        mask[labels_arr == i] = np.array(bgr, dtype=np.uint8)
    # Bright contour outline per region
    for i in range(1, num_labels):
        bgr, _ = SEGMENT_PALETTE[(i - 1) % len(SEGMENT_PALETTE)]
        region_mask = (labels_arr == i).astype(np.uint8)
        contours, _ = cv2.findContours(
            region_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        cv2.drawContours(mask, contours, -1, bgr, 2)
    return mask


def _region_stats(num_labels: int, stats_arr: np.ndarray, h: int, w: int) -> list:
    regions = []
    for i in range(1, num_labels):
        area = int(stats_arr[i, cv2.CC_STAT_AREA])
        x    = int(stats_arr[i, cv2.CC_STAT_LEFT])
        y    = int(stats_arr[i, cv2.CC_STAT_TOP])
        rw   = int(stats_arr[i, cv2.CC_STAT_WIDTH])
        rh   = int(stats_arr[i, cv2.CC_STAT_HEIGHT])
        _, hex_color = SEGMENT_PALETTE[(i - 1) % len(SEGMENT_PALETTE)]
        regions.append({
            "id":         i,
            "label":      "Polyp",
            "severity":   "high",
            "location":   f"Lesion {i}",
            "area_pct":   round(area / (h * w) * 100, 2),
            "confidence": 90,
            "color":      hex_color,
            "bbox": {
                "x": round(x  / w * 100, 2),
                "y": round(y  / h * 100, 2),
                "w": round(rw / w * 100, 2),
                "h": round(rh / h * 100, 2),
            },
        })
    return regions


# ══════════════════════════════════════════════════════════════
# Main class
# ══════════════════════════════════════════════════════════════
class PolypSegmentor:
    def __init__(
        self,
        weights_path: str = "weights/best_model_pp_v2.pt",
        threshold:    float = 0.5,
        use_tta:      bool  = True,
        img_size:     int   = 256,
    ):
        print(f"  Loading DeepLabV3++ v2 from {weights_path} ...")
        self.model = DeepLabV3PP(num_classes=1)
        state = torch.load(weights_path, map_location=DEVICE)
        # بعض الـ checkpoints يحفظو في key
        if isinstance(state, dict) and "model_state_dict" in state:
            state = state["model_state_dict"]
        self.model.load_state_dict(state, strict=True)
        self.model.eval().to(DEVICE)

        self.threshold = threshold
        self.use_tta   = use_tta
        self.img_size  = img_size
        print(f"  DeepLabV3++ v2 ready — device: {DEVICE}  TTA: {use_tta}")

    def _preprocess(self, image_bgr: np.ndarray) -> torch.Tensor:
        rgb     = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        resized = cv2.resize(rgb, (self.img_size, self.img_size))
        tensor  = INFER_TRANSFORM(resized).unsqueeze(0).to(DEVICE)
        return tensor

    @torch.no_grad()
    def segment(self, image_bgr: np.ndarray) -> dict:
        h, w   = image_bgr.shape[:2]
        tensor = self._preprocess(image_bgr)

        if self.use_tta:
            prob = _tta_predict(self.model, tensor)   # (1,1,256,256)
        else:
            prob = torch.sigmoid(self.model(tensor))

        # Resize back to original resolution
        prob_np = prob.squeeze().cpu().numpy()                     # (256,256)
        prob_np = cv2.resize(prob_np, (w, h),
                             interpolation=cv2.INTER_LINEAR)

        mask_bin = prob_np > self.threshold                        # bool H×W

        # Single CC pass — relabel by area (largest first) so palette colors
        # are assigned consistently and the biggest lesion gets the primary color.
        num_labels, labels_arr, stats_arr, _ = cv2.connectedComponentsWithStats(
            mask_bin.astype(np.uint8)
        )
        if num_labels > 1:
            order = sorted(
                range(1, num_labels),
                key=lambda k: int(stats_arr[k, cv2.CC_STAT_AREA]),
                reverse=True,
            )
            remap = np.zeros(num_labels, dtype=np.int32)
            new_stats = np.zeros_like(stats_arr)
            for new_i, old_i in enumerate(order, start=1):
                remap[old_i] = new_i
                new_stats[new_i] = stats_arr[old_i]
            labels_arr = remap[labels_arr]
            stats_arr  = new_stats

        overlay = _build_overlay(image_bgr, labels_arr, num_labels)
        regions = _region_stats(num_labels, stats_arr, h, w)

        return {
            "segments":      regions,
            "totalDetected": len(regions),
            "overallRisk":   "high" if regions else "low",
            "overlayBase64": _encode_png(overlay),
            "modelVersion":  "DeepLabV3++ v2 (EfficientNetV2-S)",
            "threshold":     round(self.threshold, 2),
            "ttaUsed":       self.use_tta,
        }

    @torch.no_grad()
    def segment_roi(self, image_bgr: np.ndarray, boxes: list) -> dict:
        """ROI-guided segmentation: runs DeepLabV3++ only inside each YOLO box.
        boxes: list of {"x","y","w","h"} in percent (0-100).
        Returns same structure as segment(), but regions are guaranteed to
        overlap with a YOLO detection — no phantom lesions outside detections.
        """
        h, w       = image_bgr.shape[:2]
        full_mask  = np.zeros((h, w), dtype=np.float32)   # accumulated probs
        MARGIN     = 0.30   # 30% padding around each box

        for b in boxes:
            x1 = int(b["x"]              / 100 * w)
            y1 = int(b["y"]              / 100 * h)
            x2 = int((b["x"] + b["w"])   / 100 * w)
            y2 = int((b["y"] + b["h"])   / 100 * h)
            bw, bh = max(1, x2 - x1), max(1, y2 - y1)

            mx = int(bw * MARGIN)
            my = int(bh * MARGIN)
            cx1, cy1 = max(0, x1 - mx), max(0, y1 - my)
            cx2, cy2 = min(w, x2 + mx), min(h, y2 + my)

            crop = image_bgr[cy1:cy2, cx1:cx2]
            if crop.size == 0:
                continue

            tensor = self._preprocess(crop)
            if self.use_tta:
                prob = _tta_predict(self.model, tensor)
            else:
                prob = torch.sigmoid(self.model(tensor))

            prob_np = prob.squeeze().cpu().numpy()
            prob_np = cv2.resize(prob_np, (cx2 - cx1, cy2 - cy1),
                                 interpolation=cv2.INTER_LINEAR)
            full_mask[cy1:cy2, cx1:cx2] = np.maximum(
                full_mask[cy1:cy2, cx1:cx2], prob_np
            )

        mask_bin = full_mask > self.threshold

        num_labels, labels_arr, stats_arr, _ = cv2.connectedComponentsWithStats(
            mask_bin.astype(np.uint8)
        )
        MIN_AREA = max(50, int(h * w * 0.0005))
        valid = sorted(
            [i for i in range(1, num_labels)
             if stats_arr[i, cv2.CC_STAT_AREA] >= MIN_AREA],
            key=lambda i: stats_arr[i, cv2.CC_STAT_AREA],
            reverse=True,
        )
        if valid:
            remap     = np.zeros(num_labels, dtype=np.int32)
            new_stats = np.zeros_like(stats_arr)
            for new_i, old_i in enumerate(valid, start=1):
                remap[old_i] = new_i
                new_stats[new_i] = stats_arr[old_i]
            labels_arr = remap[labels_arr]
            stats_arr  = new_stats
            num_labels = len(valid) + 1

        overlay = _build_overlay(image_bgr, labels_arr, num_labels)
        regions = _region_stats(num_labels, stats_arr, h, w)

        return {
            "segments":      regions,
            "totalDetected": len(regions),
            "overallRisk":   "high" if regions else "low",
            "overlayBase64": _encode_png(overlay),
            "modelVersion":  "DeepLabV3++ v2 ROI-guided",
            "threshold":     round(self.threshold, 2),
            "ttaUsed":       self.use_tta,
        }