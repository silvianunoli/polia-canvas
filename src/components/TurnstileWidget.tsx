export function TurnstileWidget({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  return <div ref={containerRef} className="mt-1" />;
}
