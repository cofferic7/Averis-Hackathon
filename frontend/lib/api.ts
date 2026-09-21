export async function getResults() {
       const response = await fetch("/report_data.json");
       if (!response.ok) {
           throw new Error("Failed to fetch results");
       }
       return response.json();
   }