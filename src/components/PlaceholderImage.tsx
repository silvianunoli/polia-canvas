import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";

interface PlaceholderImageProps {
  slot: string;
  width: number;
  height: number;
  description?: string;
  accept?: string;
  currentSrc?: string;
  fit?: "cover" | "contain";
  className?: string;
  rounded?: boolean | number;
  silent?: boolean;
  onUpload?: (file: File) => Promise<string>;
}

/**
 * Placeholder uploadável usado em todos os slots de imagem (logo, lockup,
 * raposa, foto de perfil). Por enquanto armazena local (localStorage),
 * com possibilidade de plugar onUpload pra subir em Supabase Storage.
 */
export function PlaceholderImage({
  slot,
  width,
  height,
  description,
  accept = "image/svg+xml,image/png,image/jpeg,image/webp",
  currentSrc,
  fit = "contain",
  className,
  rounded = true,
  silent = false,
  onUpload,
}: PlaceholderImageProps) {
  const storageKey = `polia-asset-${slot}`;
  const [image, setImage] = useState<string | null>(currentSrc ?? null);
  const [hover, setHover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentSrc) {
      setImage(currentSrc);
      return;
    }
    if (typeof window === "undefined") return;
    setImage(localStorage.getItem(storageKey));
  }, [storageKey, currentSrc]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) setImage(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    setBusy(true);
    try {
      if (onUpload) {
        const url = await onUpload(file);
        localStorage.setItem(storageKey, url);
        setImage(url);
      } else {
        const reader = new FileReader();
        await new Promise<void>((resolve, reject) => {
          reader.onload = () => {
            const data = reader.result as string;
            try {
              localStorage.setItem(storageKey, data);
            } catch {
              // localStorage cheio — segue sem persistir
            }
            setImage(data);
            // notify other tabs/components
            window.dispatchEvent(
              new StorageEvent("storage", { key: storageKey, newValue: data }),
            );
            resolve();
          };
          reader.onerror = () => reject(new Error("read"));
          reader.readAsDataURL(file);
        });
      }
    } catch {
      setErrorMsg("não consegui subir, tenta de novo");
      setTimeout(() => setErrorMsg(null), 3000);
    } finally {
      setBusy(false);
    }
  };

  const borderRadius = rounded === false ? 0 : typeof rounded === "number" ? rounded : 8;

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setHover(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  return (
    <div
      className={className}
      style={{ width, height, position: "relative", borderRadius }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      {image ? (
        <>
          <img
            src={image}
            alt={description ?? slot}
            style={{
              width: "100%",
              height: "100%",
              borderRadius,
              objectFit: fit,
              display: "block",
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            title="trocar imagem"
            className="font-sans absolute"
            style={{
              bottom: 6,
              right: 6,
              fontSize: 10,
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              padding: "4px 8px",
              borderRadius: 6,
              opacity: hover ? 1 : 0,
              transition: "opacity 0.2s ease",
              cursor: "pointer",
              border: "none",
            }}
          >
            trocar
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          title={description ?? slot}
          style={{
            width: "100%",
            height: "100%",
            border: "1px dashed rgba(201,107,62,0.30)",
            background: hover
              ? "rgba(201,107,62,0.10)"
              : "rgba(253,248,245,0.6)",
            borderRadius,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            padding: 6,
            cursor: "pointer",
            transition: "background 0.2s ease",
            textAlign: "center",
            overflow: "hidden",
          }}
        >
          {hover ? (
            <>
              <Upload size={Math.min(width, height) > 60 ? 18 : 12} color="#C96B3E" />
              <span
                className="font-sans"
                style={{ fontSize: 11, color: "#C96B3E" }}
              >
                clica pra subir SVG
              </span>
            </>
          ) : (
            <>
              <span
                style={{
                  fontFamily: "Caveat, cursive",
                  fontSize: Math.min(width, height) > 60 ? 16 : 14,
                  color: silent ? "transparent" : "#9A7728",
                  lineHeight: 1.1,
                }}
              >
                {silent ? "" : `PLACEHOLDER · ${slot}`}
              </span>
              {!silent && description && Math.min(width, height) > 60 && (
                <span
                  style={{
                    fontFamily: "Caveat, cursive",
                    fontSize: 14,
                    color: "#9A7728",
                    opacity: 0.8,
                    lineHeight: 1.1,
                  }}
                >
                  {description}
                </span>
              )}
              {!silent && (
                <span
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 9,
                    color: "rgba(26,26,46,0.45)",
                  }}
                >
                  {width}×{height}
                </span>
              )}
            </>
          )}
        </button>
      )}
      {busy && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.65)", borderRadius }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              border: "2px solid rgba(201,107,62,0.3)",
              borderTopColor: "#C96B3E",
              borderRadius: "50%",
              animation: "polia-spin 0.7s linear infinite",
            }}
          />
        </div>
      )}
      {errorMsg && (
        <div
          className="absolute"
          style={{
            top: -28,
            left: 0,
            background: "#C0392B",
            color: "#fff",
            fontSize: 11,
            padding: "4px 8px",
            borderRadius: 6,
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          {errorMsg}
        </div>
      )}
      <style>{`@keyframes polia-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
