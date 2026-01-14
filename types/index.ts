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
  bigcommerce_store_hash?: string;
  bigcommerce_client_id?: string;
  bigcommerce_access_token?: string;
  bigcommerce_connected_at?: string;
  created_at: string;
}

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

