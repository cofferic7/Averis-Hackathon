"use client";

import Link from "next/link";

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
  return (
    <aside className="fixed left-0 top-0 flex h-screen w-[230px] flex-col bg-gradient-to-b from-[#071c3d] via-[#0b3564] to-[#0c4a79] px-[18px] py-[25px] text-blue-100 shadow-[8px_0_30px_rgba(14,44,84,0.12)]">

      {/* Logo */}
      <div className="flex items-center gap-3 px-2 pb-[34px]">
        <div className="grid h-[38px] w-[38px] place-items-center rounded-[11px] bg-gradient-to-br from-[#2d8cff] to-[#075ddb] font-extrabold text-white shadow-[0_8px_20px_rgba(0,105,255,0.35)]">
          S
        </div>

        <div>
          <strong className="block text-[17px] text-white">
            ShipOps
          </strong>

          <span className="mt-[3px] block text-[11px] text-[#93afd0]">
            Document Control
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="grid gap-2">
        <Link
          href="/"
          className="flex h-12 items-center gap-[13px] rounded-[10px] bg-gradient-to-r from-[#0964ce] to-[#217ce0] px-[13px] text-sm text-white shadow-[0_9px_22px_rgba(0,73,174,0.35)]"
        >
          <Icon type="home" />
          <span>Dashboard</span>
        </Link>

        <Link
          href="/reports"
          className="group flex h-12 items-center gap-[13px] rounded-[10px] px-[13px] text-sm text-[#bcd0e8] transition hover:translate-x-[2px] hover:bg-white/[0.07] hover:text-white"
        >
          <Icon type="queue" />
          <span>Review Queue</span>

          <b className="ml-auto grid min-w-[23px] h-[23px] place-items-center rounded-full bg-white/[0.18] px-[6px] text-[11px]">
            12
          </b>
        </Link>

        <Link
          href="/resolved"
          className="flex h-12 items-center gap-[13px] rounded-[10px] px-[13px] text-sm text-[#bcd0e8] transition hover:translate-x-[2px] hover:bg-white/[0.07] hover:text-white"
        >
          <Icon type="check" />
          <span>Resolved Cases</span>
        </Link>
      </nav>

      {/* Help box */}
      <div className="mt-auto rounded-[14px] border border-white/[0.14] bg-white/[0.07] p-4">
        <div className="mb-[10px] grid h-[27px] w-[27px] place-items-center rounded-lg bg-white font-extrabold text-[#1267c9]">
          ?
        </div>

        <strong className="text-[13px] text-white">
          Need help?
        </strong>

        <p className="my-[6px] mb-[13px] text-[11px] leading-[1.5] text-[#a9c2de]">
          View the review guide and field rules.
        </p>

        <button className="w-full rounded-[7px] border-0 bg-white/[0.13] py-2 text-white font-bold">
          Open guide
        </button>
      </div>

      {/* Version */}
      <p className="mt-[14px] ml-[3px] text-[10px] text-[#87a9cb]">
        ShipOps v1.0 · Hackathon demo
      </p>
    </aside>
  );
}