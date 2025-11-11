export interface FieldMapping {
  name: string;
  sku: string;
  quantity: string;
  invoice: string;
  reorder_threshold: string;
  expiration_date: string;
}

export interface ExternalItem {
  name: string;
  sku: string | null;
  invoice: string | null;
  quantity: number;
  reorder_threshold: number;
  expiration_date: string | null;
}

export const DEFAULT_FIELD_MAPPING: FieldMapping = {
  name: "name",
  sku: "sku",
  quantity: "quantity",
  invoice: "invoice",
  reorder_threshold: "reorder_threshold",
  expiration_date: "expiration_date",
};

function getNestedValue(
  source: unknown,
  path: string | null
): unknown | undefined {
  if (!path) return undefined;
  return path.split(".").reduce<unknown | undefined>((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    if (typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, source ?? undefined);
}

function toInteger(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function resolveItemsFromPayload(
  payload: unknown,
  itemsPath?: string | null
): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    throw new Error(
      "API response must be an array or an object containing an items array."
    );
  }

  const trimmedPath = (itemsPath ?? "").trim();

  if (trimmedPath) {
    const value = getNestedValue(payload, trimmedPath);
    if (Array.isArray(value)) {
      return value;
    }
    throw new Error(
      `Items path "${trimmedPath}" did not resolve to an array of items.`
    );
  }

  const fallbackItems = getNestedValue(payload, "items");
  if (Array.isArray(fallbackItems)) {
    return fallbackItems;
  }

  throw new Error(
    "No inventory items found in the API response. Adjust the Items Path or response format."
  );
}

export function mapExternalItems(
  rawItems: unknown[],
  mapping: FieldMapping
): ExternalItem[] {
  return rawItems.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Item ${index + 1} is not a valid object.`);
    }

    const nameValue = getNestedValue(item, mapping.name);
    if (!nameValue || String(nameValue).trim() === "") {
      throw new Error(
        `Item ${index + 1} is missing the "${mapping.name}" field.`
      );
    }

    return {
      name: String(nameValue).trim(),
      sku:
        (getNestedValue(item, mapping.sku) as string | null | undefined) ??
        null,
      invoice:
        (getNestedValue(item, mapping.invoice) as string | null | undefined) ??
        null,
      quantity: toInteger(getNestedValue(item, mapping.quantity)),
      reorder_threshold: toInteger(
        getNestedValue(item, mapping.reorder_threshold)
      ),
      expiration_date:
        (getNestedValue(item, mapping.expiration_date) as
          | string
          | null
          | undefined) ?? null,
    };
  });
}
