"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function Icon({
  type,
}: {
  type: "home" | "queue" | "check";
}) {
  const icons = {
    home: (
      <>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
        <path d="M9 21v-7h6v7" />
      </>
    ),

    queue: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),

    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[19px] w-[19px]"
    >
      {icons[type]}
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();

  const dashboardActive = pathname === "/";
  const reviewQueueActive = pathname === "/reviewqueue";
  const resolvedActive = pathname === "/resolved";

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-[230px] flex-col border-r border-[#EEE9E3] bg-[#FFE4D1] px-[18px] py-[25px] text-[#6B625B] shadow-[8px_0_30px_rgba(120,80,40,0.06)]">

      {/* Logo */}
      <div className="flex items-center gap-3 px-2 pb-[34px]">
        <div className="grid h-[38px] w-[38px] place-items-center rounded-[11px] bg-[#EA580C] font-extrabold text-white shadow-[0_8px_20px_rgba(234,88,12,0.20)]">
          S
        </div>

        <div>
          <strong className="block text-[17px] text-[#292524]">
            ShipOps
          </strong>

          <span className="mt-[3px] block text-[11px] text-[#9A8F86]">
            Document Control
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="grid gap-2">

        {/* Dashboard */}
        <Link
          href="/"
          className={`group flex h-12 items-center gap-[13px] rounded-[10px] px-[13px] text-sm font-medium transition-all duration-200 ${
            dashboardActive
              ? "border border-[#FED7AA] bg-[#FFF1E8] text-[#C2410C] shadow-[0_4px_12px_rgba(234,88,12,0.06)]"
              : "text-[#6B625B] hover:-translate-y-[1px] hover:bg-[#FFF5EF] hover:text-[#C2410C] hover:shadow-[0_6px_16px_rgba(234,88,12,0.10)]"
          }`}
        >
          <Icon type="home" />
          <span>Dashboard</span>
        </Link>

        {/* Review Queue */}
        <Link
          href="/reviewqueue"
          className={`group flex h-12 items-center gap-[13px] rounded-[10px] px-[13px] text-sm transition-all duration-200 ${
            reviewQueueActive
              ? "border border-[#FED7AA] bg-[#FFF1E8] font-medium text-[#C2410C] shadow-[0_4px_12px_rgba(234,88,12,0.06)]"
              : "text-[#6B625B] hover:translate-x-[2px] hover:bg-[#FFF5EF] hover:text-[#C2410C]"
          }`}
        >
          <Icon type="queue" />

          <span>Review Queue</span>

          <b
            className={`ml-auto grid h-[23px] min-w-[23px] place-items-center rounded-full px-[6px] text-[11px] font-semibold transition-colors duration-200 ${
              reviewQueueActive
                ? "bg-[#EA580C] text-white"
                : "bg-[#FDE8D7] text-[#C2410C] group-hover:bg-[#EA580C] group-hover:text-white"
            }`}
          >
            12
          </b>
        </Link>

        {/* Resolved Cases */}
        <Link
          href="/resolved"
          className={`group flex h-12 items-center gap-[13px] rounded-[10px] px-[13px] text-sm transition-all duration-200 ${
            resolvedActive
              ? "border border-[#FED7AA] bg-[#FFF1E8] font-medium text-[#C2410C] shadow-[0_4px_12px_rgba(234,88,12,0.06)]"
              : "text-[#6B625B] hover:translate-x-[2px] hover:bg-[#FFF5EF] hover:text-[#C2410C]"
          }`}
        >
          <Icon type="check" />
          <span>Resolved Cases</span>
        </Link>
      </nav>

      {/* Help box */}
      <div className="mt-auto rounded-[14px] border border-[#F3DED0] bg-[#FFF8F3] p-4">

        <div className="mb-[10px] grid h-[27px] w-[27px] place-items-center rounded-lg bg-[#EA580C] font-extrabold text-white">
          ?
        </div>

        <strong className="text-[13px] text-[#292524]">
          Need help?
        </strong>

        <p className="my-[6px] mb-[13px] text-[11px] leading-[1.5] text-[#8A7F77]">
          View the review guide and field rules.
        </p>

        <button className="w-full rounded-[7px] border border-[#F3DED0] bg-white py-2 font-bold text-[#C2410C] transition-all duration-200 hover:border-[#FDBA74] hover:bg-[#FFF1E8]">
          Open guide
        </button>
      </div>

      {/* Version */}
      <p className="ml-[3px] mt-[14px] text-[10px] text-[#A69B92]">
        ShipOps v1.0 · Hackathon demo
      </p>
    </aside>
  );
}