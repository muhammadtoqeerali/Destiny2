import NavBar from "@/components/NavBar";
import AdminGate from "@/components/AdminGate";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/dataset", label: "Dataset" },
  { href: "/admin/preprocessing", label: "Preprocessing" },
  { href: "/admin/models", label: "Models" },
  { href: "/admin/results", label: "Results" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <NavBar section="admin" links={LINKS} />
      <AdminGate>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </AdminGate>
    </div>
  );
}
