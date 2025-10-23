"use client";

import { useState, useRef } from "react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabaseClient";
import { generateAiLabelClient } from "@/lib/ai/labelGeneratorClient";
import { CSVRow } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Upload, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export function CSVImporter({ orgId }: { orgId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setResult(null);

    const importResult: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        for (const row of results.data) {
          try {
            // Validate required fields
            if (!row.name || row.name.trim() === "") {
              throw new Error("Item name is required");
            }

            // Generate AI label (via API route)
            const aiResult = await generateAiLabelClient(row.name);

            // Prepare item data
            const itemData = {
              org_id: orgId,
              name: row.name.trim(),
              sku: row.sku?.trim() || null,
              invoice: row.invoice?.trim() || null,
              quantity: parseInt(row.quantity || "0", 10),
              reorder_threshold: parseInt(row.reorder_threshold || "0", 10),
              category:
                aiResult.status === "success" ? aiResult.category : null,
              ai_label: aiResult.status === "success" ? aiResult.label : null,
              expiration_date: row.expiration_date || null,
            };

            // Insert into database
            const { error } = await supabase
              .from("inventory_items")
              .insert([itemData]);

            if (error) throw error;

            importResult.success++;
          } catch (error: any) {
            importResult.failed++;
            const errorMsg = error.message || "Unknown error";
            // Check if it's a backend configuration issue
            if (
              errorMsg.includes("fetch") ||
              errorMsg.includes("Failed to fetch")
            ) {
              importResult.errors.push(
                "Backend not configured. Add Supabase credentials to .env.local"
              );
              break; // Stop processing
            } else {
              importResult.errors.push(
                `Row ${importResult.success + importResult.failed}: ${errorMsg}`
              );
            }
          }
        }

        setResult(importResult);
        setImporting(false);
      },
      error: (error) => {
        importResult.errors.push(`Parse error: ${error.message}`);
        setResult(importResult);
        setImporting(false);
      },
    });
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-2xl">Import CSV</CardTitle>
          <CardDescription className="text-sm">
            Upload a CSV file with your inventory data. Required columns: name.
            Optional: sku, invoice, quantity, reorder_threshold,
            expiration_date.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div
            className={`border-2 border-dashed rounded-2xl p-4 md:p-8 text-center transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />

            {file ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
                <div className="flex gap-2 justify-center mt-4">
                  <Button onClick={handleImport} disabled={importing}>
                    {importing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      "Import"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setFile(null)}
                    disabled={importing}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-2">
                  Drag and drop your CSV file here, or click to browse
                </p>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Select File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Import Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span>{result.success} items imported successfully</span>
            </div>

            {result.failed > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  <span>{result.failed} items failed to import</span>
                </div>

                {result.errors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-medium">Errors:</p>
                    <ul className="text-sm text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
                      {result.errors.map((error, index) => (
                        <li key={index} className="text-xs">
                          {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={() => {
                setFile(null);
                setResult(null);
                window.location.href = "/dashboard/inventory";
              }}
            >
              View Inventory
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
