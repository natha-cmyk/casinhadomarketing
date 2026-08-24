"use client";
// Editor de recorte de imagem (carrossel) — recorte tipo "cover" com proporção, zoom e arrasto.
// Opera preferencialmente sobre o File local (sem taint de CORS); cai pra URL (crossOrigin) se
// a imagem já veio salva. Exporta um Blob JPEG recortado pra re-upload via presign.
import { useEffect, useRef, useState, useCallback } from "react";

export interface CropTarget { url: string; file?: File; filename?: string }

const ASPECTS: { key: string; label: string; r: number | null }[] = [
  { key: "1:1", label: "Quadrado 1:1", r: 1 },
  { key: "4:5", label: "Retrato 4:5", r: 4 / 5 },
  { key: "9:16", label: "Story/Reels 9:16", r: 9 / 16 },
  { key: "1.91:1", label: "Paisagem 1.91:1", r: 1.91 },
  { key: "orig", label: "Original", r: null },
];

const FRAME_W = 300;

export function MediaCropModal({ target, onCancel, onSave }: { target: CropTarget; onCancel: () => void; onSave: (blob: Blob) => void | Promise<void> }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [aspectKey, setAspectKey] = useState("1:1");
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const aspect = ASPECTS.find((a) => a.key === aspectKey)!;
  const natW = img?.naturalWidth || 1;
  const natH = img?.naturalHeight || 1;
  const ratio = aspect.r ?? natW / natH;
  const frameH = Math.round(FRAME_W / ratio);
  const baseScale = Math.max(FRAME_W / natW, frameH / natH);
  const scale = baseScale * zoom;
  const dispW = natW * scale;
  const dispH = natH * scale;

  const clamp = useCallback(
    (x: number, y: number) => ({
      x: Math.min(0, Math.max(FRAME_W - dispW, x)),
      y: Math.min(0, Math.max(frameH - dispH, y)),
    }),
    [dispW, dispH, frameH]
  );

  // carrega a imagem (File → objectURL, senão URL com crossOrigin)
  useEffect(() => {
    let revoke: string | null = null;
    const im = new Image();
    if (target.file) {
      revoke = URL.createObjectURL(target.file);
      im.src = revoke;
    } else {
      im.crossOrigin = "anonymous";
      im.src = target.url;
    }
    im.onload = () => setImg(im);
    im.onerror = () => setErr("Não consegui carregar essa imagem para recorte.");
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [target]);

  // recentraliza ao trocar proporção/zoom
  useEffect(() => { setOff((o) => clamp(o.x, o.y)); }, [clamp]);

  const onDown = (e: React.PointerEvent) => {
    drag.current = { sx: e.clientX, sy: e.clientY, ox: off.x, oy: off.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const nx = drag.current.ox + (e.clientX - drag.current.sx);
    const ny = drag.current.oy + (e.clientY - drag.current.sy);
    setOff(clamp(nx, ny));
  };
  const onUp = () => { drag.current = null; };

  const doExport = async () => {
    if (!img || saving) return;
    setSaving(true);
    setErr(null);
    try {
      const srcX = -off.x / scale;
      const srcY = -off.y / scale;
      const srcW = FRAME_W / scale;
      const srcH = frameH / scale;
      const outW = Math.min(Math.round(srcW), 1440);
      const outH = Math.round(outW * (srcH / srcW));
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
      const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.92));
      if (!blob) throw new Error("Falha ao gerar a imagem recortada (a imagem pode bloquear edição por segurança).");
      await onSave(blob);
    } catch (e) {
      setErr(String((e as Error)?.message || e).slice(0, 120));
      setSaving(false);
    }
  };

  return (
    <div className="pm-back" style={{ zIndex: 60 }} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="pm" role="dialog" aria-modal="true" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <div className="pm-head">
          <b>Ajustar imagem</b>
          <button className="pm-x" aria-label="Fechar" onClick={onCancel}>✕</button>
        </div>
        <div className="pm-body" style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{ width: FRAME_W, height: frameH, position: "relative", overflow: "hidden", borderRadius: 10, background: "#111", touchAction: "none", cursor: img ? "grab" : "default", userSelect: "none" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            {img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img.src}
                alt=""
                draggable={false}
                style={{ position: "absolute", left: off.x, top: off.y, width: dispW, height: dispH, maxWidth: "none", pointerEvents: "none" }}
              />
            )}
          </div>
          <div style={{ width: "100%" }}>
            <label className="field-lbl">Proporção</label>
            <select className="field-edit" value={aspectKey} onChange={(e) => setAspectKey(e.target.value)}>
              {ASPECTS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
          </div>
          <div style={{ width: "100%" }}>
            <label className="field-lbl">Zoom</label>
            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} style={{ width: "100%" }} />
          </div>
          {err && <div className="pm-msg pm-msg-err" style={{ width: "100%" }}>{err}</div>}
        </div>
        <div className="pm-foot">
          <span />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-link" onClick={onCancel} disabled={saving}>Cancelar</button>
            <button className="btn-link ig" onClick={doExport} disabled={saving || !img}>{saving ? "Salvando…" : "Aplicar recorte"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
