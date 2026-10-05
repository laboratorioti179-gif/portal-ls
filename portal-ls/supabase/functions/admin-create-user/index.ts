import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;
const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") || "https://api.asaas.com/v3";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { financialId, successUrl } = await req.json();
    if (!financialId) throw new Error("financialId é obrigatório.");

    const { data: fin, error } = await supabase.from("financials").select("*").eq("id", financialId).single();
    if (error || !fin) throw new Error("Cobrança não encontrada.");
    if (fin.status === "paid") throw new Error("Esta cobrança já está paga.");

    if (fin.paymentUrl && fin.asaasPaymentLinkId) {
      return Response.json({ id: fin.asaasPaymentLinkId, url: fin.paymentUrl, reused: true }, { headers: cors });
    }

    const payload = {
      name: `LS Tecnologia - ${fin.description}`.slice(0, 100),
      description: fin.description,
      value: Number(fin.amount),
      billingType: "UNDEFINED",
      chargeType: "DETACHED",
      dueDateLimitDays: 10,
      externalReference: fin.id,
      notificationEnabled: true,
      ...(successUrl ? { callback: { successUrl, autoRedirect: false } } : {}),
    };

    const asaasRes = await fetch(`${ASAAS_BASE_URL}/paymentLinks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "accept": "application/json",
        "access_token": ASAAS_API_KEY,
        "User-Agent": "LS-Tecnologia-Portal/2.0",
      },
      body: JSON.stringify(payload),
    });

    const asaas = await asaasRes.json();
    if (!asaasRes.ok) throw new Error(asaas?.errors?.[0]?.description || asaas?.message || "Erro no Asaas.");

    const { error: updateError } = await supabase.from("financials").update({
      paymentUrl: asaas.url,
      asaasPaymentLinkId: asaas.id,
      asaasStatus: "LINK_CREATED",
    }).eq("id", financialId);
    if (updateError) throw updateError;

    return Response.json({ id: asaas.id, url: asaas.url }, { headers: cors });
  } catch (error) {
    return Response.json({ error: error.message || "Erro interno" }, { status: 400, headers: cors });
  }
});
