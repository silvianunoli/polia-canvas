import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const Route = createFileRoute("/_public")({
  component: PublicLayout,
});

function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--azul-noite)" }}>
      <Navbar transparentOnTop={false} />
      <main className="flex-1" style={{ paddingTop: 64 }}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
