// Arraiá do Tesouro — Edge Function pra gerenciar admins (só o MASTER usa).
// Usa a service_role (lado servidor) — nunca exposta ao front.
//
// Deploy (uma vez):
//   supabase functions deploy admin-manage --project-ref wlmbsqjiphzojcvnzjvd
// (SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY são injetadas
//  automaticamente pelo Supabase — não precisa configurar segredo.)
//
// Ações (POST JSON): { action: "list" | "create" | "delete", email?, password? }

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    // quem está chamando?
    const asCaller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await asCaller.auth.getUser();
    const callerEmail = u?.user?.email?.toLowerCase();
    if (!callerEmail) return json({ error: "Não autenticado." }, 401);

    const admin = createClient(url, service);

    // o chamador é master?
    const { data: me } = await admin.from("admins").select("role").eq("email", callerEmail).maybeSingle();
    if (!me || me.role !== "master") return json({ error: "Só o admin master pode gerenciar admins." }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "list") {
      const { data, error } = await admin.from("admins").select("email, role, created_at").order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 400);
      return json({ admins: data ?? [] });
    }

    if (action === "create") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "E-mail inválido." }, 400);
      if (password.length < 6) return json({ error: "A senha precisa ter ao menos 6 caracteres." }, 400);
      const { error: ce } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (ce && !/already|exist/i.test(ce.message)) return json({ error: ce.message }, 400);
      const { error: ue } = await admin.from("admins").upsert({ email, role: "admin" }, { onConflict: "email" });
      if (ue) return json({ error: ue.message }, 400);
      return json({ ok: true });
    }

    if (action === "delete") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (email === callerEmail) return json({ error: "Você não pode remover a si mesmo." }, 400);
      const { data: target } = await admin.from("admins").select("role").eq("email", email).maybeSingle();
      if (target?.role === "master") return json({ error: "Não dá pra remover outro master." }, 400);
      await admin.from("admins").delete().eq("email", email);
      const { data: list } = await admin.auth.admin.listUsers();
      const usr = list?.users?.find((x: { email?: string }) => x.email?.toLowerCase() === email);
      if (usr) await admin.auth.admin.deleteUser(usr.id);
      return json({ ok: true });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
