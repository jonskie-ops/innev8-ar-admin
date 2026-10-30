"use client";

import { useEffect, useRef, useState } from "react";
import { CameraIcon } from "./icons";
import { Spinner } from "./Progress";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorClass = new (opts: { formats: string[] }) => Detector;

/** The claim code in a prize card's QR ("INNEV8-PRIZE:K7M2P9QX"), or null for any other QR. */
export function claimInQr(text: string) {
  const m = /INNEV8-PRIZE:([A-Z0-9]{8})/i.exec(text) ?? /^\s*([A-Z0-9]{4})-?([A-Z0-9]{4})\s*$/i.exec(text);
  return m ? (m[2] ? m[1] + m[2] : m[1]).toUpperCase() : null;
}

const WHY = {
  denied: "The camera is blocked. Allow it for this site in the browser (the camera icon in the address bar), or type the code.",
  unavailable: "No camera found on this device. Type the code instead.",
  insecure: "The camera needs the admin's https address. Type the code instead.",
};

/**
 * The prize desk's camera: reads the QR on a player's prize card (the browser's own QR reader where
 * it has one, else jsQR on the camera's frames), and reports its claim code. While `paused` (a card
 * being checked) it keeps the camera on but doesn't read. A laptop's camera, or a phone's back one.
 */
export function DeskCamera({ paused, onCode }: { paused: boolean; onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"starting" | "live" | keyof typeof WHY>("starting");
  const latest = useRef({ paused, onCode });
  useEffect(() => {
    latest.current = { paused, onCode };
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      if (!window.isSecureContext) return setState("insecure");
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unavailable");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (e) {
        if (!stopped) setState((e as Error).name === "NotAllowedError" ? "denied" : "unavailable");
        return;
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      const v = video.current!;
      v.srcObject = stream;
      await v.play().catch(() => {});
      setState("live");

      const Native = (globalThis as { BarcodeDetector?: DetectorClass & { getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
      let native: Detector | null = null;
      try {
        if (Native && (await Native.getSupportedFormats?.())?.includes("qr_code")) native = new Native({ formats: ["qr_code"] });
      } catch {}
      const jsQR = native ? null : (await import("jsqr")).default;

      const tick = async () => {
        if (stopped) return;
        if (!latest.current.paused && v.readyState >= 2 && v.videoWidth) {
          let text: string | null = null;
          if (native) {
            text = (await native.detect(v).catch(() => []))[0]?.rawValue ?? null;
          } else if (jsQR && ctx) {
            // A smaller copy reads faster, and is plenty for a phone held up to the camera
            const scale = Math.min(1, 800 / Math.max(v.videoWidth, v.videoHeight));
            canvas.width = Math.round(v.videoWidth * scale);
            canvas.height = Math.round(v.videoHeight * scale);
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            text = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
          }
          const code = text ? claimInQr(text) : null;
          if (code && !stopped && !latest.current.paused) {
            navigator.vibrate?.(60);
            latest.current.onCode(code);
          }
        }
        timer = window.setTimeout(() => void tick(), 150);
      };
      void tick();
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className={`deskcam${state === "live" ? " is-live" : ""}${paused ? " is-paused" : ""}`}>
      <video ref={video} playsInline muted aria-label="Camera: hold the player's prize QR up to it" />
      {/* (the window to hold the QR in: its corners, and a line sweeping it while it reads) */}
      {state === "live" && (
        <span className="deskcam__frame" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <b className="deskcam__line" />
        </span>
      )}
      {state === "starting" && (
        <span className="deskcam__note">
          <Spinner />
          Starting the camera…
        </span>
      )}
      {state !== "starting" && state !== "live" && (
        <span className="deskcam__note is-off" role="alert">
          <CameraIcon />
          {WHY[state]}
        </span>
      )}
      {state === "live" && (
        <span className="deskcam__tip" aria-live="polite">
          {paused ? "Checking this card…" : "Hold the player's prize QR up to the camera"}
        </span>
      )}
    </div>
  );
}
