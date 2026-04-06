import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let _supabase: SupabaseClient<Database> | null = null;

// クライアントサイド用（匿名キー）
export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _supabase;
}

// 後方互換のエクスポート
export const supabase = typeof window !== "undefined"
  ? getSupabase()
  : (null as unknown as SupabaseClient<Database>);

// サーバーサイド用（サービスロールキー）
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
