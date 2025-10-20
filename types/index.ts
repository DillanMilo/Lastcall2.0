// Core type definitions for LastCall 2.0

export interface User {
  id: string;
  email: string;
  full_name?: string;
  org_id?: string;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  subscription_tier: 'growth' | 'enterprise' | 'trial';
  created_at: string;
}

export interface InventoryItem {
  id: string;
  org_id: string;
  name: string;
  sku?: string;
  quantity: number;
  reorder_threshold: number;
  ai_label?: string;
  category?: string;
  expiration_date?: string;
  last_restock: string;
  created_at: string;
}

export interface Import {
  id: string;
  org_id: string;
  source: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
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

