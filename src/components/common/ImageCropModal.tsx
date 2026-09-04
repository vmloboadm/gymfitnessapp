"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Check, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { cn } from "~/lib/utils";

type Props = {
  open: boolean;
  src: string | null;
  onClose: () => void;
  onConfirm: (blob: Blob) => void;
  size?: number;
};

export function ImageCropModal({ open, src, onClose, onConfirm, size = 400 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, dx: 0, dy: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open || !src) return;
    setScale(1);
    setRotation(0);
    setDrag({ x: 0, y: 0 });
    setReady(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setReady(true);
    };
    img.src = src;
  }, [open, src]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);
    const aspect = img.naturalWidth / img.naturalHeight;
    let w: number, h: number;
    if (aspect > 1) {
      h = size * 1.4;
      w = h * aspect;
    } else {
      w = size * 1.4;
      h = w / aspect;
    }
    ctx.drawImage(img, -w / 2 + drag.x, -h / 2 + drag.y, w, h);
    ctx.restore();
    // circular mask
    ctx.globalCompositeOperation = "destination-in";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }, [size, scale, rotation, drag, ready]);

  useEffect(() => {
    if (ready) draw();
  }, [ready, draw]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, dx: drag.x, dy: drag.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setDrag({ x: dragStart.current.dx + dx, y: dragStart.current.dy + dy });
  };

  const handlePointerUp = () => setDragging(false);

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) onConfirm(blob);
    }, "image/webp", 0.85);
  };

  if (!open || !src) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
      {/* top bar */}
      <div className="absolute top-0 flex w-full items-center justify-between px-4 pt-4 pb-2 safe-top">
        <p className="text-sm font-bold text-white">Ajustar foto</p>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* canvas area */}
      <div
        className="relative flex items-center justify-center touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ width: size, height: size }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: size, height: size }}
          className="rounded-full"
        />
        {/* crop guide ring */}
        <div
          className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/40"
          style={{ width: size, height: size }}
        />
      </div>

      {/* controls */}
      <div className="absolute bottom-0 flex w-full flex-col items-center gap-4 pb-6 safe-bottom">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.15))}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Diminuir zoom"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <input
            type="range"
            min={50}
            max={300}
            value={scale * 100}
            onChange={(e) => setScale(Number(e.target.value) / 100)}
            className="w-36 accent-brand"
            aria-label="Zoom"
          />
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.15))}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Aumentar zoom"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Rotacionar"
          >
            <RotateCw className="h-5 w-5" />
          </button>
        </div>
        <p className="text-[11px] text-white/50">Arraste para posicionar · Use os controles para ajustar</p>
        <button
          onClick={handleConfirm}
          disabled={!ready}
          className={cn(
            "flex h-12 w-48 items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.97]",
            ready ? "bg-brand shadow-lg shadow-brand/30" : "bg-white/10 text-white/40"
          )}
        >
          <Check className="h-4 w-4" />
          Confirmar foto
        </button>
      </div>
    </div>
  );
}
