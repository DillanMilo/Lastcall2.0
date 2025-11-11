/**
 * Check if Supabase is properly configured
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!(url && url !== 'https://placeholder.supabase.co' && !url.includes('placeholder'));
}

/**
 * Check if OpenAI is properly configured
 */
export function isOpenAIConfigured(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return !!(key && key !== 'placeholder-key' && key !== '');
}

/**
 * Check if BigCommerce credentials are configured
 */
export function isBigCommerceConfigured(): boolean {
  const storeHash = process.env.BIGCOMMERCE_STORE_HASH;
  const clientId = process.env.BIGCOMMERCE_CLIENT_ID;
  const token = process.env.BIGCOMMERCE_ACCESS_TOKEN;
  return Boolean(storeHash && clientId && token);
}
