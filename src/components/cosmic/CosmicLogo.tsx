export function CosmicLogo({ variant = "horizontal" }: { variant?: "horizontal" | "vertical" }) {
  if (variant === "vertical") {
    return (
      <div className="mx-auto flex h-[180px] w-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#C96B3E] bg-[rgba(36,36,66,0.4)] p-4 text-center">
        <span className="font-accent text-[10px] uppercase tracking-[1.5px] text-[#C8A96E]">
          Placeholder · Logo
        </span>
        <span className="mt-1 font-accent text-[10px] uppercase tracking-[1.5px] text-[#C8A96E]/70">
          Lockup L2 Vertical · 180×180
        </span>
      </div>
    );
  }
  return (
    <div className="mx-auto flex h-[32px] w-[120px] items-center justify-center rounded-lg border border-dashed border-[#C96B3E] bg-[rgba(36,36,66,0.4)]">
      <span className="font-accent text-[10px] uppercase tracking-[1.5px] text-[#C8A96E]">
        Placeholder · Logo
      </span>
    </div>
  );
}
