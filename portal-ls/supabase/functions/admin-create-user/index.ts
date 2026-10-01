import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return json(
        { error: 'Configuração do servidor incompleta.' },
        500
      );
    }

    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.replace(/^Bearer\s+/i, '');

    if (!jwt) {
      return json({ error: 'Não autenticado.' }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: userData, error: userError } =
      await admin.auth.getUser(jwt);

    if (userError || !userData.user) {
      return json({ error: 'Sessão inválida.' }, 401);
    }

    const { data: callerProfile, error: profileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single();

    if (profileError || callerProfile?.role !== 'admin') {
      return json(
        { error: 'Apenas administradores podem criar usuários.' },
        403
      );
    }

    const body = await req.json();

    const name = String(body?.name || '').trim();
    const email = String(body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(body?.password || '');
    const role = body?.role === 'admin' ? 'admin' : 'client';

    const companyId =
      role === 'admin'
        ? null
        : String(body?.companyId || '').trim();

    if (!name || !email || password.length < 8) {
      return json(
        {
          error:
            'Nome, e-mail e senha de pelo menos 8 caracteres são obrigatórios.',
        },
        400
      );
    }

    if (role === 'client' && !companyId) {
      return json(
        { error: 'Cliente precisa estar vinculado a uma empresa.' },
        400
      );
    }

    if (role === 'client') {
      const { data: company, error: companyError } = await admin
        .from('companies')
        .select('id')
        .eq('id', companyId)
        .maybeSingle();

      if (companyError || !company) {
        return json({ error: 'Empresa não encontrada.' }, 400);
      }
    }

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          role,
          companyId,
        },
      });

    if (createError || !created.user) {
      return json(
        {
          error:
            createError?.message ||
            'Não foi possível criar o usuário.',
        },
        400
      );
    }

    const profile = {
      id: created.user.id,
      role,
      name,
      email,
      companyId,
      preferences: {
        bgColor:
          role === 'admin'
            ? 'bg-slate-200'
            : 'bg-slate-50',
      },
    };

    const { data: savedProfile, error: insertError } = await admin
      .from('profiles')
      .insert(profile)
      .select('*')
      .single();

    if (insertError) {
      await admin.auth.admin.deleteUser(created.user.id);

      return json(
        { error: insertError.message },
        400
      );
    }

    return json(
      {
        success: true,
        userId: created.user.id,
        profile: savedProfile,
      },
      200
    );
  } catch (error) {
    console.error('admin-create-user:', error);

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro interno.',
      },
      500
    );
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
