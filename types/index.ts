// Core type definitions for LastCall 2.0

export interface User {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  org_id?: string;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  subscription_tier: 'free' | 'starter' | 'growth' | 'pro' | 'enterprise' | 'trial';
  subscription_status?: 'active' | 'canceled' | 'past_due' | 'trialing' | null;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_period_end?: string; // When current billing period ends
  payment_failed_at?: string; // When payment last failed (for grace period)
  canceled_at?: string; // When subscription was cancelled
  is_read_only?: boolean; // Read-only mode after grace period expires
  billing_exempt?: boolean; // Exempt from billing - full access, no billing prompts
  bigcommerce_store_hash?: string;
  bigcommerce_client_id?: string;
  bigcommerce_access_token?: string;
  bigcommerce_connected_at?: string;
  shopify_store_domain?: string;
  shopify_access_token?: string;
  shopify_connected_at?: string;
  // Clover integration
  clover_merchant_id?: string;
  clover_access_token?: string;
  clover_connected_at?: string;
  created_at: string;
}

export type ItemType = 'stock' | 'operational';

export type OperationalCategory =
  | 'cleaning'
  | 'office'
  | 'kitchen'
  | 'packaging'
  | 'tableware'
  | 'maintenance'
  | 'safety'
  | 'other';

export const OPERATIONAL_CATEGORIES: { value: OperationalCategory; label: string }[] = [
  { value: 'cleaning', label: 'Cleaning Supplies' },
  { value: 'office', label: 'Office Supplies' },
  { value: 'kitchen', label: 'Kitchen & Cooking' },
  { value: 'packaging', label: 'Packaging & Labels' },
  { value: 'tableware', label: 'Tableware & Utensils' },
  { value: 'maintenance', label: 'Maintenance & Tools' },
  { value: 'safety', label: 'Safety & First Aid' },
  { value: 'other', label: 'Other' },
];

export interface InventoryItem {
  id: string;
  org_id: string;
  name: string;
  sku?: string;
  invoice?: string;
  quantity: number;
  reorder_threshold: number;
  ai_label?: string;
  category?: string;
  expiration_date?: string;
  bigcommerce_product_id?: string;
  bigcommerce_variant_id?: string;
  shopify_product_id?: string;
  shopify_variant_id?: string;
  clover_item_id?: string;
  item_type: ItemType;
  operational_category?: OperationalCategory;
  last_restock: string;
  created_at: string;
}

export interface Import {
  id: string;
  org_id: string;
  source: string;
  status: 'pending' | 'processing' | 'completed' | 'completed_with_errors' | 'failed';
  created_at: string;
}

export interface ItemHistory {
  item_id: string;
  quantity: number;
  date: string;
  action: 'restock' | 'sale' | 'waste';
}

export interface AILabelResult {
  status: 'success' | 'insufficient_data';
  label?: string;
  category?: string;
  confidence?: number;
  reason?: string;
}

export interface ReorderPrediction {
  status: 'success' | 'insufficient_data';
  predicted_date?: string;
  confidence?: number;
  reason?: string;
}

export interface CSVRow {
  [key: string]: string;
}

