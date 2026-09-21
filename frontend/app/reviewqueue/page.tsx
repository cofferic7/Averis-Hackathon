import { Suspense } from "react";
// Import your existing component
import ReviewQueue from "@/components/reviewque"; 

export default function ReviewQueuePage() {
    return (
        <Suspense fallback={<div>Loading review queue...</div>}>
            <ReviewQueue />
        </Suspense>
    );
}