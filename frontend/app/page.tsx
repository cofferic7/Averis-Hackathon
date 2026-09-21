"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getResults } from "@/lib/api";

type EmailType =
    | "CHECK_DOCUMENT"
    | "SPAM"
    | "NEW_SHIPPING_INSTRUCTION"
    | "INVOICE_QUESTION"
    | "OPERATIONAL_UPDATE";

type StatusFilter = "ALL" | "NEEDS_REVIEW" | "RESOLVED";

type Email = {
    id: string;
    sender: string;
    subject: string;
    received: string;
    type: EmailType;
    status: "NEEDS_REVIEW" | "RESOLVED";
    summary: string;
    si?: string;
    bl?: string;
};

type Category = {
    type: EmailType;
    title: string;
    description: string;
    count: number;
    icon: string;
};


/* =========================================================
   DEMO EMAIL DATA
========================================================= */


/* ========

==========*/



/* =========================================================
   DASHBOARD
========================================================= */

export default function Dashboard({
    openReviewQueue,
}: {
    openReviewQueue: () => void;
}) {
    const [selectedCategory, setSelectedCategory] =
        useState<EmailType | null>(null);

    const [statusFilter, setStatusFilter] =
        useState<StatusFilter>("ALL");

    const [search, setSearch] = useState("");


    const [data, setData] = useState<Record<string, any>>({});

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getResults()
            .then((result) => {
                setData(result);
                setLoading(false);
            })
            .catch((error) => {
                console.error(error);
                setLoading(false);
            });
    }, []);

    const categoryMap: Record<string, EmailType> = {
        BL_COMPARISON: "CHECK_DOCUMENT",
        SI_REQUEST: "NEW_SHIPPING_INSTRUCTION",
        INVOICE_QUERY: "INVOICE_QUESTION",
        GENERAL: "OPERATIONAL_UPDATE",
        SPAM: "SPAM",
    };

    const emails: Email[] = Object.entries(data).map(
        ([id, item]: [string, any]) => ({
            id,
            sender: "Shipping Operations",
            subject: item.subject || "Shipping Email",
            received: "Recently",
            type: categoryMap[item.category] || "OPERATIONAL_UPDATE",
            status:
                item.status === "NEEDS_REVIEW"
                    ? "NEEDS_REVIEW"
                    : "RESOLVED",
            summary:
                item.status === "NEEDS_REVIEW"
                    ? item.review_reason || "Requires attention"
                    : "No issues detected",
        })
    );

    const categories: Category[] = [
        {
            type: "CHECK_DOCUMENT",
            title: "Document Check",
            description: "Verify shipping documents and identify discrepancies",
            count: emails.filter(
                (email) => email.type === "CHECK_DOCUMENT"
            ).length,
            icon: "▣",
        },
        {
            type: "NEW_SHIPPING_INSTRUCTION",
            title: "Shipping Instructions",
            description: "Review new and updated shipping instructions",
            count: emails.filter(
                (email) => email.type === "NEW_SHIPPING_INSTRUCTION"
            ).length,
            icon: "≡",
        },
        {
            type: "INVOICE_QUESTION",
            title: "Invoice Questions",
            description: "Review questions and enquiries about invoices",
            count: emails.filter(
                (email) => email.type === "INVOICE_QUESTION"
            ).length,
            icon: "$",
        },
        {
            type: "OPERATIONAL_UPDATE",
            title: "Operational Updates",
            description: "Monitor shipment and operational communications",
            count: emails.filter(
                (email) => email.type === "OPERATIONAL_UPDATE"
            ).length,
            icon: "↻",
        },
        {
            type: "SPAM",
            title: "Spam",
            description: "Automatically filtered unwanted emails",
            count: emails.filter(
                (email) => email.type === "SPAM"
            ).length,
            icon: "⊘",
        },
    ];

    const currentCategory = categories.find((category) => category.type === selectedCategory);


    const totalEmails = emails.length;

    const needsAttention = emails.filter(
        (email) => email.status === "NEEDS_REVIEW"
    ).length;

    const resolved = emails.filter(
        (email) => email.status === "RESOLVED"
    ).length;


    /* =====================================================
       FILTER EMAILS
    ===================================================== */

    const filteredEmails = useMemo(() => {
        if (!selectedCategory) {
            return [];
        }

        return emails.filter((email) => {
            const matchesCategory =
                email.type === selectedCategory;

            const matchesStatus =
                statusFilter === "ALL" ||
                email.status === statusFilter;

            const searchText = search.toLowerCase();

            const matchesSearch =
                email.id.toLowerCase().includes(searchText) ||
                email.sender.toLowerCase().includes(searchText) ||
                email.subject.toLowerCase().includes(searchText) ||
                email.summary.toLowerCase().includes(searchText);

            return (
                matchesCategory &&
                matchesStatus &&
                matchesSearch
            );
        });
    }, [selectedCategory, statusFilter, search]);


    /* =====================================================
       OPEN CATEGORY
    ===================================================== */

    const openCategory = (type: EmailType) => {
        setSelectedCategory(type);
        setStatusFilter("ALL");
        setSearch("");
    };


    /* =====================================================
       BACK
    ===================================================== */

    const goBack = () => {
        setSelectedCategory(null);
        setStatusFilter("ALL");
        setSearch("");
    };


    /* =====================================================
       CATEGORY DETAIL VIEW
    ===================================================== */

    if (selectedCategory && currentCategory) {
        return (
            <div className="min-h-full bg-[#F8FAFC] px-8 py-7">

                {/* BACK BUTTON */}

                <button
                    onClick={goBack}
                    className="
                        group
                        flex
                        items-center
                        gap-3
                        mb-5
                        text-gray-600
                        hover:text-[#EA580C]
                        transition-all
                        duration-200
                    "
                >
                    <span
                        className="
                            text-[38px]
                            leading-none
                            font-light
                            transition-transform
                            duration-200
                            group-hover:-translate-x-1
                        "
                    >
                        ←
                    </span>

                    <span className="text-base font-semibold">
                        Back to categories
                    </span>
                </button>


                {/* HEADER */}

                <div className="flex items-center justify-between mb-6">

                    <div className="flex items-center gap-4">

                        <div
                            className="
                                w-11
                                h-11
                                rounded-xl
                                bg-orange-50
                                text-[#EA580C]
                                flex
                                items-center
                                justify-center
                                text-xl
                                font-bold
                            "
                        >
                            {currentCategory.icon}
                        </div>

                        <div>

                            <h1 className="text-2xl font-bold text-[#1F2937]">
                                {currentCategory.title}
                            </h1>

                            <p className="text-sm text-gray-500 mt-1">
                                {currentCategory.description}
                            </p>

                        </div>

                    </div>


                    <div className="text-right">

                        <p className="text-2xl font-bold text-gray-800">
                            {currentCategory.count}
                        </p>

                        <p className="text-xs text-gray-400">
                            total emails
                        </p>

                    </div>

                </div>


                {/* =================================================
                    CATEGORY NAVIGATION
                ================================================= */}

                <div
                    className="
                        relative
                        bg-white
                        border
                        border-gray-200
                        rounded-xl
                        p-1.5
                        flex
                        gap-1
                        mb-4
                        shadow-sm
                    "
                >

                    {categories.map((category) => {

                        const active =
                            selectedCategory === category.type;

                        return (
                            <button
                                key={category.type}
                                onClick={() =>
                                    openCategory(category.type)
                                }
                                className={`
                                    relative
                                    flex-1
                                    px-3
                                    py-2.5
                                    rounded-lg
                                    text-sm
                                    font-semibold
                                    transition-all
                                    duration-200
                                    ${
                                        active
                                            ? "bg-[#FFF7ED] text-[#EA580C] shadow-sm"
                                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                                    }
                                `}
                            >
                                {category.title}

                                {active && (
                                    <span
                                        className="
                                            absolute
                                            bottom-0
                                            left-1/2
                                            -translate-x-1/2
                                            w-8
                                            h-0.5
                                            bg-[#EA580C]
                                            rounded-full
                                        "
                                    />
                                )}
                            </button>
                        );
                    })}

                </div>


                {/* =================================================
                    STATUS SUB-NAVIGATION
                ================================================= */}

                <div className="flex items-center justify-between mb-5">

                    <div
                        className="
                            inline-flex
                            bg-white
                            border
                            border-gray-200
                            rounded-lg
                            p-1
                            shadow-sm
                        "
                    >

                        {[
                            {
                                value: "ALL" as StatusFilter,
                                label: "All emails",
                            },
                            {
                                value: "NEEDS_REVIEW" as StatusFilter,
                                label: "Needs review",
                            },
                            {
                                value: "RESOLVED" as StatusFilter,
                                label: "Resolved",
                            },
                        ].map((tab) => {

                            const active =
                                statusFilter === tab.value;

                            return (
                                <button
                                    key={tab.value}
                                    onClick={() =>
                                        setStatusFilter(tab.value)
                                    }
                                    className={`
                                        relative
                                        px-5
                                        py-2
                                        rounded-md
                                        text-sm
                                        font-semibold
                                        transition-all
                                        duration-200
                                        ${
                                            active
                                                ? "bg-[#EA580C] text-white shadow-sm"
                                                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                                        }
                                    `}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}

                    </div>


                    {/* SEARCH */}

                    <div className="relative w-72">

                        <span
                            className="
                                absolute
                                left-3.5
                                top-1/2
                                -translate-y-1/2
                                text-gray-400
                            "
                        >
                            ⌕
                        </span>

                        <input
                            type="text"
                            placeholder="Search emails..."
                            value={search}
                            onChange={(e) =>
                                setSearch(e.target.value)
                            }
                            className="
                                w-full
                                bg-white
                                border
                                border-gray-300
                                rounded-lg
                                pl-10
                                pr-4
                                py-2.5
                                text-sm
                                outline-none
                                transition
                                focus:border-[#EA580C]
                                focus:ring-2
                                focus:ring-orange-100
                            "
                        />

                    </div>

                </div>


                {/* RESULT COUNT */}

                <div className="mb-3">

                    <p className="text-sm text-gray-500">
                        Showing{" "}
                        <span className="font-semibold text-gray-800">
                            {filteredEmails.length}
                        </span>{" "}
                        email
                        {filteredEmails.length !== 1 ? "s" : ""}
                    </p>

                </div>


                {/* =================================================
                    EMAIL LIST
                ================================================= */}

                <div className="space-y-3">

                    {filteredEmails.map((email) => (

                        <div
                            key={email.id}
                            className="
                                group
                                bg-white
                                border
                                border-gray-200
                                rounded-xl
                                px-5
                                py-4
                                shadow-sm
                                transition-all
                                duration-200
                                hover:-translate-y-0.5
                                hover:shadow-md
                                hover:border-orange-200
                            "
                        >

                            <div className="flex items-center gap-5">

                                {/* EMAIL ID */}

                                <div className="w-28 shrink-0">

                                    <span
                                        className="
                                            text-sm
                                            font-bold
                                            text-gray-700
                                        "
                                    >
                                        {email.id}
                                    </span>

                                </div>


                                {/* MAIN CONTENT */}

                                <div className="flex-1 min-w-0">

                                    <div className="flex items-center gap-3 mb-1">

                                        <h3
                                            className="
                                                font-semibold
                                                text-gray-800
                                                truncate
                                            "
                                        >
                                            {email.subject}
                                        </h3>

                                        <span
                                            className={`
                                                shrink-0
                                                text-[11px]
                                                font-bold
                                                px-2.5
                                                py-1
                                                rounded-full
                                                ${
                                                    email.status ===
                                                    "NEEDS_REVIEW"
                                                        ? "bg-orange-100 text-orange-700"
                                                        : "bg-green-100 text-green-700"
                                                }
                                            `}
                                        >
                                            {email.status ===
                                            "NEEDS_REVIEW"
                                                ? "NEEDS REVIEW"
                                                : "RESOLVED"}
                                        </span>

                                    </div>

                                    <p className="text-sm text-gray-500 truncate">
                                        {email.summary}
                                    </p>

                                </div>


                                {/* SI / BL */}

                                {email.type === "CHECK_DOCUMENT" &&
                                    email.si &&
                                    email.bl && (

                                        <div className="hidden lg:flex items-center gap-5 shrink-0">

                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">
                                                    SI
                                                </p>

                                                <p className="text-sm font-semibold text-gray-700">
                                                    {email.si}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">
                                                    BL
                                                </p>

                                                <p className="text-sm font-semibold text-gray-700">
                                                    {email.bl}
                                                </p>
                                            </div>

                                        </div>
                                    )}


                                {/* TIME */}

                                <div className="text-right w-20 shrink-0">

                                    <p className="text-xs text-gray-400">
                                        {email.received}
                                    </p>

                                </div>


                                {/* ACTION */}

                                <div className="shrink-0">

                                    {email.type === "CHECK_DOCUMENT" &&
                                    email.status ===
                                        "NEEDS_REVIEW" ? (

                                        <Link
                                            href="/reviewqueue"
                                            className="
                                                bg-[#EA580C]
                                                hover:bg-[#C2410C]
                                                text-white
                                                font-semibold
                                                px-4
                                                py-2.5
                                                rounded-lg
                                                text-sm
                                                transition-all
                                                duration-200
                                                hover:-translate-y-0.5
                                                hover:shadow-md
                                            "
                                        >
                                            Open Review Queue →
                                        </Link>

                                    ) : (

                                        <button
                                            className="
                                                px-4
                                                py-2.5
                                                border
                                                border-gray-300
                                                text-gray-600
                                                rounded-lg
                                                text-sm
                                                font-semibold
                                                transition-all
                                                duration-200
                                                hover:border-[#EA580C]
                                                hover:text-[#EA580C]
                                                hover:bg-orange-50
                                            "
                                        >
                                            View →
                                        </button>

                                    )}

                                </div>

                            </div>

                        </div>

                    ))}


                    {/* EMPTY STATE */}

                    {filteredEmails.length === 0 && (

                        <div
                            className="
                                bg-white
                                border
                                border-gray-200
                                rounded-xl
                                py-14
                                text-center
                            "
                        >

                            <div className="text-3xl text-green-500 mb-2">
                                ✓
                            </div>

                            <h3 className="font-semibold text-gray-800">
                                No emails found
                            </h3>

                            <p className="text-sm text-gray-500 mt-1">
                                No emails match the current filter.
                            </p>

                        </div>

                    )}

                </div>

            </div>
        );
    }


    /* =====================================================
       MAIN DASHBOARD
    ===================================================== */

    return (
        <div className="min-h-full bg-[#F8FAFC] px-8 py-7">

            {/* HEADER */}

            <div className="mb-7">

                <div className="flex items-center gap-3">

                    <div
                        className="
                            w-1.5
                            h-8
                            bg-[#EA580C]
                            rounded-full
                        "
                    />

                    <h1 className="text-2xl font-bold text-[#1F2937]">
                        Email Operations
                    </h1>

                </div>

                <p className="text-sm text-gray-500 ml-4 mt-1">
                    Review and manage incoming shipping documentation
                </p>

            </div>


            {/* =================================================
                SUMMARY CARDS
            ================================================= */}

            <div
                className="
                    grid
                    grid-cols-4
                    gap-4
                    mb-7
                "
            >

                <div className="
                    bg-white
                    border
                    border-gray-200
                    rounded-xl
                    px-5
                    py-4
                    shadow-sm
                ">
                    <p className="text-xs font-medium text-gray-500">
                        Total emails
                    </p>

                    <p className="text-2xl font-bold text-gray-900 mt-1">
                        {totalEmails}
                    </p>
                </div>


                <div className="
                    bg-white
                    border
                    border-gray-200
                    rounded-xl
                    px-5
                    py-4
                    shadow-sm
                ">
                    <p className="text-xs font-medium text-gray-500">
                        Need attention
                    </p>

                    <p className="text-2xl font-bold text-[#EA580C] mt-1">
                        {needsAttention}
                    </p>
                </div>


                <div className="
                    bg-white
                    border
                    border-gray-200
                    rounded-xl
                    px-5
                    py-4
                    shadow-sm
                ">
                    <p className="text-xs font-medium text-gray-500">
                        Resolved
                    </p>

                    <p className="text-2xl font-bold text-green-600 mt-1">
                        {resolved}
                    </p>
                </div>


                <div className="
                    bg-white
                    border
                    border-gray-200
                    rounded-xl
                    px-5
                    py-4
                    shadow-sm
                ">
                    <p className="text-xs font-medium text-gray-500">
                        Needs review
                    </p>

                    <p className="text-2xl font-bold text-orange-600 mt-1">
                        {needsAttention}
                    </p>
                </div>

            </div>


            {/* =================================================
                CATEGORY TITLE
            ================================================= */}

            <div className="mb-4">

                <h2 className="text-lg font-bold text-gray-900">
                    Email Categories
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                    Select a category to view and process emails
                </p>

            </div>


            {/* =================================================
                CATEGORY CARDS
            ================================================= */}

            <div
                className="
                    grid
                    grid-cols-2
                    gap-4
                "
            >

                {categories.map((category) => (

                    <button
                        key={category.type}
                        onClick={() =>
                            openCategory(category.type)
                        }
                        className="
                            group
                            relative
                            bg-white
                            border
                            border-gray-200
                            rounded-xl
                            p-5
                            text-left
                            shadow-sm

                            transition-all
                            duration-200
                            ease-out

                            hover:-translate-y-1
                            hover:shadow-lg
                            hover:border-orange-300

                            active:translate-y-0
                            active:shadow-sm
                        "
                    >

                        {/* ORANGE HOVER LINE */}

                        <div
                            className="
                                absolute
                                top-0
                                left-5
                                right-5
                                h-0.5
                                bg-[#EA580C]
                                rounded-b-full
                                opacity-0
                                transition-opacity
                                duration-200
                                group-hover:opacity-100
                            "
                        />


                        <div className="flex items-start justify-between">

                            {/* ICON */}

                            <div
                                className="
                                    w-11
                                    h-11
                                    rounded-lg
                                    bg-orange-50
                                    text-[#EA580C]
                                    flex
                                    items-center
                                    justify-center
                                    text-xl
                                    font-bold

                                    transition-all
                                    duration-200

                                    group-hover:bg-[#EA580C]
                                    group-hover:text-white
                                    group-hover:scale-105
                                "
                            >
                                {category.icon}
                            </div>


                            {/* COUNT */}

                            <div className="text-right">

                                <p className="
                                    text-2xl
                                    font-bold
                                    text-[#1F2937]
                                    transition-colors
                                    duration-200
                                    group-hover:text-[#EA580C]
                                ">
                                    {category.count}
                                </p>

                                <p className="text-[11px] text-gray-400">
                                    emails
                                </p>

                            </div>

                        </div>


                        {/* TEXT */}

                        <div className="mt-5">

                            <h3
                                className="
                                    text-base
                                    font-bold
                                    text-[#1F2937]
                                    transition-colors
                                    duration-200
                                    group-hover:text-[#EA580C]
                                "
                            >
                                {category.title}
                            </h3>

                            <p
                                className="
                                    text-sm
                                    text-gray-500
                                    mt-1
                                    leading-5
                                    line-clamp-2
                                "
                            >
                                {category.description}
                            </p>

                        </div>


                        {/* VIEW LINK */}

                        <div
                            className="
                                mt-4
                                flex
                                items-center
                                gap-1
                                text-xs
                                font-bold
                                text-[#EA580C]
                            "
                        >
                            View emails

                            <span
                                className="
                                    transition-transform
                                    duration-200
                                    group-hover:translate-x-1
                                "
                            >
                                →
                            </span>

                        </div>

                    </button>

                ))}

            </div>


            {/* =================================================
                REVIEW OVERVIEW
            ================================================= */}

            <div className="mt-7">

                <div className="flex items-center justify-between mb-3">

                    <div>

                        <h2 className="text-lg font-bold text-gray-900">
                            Review Overview
                        </h2>

                        <p className="text-sm text-gray-500 mt-1">
                            Shipping documents requiring staff attention
                        </p>

                    </div>


                    <button
                        onClick={openReviewQueue}
                        className="
                            bg-[#EA580C]
                            hover:bg-[#C2410C]
                            text-white
                            font-semibold
                            px-4
                            py-2.5
                            rounded-lg
                            text-sm
                            transition-all
                            duration-200
                            hover:-translate-y-0.5
                            hover:shadow-md
                        "
                    >
                        Open Review Queue →
                    </button>

                </div>


                {/* REVIEW TABLE */}

                <div
                    className="
                        bg-white
                        border
                        border-gray-200
                        rounded-xl
                        overflow-hidden
                        shadow-sm
                    "
                >

                    <div
                        className="
                            grid
                            grid-cols-4
                            px-5
                            py-3
                            bg-gray-50
                            border-b
                            border-gray-200
                            text-[11px]
                            font-bold
                            uppercase
                            tracking-wide
                            text-gray-500
                        "
                    >
                        <span>Email</span>
                        <span>Issue</span>
                        <span>Priority</span>
                        <span>Received</span>
                    </div>


                    {[
                        {
                            id: "email_004",
                            issue: "Container count mismatch",
                            priority: "High",
                            received: "5 min ago",
                        },
                        {
                            id: "email_017",
                            issue: "Gross weight missing",
                            priority: "High",
                            received: "18 min ago",
                        },
                        {
                            id: "email_026",
                            issue: "BL attachment missing",
                            priority: "Medium",
                            received: "34 min ago",
                        },
                    ].map((item) => (

                        <div
                            key={item.id}
                            className="
                                grid
                                grid-cols-4
                                px-5
                                py-4
                                border-b
                                border-gray-100
                                last:border-0
                                items-center

                                transition-colors
                                duration-150

                                hover:bg-orange-50/50
                            "
                        >

                            <span className="font-semibold text-sm text-gray-800">
                                {item.id}
                            </span>

                            <span className="text-sm text-gray-700">
                                {item.issue}
                            </span>

                            <span>

                                <span
                                    className={`
                                        inline-flex
                                        px-2.5
                                        py-1
                                        rounded-full
                                        text-[11px]
                                        font-bold
                                        ${
                                            item.priority === "High"
                                                ? "bg-red-100 text-red-700"
                                                : "bg-orange-100 text-orange-700"
                                        }
                                    `}
                                >
                                    {item.priority}
                                </span>

                            </span>

                            <span className="text-sm text-gray-500">
                                {item.received}
                            </span>

                        </div>

                    ))}

                </div>

            </div>

        </div>
    );
}