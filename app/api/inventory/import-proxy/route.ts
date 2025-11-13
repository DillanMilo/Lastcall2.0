import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_FIELD_MAPPING,
  mapExternalItems,
  resolveItemsFromPayload,
  type FieldMapping,
} from "@/lib/inventory/apiImportUtils";

interface ProxyRequestBody {
  org_id?: string;
  source?: string;
  apiUrl?: string;
  apiKey?: string | null;
  itemsPath?: string | null;
  fieldMapping?: Partial<FieldMapping>;
  enable_ai_labeling?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: ProxyRequestBody = await request.json();

    const { org_id, source, apiUrl, apiKey, itemsPath } = body;
    const enableAiLabeling = body.enable_ai_labeling ?? false;
    const fieldMapping: FieldMapping = {
      ...DEFAULT_FIELD_MAPPING,
      ...(body.fieldMapping ?? {}),
    };

    if (!org_id || !source || !apiUrl) {
      return NextResponse.json(
        { error: "org_id, source, and apiUrl are required." },
        { status: 400 }
      );
    }

    const externalHeaders: Record<string, string> = {
      Accept: "application/json",
    };

    if (apiKey?.trim()) {
      externalHeaders.Authorization = `Bearer ${apiKey.trim()}`;
    }

    const externalResponse = await fetch(apiUrl, {
      headers: externalHeaders,
      cache: "no-store",
    });

    if (!externalResponse.ok) {
      throw new Error(
        `External API request failed: ${externalResponse.status} ${externalResponse.statusText}`
      );
    }

    const payload = await externalResponse.json();
    const rawItems = resolveItemsFromPayload(payload, itemsPath);

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new Error(
        "No inventory items found in the external API response. Adjust the items path or response shape."
      );
    }

    const mappedItems = mapExternalItems(rawItems, fieldMapping);

    const syncUrl = new URL("/api/inventory/sync", request.nextUrl.origin);
    const syncResponse = await fetch(syncUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        org_id,
        source,
        items: mappedItems,
        enable_ai_labeling: enableAiLabeling,
      }),
      cache: "no-store",
    });

    const syncBody = await syncResponse.json().catch(() => null);

    if (!syncResponse.ok) {
      const message =
        syncBody?.error || `Sync failed with status ${syncResponse.status}.`;
      return NextResponse.json(
        {
          error: message,
          details: syncBody?.details ?? null,
        },
        { status: syncResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      fetched: mappedItems.length,
      summary: syncBody?.summary ?? "Sync completed.",
      results: syncBody?.results ?? null,
    });
  } catch (error: unknown) {
    console.error("Error in POST /api/inventory/import-proxy:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
