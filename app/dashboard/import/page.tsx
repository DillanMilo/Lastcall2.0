"use client";

import { CSVImporter } from "@/components/forms/CSVImporter";

export default function ImportPage() {
  // In a real app, this would come from the authenticated user's session
  const orgId = "00000000-0000-0000-0000-000000000000"; // Placeholder

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Data</h1>
        <p className="text-muted-foreground">
          Upload a CSV file to add items to your inventory
        </p>
      </div>

      <CSVImporter orgId={orgId} />

      <div className="mt-8 p-4 bg-muted rounded-2xl">
        <h3 className="font-semibold mb-2">CSV Format Guide</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Your CSV file should include the following columns:
        </p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li><strong>name</strong> (required) - Product name</li>
          <li><strong>sku</strong> (optional) - Stock keeping unit</li>
          <li><strong>quantity</strong> (optional) - Current stock quantity</li>
          <li><strong>reorder_threshold</strong> (optional) - Minimum quantity before reorder</li>
          <li><strong>expiration_date</strong> (optional) - Format: YYYY-MM-DD</li>
        </ul>
        <p className="text-sm text-muted-foreground mt-3">
          Example: <code className="bg-background px-2 py-1 rounded">name,sku,quantity,reorder_threshold,expiration_date</code>
        </p>
      </div>
    </div>
  );
}

