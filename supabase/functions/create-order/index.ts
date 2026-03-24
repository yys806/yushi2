import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type Json = Record<string, unknown>;

function json(data: Json, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ message: "Unauthorized" }, 401);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth?.user) return json({ message: "Unauthorized" }, 401);

    const body = (await req.json()) as {
      packageId?: string;
      payChannel?: "wechat" | "alipay";
      customTimes?: number;
    };

    const payChannel = body.payChannel;
    if (payChannel !== "wechat" && payChannel !== "alipay") {
      return json({ message: "payChannel must be wechat or alipay" }, 400);
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id,quota_total,quota_used,is_admin")
      .eq("id", auth.user.id)
      .single();
    if (profileError || !profile) return json({ message: "Profile not found" }, 404);

    let amount = 0;
    let times = 0;
    let packageId: string | null = null;

    if (body.packageId) {
      const { data: pkg, error: pkgError } = await supabase
        .from("recharge_packages")
        .select("id,amount,times,active")
        .eq("id", body.packageId)
        .eq("active", true)
        .single();

      if (pkgError || !pkg) return json({ message: "packageId invalid" }, 400);

      packageId = pkg.id;
      amount = Number(pkg.amount);
      times = Number(pkg.times);
    } else {
      const t = Math.max(1, Number(body.customTimes || 0));
      times = t;
      amount = Number((t * 0.1).toFixed(1));
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: auth.user.id,
        package_id: packageId,
        amount,
        times,
        pay_channel: payChannel,
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (orderError || !order) return json({ message: orderError?.message || "order create failed" }, 500);

    let quotaTotal = profile.quota_total;
    if (!profile.is_admin) {
      const { data: updatedProfile, error: updateError } = await supabase
        .from("user_profiles")
        .update({ quota_total: profile.quota_total + times, updated_at: new Date().toISOString() })
        .eq("id", auth.user.id)
        .select("quota_total")
        .single();

      if (updateError) return json({ message: updateError.message }, 500);
      quotaTotal = Number(updatedProfile.quota_total);
    }

    return json({
      id: order.id,
      amount: Number(order.amount),
      times: Number(order.times),
      status: order.status,
      quotaTotal,
      quotaUsed: profile.quota_used,
      quotaRemaining: profile.is_admin ? -1 : Math.max(0, quotaTotal - profile.quota_used),
    });
  } catch (e) {
    return json({ message: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
