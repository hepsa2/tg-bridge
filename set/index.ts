// 使用supabase存放Bot token
// 用户体验：点进链接→输入下面设置的密钥→查看Bot token
// 允许公开访问（不需要 Supabase 用户登录）
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  const MASTER_KEY = "your-master-key";
  const BOT_TOKEN = "123456:ABC-your-bot-token";

  if (key !== MASTER_KEY) {
    return new Response(
      JSON.stringify({ error: "Wrong key" }),
      { status: 403 }
    );
  }

  return new Response(
    JSON.stringify({ token: BOT_TOKEN }),
    { headers: { "Content-Type": "application/json" } }
  );
});
