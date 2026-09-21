"use client";

import { useMemo, useState } from "react";

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

const emails: Email[] = [
    {
        id: "email_004",
        sender: "operations@shipping.com",
        subject: "Draft BL Verification",
        received: "5 min ago",
        type: "CHECK_DOCUMENT",
        status: "NEEDS_REVIEW",
        summary: "Container count mismatch",
        si: "3 containers",
        bl: "4 containers",
    },
    {
        id: "email_017",
        sender: "shipping@company.com",
        subject: "BL Verification Required",
        received: "18 min ago",
        type: "CHECK_DOCUMENT",
        status: "NEEDS_REVIEW",
        summary: "Gross weight missing",
        si: "22,000 kg",
        bl: "Missing",
    },
    {
        id: "email_026",
        sender: "operations@shipping.com",
        subject: "Shipping Document",
        received: "34 min ago",
        type: "CHECK_DOCUMENT",
        status: "NEEDS_REVIEW",
        summary: "BL attachment missing",
        si: "Available",
        bl: "Missing",
    },
    {
        id: "email_031",
        sender: "documentation@shipping.com",
        subject: "Draft BL Check",
        received: "1 hr ago",
        type: "CHECK_DOCUMENT",
        status: "RESOLVED",
        summary: "Port of discharge mismatch",
        si: "Singapore",
        bl: "Port Klang",
    },
    {
        id: "email_002",
        sender: "customer@company.com",
        subject: "New Shipping Instruction",
        received: "12 min ago",
        type: "NEW_SHIPPING_INSTRUCTION",
        status: "RESOLVED",
        summary: "New shipping instruction received",
    },
    {
        id: "email_008",
        sender: "customer@company.com",
        subject: "Updated Shipping Instruction",
        received: "42 min ago",
        type: "NEW_SHIPPING_INSTRUCTION",
        status: "NEEDS_REVIEW",
        summary: "Shipping instruction requires attention",
    },
    {
        id: "email_011",
        sender: "accounts@company.com",
        subject: "Invoice Question",
        received: "1 hr ago",
        type: "INVOICE_QUESTION",
        status: "RESOLVED",
        summary: "Question regarding invoice amount",
    },
    {
        id: "email_014",
        sender: "operations@company.com",
        subject: "Operational Update",
        received: "2 hrs ago",
        type: "OPERATIONAL_UPDATE",
        status: "RESOLVED",
        summary: "Shipment status update",
    },
    {
        id: "email_019",
        sender: "unknown@randommail.com",
        subject: "Congratulations! You Won",
        received: "3 hrs ago",
        type: "SPAM",
        status: "RESOLVED",
        summary: "Automatically identified as spam",
    },
];


/* =========================================================
   CATEGORY DATA
========================================================= */

const categories: Category[] = [
    {
        type: "CHECK_DOCUMENT",
        title: "Document Check",
        description: "Verify shipping documents and identify discrepancies",
        count: 12,
        icon: "▣",
    },
    {
        type: "NEW_SHIPPING_INSTRUCTION",
        title: "Shipping Instructions",
        description: "Review new and updated shipping instructions",
        count: 18,
        icon: "≡",
    },
    {
        type: "INVOICE_QUESTION",
        title: "Invoice Questions",
        description: "Review questions and enquiries about invoices",
        count: 3,
        icon: "$",
    },
    {
        type: "OPERATIONAL_UPDATE",
        title: "Operational Updates",
        description: "Monitor shipment and operational communications",
        count: 7,
        icon: "↻",
    },
    {
        type: "SPAM",
        title: "Spam",
        description: "Automatically filtered unwanted emails",
        count: 3,
        icon: "⊘",
    },
];


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

    const currentCategory = categories.find(
        (category) => category.type === selectedCategory
    );


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

                                        <button
                                            onClick={openReviewQueue}
                                            className="
                                                px-4
                                                py-2.5
                                                bg-[#EA580C]
                                                hover:bg-[#C2410C]
                                                text-white
                                                rounded-lg
                                                text-sm
                                                font-semibold
                                                transition-all
                                                duration-200
                                                hover:shadow-md
                                                hover:-translate-y-0.5
                                            "
                                        >
                                            Review →
                                        </button>

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
                        43
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
                        12
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
                        31
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
                        3
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