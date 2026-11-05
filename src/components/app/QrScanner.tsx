import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Camera QR reader. Calls onCode once per distinct code (3s cooldown). Browser-only; start is user-triggered. */
export function QrScanner({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const [active, setActive] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState<string | null>(null);

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  };

  const start = async (mode = facing) => {
    setError(null);
    stop();
    try {
      const jsQR = (await import("jsqr")).default;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode } });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setActive(true);
      const tick = () => {
        const canvas = canvasRef.current;
        if (canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
          ctx.drawImage(video, 0, 0);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          const now = Date.now();
          if (hit?.data && (hit.data !== lastRef.current.code || now - lastRef.current.at > 3000)) {
            lastRef.current = { code: hit.data, at: now };
            navigator.vibrate?.(80);
            onCode(hit.data);
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setError("Camera unavailable. Allow camera access in your browser, or use the search box.");
    }
  };

  useEffect(() => stop, []);

  return (
    <div className="space-y-3">
      <div className="relative aspect-video overflow-hidden rounded-[10px] border border-border bg-elevated">
        <video ref={videoRef} muted playsInline className={`size-full object-cover ${active ? "" : "hidden"}`} />
        <canvas ref={canvasRef} className="hidden" />
        {active ? (
          <div className="pointer-events-none absolute inset-[18%] rounded-[12px] border-2 border-primary/80" />
        ) : (
          <div className="grid size-full place-items-center p-4 text-center text-xs text-muted-foreground">
            Point the camera at a guest's invitation or badge QR code.
          </div>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {active ? (
          <Button size="sm" variant="outline" onClick={stop}>
            <CameraOff className="size-4" /> Stop camera
          </Button>
        ) : (
          <Button size="sm" onClick={() => start()}>
            <Camera className="size-4" /> Start scanner
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const next = facing === "environment" ? "user" : "environment";
            setFacing(next);
            if (active) void start(next);
          }}
        >
          <RefreshCw className="size-4" /> Switch camera
        </Button>
      </div>
    </div>
  );
}
