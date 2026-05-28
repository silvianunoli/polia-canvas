import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/flags")({
  component: AdminFlags,
});

function AdminFlags() {
  const [flags, setFlags] = useState<any[]>([]);

  const carregar = async () => {
    const { data } = await supabase.from("feature_flags").select("*").order("key");
    setFlags(data ?? []);
  };

  useEffect(() => {
    carregar();
  }, []);

  const toggle = async (key: string, enabled: boolean) => {
    await supabase.from("feature_flags").update({ enabled, updated_at: new Date().toISOString() }).eq("key", key);
    carregar();
  };

  return (
    <>
      <h2 className="font-serif text-[#1A1A2E] text-[40px] mb-6">Feature Flags</h2>
      <div className="space-y-3">
        {flags.map((flag) => (
          <div key={flag.key} className="bg-white rounded-2xl p-5 border border-[rgba(26,26,46,0.06)] flex items-center justify-between">
            <div>
              <p className="font-mono text-[#1A1A2E] text-[14px] font-medium">{flag.key}</p>
              <p className="font-sans text-[#1A1A2E] text-[13px] opacity-50">{flag.description}</p>
            </div>
            <button
              onClick={() => toggle(flag.key, !flag.enabled)}
              className={`w-12 h-6 rounded-full transition-colors relative ${flag.enabled ? "bg-[#2D6A4F]" : "bg-[rgba(26,26,46,0.15)]"}`}
              aria-label={`Toggle ${flag.key}`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${flag.enabled ? "translate-x-7" : "translate-x-1"}`}
              />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
