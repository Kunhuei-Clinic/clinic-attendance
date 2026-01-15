import { createClient } from '@supabase/supabase-js';

// 後端專用的 Supabase Admin Client
// 使用 Service Role Key，可以繞過 RLS 並執行所有資料庫操作
// ⚠️ 此檔案僅能在 Server-Side (API Routes, Server Components) 中使用

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseServiceRoleKey) {
  throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
