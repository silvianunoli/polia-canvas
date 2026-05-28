import { useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";

interface Props {
  id: string;
  label: string;
  width: number | string;
  height: number | string;
  description?: string;
  fit?: "cover" | "contain";
}

export function UploadablePlaceholder({ id, label, width, height, description, fit = "cover" }: Props) {
  const storageKey = `polia-asset-${id}`;
  const [image, setImage] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setImage(localStorage.getItem(storageKey));
  }, [storageKey]);

  const onPick = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as string;
      localStorage.setItem(storageKey, data);
      setImage(data);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      style={{ width, height, position: "relative" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
        }}
      />
      {image ? (
        <>
          <img
            src={image}
            alt={label}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 12,
              objectFit: "cover",
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-sans absolute"
            style={{
              bottom: 12,
              right: 12,
              fontSize: 11,
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              padding: "6px 12px",
              borderRadius: 6,
              opacity: hover ? 1 : 0,
              transition: "opacity 0.2s ease",
              cursor: "pointer",
              border: "none",
            }}
          >
            Trocar imagem
          </button>
        </>
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            border: "1.5px dashed var(--terracota)",
            background: "rgba(201,107,62,0.04)",
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: 16,
            textAlign: "center",
          }}
        >
          <ImagePlus size={32} color="rgba(201,107,62,0.4)" />
          <div className="font-sans" style={{ fontSize: 12, color: "rgba(201,107,62,0.5)" }}>
            {label}
          </div>
          {description && (
            <div
              className="font-sans"
              style={{ fontSize: 10, color: "rgba(201,107,62,0.3)", marginTop: -4 }}
            >
              {description}
            </div>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-sans"
            style={{
              fontSize: 11,
              color: "var(--terracota)",
              border: "1px solid rgba(201,107,62,0.4)",
              padding: "6px 12px",
              borderRadius: 6,
              cursor: "pointer",
              background: "transparent",
              marginTop: 6,
            }}
          >
            Enviar imagem
          </button>
        </div>
      )}
    </div>
  );
}
