import { useEffect, useState } from "react";

type ServerStatus = "checking" | "ok" | "error";

export function DiagnosticPanel() {
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [serverStatus, setServerStatus] = useState<ServerStatus>("checking");
  const [serverCode, setServerCode] = useState<number | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [renderedAt] = useState<Date>(new Date());

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      setServerStatus("checking");
      try {
        const res = await fetch(window.location.origin + "/", {
          method: "HEAD",
          cache: "no-store",
        });
        if (cancelled) return;
        setServerCode(res.status);
        setServerStatus(res.ok ? "ok" : "error");
      } catch {
        if (cancelled) return;
        setServerStatus("error");
        setServerCode(null);
      } finally {
        if (!cancelled) setLastCheck(new Date());
      }
    };
    ping();
    const id = setInterval(ping, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (typeof window === "undefined") return null;

  const dot = (color: string) => (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        marginRight: 6,
      }}
    />
  );

  const serverColor =
    serverStatus === "ok" ? "#22c55e" : serverStatus === "error" ? "#ef4444" : "#eab308";

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        right: 12,
        zIndex: 99999,
        fontFamily: "ui-monospace, monospace",
        fontSize: 12,
      }}
    >
      {open ? (
        <div
          style={{
            background: "rgba(15,15,25,0.92)",
            color: "#fff",
            padding: "10px 12px",
            borderRadius: 8,
            minWidth: 220,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <strong>Diagnóstico</strong>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                fontSize: 14,
              }}
              aria-label="Fechar"
            >
              ×
            </button>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <div>
              {dot(online ? "#22c55e" : "#ef4444")}
              Conexão: {online ? "online" : "offline"}
            </div>
            <div>
              {dot(serverColor)}
              Servidor:{" "}
              {serverStatus === "checking"
                ? "verificando…"
                : serverStatus === "ok"
                  ? `ok (${serverCode})`
                  : `erro${serverCode ? ` (${serverCode})` : ""}`}
            </div>
            <div style={{ opacity: 0.8 }}>
              Última verificação: {lastCheck ? lastCheck.toLocaleTimeString() : "—"}
            </div>
            <div style={{ opacity: 0.8 }}>
              Última renderização: {renderedAt.toLocaleTimeString()}
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          style={{
            background: "rgba(15,15,25,0.92)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 999,
            padding: "6px 10px",
            cursor: "pointer",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
          aria-label="Abrir diagnóstico"
        >
          {dot(serverColor)}
          Diagnóstico
        </button>
      )}
    </div>
  );
}
