import { Suspense } from "react";
// Make sure the path matches your actual filename (e.g., reviewque or reviewque_2)
import ReviewQueue from "@/components/reviewque"; 

export default function ResolvedPage() {
    return (
        <Suspense fallback={<div>Loading resolved cases...</div>}>
            <ReviewQueue initialPage="resolved" />
        </Suspense>
    );
}