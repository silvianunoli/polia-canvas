import { type ReactNode } from "react";
import { CosmicBackground } from "./CosmicBackground";
import { CosmicLogo } from "./CosmicLogo";

interface AuthShellProps {
  children: ReactNode;
  maxWidth?: number;
}

export function AuthShell({ children, maxWidth = 440 }: AuthShellProps) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <CosmicBackground />
      <div className="relative z-10 flex min-h-screen w-full flex-col items-center px-5 pb-16 pt-10">
        <CosmicLogo />
        <main
          className="mt-10 flex w-full flex-1 flex-col items-center"
        >
          <div className="w-full" style={{ maxWidth }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function CaveatEyebrow({ children, size = 28 }: { children: ReactNode; size?: number }) {
  return (
    <p
      className="mb-2 text-center font-handwritten text-[#E89770]"
      style={{ fontSize: size, lineHeight: 1.1 }}
    >
      {children}
    </p>
  );
}

export function SerifHeadline({ children, size = 52 }: { children: ReactNode; size?: number }) {
  return (
    <h1
      className="text-center font-serif leading-[1.05] text-[#FDF8F5]"
      style={{ fontSize: `clamp(${Math.round(size * 0.6)}px, 6vw, ${size}px)` }}
    >
      {children}
    </h1>
  );
}

export function SubText({ children }: { children: ReactNode }) {
  return (
    <p className="text-center font-sans text-[16px] leading-relaxed text-[#D8D2CC]/80">
      {children}
    </p>
  );
}

export function Divider({ label = "ou" }: { label?: string }) {
  return (
    <div className="my-6 flex items-center gap-3" aria-hidden="true">
      <div className="h-px flex-1 bg-[rgba(255,255,255,0.12)]" />
      <span className="font-sans text-[13px] text-[#D8D2CC]/50">{label}</span>
      <div className="h-px flex-1 bg-[rgba(255,255,255,0.12)]" />
    </div>
  );
}
