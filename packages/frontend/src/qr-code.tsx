"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@festhub/ui/components/button";
import { DownloadIcon } from "@festhub/ui/icons";

type QrCodePanelProps = {
  value: string;
  filename?: string;
  label?: string;
};

export function QrCodePanel(props: QrCodePanelProps) {
  return <GeneratedQr key={props.value} {...props} />;
}

function GeneratedQr({
  value,
  filename = "festhub-qr.png",
  label = "QR code",
}: QrCodePanelProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState("");
  const [error, setError] = useState<{ value: string; message: string } | null>(null);
  const ready = rendered === value && !!value;

  useEffect(() => {
    let active = true;
    const target = canvas.current;
    if (!target || !value) return;
    import("qrcode")
      .then(({ default: qr }) => {
        if (!active) return;
        return qr.toCanvas(target, value, {
          width: 768,
          margin: 4,
          errorCorrectionLevel: "M",
          color: { dark: "#000000", light: "#ffffff" },
        });
      })
      .then(() => {
        if (active) {
          // The encoder sets inline pixel dimensions. Keep those pixels for the
          // download while fitting the preview inside its dialog.
          target.style.width = "100%";
          target.style.height = "auto";
          setRendered(value);
          setError(null);
        }
      })
      .catch(() => {
        if (active)
          setError({ value, message: "Could not generate this QR code. Please try again." });
      });
    return () => { active = false; };
  }, [value]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="grid size-64 max-w-full place-items-center rounded-lg border bg-white p-1">
        <canvas
          ref={canvas}
          role="img"
          aria-label={label}
          className={`col-start-1 row-start-1 h-auto w-full ${ready ? "" : "invisible"}`}
        />
        {!ready && (
          <p role="status" className="col-start-1 row-start-1 px-4 text-center text-sm text-neutral-600">
            {error?.value === value ? error.message : "Generating QR…"}
          </p>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={!ready}
        onClick={() => {
          if (!canvas.current || !ready) return;
          const link = document.createElement("a");
          link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
          link.href = canvas.current.toDataURL("image/png");
          link.click();
        }}
      >
        <DownloadIcon aria-hidden="true" /> Download QR
      </Button>
    </div>
  );
}
