"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { Camera, CameraOff, Keyboard, Loader2 } from "lucide-react";
import { btn } from "./ui";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/** Kamera ilə QR oxuyucu (BarcodeDetector varsa ondan, yoxdursa jsQR ilə) + əl ilə kod daxil etmə */
export function QrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<"idle" | "starting" | "scanning" | "denied" | "unsupported" | "found">("idle");
  const [manual, setManual] = useState("");

  const handle = useCallback((raw: string) => {
    const text = raw.trim();
    let token: string | null = null;
    try {
      const u = new URL(text);
      const m = /\/c\/([A-Za-z0-9]+)/.exec(u.pathname);
      if (m) token = m[1];
    } catch {
      if (/^[A-Za-z0-9]{6,20}$/.test(text)) token = text;
    }
    if (!token) return false;
    setState("found");
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (navigator.vibrate) navigator.vibrate(60);
    router.push(`/c/${token.toUpperCase()}`);
    return true;
  }, [router]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setState("unsupported"); return; }
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setState("scanning");
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      const detector = BD ? new BD({ formats: ["qr_code"] }) : null;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      let busy = false;
      const tick = async () => {
        if (!streamRef.current) return;
        if (!busy && video.readyState === video.HAVE_ENOUGH_DATA) {
          busy = true;
          try {
            if (detector) {
              const codes = await detector.detect(video);
              if (codes[0] && handle(codes[0].rawValue)) return;
            } else {
              const w = Math.min(640, video.videoWidth);
              const h = Math.round((video.videoHeight / video.videoWidth) * w);
              canvas.width = w; canvas.height = h;
              ctx.drawImage(video, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
              if (code && handle(code.data)) return;
            }
          } catch { /* növbəti kadr */ }
          busy = false;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch {
      setState("denied");
    }
  }, [handle]);

  useEffect(() => () => stop(), [stop]);

  return (
    <div className="space-y-5">
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-brand-900 shadow-lift">
        <video ref={videoRef} playsInline muted className={`h-full w-full object-cover ${state === "scanning" ? "" : "opacity-0"}`} />
        <canvas ref={canvasRef} className="hidden" />
        {state === "scanning" && (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-[14%] rounded-3xl border-2 border-white/80 shadow-[0_0_0_9999px_rgb(22_66_60/0.45)]" />
            <div className="absolute inset-x-[14%] top-[14%] h-0.5 bg-cream shadow-[0_0_12px_#F0F3BF]" style={{ animation: "scan-line 2.4s ease-in-out infinite", ["--scan-h" as string]: "calc(72% * 1)" }} />
          </div>
        )}
        {state !== "scanning" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
            {state === "starting" || state === "found" ? (
              <Loader2 className="size-10 animate-spin text-cream" />
            ) : state === "denied" || state === "unsupported" ? (
              <div>
                <CameraOff className="mx-auto size-10 text-cream" />
                <p className="mt-3 text-sm text-white/85">
                  {state === "denied" ? "Kameraya icazə verilmədi. Brauzer parametrlərindən icazə verin və ya kodu əl ilə daxil edin." : "Bu brauzer kameranı dəstəkləmir. Telefonun kamera tətbiqi ilə QR-ı skan edin və ya kodu əl ilə daxil edin."}
                </p>
              </div>
            ) : (
              <div>
                <Camera className="mx-auto size-12 text-cream" />
                <p className="mt-3 text-sm text-white/85">Otağın qapısındakı QR kodu kameraya tutun</p>
                <button onClick={start} className={btn("light", "md", "mt-5")}>Kameranı aç</button>
              </div>
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (!handle(manual)) setManual(""); }}
        className="mx-auto flex max-w-sm gap-2"
      >
        <div className="relative flex-1">
          <Keyboard className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-brand-300" />
          <input value={manual} onChange={(e) => setManual(e.target.value.toUpperCase())} placeholder="QR altındakı kod" maxLength={20} className="field-input pl-9 font-semibold tracking-widest uppercase" aria-label="QR kodun altındakı kod" />
        </div>
        <button className={btn("secondary")} disabled={manual.length < 6}>Təsdiq</button>
      </form>
    </div>
  );
}
