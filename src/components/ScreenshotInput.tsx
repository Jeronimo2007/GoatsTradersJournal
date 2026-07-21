"use client";

import { useRef, useState, type DragEvent } from "react";
import { ImagePlus, X } from "lucide-react";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * value: a URL ("/api/images/..."), a data URL, or null.
 * onChange emits a data URL for new uploads, or null when cleared.
 */
export function ScreenshotInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    onChange(await fileToDataUrl(file));
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const item = Array.from(e.clipboardData.items).find((i) =>
      i.type.startsWith("image/")
    );
    if (item) {
      const file = item.getAsFile();
      if (file) handleFile(file);
    }
  };

  return (
    <div>
      <span className="field-label">{label}</span>
      {value ? (
        <div className="relative group rounded-lg overflow-hidden border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={label}
            className="w-full max-h-72 object-contain bg-background"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 rounded-md bg-black/70 p-1.5 text-white hover:bg-black"
            aria-label="Remove image"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onPaste={onPaste}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          tabIndex={0}
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center cursor-pointer transition-colors ${
            dragging
              ? "border-accent bg-accent/5"
              : "border-border hover:border-accent/60 hover:bg-surface-2"
          }`}
        >
          <ImagePlus className="h-6 w-6 text-muted" />
          <div className="text-sm text-muted">
            Click, drag &amp; drop, or paste an image
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
