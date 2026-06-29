import { useUserMeta } from "@/hooks/useUserMeta";

interface BusinessBrandLockupProps {
  variant?: "header" | "drawer";
  href?: string;
}

export function BusinessBrandLockup({
  variant = "header",
  href = "/painel",
}: BusinessBrandLockupProps) {
  const { businessName } = useUserMeta();

  const isDrawer = variant === "drawer";
  const businessSize = isDrawer ? 17 : 19;
  const signatureSize = isDrawer ? 12 : 13;
  const maxWidth = isDrawer ? 200 : 240;

  if (!businessName) {
    return (
      <a
        href={href}
        aria-label="Pólia · ir pro painel"
        className="font-serif text-polia-noite"
        style={{ fontSize: businessSize + 2, lineHeight: 1, letterSpacing: -0.2 }}
      >
        Pólia
      </a>
    );
  }

  return (
    <a
      href={href}
      aria-label={`${businessName} · ir pro painel`}
      className="flex flex-col leading-none"
      style={{ maxWidth, gap: 2 }}
    >
      <span
        className="block truncate font-serif text-polia-noite"
        style={{ fontSize: businessSize, lineHeight: 1.05, letterSpacing: -0.2 }}
        title={businessName}
      >
        {businessName}
      </span>
      <span
        className="caveat-decorativo text-polia-terracota/70"
        style={{ fontSize: signatureSize, lineHeight: 1 }}
      >
        feito com Pólia
      </span>
    </a>
  );
}
