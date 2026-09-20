import Link from "next/link";

const categories = [
  {
    name: "Check Document",
    description: "Shipping documents that require verification",
    count: 12,
    icon: "▣",
    href: "/category/check-document",
    iconStyle: "bg-blue-100 text-blue-600",
    countStyle: "text-blue-600",
  },
  {
    name: "SPAM",
    description: "Emails identified as spam",
    count: 7,
    icon: "!",
    href: "/category/spam",
    iconStyle: "bg-red-100 text-red-500",
    countStyle: "text-red-600",
  },
  {
    name: "New Shipping Instruction",
    description: "New shipping instruction requests",
    count: 3,
    icon: "→",
    href: "/category/new-shipping-instruction",
    iconStyle: "bg-blue-100 text-blue-600",
    countStyle: "text-blue-600",
  },
  {
    name: "Invoice Question",
    description: "Questions related to invoices",
    count: 18,
    icon: "?",
    href: "/category/invoice-question",
    iconStyle: "bg-green-100 text-green-600",
    countStyle: "text-green-700",
  },
  {
    name: "Operational Update",
    description: "General operational updates",
    count: 3,
    icon: "✓",
    href: "/category/operational-update",
    iconStyle: "bg-yellow-100 text-yellow-600",
    countStyle: "text-yellow-700",
  },
];

export default function Dashboard() {
  return (
    <main className="min-h-screen bg-[#f4f8fd]">
      <section className="mx-auto max-w-[1500px] px-8 py-8">

        {/* Page heading */}
        <div className="mb-8">
          <p className="text-[11px] font-bold tracking-[1.5px] text-blue-600">
            EMAIL CLASSIFICATION
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Shipping E-mail Review
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Review and manage emails received by the shipping operations team.
          </p>
        </div>

        {/* Overview */}
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-800">
            Email Categories
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Select a category to view the classified emails.
          </p>
        </div>

        {/* Category cards */}
        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.name}
              href={category.href}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg"
            >
              <div className="flex items-start justify-between">

                {/* Icon */}
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold ${category.iconStyle}`}
                >
                  {category.icon}
                </div>

                {/* Count */}
                <div className="text-right">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    Emails
                  </p>

                  <p
                    className={`mt-1 text-3xl font-bold ${category.countStyle}`}
                  >
                    {category.count}
                  </p>
                </div>
              </div>

              {/* Text */}
              <div className="mt-6">
                <h3 className="text-base font-bold text-slate-800">
                  {category.name}
                </h3>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {category.description}
                </p>
              </div>

              {/* Click indication */}
              <div className="mt-6 flex items-center text-xs font-bold text-blue-600">
                View emails

                <span className="ml-2 transition-transform group-hover:translate-x-1">
                  →
                </span>
              </div>
            </Link>
          ))}
        </section>

        {/* Quick summary */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Review Overview
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Summary of today's classified emails.
              </p>
            </div>

            <Link
              href="/reports"
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
            >
              Review Queue →
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-xs text-slate-500">Total emails</p>
              <p className="mt-1 text-2xl font-bold text-blue-700">
                43
              </p>
            </div>

            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-xs text-slate-500">Need attention</p>
              <p className="mt-1 text-2xl font-bold text-red-600">
                12
              </p>
            </div>

            <div className="rounded-xl bg-green-50 p-4">
              <p className="text-xs text-slate-500">Processed</p>
              <p className="mt-1 text-2xl font-bold text-green-700">
                31
              </p>
            </div>

            <div className="rounded-xl bg-yellow-50 p-4">
              <p className="text-xs text-slate-500">Needs review</p>
              <p className="mt-1 text-2xl font-bold text-yellow-700">
                3
              </p>
            </div>
          </div>
        </section>

      </section>
    </main>
  );
}