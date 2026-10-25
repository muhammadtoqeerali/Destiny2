import NavBar from "@/components/NavBar";

const LINKS = [
  { href: "/doctor", label: "Patients" },
  { href: "/doctor/predict", label: "Live Risk Prediction" },
];

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <NavBar section="doctor" links={LINKS} />
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
