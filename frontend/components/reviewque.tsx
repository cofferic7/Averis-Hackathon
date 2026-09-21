"use client";

import { useMemo, useState, useEffect } from "react";
import { getResults } from "@/lib/api";
import { useSearchParams } from "next/navigation";

type ReviewStatus = "MISMATCH" | "NEEDS_REVIEW";

type ReviewCase = {
    emailId: string;
    issue: string;
    si: string;
    bl: string;
    status: ReviewStatus;
    priority: "High" | "Medium";
    received: string;
    raw: any;
};

type ResolvedRecord = {
    emailId: string;
    reviewId: string;
    result: "APPROVED" | "CORRECTED" | "REJECTED";
    date: string;
    note: string;
    acceptedDocument: "SI" | "BL";
    originalSi: Record<string, any>;
    originalBl: Record<string, any>;
    finalSi: Record<string, any>;
    finalBl: Record<string, any>;
    changedFields: string[];
};

const REVIEW_STORAGE_KEY = "shipops_resolved_cases_v1";

function loadResolvedCases(): ResolvedRecord[] {
    if (typeof window === "undefined") return []; // Add this guard

    try {
        const saved = JSON.parse(localStorage.getItem(REVIEW_STORAGE_KEY) || "[]");
        return Array.isArray(saved) ? saved : [];
    } catch {
        return [];
    }
}

function storeResolvedCases(cases: ResolvedRecord[]): void {
    if (typeof window === "undefined") return; // Add this guard

    localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(cases));
    window.dispatchEvent(new Event("shipops-reviews-changed"));
}


function Icon({ name }: { name: "home" | "queue" | "check" | "search" | "bell" | "chevron" }) {
    const paths = {
        home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9 21v-7h6v7" /></>,
        queue: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
        check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
        search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
        bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
        chevron: <path d="m9 18 6-6-6-6" />,
    };

    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {paths[name]}
        </svg>
    );
}

function StatCard({ label, value, tone, symbol, detail }: {
    label: string;
    value: number;
    tone: "blue" | "red" | "amber" | "green";
    symbol: string;
    detail: string;
}) {
    return (
        <article className={`stat-card ${tone}`}>
            <div className="stat-icon">{symbol}</div>
            <div>
                <p>{label}</p>
                <strong>{value}</strong>
                <span>{detail}</span>
            </div>
        </article>
    );
}

function CaseDetail({
    item,
    onBack,
    onResolved,
}: {
    item: ReviewCase;
    onBack: () => void;
    onResolved: (record: ResolvedRecord) => void;
}) {
    const isMismatch = item.status === "MISMATCH";

    const si = item.raw?.si || {};
    const bl = item.raw?.bl || {};

    const [choice, setChoice] = useState<"SI" | "BL" | null>(null);
    const [weight, setWeight] = useState(
        si.gross_weight_kg !== null && si.gross_weight_kg !== undefined
            ? String(si.gross_weight_kg)
            : ""
    );
    const [containerCount, setContainerCount] = useState(
        si.container_count !== null && si.container_count !== undefined
            ? String(si.container_count)
            : ""
    );
    const [portOfLoading, setPortOfLoading] = useState(
        si.port_of_loading || ""
    );
    const [portOfDischarge, setPortOfDischarge] = useState(
        si.port_of_discharge || ""
    );
    const [notes, setNotes] = useState("");
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState("");

    const fieldLabels: Record<string, string> = {
        shipper: "Shipper",
        consignee: "Consignee",
        notify_party: "Notify Party",
        port_of_loading: "Port of Loading",
        port_of_discharge: "Port of Discharge",
        container_count: "Container Count",
        gross_weight_kg: "Gross Weight",
    };

    const formatValue = (value: any) => {
        if (value === null || value === undefined || value === "") {
            return "Not available";
        }

        if (typeof value === "number") {
            return value.toLocaleString();
        }

        return String(value);
    };

    const renderDocumentField = (
        label: string,
        value: any,
        isDefect = false
    ) => (
        <div>
            <dt>{label}</dt>
            <dd className={isDefect ? "value-red" : ""}>
                {formatValue(value)}
            </dd>
        </div>
    );




    if (isMismatch) {
        // Compare the values shown in the documents so stale backend flags
        // cannot mark identical values as different.
        const allFields = Object.keys(fieldLabels);
        const comparable = (field: string, value: any) => {
            if (value === null || value === undefined || String(value).trim() === "") return null;
            const text = String(value).trim();
            if (field === "container_count" || field === "gross_weight_kg") {
                const match = text.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
                return match ? Number(match[0]) : null;
            }
            return text.replace(/\s+/g, " ").toLocaleLowerCase();
        };
        const defectFields = allFields.filter((field) => {
            const siValue = comparable(field, si[field]);
            const blValue = comparable(field, bl[field]);
            return siValue !== null && blValue !== null && siValue !== blValue;
        });
        const defectField = defectFields[0];
        const defectLabel =
            fieldLabels[defectField] || "Document mismatch";
        const displaySi = choice === "BL"
            ? { ...si, ...Object.fromEntries(defectFields.map((field) => [field, bl[field]])) }
            : si;
        const displayBl = choice === "SI"
            ? { ...bl, ...Object.fromEntries(defectFields.map((field) => [field, si[field]])) }
            : bl;

        const resolveMismatch = () => {
            if (!choice) return;
            const originalSi = { ...si };
            const originalBl = { ...bl };
            const finalSi = { ...displaySi };
            const finalBl = { ...displayBl };
            const record: ResolvedRecord = {
                emailId: item.emailId,
                reviewId: `REV-${item.emailId}-${Date.now()}`,
                result: defectFields.length ? "CORRECTED" : "APPROVED",
                date: new Date().toISOString(),
                note: notes,
                acceptedDocument: choice,
                originalSi,
                originalBl,
                finalSi,
                finalBl,
                changedFields: defectFields,
            };
            try {
                onResolved(record);
            } catch {
                setSaveError("Could not save this review. Please try again.");
            }
        };

        return (
            <section className="detail-page">
                <button className="back-link" onClick={onBack}>
                    ← Review Queue
                </button>

                <div className="detail-title-row">
                    <div>
                        <h1>{item.issue}</h1>
                        <p>
                            Compare the source documents and confirm the
                            correct information.
                        </p>
                    </div>

                    <span className="status mismatch">
                        ▲ Mismatch
                    </span>
                </div>

                <div className="document-grid">
                    <article className="document-card">
                        <div className="doc-heading">
                            <span>▤</span>

                            <div>
                                <h3>Shipping Instruction</h3>
                                <small>
                                    {formatValue(si.document_type)}
                                </small>
                            </div>

                            <em>
                                {Object.values(si).some(
                                    (value) =>
                                        value !== null &&
                                        value !== undefined &&
                                        value !== ""
                                )
                                    ? "Available"
                                    : "Missing"}
                            </em>
                        </div>

                        <dl>
                            {renderDocumentField(
                                "Shipper",
                                displaySi.shipper,
                                !choice && defectFields.includes("shipper")
                            )}

                            {renderDocumentField(
                                "Consignee",
                                displaySi.consignee,
                                !choice && defectFields.includes("consignee")
                            )}

                            {renderDocumentField(
                                "Notify Party",
                                displaySi.notify_party,
                                !choice && defectFields.includes("notify_party")
                            )}

                            {renderDocumentField(
                                "Port of loading",
                                displaySi.port_of_loading,
                                !choice && defectFields.includes("port_of_loading")
                            )}

                            {renderDocumentField(
                                "Port of discharge",
                                displaySi.port_of_discharge,
                                !choice && defectFields.includes("port_of_discharge")
                            )}

                            {renderDocumentField(
                                "Container count",
                                displaySi.container_count,
                                !choice && defectFields.includes("container_count")
                            )}

                            {renderDocumentField(
                                "Gross weight (kg)",
                                displaySi.gross_weight_kg,
                                !choice && defectFields.includes("gross_weight_kg")
                            )}
                        </dl>
                    </article>

                    <article className="document-card">
                        <div className="doc-heading">
                            <span>▤</span>

                            <div>
                                <h3>Bill of Lading</h3>
                                <small>
                                    {formatValue(bl.document_type)}
                                </small>
                            </div>

                            <em>
                                {Object.values(bl).some(
                                    (value) =>
                                        value !== null &&
                                        value !== undefined &&
                                        value !== ""
                                )
                                    ? "Available"
                                    : "Missing"}
                            </em>
                        </div>

                        <dl>
                            {renderDocumentField(
                                "Shipper",
                                displayBl.shipper,
                                !choice && defectFields.includes("shipper")
                            )}

                            {renderDocumentField(
                                "Consignee",
                                displayBl.consignee,
                                !choice && defectFields.includes("consignee")
                            )}

                            {renderDocumentField(
                                "Notify Party",
                                displayBl.notify_party,
                                !choice && defectFields.includes("notify_party")
                            )}

                            {renderDocumentField(
                                "Port of loading",
                                displayBl.port_of_loading,
                                !choice && defectFields.includes("port_of_loading")
                            )}

                            {renderDocumentField(
                                "Port of discharge",
                                displayBl.port_of_discharge,
                                !choice && defectFields.includes("port_of_discharge")
                            )}

                            {renderDocumentField(
                                "Container count",
                                displayBl.container_count,
                                !choice && defectFields.includes("container_count")
                            )}

                            {renderDocumentField(
                                "Gross weight (kg)",
                                displayBl.gross_weight_kg,
                                !choice && defectFields.includes("gross_weight_kg")
                            )}
                        </dl>
                    </article>
                </div>

                <div className="resolution-grid">
                    <article className="info-card mismatch-details-card">
                        <h3>Mismatch details</h3>
                        <strong className="mismatch-summary">
                            {defectFields.length ? `The documents disagree on ${defectFields.length} ${defectFields.length === 1 ? "field" : "fields"}.` : "The report flagged a mismatch, but the displayed values match. Check the original documents before approving."}
                        </strong>
                        {defectFields.map((field) => (
                            <div className="mismatch-detail-row" key={field}>
                                <h4>{fieldLabels[field]}</h4>
                                <p>Shipping Instruction: <strong>{formatValue(si[field])}</strong></p>
                                <p>Bill of Lading: <strong>{formatValue(bl[field])}</strong></p>
                            </div>
                        ))}
                    </article>

                    <article className="resolve-card">
                        <h3>Resolve mismatch</h3>

                        <p>
                            {defectFields.length > 1
                                ? "Which document should be accepted for the mismatched fields?"
                                : <>Which value should be accepted for {defectLabel.toLowerCase()}?</>}
                        </p>

                        <div className="choice-row">
                            <button
                                className={
                                    choice === "SI" ? "selected" : ""
                                }
                                onClick={() => setChoice("SI")}
                            >
                                Confirm SI
                            </button>

                            <button
                                className={
                                    choice === "BL" ? "selected" : ""
                                }
                                onClick={() => setChoice("BL")}
                            >
                                Confirm BL
                            </button>
                        </div>

                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add an optional review note..."
                        />

                        {saveError && <p role="alert">{saveError}</p>}
                        <div className="form-actions">
                            <button
                                className="secondary"
                                onClick={onBack}
                            >
                                Cancel
                            </button>

                            <button
                                className="primary"
                                disabled={!choice}
                                onClick={resolveMismatch}
                            >
                                Resolve case
                            </button>
                        </div>
                    </article>
                </div>
            </section>
        );
    }

    // NEEDS_REVIEW

    const reviewReasonLabels: Record<string, string> = {
        missing_value: "Information is missing",
        missing_attachment: "Attachment is missing",
        wrong_doc_type: "Incorrect document type",
        unreadable: "Document is unreadable",
    };

    const reviewReason =
        reviewReasonLabels[item.raw?.review_reason] ||
        "This case requires review";

    return (
        <section className="detail-page">
            <button className="back-link" onClick={onBack}>
                ← Review Queue
            </button>

            <div className="detail-title-row">
                <div>
                    <h1>{reviewReason}</h1>

                    <p>
                        Review the available document information and
                        complete any missing fields.
                    </p>
                </div>

                <span className="status needs_review">
                    ● Needs review
                </span>
            </div>

            <div className="case-summary">
                <span>
                    Email ID
                    <strong>{item.emailId}</strong>
                </span>

                <span>
                    Subject
                    <strong>
                        {item.raw?.subject || "Not available"}
                    </strong>
                </span>

                <span>
                    Shipping Instruction
                    <strong>
                        {si.document_type || "Not available"}
                    </strong>
                </span>

                <span>
                    Bill of Lading
                    <strong>
                        {bl.document_type || "Not available"}
                    </strong>
                </span>
            </div>

            <div className="document-grid">
                <article className="document-card">
                    <div className="doc-heading">
                        <span>▤</span>

                        <div>
                            <h3>Shipping Instruction</h3>
                            <small>
                                {formatValue(si.document_type)}
                            </small>
                        </div>

                        <em>
                            {Object.values(si).some(
                                (value) =>
                                    value !== null &&
                                    value !== undefined &&
                                    value !== ""
                            )
                                ? "Available"
                                : "Missing"}
                        </em>
                    </div>

                    <dl>
                        {renderDocumentField(
                            "Shipper",
                            si.shipper
                        )}

                        {renderDocumentField(
                            "Consignee",
                            si.consignee
                        )}

                        {renderDocumentField(
                            "Notify Party",
                            si.notify_party
                        )}

                        {renderDocumentField(
                            "Port of loading",
                            si.port_of_loading
                        )}

                        {renderDocumentField(
                            "Port of discharge",
                            si.port_of_discharge
                        )}

                        {renderDocumentField(
                            "Container count",
                            si.container_count
                        )}

                        {renderDocumentField(
                            "Gross weight (kg)",
                            si.gross_weight_kg
                        )}
                    </dl>
                </article>

                <article className="document-card">
                    <div className="doc-heading">
                        <span>▤</span>

                        <div>
                            <h3>Bill of Lading</h3>
                            <small>
                                {formatValue(bl.document_type)}
                            </small>
                        </div>

                        <em>
                            {Object.values(bl).some(
                                (value) =>
                                    value !== null &&
                                    value !== undefined &&
                                    value !== ""
                            )
                                ? "Available"
                                : "Missing"}
                        </em>
                    </div>

                    <dl>
                        <div>
                            <dt>Shipper</dt>
                            <dd>{formatValue(bl.shipper)}</dd>
                        </div>

                        <div>
                            <dt>Consignee</dt>
                            <dd>{formatValue(bl.consignee)}</dd>
                        </div>

                        <div>
                            <dt>Notify Party</dt>
                            <dd>{formatValue(bl.notify_party)}</dd>
                        </div>

                        <div>
                            <dt>Port of loading</dt>
                            <dd>{formatValue(bl.port_of_loading)}</dd>
                        </div>

                        <div>
                            <dt>Port of discharge</dt>
                            <dd>{formatValue(bl.port_of_discharge)}</dd>
                        </div>

                        <div>
                            <dt>Container count</dt>
                            <dd>{formatValue(bl.container_count)}</dd>
                        </div>

                        <div>
                            <dt>Gross weight (kg)</dt>
                            <dd>{formatValue(bl.gross_weight_kg)}</dd>
                        </div>
                    </dl>
                </article>
            </div>

            <form
                className="details-form"
                onSubmit={(e) => {
                    e.preventDefault();
                    setSaved(true);
                }}
                style={{ marginTop: "14px" }}
            >
                <div>
                    <h2>Complete available information</h2>

                    <p>
                        Fill in the missing Shipping Instruction values
                        before continuing.
                    </p>
                </div>

                <div className="form-grid">
                    <label>
                        Gross weight (kg)
                        <input
                            value={weight}
                            onChange={(e) =>
                                setWeight(e.target.value)
                            }
                            placeholder="Enter gross weight"
                        />
                    </label>

                    <label>
                        Container count
                        <input
                            value={containerCount}
                            onChange={(e) =>
                                setContainerCount(e.target.value)
                            }
                            placeholder="Enter container count"
                        />
                    </label>

                    <label>
                        Port of loading
                        <input
                            value={portOfLoading}
                            onChange={(e) =>
                                setPortOfLoading(e.target.value)
                            }
                            placeholder="Enter port of loading"
                        />
                    </label>

                    <label>
                        Port of discharge
                        <input
                            value={portOfDischarge}
                            onChange={(e) =>
                                setPortOfDischarge(e.target.value)
                            }
                            placeholder="Enter port of discharge"
                        />
                    </label>
                </div>

                <label className="notes-label">
                    Review notes
                    <textarea
                        value={notes}
                        onChange={(e) =>
                            setNotes(e.target.value)
                        }
                        placeholder="Add context for the reviewer or note how the value was verified..."
                    />
                </label>

                <div className="form-footer">
                    <small>
                        Review reason: {item.raw?.review_reason}
                    </small>

                    <div className="form-actions">
                        <button
                            type="button"
                            className="secondary"
                            onClick={onBack}
                        >
                            Cancel
                        </button>

                        <button
                            className="primary"
                            type="submit"
                        >
                            {saved
                                ? "Saved ✓"
                                : "Save and continue →"}
                        </button>
                    </div>
                </div>
            </form>
        </section>
    );
}

type EmailType = "CHECK_DOCUMENT" | "SPAM" | "NEW_SHIPPING_INSTRUCTION" | "INVOICE_QUESTION" | "OPERATIONAL_UPDATE";

const classifiedEmails: Array<{ id: string; sender: string; subject: string; received: string; type: EmailType }> = [
    { id: "email_004", sender: "documents@pacifichome.com", subject: "Please compare SI and draft BL – BKG-7842931", received: "5 min ago", type: "CHECK_DOCUMENT" },
    { id: "email_017", sender: "shipping@northstar.nl", subject: "BL verification required – missing gross weight", received: "18 min ago", type: "CHECK_DOCUMENT" },
    { id: "email_021", sender: "promo@fast-deals.example", subject: "Congratulations! Claim your shipping reward", received: "23 min ago", type: "SPAM" },
    { id: "email_026", sender: "export@meridian.com", subject: "New Shipping Instruction – Shanghai to Rotterdam", received: "34 min ago", type: "NEW_SHIPPING_INSTRUCTION" },
    { id: "email_033", sender: "accounts@oceanlink.com", subject: "Question about invoice INV-2026-0918", received: "48 min ago", type: "INVOICE_QUESTION" },
    { id: "email_038", sender: "operations@shipcheck.com", subject: "Vessel schedule updated for Voyage 418W", received: "1 hr ago", type: "OPERATIONAL_UPDATE" },
    { id: "email_041", sender: "billing@northstar.nl", subject: "Incorrect surcharge shown on invoice", received: "2 hrs ago", type: "INVOICE_QUESTION" },
    { id: "email_044", sender: "portdesk@shipping.com", subject: "Port congestion operational notice", received: "3 hrs ago", type: "OPERATIONAL_UPDATE" },
];

const emailCategories: Array<{ type: EmailType; label: string; value: number; icon: string; tone: string; description: string }> = [
    { type: "CHECK_DOCUMENT", label: "Check Document", value: 12, icon: "▣", tone: "purple", description: "SI and BL comparison requests" },
    { type: "NEW_SHIPPING_INSTRUCTION", label: "New Shipping Instruction", value: 3, icon: "→", tone: "blue", description: "New instructions for extraction" },
    { type: "INVOICE_QUESTION", label: "Invoice Question", value: 18, icon: "?", tone: "green", description: "Billing and payment enquiries" },
    { type: "OPERATIONAL_UPDATE", label: "Operational Update", value: 3, icon: "✓", tone: "yellow", description: "Schedules, ports and vessel news" },
    { type: "SPAM", label: "Spam", value: 7, icon: "!", tone: "red", description: "Unwanted or unrelated messages" },
];

const emailTypeLabels: Record<EmailType, string> = {
    CHECK_DOCUMENT: "Check Document",
    SPAM: "Spam",
    NEW_SHIPPING_INSTRUCTION: "New Shipping Instruction",
    INVOICE_QUESTION: "Invoice Question",
    OPERATIONAL_UPDATE: "Operational Update",
};

function Dashboard({
    openReviewQueue,
}: {
    openReviewQueue: (emailId: string) => void;
}) {
    const [category, setCategory] = useState<EmailType | "ALL">("ALL");
    const [emailSearch, setEmailSearch] = useState("");
    const emails = classifiedEmails.filter((email) => {
        const term = emailSearch.trim().toLowerCase();
        const matchesCategory = category === "ALL" || email.type === category;
        const matchesSearch = !term || email.id.toLowerCase().includes(term) || email.sender.toLowerCase().includes(term) || email.subject.toLowerCase().includes(term);
        return matchesCategory && matchesSearch;
    });

    return (
        <section className="dashboard-page">
            <div className="dashboard-heading"><div><span className="eyebrow">EMAIL CLASSIFICATION</span><h1>Shipping Email Review</h1><p>Automatically classified shipping emails, ready for the correct workflow.</p></div><button className="refresh" onClick={() => { setCategory("ALL"); setEmailSearch(""); }}>↻ Reset filters</button></div>
            <div className="category-title"><h2>Email categories</h2><button className={category === "ALL" ? "all-active" : ""} onClick={() => setCategory("ALL")}>Show all emails</button></div>
            <section className="email-category-grid">
                {emailCategories.map((item) => <button key={item.type} className={`email-category-card ${item.tone} ${category === item.type ? "selected" : ""}`} onClick={() => setCategory(item.type)}><span className="category-icon">{item.icon}</span><span className="category-content"><small>{item.label}</small><strong>{item.value}</strong><em>{item.description}</em><b>{category === item.type ? "Selected ✓" : "View emails →"}</b></span></button>)}
            </section>
            <section className="queue-panel email-panel">
                <div className="email-table-heading"><div><h2>{category === "ALL" ? "All classified emails" : emailTypeLabels[category]}</h2><p>{category === "ALL" ? "Showing emails from every classification category" : `Only showing emails classified as ${emailTypeLabels[category]}`}</p></div><label className="search-box"><Icon name="search" /><input value={emailSearch} onChange={(e) => setEmailSearch(e.target.value)} placeholder="Search email, sender or subject" /></label><span className="result-count">{emails.length} emails</span></div>
                <div className="table-wrap"><table><thead><tr><th>Email ID</th><th>Sender</th><th>Subject</th><th>Received</th><th>Email Type</th><th>Action</th></tr></thead><tbody>{emails.map((email) => <tr key={email.id}><td><strong>{email.id}</strong></td><td>{email.sender}</td><td><strong className="email-subject">{email.subject}</strong></td><td>{email.received}</td><td><span className={`email-type ${email.type.toLowerCase()}`}>{emailTypeLabels[email.type]}</span></td><td>{email.type === "CHECK_DOCUMENT" ? <button className="view-button" onClick={() => openReviewQueue(email.id)}>Open Review</button> : <button className="view-button neutral">View Email</button>}</td></tr>)}</tbody></table>{!emails.length && <div className="empty"><strong>No emails found</strong><p>Try another category or search term.</p></div>}</div>
                <footer className="panel-footer"><span>Showing {emails.length} classified emails</span><span>AI classification demo</span></footer>
            </section>
        </section>
    );
}

function ResolvedCases({ cases }: { cases: ResolvedRecord[] }) {
    const [search, setSearch] = useState("");
    const [resultFilter, setResultFilter] = useState("ALL");
    const [viewing, setViewing] = useState<ResolvedRecord | null>(null);
    const rows = cases.filter((item) => {
        const term = search.trim().toLowerCase();
        return (!term || item.emailId.toLowerCase().includes(term) || item.reviewId.toLowerCase().includes(term))
            && (resultFilter === "ALL" || item.result === resultFilter);
    });
    const formatRecordValue = (value: any) => value === null || value === undefined || value === "" ? "Missing" : String(value);
    const exportReport = () => {
    if (typeof window === "undefined") return; // Add this guard

    const blob = new Blob([JSON.stringify(cases, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "resolved_cases.json";
    anchor.click();
    URL.revokeObjectURL(url);
};

    return (
        <section className="resolved-page">
            <div className="resolved-heading">
                <div><span className="eyebrow">COMPLETED REVIEWS</span><h1>Resolved Cases</h1><p>View completed shipping document reviews and final decisions.</p></div>
                <button className="export-button" onClick={exportReport} disabled={!cases.length}>⇩ Export report</button>
            </div>
            <section className="resolved-stats">
                <StatCard label="Total Resolved" value={cases.length} tone="blue" symbol="▤" detail="All completed cases" />
                <StatCard label="Approved" value={cases.filter((item) => item.result === "APPROVED").length} tone="green" symbol="✓" detail="No changes required" />
                <StatCard label="Corrected & Approved" value={cases.filter((item) => item.result === "CORRECTED").length} tone="amber" symbol="✎" detail="Updated after review" />
                <StatCard label="Rejected" value={cases.filter((item) => item.result === "REJECTED").length} tone="red" symbol="×" detail="Documents invalid" />
            </section>
            <section className="queue-panel">
                <div className="resolved-toolbar">
                    <div><h2>Resolved Review Cases</h2><p>A history of completed decisions</p></div>
                    <label className="search-box"><Icon name="search" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search email ID or review ID" /></label>
                    <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}><option value="ALL">All results</option><option value="APPROVED">Approved</option><option value="CORRECTED">Corrected</option><option value="REJECTED">Rejected</option></select>
                </div>
                <div className="table-wrap"><table><thead><tr><th>Email ID</th><th>Review ID</th><th>Final result</th><th>Resolved date</th><th>Actions</th></tr></thead>
                    <tbody>{rows.map((item) => <tr key={item.reviewId}><td><strong>{item.emailId}</strong></td><td>{item.reviewId}</td><td><span className={`final-result ${item.result.toLowerCase()}`}>{item.result}</span></td><td>{new Date(item.date).toLocaleString()}</td><td><button className="view-button" onClick={() => setViewing(item)}>View Details</button></td></tr>)}</tbody></table>
                    {!rows.length && <div className="empty"><strong>No resolved cases found</strong><p>{cases.length ? "Try another search or result filter." : "Cases will appear here after you resolve them."}</p></div>}
                </div>
                <footer className="panel-footer"><span>Showing {rows.length} of {cases.length} resolved cases</span></footer>
            </section>
            {viewing && <div className="modal-backdrop" onMouseDown={() => setViewing(null)}>
                <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
                    <button className="modal-close" onClick={() => setViewing(null)}>×</button>
                    <span className="eyebrow">RESOLVED REVIEW</span><h2>{viewing.reviewId}</h2><p>{viewing.emailId}</p>
                    <div className="resolved-detail">
                        <span>Final result<strong className={`final-text ${viewing.result.toLowerCase()}`}>{viewing.result}</strong></span>
                        <span>Resolved date<strong>{new Date(viewing.date).toLocaleString()}</strong></span>
                        <span>Accepted document<strong>{viewing.acceptedDocument === "SI" ? "Shipping Instruction" : "Bill of Lading"}</strong></span>
                        <span>Review note<strong>{viewing.note || "None"}</strong></span>
                    </div>
                    <h3>Fields reviewed</h3>
                    {viewing.changedFields.length ? viewing.changedFields.map((field) => <div className="resolved-comparison" key={field}>
                        <strong>{field.replace(/_/g, " ")}</strong>
                        <p>Original SI: {formatRecordValue(viewing.originalSi[field])} · Original BL: {formatRecordValue(viewing.originalBl[field])}</p>
                        <p>Final SI: {formatRecordValue(viewing.finalSi[field])} · Final BL: {formatRecordValue(viewing.finalBl[field])}</p>
                    </div>) : <p>No differing values were visible in the documents.</p>}
                    <div className="modal-actions"><button className="primary" onClick={() => setViewing(null)}>Close</button></div>
                </section>
            </div>}
        </section>
    );
}

export default function ReviewQueue({ initialPage = "queue" }: { initialPage?: "dashboard" | "queue" | "resolved" }) {
    const [resolvedRecords, setResolvedRecords] = useState<ResolvedRecord[]>([]);
    useEffect(() => { setResolvedRecords(loadResolvedCases()); }, []);
    const saveResolution = (record: ResolvedRecord) => {
        const next = [record, ...loadResolvedCases().filter((old) => old.emailId !== record.emailId)];
        storeResolvedCases(next);
        setResolvedRecords(next);
        setSelectedCase(null);
    };
    const searchParams = useSearchParams();
    const emailFromUrl = searchParams.get("email");

    const [query, setQuery] = useState("");
    const [status, setStatus] =
        useState<"ALL" | ReviewStatus>("ALL");

    const [selectedCase, setSelectedCase] =
        useState<ReviewCase | null>(null);

    const [currentPage, setCurrentPage] =
        useState<"dashboard" | "queue" | "resolved">(initialPage);

    const [data, setData] =
        useState<Record<string, any>>({});

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

    const reviewCases = useMemo<ReviewCase[]>(() => {
        return Object.entries(data)
            .filter(([emailId, item]: [string, any]) =>
                (item.status === "MISMATCH" || item.status === "NEEDS_REVIEW") &&
                !resolvedRecords.some((record) => record.emailId === emailId)
            )
            .map(([emailId, item]: [string, any]) => {
                let issue = "Requires review";

                if (item.status === "MISMATCH") {
                    const field = item.defect_fields?.[0];

                    const fieldLabels: Record<string, string> = {
                        shipper: "Shipper mismatch",
                        consignee: "Consignee mismatch",
                        notify_party: "Notify party mismatch",
                        port_of_loading: "Port of loading mismatch",
                        port_of_discharge: "Port of discharge mismatch",
                        container_count: "Container count mismatch",
                        gross_weight_kg: "Gross weight mismatch",
                    };

                    issue =
                        fieldLabels[field] ||
                        "Document mismatch";
                } else {
                    const reasonLabels: Record<string, string> = {
                        missing_value: "Information missing",
                        missing_attachment: "Attachment missing",
                        wrong_doc_type: "Incorrect document type",
                        unreadable: "Document unreadable",
                    };

                    issue =
                        reasonLabels[item.review_reason] ||
                        "Requires review";
                }

                return {
                    emailId,
                    issue,

                    // These are only display values for the table.
                    // The actual backend object is kept in raw.
                    si: item.si && Object.values(item.si).some(
                        (value) => value !== null && value !== undefined && value !== "")
                        ? "Available"
                        : "Not available",

                    bl:
                        item.bl &&
                            Object.values(item.bl).some(
                                (value) => value !== null && value !== undefined && value !== ""
                            )
                            ? "Available"
                            : "Not available",

                    status: item.status,
                    priority:
                        item.status === "NEEDS_REVIEW"
                            ? "High"
                            : "Medium",

                    received:
                        item.received ||
                        item.created_at ||
                        "Recently",

                    raw: item,
                };
            });
    }, [data, resolvedRecords]);

    useEffect(() => {
        if (!emailFromUrl || reviewCases.length === 0) {
            return;
        }

        const matchingCase = reviewCases.find(
            (item) => item.emailId === emailFromUrl
        );

        if (matchingCase) {
            setSelectedCase(matchingCase);
            setCurrentPage("queue");
        }
    }, [emailFromUrl, reviewCases]);

    const filteredCases = useMemo(() => {
        const search = query.trim().toLowerCase();

        return reviewCases.filter((item) => {
            const matchesSearch =
                !search ||
                item.emailId.toLowerCase().includes(search) ||
                item.issue.toLowerCase().includes(search);

            const matchesStatus =
                status === "ALL" || item.status === status;

            return matchesSearch && matchesStatus;
        });
    }, [query, status, reviewCases]);

    return (
        <div className="review-app">

            <main>

                {currentPage === "dashboard" ? <Dashboard openReviewQueue={(emailId) => {
                    const matchingCase = reviewCases.find((item) => item.emailId === emailId);
                    if (matchingCase) {setSelectedCase(matchingCase);
                        setCurrentPage("queue");
        }
    }}/> : currentPage === "resolved" ? <ResolvedCases cases={resolvedRecords} /> : selectedCase ? <CaseDetail item={selectedCase} onBack={() => setSelectedCase(null)} onResolved={saveResolution} /> : <section className="content">
                    <div className="page-heading">
                        <div>
                            <span className="eyebrow">DOCUMENT VERIFICATION</span>
                            <h1>Shipping Document Review</h1>
                            <p>Review mismatches and complete missing information before approving each case.</p>
                        </div>
                        <button className="refresh" onClick={() => typeof window !== 'undefined' && window.location.reload()}>↻ Refresh queue</button>
                    </div>

                    <section className="stats" aria-label="Review summary">
                        <StatCard
                            label="Pending Reviews"
                            value={reviewCases.length}
                            tone="blue"
                            symbol="□"
                            detail="Cases requiring attention"
                        />

                        <StatCard
                            label="Mismatches"
                            value={reviewCases.filter(
                                (item) => item.status === "MISMATCH"
                            ).length}
                            tone="red"
                            symbol="!"
                            detail="Document differences detected"
                        />

                        <StatCard
                            label="Missing Information"
                            value={reviewCases.filter(
                                (item) => item.status === "NEEDS_REVIEW"
                            ).length}
                            tone="amber"
                            symbol="≡"
                            detail="Action required"
                        />

                        <StatCard
                            label="Resolved"
                            value={resolvedRecords.length}
                            tone="green"
                            symbol="✓"
                            detail="Completed human reviews"
                        /></section>

                    <section className="queue-panel">
                        <div className="panel-heading">
                            <div><h2>Cases requiring attention</h2><p>Sorted by priority and received time</p></div>
                            <span className="live"><i /> Live queue</span>
                        </div>

                        <div className="toolbar">
                            <label className="search-box">
                                <Icon name="search" />
                                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search email ID or issue" />
                                {query && <button onClick={() => setQuery("")} aria-label="Clear search">×</button>}
                            </label>
                            <select value={status} onChange={(e) => setStatus(e.target.value as "ALL" | ReviewStatus)}>
                                <option value="ALL">All statuses</option>
                                <option value="MISMATCH">Mismatch</option>
                                <option value="NEEDS_REVIEW">Needs review</option>
                            </select>
                            <button className="filter-button">☷ More filters</button>
                            <span className="result-count">{filteredCases.length} cases</span>
                        </div>

                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>Case</th><th>Issue detected</th><th>Shipping Instruction</th><th>Bill of Lading</th><th>Status</th><th>Action</th></tr></thead>
                                <tbody>
                                    {filteredCases.map((item) => (
                                        <tr key={item.emailId}>
                                            <td><div className="case-id"><span>{item.emailId.slice(-2)}</span><div><strong>{item.emailId}</strong><small>{item.received}</small></div></div></td>
                                            <td><strong className="issue">{item.issue}</strong><span className={`priority ${item.priority.toLowerCase()}`}>{item.priority} priority</span></td>
                                            <td>{item.si}</td>
                                            <td className={item.bl === "Missing" ? "missing" : ""}>{item.bl}</td>
                                            <td><span className={`status ${item.status.toLowerCase()}`}>{item.status === "MISMATCH" ? "▲ Mismatch" : "● Needs review"}</span></td>
                                            <td><button className="review-button" onClick={() => setSelectedCase(item)}>{item.status === "MISMATCH" ? "Review" : "Add details"}<span>→</span></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {!filteredCases.length && <div className="empty"><strong>No matching cases</strong><p>Try changing your search or status filter.</p></div>}
                        </div>

                        <footer className="panel-footer">
                            <span>
                                Showing {filteredCases.length} of {reviewCases.length} cases
                            </span>
                            <div><button disabled>‹</button><button className="current">1</button><button>2</button><button>3</button><button>›</button></div>
                        </footer>
                    </section>
                </section>}
            </main>

            <style>{`
                *{box-sizing:border-box}

                .review-app{
                    min-height:100vh;
                    color:#292524;
                    background:#F8FAFC;
                }

                /* SIDEBAR */

                .sidebar{
                    position:sticky;
                    top:0;
                    height:100vh;
                    padding:25px 18px 20px;
                    color:#6B625B;
                    background:#FFFDF9;
                    display:flex;
                    flex-direction:column;
                    border-right:1px solid #EEE9E3;
                    box-shadow:8px 0 30px rgba(120,75,40,.05)
                }

                .brand{
                    display:flex;
                    align-items:center;
                    gap:12px;
                    padding:0 8px 34px
                }

                .brand-mark{
                    width:38px;
                    height:38px;
                    display:grid;
                    place-items:center;
                    border-radius:11px;
                    color:#fff;
                    font-weight:800;
                    background:#EA580C;
                    box-shadow:0 8px 20px rgba(234,88,12,.20)
                }

                .brand strong,
                .brand span{
                    display:block
                }

                .brand strong{
                    color:#292524;
                    font-size:17px
                }

                .brand span{
                    margin-top:3px;
                    color:#9A8F86;
                    font-size:11px
                }

                .sidebar nav{
                    display:grid;
                    gap:8px
                }

                .sidebar nav button{
                    width:100%;
                    height:48px;
                    padding:0 13px;
                    display:flex;
                    align-items:center;
                    gap:13px;
                    border:0;
                    border-radius:10px;
                    color:#6B625B;
                    background:transparent;
                    font:inherit;
                    font-size:14px;
                    text-align:left;
                    cursor:pointer;
                    transition:.2s
                }

                .sidebar nav button:hover{
                    background:#FFF5EF;
                    color:#C2410C;
                    transform:translateX(2px)
                }

                .sidebar nav button.active{
                    color:#C2410C;
                    background:#FFF1E8;
                    border:1px solid #FED7AA;
                    box-shadow:0 6px 18px rgba(234,88,12,.08)
                }

                .sidebar nav button svg{
                    width:19px;
                    height:19px
                }

                .sidebar nav button b{
                    margin-left:auto;
                    min-width:23px;
                    height:23px;
                    padding:0 6px;
                    display:grid;
                    place-items:center;
                    border-radius:999px;
                    background:#FDE8D7;
                    color:#C2410C;
                    font-size:11px
                }

                .sidebar-help{
                    margin-top:auto;
                    padding:16px;
                    border:1px solid #F3DED0;
                    border-radius:14px;
                    background:#FFF8F3
                }

                .help-icon{
                    width:27px;
                    height:27px;
                    margin-bottom:10px;
                    display:grid;
                    place-items:center;
                    border-radius:8px;
                    background:#EA580C;
                    color:#fff;
                    font-weight:800
                }

                .sidebar-help strong{
                    font-size:13px;
                    color:#3C332D
                }

                .sidebar-help p{
                    margin:6px 0 13px;
                    color:#8A817A;
                    font-size:11px;
                    line-height:1.5
                }

                .sidebar-help button{
                    width:100%;
                    padding:8px;
                    border:1px solid #F3DED0;
                    border-radius:7px;
                    background:#fff;
                    color:#C2410C;
                    font-weight:700;
                    cursor:pointer;
                    transition:.2s
                }

                .sidebar-help button:hover{
                    background:#FFF1E8;
                    border-color:#FED7AA
                }

                .version{
                    margin:14px 3px 0;
                    color:#A69B92;
                    font-size:10px
                }

                /* TOP BAR */

                main{
                    min-width:0
                }

                .topbar{
                    height:66px;
                    padding:0 31px;
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    border-bottom:1px solid #EEE9E3;
                    background:rgba(255,255,255,.92);
                    backdrop-filter:blur(12px)
                }

                .topbar>div:first-child{
                    display:flex;
                    align-items:center;
                    gap:8px;
                    font-size:12px
                }

                .topbar>div:first-child span{
                    color:#A69B92
                }

                .topbar>div:first-child svg{
                    width:13px;
                    color:#B4A9A1
                }

                .user-area{
                    display:flex;
                    align-items:center;
                    gap:10px
                }

                .icon-button{
                    position:relative;
                    width:36px;
                    height:36px;
                    border:1px solid #EEE9E3;
                    border-radius:10px;
                    background:#fff;
                    color:#7A7069;
                    cursor:pointer
                }

                .icon-button svg{
                    width:17px
                }

                .icon-button i{
                    position:absolute;
                    right:8px;
                    top:7px;
                    width:6px;
                    height:6px;
                    border-radius:50%;
                    background:#EA580C;
                    border:1px solid white
                }

                .avatar{
                    width:36px;
                    height:36px;
                    display:grid;
                    place-items:center;
                    border-radius:50%;
                    background:#FDE8D7;
                    color:#C2410C;
                    font-size:11px;
                    font-weight:800
                }

                .user-area strong,
                .user-area div span{
                    display:block
                }

                .user-area strong{
                    font-size:12px
                }

                .user-area div span{
                    font-size:10px;
                    color:#A69B92;
                    margin-top:2px
                }

                .down{
                    margin-left:4px;
                    color:#8A817A
                }

                /* MAIN CONTENT */

                .content{
                    padding:30px;
                    max-width:1500px;
                    margin:auto
                }

                .page-heading{
                    display:flex;
                    align-items:flex-end;
                    justify-content:space-between;
                    margin-bottom:22px
                }

                .eyebrow{
                    color:#C2410C;
                    font-size:10px;
                    font-weight:800;
                    letter-spacing:1.3px
                }

                .page-heading h1{
                    margin:5px 0 4px;
                    font-size:31px;
                    line-height:1.15;
                    letter-spacing:-.8px
                }

                .page-heading p{
                    margin:0;
                    color:#7A7069;
                    font-size:14px
                }

                .refresh{
                    height:39px;
                    padding:0 15px;
                    border:1px solid #F0D9CA;
                    border-radius:9px;
                    background:#fff;
                    color:#C2410C;
                    font-weight:700;
                    cursor:pointer;
                    transition:.2s
                }

                .refresh:hover{
                    background:#FFF5EF;
                    border-color:#FED7AA
                }

                /* STAT CARDS */

                .stats{
                    display:grid;
                    grid-template-columns:repeat(4,1fr);
                    gap:14px;
                    margin-bottom:18px
                }

                .stat-card{
                    min-height:112px;
                    padding:20px;
                    display:flex;
                    align-items:center;
                    gap:15px;
                    border:1px solid #EEE9E3;
                    border-radius:13px;
                    background:#fff;
                    box-shadow:0 5px 18px rgba(90,60,35,.045);
                    transition:.2s
                }

                .stat-card:hover{
                    transform:translateY(-3px);
                    box-shadow:0 12px 27px rgba(90,60,35,.09)
                }

                .stat-icon{
                    width:46px;
                    height:46px;
                    display:grid;
                    place-items:center;
                    flex:none;
                    border-radius:14px;
                    font-size:22px;
                    font-weight:800
                }

                /* Orange is the main Averis accent */

                .stat-card.blue .stat-icon{
                    background:#FFF1E8;
                    color:#EA580C
                }

                .stat-card.blue strong{
                    color:#C2410C
                }

                /* Keep actual severity colours */

                .stat-card.red .stat-icon{
                    background:#FFE6E9;
                    color:#D9213C
                }

                .stat-card.red strong{
                    color:#CC1731
                }

                .stat-card.amber .stat-icon{
                    background:#FFF0D0;
                    color:#C86C00
                }

                .stat-card.amber strong{
                    color:#BD6200
                }

                .stat-card.green .stat-icon{
                    background:#DAF5E9;
                    color:#087D55
                }

                .stat-card.green strong{
                    color:#087852
                }

                .stat-card p{
                    margin:0 0 2px;
                    color:#786F68;
                    font-size:11px
                }

                .stat-card strong{
                    display:inline-block;
                    margin-right:10px;
                    font-size:27px;
                    letter-spacing:-.5px
                }

                .stat-card span{
                    display:block;
                    margin-top:3px;
                    color:#A69B92;
                    font-size:10px
                }

                /* PANELS */

                .queue-panel{
                    overflow:hidden;
                    border:1px solid #EEE9E3;
                    border-radius:14px;
                    background:#fff;
                    box-shadow:0 8px 28px rgba(90,60,35,.05)
                }

                .panel-heading{
                    padding:20px 20px 15px;
                    display:flex;
                    align-items:center;
                    justify-content:space-between
                }

                .panel-heading h2{
                    margin:0;
                    font-size:17px
                }

                .panel-heading p{
                    margin:4px 0 0;
                    color:#A69B92;
                    font-size:11px
                }

                .live{
                    padding:6px 9px;
                    border-radius:999px;
                    background:#FFF1E8;
                    color:#C2410C;
                    font-size:10px;
                    font-weight:700
                }

                .live i{
                    display:inline-block;
                    width:7px;
                    height:7px;
                    margin-right:5px;
                    border-radius:50%;
                    background:#EA580C;
                    box-shadow:0 0 0 4px rgba(234,88,12,.10)
                }

                /* TOOLBAR */

                .toolbar{
                    padding:0 20px 17px;
                    display:flex;
                    align-items:center;
                    gap:10px
                }

                .search-box{
                    width:min(390px,42%);
                    height:40px;
                    padding:0 11px;
                    display:flex;
                    align-items:center;
                    border:1px solid #E7DED7;
                    border-radius:9px;
                    background:#FFFCFA
                }

                .search-box:focus-within{
                    border-color:#F2A36F;
                    box-shadow:0 0 0 3px rgba(234,88,12,.08)
                }

                .search-box svg{
                    width:17px;
                    color:#A69B92
                }

                .search-box input{
                    width:100%;
                    height:100%;
                    padding:0 9px;
                    border:0;
                    outline:0;
                    background:transparent;
                    color:#3C332D
                }

                .search-box button{
                    border:0;
                    background:transparent;
                    color:#8A817A;
                    font-size:18px;
                    cursor:pointer
                }

                .toolbar select,
                .filter-button{
                    height:40px;
                    padding:0 34px 0 12px;
                    border:1px solid #E7DED7;
                    border-radius:9px;
                    background:#fff;
                    color:#6B625B
                }

                .filter-button{
                    padding:0 13px;
                    cursor:pointer
                }

                .result-count{
                    margin-left:auto;
                    color:#9A8F86;
                    font-size:11px
                }

                /* TABLE */

                .table-wrap{
                    overflow-x:auto;
                    border-top:1px solid #F0EBE7;
                    border-bottom:1px solid #F0EBE7
                }

                table{
                    width:100%;
                    border-collapse:collapse;
                    min-width:950px
                }

                th{
                    padding:13px 16px;
                    text-align:left;
                    background:#FFFBF8;
                    color:#82776F;
                    font-size:10px;
                    text-transform:uppercase;
                    letter-spacing:.35px
                }

                td{
                    padding:14px 16px;
                    border-top:1px solid #F0EBE7;
                    color:#5C514A;
                    font-size:12px
                }

                tbody tr{
                    transition:.18s
                }

                tbody tr:hover{
                    background:#FFF9F5
                }

                .case-id{
                    display:flex;
                    align-items:center;
                    gap:10px
                }

                .case-id>span{
                    width:33px;
                    height:33px;
                    display:grid;
                    place-items:center;
                    border-radius:9px;
                    background:#FFF1E8;
                    color:#C2410C;
                    font-weight:800
                }

                .case-id strong,
                .case-id small{
                    display:block
                }

                .case-id small{
                    margin-top:3px;
                    color:#A69B92;
                    font-size:9px
                }

                .issue{
                    display:block;
                    margin-bottom:6px
                }

                .priority{
                    display:inline-block;
                    font-size:9px
                }

                .priority.high{
                    color:#D3283C
                }

                .priority.medium{
                    color:#A86804
                }

                .missing{
                    color:#D42F43!important;
                    font-weight:700
                }

                .status{
                    display:inline-flex;
                    padding:7px 10px;
                    border-radius:7px;
                    font-size:9px;
                    font-weight:800;
                    text-transform:uppercase;
                    white-space:nowrap
                }

                .status.mismatch{
                    background:#FFE1E5;
                    color:#CE1F38
                }

                .status.needs_review{
                    background:#FFEFcf;
                    color:#A96100
                }

                /* MAIN REVIEW BUTTON */

                .review-button{
                    min-width:112px;
                    height:36px;
                    padding:0 12px;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    gap:10px;
                    border:0;
                    border-radius:8px;
                    background:#EA580C;
                    color:#fff;
                    font-size:11px;
                    font-weight:800;
                    box-shadow:0 6px 13px rgba(234,88,12,.16);
                    cursor:pointer;
                    transition:.2s
                }

                .review-button:hover{
                    transform:translateY(-1px);
                    background:#C2410C;
                    box-shadow:0 9px 18px rgba(234,88,12,.22)
                }

                .review-button span{
                    font-size:15px
                }

                .empty{
                    padding:45px;
                    text-align:center;
                    color:#786F68
                }

                .empty p{
                    font-size:12px
                }

                .panel-footer{
                    padding:14px 20px;
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    color:#8A817A;
                    font-size:10px
                }

                .panel-footer div{
                    display:flex;
                    gap:5px
                }

                .panel-footer button{
                    width:29px;
                    height:29px;
                    border:1px solid #E7DED7;
                    border-radius:7px;
                    background:#fff;
                    color:#6B625B;
                    cursor:pointer
                }

                .panel-footer button.current{
                    border-color:#EA580C;
                    background:#EA580C;
                    color:#fff
                }

                .panel-footer button:disabled{
                    opacity:.4
                }

                /* MODAL */

                .modal-backdrop{
                    position:fixed;
                    inset:0;
                    z-index:20;
                    display:grid;
                    place-items:center;
                    padding:20px;
                    background:rgba(45,30,20,.40);
                    backdrop-filter:blur(5px)
                }

                .modal{
                    position:relative;
                    width:min(520px,100%);
                    padding:30px;
                    border-radius:18px;
                    background:#fff;
                    box-shadow:0 25px 70px rgba(60,35,20,.22)
                }

                .modal-close{
                    position:absolute;
                    right:18px;
                    top:15px;
                    border:0;
                    background:transparent;
                    color:#8A817A;
                    font-size:25px;
                    cursor:pointer
                }

                .modal h2{
                    margin:6px 0
                }

                .modal>p{
                    margin:0;
                    color:#7A7069
                }

                .modal-actions{
                    display:flex;
                    justify-content:flex-end;
                    gap:9px
                }

                .modal-actions button{
                    height:40px;
                    padding:0 15px;
                    border-radius:8px;
                    font-weight:800;
                    cursor:pointer
                }

                .secondary{
                    border:1px solid #E7DED7;
                    background:#fff;
                    color:#6B625B
                }

                .primary{
                    border:0;
                    background:#EA580C;
                    color:#fff
                }

                .primary:hover{
                    background:#C2410C
                }

                @media(max-width:1050px){
                    .review-app{
                        grid-template-columns:82px 1fr
                    }

                    .sidebar{
                        padding:24px 12px
                    }

                    .brand{
                        padding:0 9px 30px
                    }

                    .brand>div:last-child,
                    .sidebar nav span,
                    .sidebar nav b,
                    .sidebar-help,
                    .version{
                        display:none
                    }

                    .sidebar nav button{
                        justify-content:center
                    }

                    .stats{
                        grid-template-columns:repeat(2,1fr)
                    }
                }

                @media(max-width:700px){
                    .review-app{
                        display:block
                    }

                    .sidebar{
                        position:static;
                        width:100%;
                        height:auto;
                        padding:10px 14px;
                        flex-direction:row;
                        align-items:center
                    }

                    .brand{
                        padding:0;
                        margin-right:auto
                    }

                    .brand>div:last-child{
                        display:none
                    }

                    .sidebar nav{
                        display:flex
                    }

                    .sidebar nav button{
                        height:42px
                    }

                    .sidebar nav span,
                    .sidebar nav b{
                        display:none
                    }

                    .topbar{
                        padding:0 15px
                    }

                    .topbar>div:first-child,
                    .user-area>div:not(.avatar),
                    .down{
                        display:none
                    }

                    .content{
                        padding:20px 14px
                    }

                    .page-heading{
                        align-items:flex-start;
                        gap:15px
                    }

                    .page-heading h1{
                        font-size:25px
                    }

                    .refresh{
                        font-size:0
                    }

                    .refresh:first-letter{
                        font-size:18px
                    }

                    .stats{
                        grid-template-columns:1fr 1fr
                    }

                    .stat-card{
                        padding:14px
                    }

                    .toolbar{
                        flex-wrap:wrap
                    }

                    .search-box{
                        width:100%
                    }

                    .result-count{
                        margin-left:0
                    }

                    .panel-footer{
                        gap:12px
                    }
                }

                @media(max-width:430px){
                    .stats{
                        grid-template-columns:1fr
                    }

                    .page-heading p{
                        font-size:12px
                    }

                    .modal-actions{
                        flex-direction:column-reverse
                    }

                    .modal-actions button{
                        width:100%
                    }
                }
            `}</style>
            <style>{`.detail-page{padding:24px 30px 40px;max-width:1400px;margin:auto}.back-link{margin-bottom:14px;padding:0;border:0;background:transparent;color:#126bd2;font-weight:700;cursor:pointer}.detail-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:14px}.detail-title-row h1{margin:0 0 4px;font-size:28px}.detail-title-row p{margin:0;color:#71829a;font-size:12px}.alert-box{display:flex;gap:12px;padding:14px;border:1px solid #ffc4cb;border-radius:10px;background:#fff5f6;color:#92253a}.alert-box>b{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:#ffdbe0;color:#dd263d}.alert-box strong{font-size:12px}.alert-box p{margin:4px 0 0;color:#7f5c66;font-size:10px}.document-grid,.resolution-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.document-card,.info-card,.resolve-card,.details-form{padding:18px;border:1px solid #dce5ef;border-radius:12px;background:#fff;box-shadow:0 5px 18px rgba(28,65,108,.05)}.doc-heading{display:flex;align-items:center;gap:10px}.doc-heading>span{width:31px;height:31px;display:grid;place-items:center;border-radius:8px;background:#eaf3ff;color:#1672dc}.doc-heading h3{margin:0;font-size:14px}.doc-heading small{color:#8392a8;font-size:9px}.doc-heading em{margin-left:auto;padding:5px 8px;border-radius:999px;background:#daf5e8;color:#087753;font-size:8px;font-style:normal;font-weight:800;text-transform:uppercase}.document-card dl{margin:14px 0 8px}.document-card dl div{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #e8eef5}.document-card dt{color:#70829a;font-size:10px}.document-card dd{margin:0;font-size:10px;font-weight:700}.value-red{padding:3px 7px;border-radius:5px;background:#ffe2e5;color:#d42038}.text-button{padding:8px 0 0;border:0;background:transparent;color:#096de0;font-size:10px;font-weight:700;cursor:pointer}.info-card h3,.resolve-card h3{margin:0 0 10px;font-size:14px}.mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.mini-grid span,.case-summary span{color:#71839a;font-size:9px}.mini-grid strong,.case-summary strong{display:block;margin-top:3px;color:#1b3151;font-size:11px}.resolve-card>p{margin:0 0 9px;color:#71839a;font-size:10px}.choice-row{display:flex;gap:8px}.choice-row button{padding:9px 13px;border:1px solid #d3deeb;border-radius:7px;background:#fff;color:#263b58;font-weight:700;cursor:pointer}.choice-row button.selected{border-color:#086ce0;background:#086ce0;color:#fff}.resolve-card textarea,.notes-label textarea{width:100%;min-height:64px;margin-top:9px;padding:10px;border:1px solid #d9e3ee;border-radius:8px;resize:vertical;font:inherit}.form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.form-actions button{height:37px;padding:0 14px;border-radius:7px;font-weight:700;cursor:pointer}.primary:disabled{opacity:.45;cursor:not-allowed}.case-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px;padding:13px 16px;border-radius:10px;background:#edf3fb}.details-form>div:first-child h2{margin:0;font-size:15px}.details-form>div:first-child p{margin:4px 0 14px;color:#75869e;font-size:10px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.form-grid label,.notes-label{display:grid;gap:6px;color:#253b58;font-size:10px;font-weight:700}.form-grid input,.form-grid select{height:41px;padding:0 11px;border:1px solid #d7e1ed;border-radius:8px;background:#fff;color:#2f4561}.notes-label{margin-top:13px}.form-footer{display:flex;align-items:center;justify-content:space-between}.form-footer small{color:#6f8199}@media(max-width:800px){.document-grid,.resolution-grid,.form-grid{grid-template-columns:1fr}.case-summary{grid-template-columns:1fr 1fr}.detail-page{padding:20px 14px}}`}</style>
            <style>{`.sidebar nav button{width:100%;height:48px;padding:0 13px;display:flex;align-items:center;gap:13px;border:0;border-radius:10px;color:#bcd0e8;background:transparent;font:inherit;font-size:14px;text-align:left;cursor:pointer;transition:.2s}.sidebar nav button:hover{background:rgba(255,255,255,.07);color:#fff;transform:translateX(2px)}.sidebar nav button.active{color:#fff;background:linear-gradient(90deg,#0964ce,#217ce0);box-shadow:0 9px 22px rgba(0,73,174,.35)}.sidebar nav button svg{width:19px;height:19px}.sidebar nav button b{margin-left:auto;min-width:23px;height:23px;padding:0 6px;display:grid;place-items:center;border-radius:999px;background:rgba(255,255,255,.18);font-size:11px}.resolved-page{padding:30px;max-width:1500px;margin:auto}.resolved-heading{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:22px}.resolved-heading h1{margin:5px 0 4px;font-size:31px}.resolved-heading p{margin:0;color:#687b99;font-size:14px}.export-button{height:39px;padding:0 15px;border:1px solid #cddaea;border-radius:9px;background:#fff;color:#24577f;font-weight:700;cursor:pointer}.resolved-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}.resolved-toolbar{padding:20px;display:flex;align-items:center;gap:10px}.resolved-toolbar>div{margin-right:auto}.resolved-toolbar h2{margin:0;font-size:17px}.resolved-toolbar p{margin:4px 0 0;color:#8997aa;font-size:10px}.resolved-toolbar .search-box{width:320px}.resolved-toolbar select{height:40px;padding:0 32px 0 12px;border:1px solid #d7e1ed;border-radius:9px;background:#fff;color:#526781}.final-result{display:inline-block;padding:6px 11px;border-radius:999px;font-size:9px;font-weight:800}.final-result.approved{background:#d8f4e6;color:#08784f}.final-result.corrected{background:#fff0cd;color:#ad6700}.final-result.rejected{background:#ffe0e4;color:#d32039}.view-button{height:32px;padding:0 13px;border:1px solid #0871ea;border-radius:7px;background:#fff;color:#0869d8;font-size:10px;font-weight:800;cursor:pointer}.view-button:hover{background:#0871ea;color:#fff}.resolved-page .panel-footer button{width:auto;min-width:30px;padding:0 10px}.resolved-detail{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:22px 0}.resolved-detail span{padding:13px;border-radius:9px;background:#f4f8fd;color:#7889a0;font-size:10px}.resolved-detail strong{display:block;margin-top:5px;color:#203652;font-size:12px}.final-text.approved{color:#08784f}.final-text.corrected{color:#ad6700}.final-text.rejected{color:#d32039}@media(max-width:1050px){.resolved-stats{grid-template-columns:1fr 1fr}.sidebar nav button span,.sidebar nav button b{display:none}.sidebar nav button{justify-content:center}}@media(max-width:760px){.resolved-page{padding:20px 14px}.resolved-toolbar{flex-wrap:wrap}.resolved-toolbar>div{width:100%}.resolved-toolbar .search-box{width:100%}.resolved-stats{grid-template-columns:1fr 1fr}.resolved-heading p{font-size:12px}}@media(max-width:430px){.resolved-stats{grid-template-columns:1fr}.resolved-detail{grid-template-columns:1fr}}`}</style>
            <style>{`.dashboard-page{padding:30px;max-width:1500px;margin:auto}.dashboard-heading{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:21px}.dashboard-heading h1{margin:5px 0 4px;font-size:31px;letter-spacing:-.7px}.dashboard-heading p{margin:0;color:#687b99;font-size:14px}.category-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.category-title h2{margin:0;font-size:15px}.category-title button{padding:7px 11px;border:1px solid #d4dfeb;border-radius:8px;background:#fff;color:#5d718c;font-size:10px;font-weight:700;cursor:pointer}.category-title button.all-active{border-color:#1675df;background:#eaf3ff;color:#0864cf}.email-category-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:13px;margin-bottom:18px}.email-category-card{min-height:118px;padding:17px;display:flex;align-items:center;gap:12px;border:1px solid #dce5f1;border-radius:13px;background:#fff;color:#18304f;text-align:left;box-shadow:0 5px 18px rgba(29,63,105,.045);cursor:pointer;transition:.2s}.email-category-card:hover{transform:translateY(-3px);box-shadow:0 12px 25px rgba(29,63,105,.11)}.email-category-card.selected{border-color:#1977e2;box-shadow:0 0 0 3px rgba(25,119,226,.13),0 12px 25px rgba(29,63,105,.1)}.category-icon{width:44px;height:44px;display:grid;place-items:center;flex:none;border-radius:50%;font-size:19px;font-weight:800}.email-category-card>span:last-child{min-width:0}.email-category-card small,.email-category-card strong,.email-category-card em{display:block}.email-category-card small{min-height:27px;color:#627692;font-size:10px;line-height:1.25}.email-category-card strong{font-size:25px}.email-category-card em{margin-top:3px;color:#95a1b2;font-size:8px;font-style:normal}.email-category-card.purple .category-icon{background:#f0ddff;color:#a719d5}.email-category-card.purple strong{color:#a719d5}.email-category-card.red .category-icon{background:#ffe2e6;color:#d9233d}.email-category-card.red strong{color:#d9233d}.email-category-card.blue .category-icon{background:#dceeff;color:#0877ef}.email-category-card.blue strong{color:#0877ef}.email-category-card.green .category-icon{background:#daf5e8;color:#087853}.email-category-card.green strong{color:#087853}.email-category-card.yellow .category-icon{background:#fff0bd;color:#d28b00}.email-category-card.yellow strong{color:#d28b00}.email-table-heading{padding:18px 20px;display:flex;align-items:center;gap:12px}.email-table-heading>div{margin-right:auto}.email-table-heading h2{margin:0;font-size:17px}.email-table-heading p{margin:4px 0 0;color:#8695a9;font-size:10px}.email-table-heading .search-box{width:310px}.email-subject{font-weight:600}.email-type{display:inline-block;padding:6px 10px;border-radius:999px;font-size:8px;font-weight:800;white-space:nowrap}.email-type.check_document{background:#efddff;color:#9720bd}.email-type.spam{background:#ffe1e5;color:#d21e38}.email-type.new_shipping_instruction{background:#dceeff;color:#086cda}.email-type.invoice_question{background:#d9f4e6;color:#087550}.email-type.operational_update{background:#fff0c7;color:#a86a00}.view-button.neutral{border-color:#aab8c9;color:#526982}.view-button.neutral:hover{background:#526982;color:#fff}@media(max-width:1200px){.email-category-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.dashboard-page{padding:20px 14px}.email-category-grid{grid-template-columns:1fr 1fr}.email-table-heading{flex-wrap:wrap}.email-table-heading>div{width:100%}.email-table-heading .search-box{width:100%}.dashboard-heading p{font-size:12px}}@media(max-width:430px){.email-category-grid{grid-template-columns:1fr}}`}</style>
            <style>{`.email-category-grid{grid-template-columns:repeat(5,minmax(180px,1fr));gap:16px}.email-category-card{min-height:168px;padding:21px 18px;align-items:flex-start;border-radius:16px}.category-icon{width:56px;height:56px;border-radius:16px;font-size:23px}.category-content{display:flex;min-height:124px;flex:1;flex-direction:column}.email-category-card small{min-height:auto;margin-bottom:5px;color:#425a79;font-size:12px;font-weight:800;line-height:1.3}.email-category-card strong{font-size:32px;line-height:1.1}.email-category-card em{margin-top:7px;color:#74869d;font-size:9px;line-height:1.4}.email-category-card .category-content b{margin-top:auto;padding-top:8px;color:#536b88;font-size:9px}.email-category-card.selected .category-content b{color:#086bd9}.email-category-card.selected{transform:translateY(-3px)}@media(max-width:1300px){.email-category-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:850px){.email-category-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:500px){.email-category-grid{grid-template-columns:1fr}.email-category-card{min-height:145px}}`}</style>
            <style>{`.mismatch-details-card{border-color:#ffc4cb;background:#fff5f6;color:#92253a}.mismatch-details-card h3{color:#92253a;font-size:19px}.mismatch-summary{display:block;margin-bottom:14px;font-size:16px}.mismatch-detail-row{padding:11px 0;border-top:1px solid #f5ccd3}.mismatch-detail-row h4{margin:0 0 7px;color:#92253a;font-size:16px}.mismatch-detail-row p{margin:5px 0;color:#7f4050;font-size:14px}.mismatch-detail-row p strong{color:#8f142f;font-size:15px}.resolved-page .modal{max-height:85vh;overflow:auto}.resolved-comparison{border-top:1px solid #e4eaf2;padding:12px 0}.resolved-comparison p{margin:6px 0;color:#526781}`}</style>
        </div>
    );
}
