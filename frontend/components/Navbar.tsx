import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="flex items-center justify-between bg-slate-900 px-8 py-4 text-white shadow-md">
      
      {/* Logo */}
      <Link
        href="/"
        className="text-2xl font-bold tracking-wide text-cyan-400"
      >
        AVERIS
      </Link>

      {/* Navigation links */}
      <div className="flex items-center gap-8">
        <Link
          href="/"
          className="text-slate-300 transition hover:text-cyan-400"
        >
          Dashboard
        </Link>

        <Link
          href="/reports"
          className="text-slate-300 transition hover:text-cyan-400"
        >
          Reports
        </Link>
      </div>
    </nav>
  );
}