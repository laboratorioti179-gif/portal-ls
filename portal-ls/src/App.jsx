import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import {
  AlertCircle, ArrowRight, BadgeDollarSign, Banknote, Bell, BriefcaseBusiness,
  Building2, Check, CheckCircle2, ChevronDown, ChevronRight, CircleDollarSign,
  Clock3, CreditCard, FileText, FolderKanban, Gauge, History, LayoutDashboard,
  LogOut, Menu, MessageSquareText, Plus, Receipt, RefreshCw, Search, Settings,
  ShieldCheck, Sparkles, Ticket, UserPlus, Users, WalletCards, X
} from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel.');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const AppContext = createContext(null);

const PROJECT_STAGES = [
  ['planning', 'Planejamento'],
  ['waiting_client', 'Aguardando cliente'],
  ['development', 'Em desenvolvimento'],
  ['testing', 'Testes'],
  ['adjustments', 'Ajustes'],
  ['delivery', 'Entrega'],
  ['completed', 'Concluído'],
];

const STAGE_LABEL = Object.fromEntries(PROJECT_STAGES);

const money = (value) => Number(value || 0).toLocaleString('pt-BR', {
  style: 'currency', currency: 'BRL'
});

const dateBR = (value) => {
  if (!value) return '—';
  const d = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
};

const fetchSupabase = async (path, options = {}) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { data: null, error: { message: 'Sessão expirada.' } };
    const res = await fetch(`${supabaseUrl}${path}`, {
      ...options,
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(options.headers || {}),
      },
    });
    const raw = await res.text();
    const data = raw ? JSON.parse(raw) : null;
    return { data: res.ok ? data : null, error: res.ok ? null : data };
  } catch (error) {
    return { data: null, error };
  }
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [history, setHistory] = useState([]);
  const [financials, setFinancials] = useState([]);
  const [financialSettings, setFinancialSettings] = useState(null);
  const [approvals, setApprovals] = useState([]);

  const clearData = () => {
    setCompanies([]); setUsers([]); setProjects([]); setTickets([]);
    setHistory([]); setFinancials([]); setFinancialSettings(null); setApprovals([]);
  };

  const loadData = async () => {
    const endpoints = [
      ['companies', setCompanies], ['profiles', setUsers], ['projects', setProjects],
      ['tickets', setTickets], ['history', setHistory], ['financials', setFinancials],
      ['approvals', setApprovals],
    ];
    const results = await Promise.all(endpoints.map(async ([table, setter]) => {
      const result = await fetchSupabase(`/rest/v1/${table}?select=*`);
      if (!result.error) setter(result.data || []);
      else console.error(`Erro ao carregar ${table}:`, result.error);
      return result;
    }));

    const settingsRes = await fetchSupabase('/rest/v1/ls_financial_settings?id=eq.default&select=*');
    if (!settingsRes.error) setFinancialSettings(settingsRes.data?.[0] || null);
    else console.error('Erro ao carregar configurações financeiras:', settingsRes.error);

    return results.every(r => !r.error) && !settingsRes.error;
  };

  const loadProfile = async (authUser) => {
    if (!authUser?.id) return null;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', authUser.id).single();
    if (error) return null;
    setCurrentUser(data);
    return data;
  };

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (session?.user) {
        const profile = await loadProfile(session.user);
        if (profile) await loadData();
      }
      setAuthLoading(false);
    };
    boot();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
        setAuthLoading(false);
        return;
      }
      if (event === 'SIGNED_OUT' || !session?.user) {
        setCurrentUser(null); clearData(); return;
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        const profile = await loadProfile(session.user);
        if (profile) await loadData();
      }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.user) return false;
    const profile = await loadProfile(data.user);
    if (!profile) { await supabase.auth.signOut(); return false; }
    await loadData();
    return true;
  };

  const logout = async () => { await supabase.auth.signOut(); setCurrentUser(null); clearData(); };

  const createManagedUser = async ({ name, email, password, role, companyId = null }) => {
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: { name, email, password, role, companyId }
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const generateId = prefix => `${prefix}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;

  const ctx = {
    currentUser, companies, setCompanies, users, setUsers, projects, setProjects,
    tickets, setTickets, history, setHistory, financials, setFinancials,
    financialSettings, setFinancialSettings, approvals, setApprovals, fetchSupabase, createManagedUser, generateId,
    refreshData: loadData, logout, supabase,
  };

  if (authLoading) return <FullLoading />;
  if (passwordRecovery) return <ResetPasswordScreen onDone={async () => {
    setPasswordRecovery(false); await supabase.auth.signOut();
  }} />;

  return (
    <AppContext.Provider value={ctx}>
      {!currentUser ? <LoginScreen onLogin={login} /> : currentUser.role === 'admin' ? <AdminPortal /> : <ClientPortal />}
    </AppContext.Provider>
  );
}

function FullLoading() {
  return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><RefreshCw className="animate-spin mr-3"/> Carregando Portal LS...</div>;
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault(); setLoading(true); setError(''); setMessage('');
    const ok = await onLogin(email.trim().toLowerCase(), password);
    if (!ok) setError('Não foi possível entrar. Confira e-mail e senha.');
    setLoading(false);
  };

  const recover = async () => {
    setError(''); setMessage('');
    if (!email.trim()) return setError('Digite seu e-mail primeiro.');
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin,
    });
    if (resetError) setError(resetError.message);
    else setMessage('Enviamos o link para redefinir sua senha.');
    setLoading(false);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-950">
      <div className="relative hidden lg:flex overflow-hidden p-14 items-end">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_#2563eb_0,_#0f172a_42%,_#020617_75%)]"/>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/20 blur-3xl rounded-full"/>
        <div className="relative z-10 max-w-xl text-white">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-400/30 bg-blue-400/10 text-blue-200 text-xs font-normal mb-6"><Sparkles size={14}/> LS Tecnologia</div>
          <h1 className="text-5xl font-normal leading-tight tracking-tight">Tecnologia, execução e transparência em um só lugar.</h1>
          <p className="mt-6 text-slate-300 text-lg">Acompanhe projetos, aprovações, suporte e financeiro pelo Portal LS.</p>
        </div>
      </div>
      <div className="bg-slate-50 flex items-center justify-center p-5 sm:p-10">
        <form onSubmit={submit} className="w-full max-w-md bg-white border border-slate-200 rounded-[28px] shadow-2xl shadow-slate-900/10 p-7 sm:p-10">
          <div className="w-12 h-12 rounded-2xl bg-slate-950 text-white flex items-center justify-center mb-7"><Sparkles size={22}/></div>
          <h2 className="text-3xl font-normal text-slate-950">Portal LS</h2>
          <p className="text-slate-500 mt-2 mb-8">Área restrita para clientes e administradores.</p>
          {error && <Notice type="error">{error}</Notice>}
          {message && <Notice type="success">{message}</Notice>}
          <Field label="E-mail"><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></Field>
          <Field label="Senha"><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></Field>
          <button disabled={loading} className="btn-primary w-full mt-2">{loading ? 'Acessando...' : 'Entrar no Portal'}</button>
          <button type="button" onClick={recover} disabled={loading} className="w-full mt-4 text-sm font-normal text-blue-700 hover:text-blue-900">Esqueci minha senha</button>
        </form>
      </div>
      <GlobalStyles />
    </div>
  );
}

function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault(); setError('');
    if (password.length < 8) return setError('Use pelo menos 8 caracteres.');
    if (password !== confirm) return setError('As senhas não coincidem.');
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) { setError(updateError.message); setLoading(false); return; }
    await onDone();
  };

  return <div className="min-h-screen bg-slate-950 flex items-center justify-center p-5"><form onSubmit={submit} className="w-full max-w-md bg-white p-8 rounded-3xl">
    <h1 className="text-2xl font-normal">Criar nova senha</h1><p className="text-slate-500 mt-2 mb-6">Defina sua nova senha do Portal LS.</p>
    {error && <Notice type="error">{error}</Notice>}
    <Field label="Nova senha"><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} /></Field>
    <Field label="Confirmar senha"><input className="input" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} /></Field>
    <button disabled={loading} className="btn-primary w-full">{loading ? 'Salvando...' : 'Salvar nova senha'}</button>
    <GlobalStyles />
  </form></div>;
}

function PortalShell({ menu, currentView, setView, children, title }) {
  const { currentUser, logout } = useContext(AppContext);
  const [mobileOpen, setMobileOpen] = useState(false);
  const go = id => { setView(id); setMobileOpen(false); };
  return (
    <div className="portal-ui min-h-screen bg-[#f5f7fb] text-slate-900">
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-slate-950 text-white transform transition-transform duration-300 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-20 px-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20"><Sparkles size={20}/></div><div><div className="font-normal tracking-tight">Portal LS</div><div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Tecnologia</div></div></div>
          <button onClick={()=>setMobileOpen(false)} className="lg:hidden text-slate-400"><X/></button>
        </div>
        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-160px)]">
          {menu.map(item => <button key={item.id} onClick={()=>go(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-normal transition ${currentView===item.id?'bg-white text-slate-950 shadow-lg':'text-slate-400 hover:bg-white/5 hover:text-white'}`}><item.icon size={18}/>{item.label}{currentView===item.id&&<ChevronRight size={16} className="ml-auto"/>}</button>)}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <div className="px-3 pb-3 text-xs text-slate-500 truncate">{currentUser?.name}</div>
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 rounded-xl py-3 text-sm font-normal text-slate-300"><LogOut size={17}/> Sair</button>
        </div>
      </aside>
      {mobileOpen && <button aria-label="Fechar menu" className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" onClick={()=>setMobileOpen(false)}/>} 
      <main className="lg:pl-72 min-h-screen">
        <header className="h-20 sticky top-0 z-20 bg-white/85 backdrop-blur-xl border-b border-slate-200 flex items-center px-4 sm:px-6 lg:px-10">
          <button onClick={()=>setMobileOpen(true)} className="lg:hidden mr-4 w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center"><Menu size={20}/></button>
          <div><p className="text-[11px] uppercase tracking-[0.18em] font-normal text-blue-600">LS Tecnologia</p><h1 className="font-normal text-slate-950">{title}</h1></div>
        </header>
        <div className="p-4 sm:p-6 lg:p-10 max-w-[1600px] mx-auto">{children}</div>
      </main>
      <GlobalStyles />
    </div>
  );
}

function AdminPortal() {
  const [view, setView] = useState('dashboard');
  const menu = [
    {id:'dashboard',label:'Visão geral',icon:LayoutDashboard}, {id:'clients',label:'Clientes',icon:Users},
    {id:'projects',label:'Desenvolvimentos',icon:FolderKanban}, {id:'financial',label:'Financeiro',icon:WalletCards},
    {id:'financial-settings',label:'Config. financeiro',icon:Settings},
    {id:'tickets',label:'Suporte',icon:Ticket}, {id:'register-company',label:'Cadastrar cliente',icon:Building2},
    {id:'register-admin',label:'Cadastrar admin',icon:ShieldCheck},
  ];
  const titles = Object.fromEntries(menu.map(x=>[x.id,x.label]));
  const content = {
    dashboard:<AdminDashboard/>, clients:<AdminClients/>, projects:<AdminProjects/>, financial:<AdminFinancial/>,
    'financial-settings':<AdminFinancialSettings/>, tickets:<AdminTickets/>, 'register-company':<AdminRegisterCompany onDone={()=>setView('clients')}/>,
    'register-admin':<AdminRegisterAdmin/>,
  }[view];
  return <PortalShell menu={menu} currentView={view} setView={setView} title={titles[view]}>{content}</PortalShell>;
}

function AdminDashboard() {
  const { companies, projects, tickets, financials } = useContext(AppContext);
  const pending = financials.filter(f => f.status === 'pending');
  const overdue = pending.filter(f => f.dueDate && new Date(`${f.dueDate}T23:59:59`) < new Date());
  const now = new Date();
  const receivedMonth = financials
    .filter(f => f.status === 'paid' && f.paidAt && new Date(f.paidAt).getMonth() === now.getMonth() && new Date(f.paidAt).getFullYear() === now.getFullYear())
    .reduce((s, f) => s + Number(f.amount || 0), 0);
  const toReceive = pending.reduce((s, f) => s + Number(f.amount || 0), 0);
  const waitingClient = projects.filter(p => p.stage === 'waiting_client').length;
  const activeProjects = projects.filter(p => p.status !== 'closed');

  const COLORS = ['#2563eb', '#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];
  const companiesData = companies.map((c, i) => ({ name: c.name, value: 1, color: COLORS[i % COLORS.length] }));
  const projectsData = companies.map((c, i) => ({
    name: c.name,
    value: projects.filter(p => p.companyId === c.id).length,
    color: COLORS[i % COLORS.length],
  })).filter(x => x.value > 0);
  const ticketsData = companies.map((c, i) => ({
    name: c.name,
    value: tickets.filter(t => t.companyId === c.id && t.status === 'open').length,
    color: COLORS[i % COLORS.length],
  })).filter(x => x.value > 0);

  const ChartCard = ({ title, total, data, empty }) => (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-2xl text-slate-950 mt-1">{total}</p>
        </div>
      </div>
      <div className="h-52">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-slate-400">{empty}</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={48} outerRadius={76} paddingAngle={3} dataKey="value" nameKey="name">
                {data.map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={entry.color} />)}
              </Pie>
              <RechartsTooltip formatter={(value, name) => [value, name]} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );

  return <div className="space-y-8">
    <section>
      <h2 className="text-3xl tracking-tight text-slate-950">Operação LS</h2>
      <p className="text-slate-500 mt-1">Clientes, desenvolvimentos, suporte e financeiro em uma única visão.</p>
    </section>

    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5">
      <Metric icon={Building2} label="Clientes" value={companies.length}/>
      <Metric icon={FolderKanban} label="Projetos ativos" value={activeProjects.length}/>
      <Metric icon={Clock3} label="Aguardando cliente" value={waitingClient}/>
      <Metric icon={Ticket} label="Chamados abertos" value={tickets.filter(t => t.status === 'open').length}/>
      <Metric icon={CircleDollarSign} label="A receber" value={money(toReceive)}/>
      <Metric icon={Banknote} label="Recebido no mês" value={money(receivedMonth)}/>
      <Metric icon={AlertCircle} label="Vencidos" value={overdue.length}/>
      <Metric icon={Gauge} label="Progresso médio" value={`${Math.round(projects.length ? projects.reduce((s,p) => s + Number(p.progress || 0), 0) / projects.length : 0)}%`}/>
    </div>

    <div className="grid md:grid-cols-3 gap-5">
      <ChartCard title="Empresas atendidas" total={companies.length} data={companiesData} empty="Nenhum cliente cadastrado." />
      <ChartCard title="Projetos por cliente" total={projects.length} data={projectsData} empty="Nenhum projeto cadastrado." />
      <ChartCard title="Chamados abertos" total={tickets.filter(t => t.status === 'open').length} data={ticketsData} empty="Nenhum chamado aberto." />
    </div>

    <div className="grid xl:grid-cols-2 gap-6">
      <Panel title="Desenvolvimentos em andamento" icon={FolderKanban}>
        {activeProjects.length === 0 ? <p className="text-sm text-slate-400">Nenhum desenvolvimento ativo.</p> :
          <div className="space-y-4">{activeProjects.slice(0,6).map(p => <ProjectCompact key={p.id} p={p} company={companies.find(c => c.id === p.companyId)}/>)}</div>}
      </Panel>
      <Panel title="Financeiro prioritário" icon={Receipt}>
        {pending.length === 0 ? <p className="text-sm text-slate-400">Nenhuma cobrança pendente.</p> :
          <div className="space-y-3">{[...pending].sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0,6).map(f =>
            <div key={f.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50">
              <div><div className="text-slate-800">{companies.find(c => c.id === f.companyId)?.name || 'Cliente'}</div><div className="text-xs text-slate-500 mt-1">{f.description} • {dateBR(f.dueDate)}</div></div>
              <div className="text-slate-950 whitespace-nowrap">{money(f.amount)}</div>
            </div>)}
          </div>}
      </Panel>
    </div>
  </div>;
}

function AdminClients() {
  const { companies, users, setUsers, projects, financials, tickets, fetchSupabase, setCompanies } = useContext(AppContext);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [companyForm, setCompanyForm] = useState({ name:'', cnpj:'', paymentPlan:'' });
  const [userDrafts, setUserDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const filtered = companies.filter(c => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const linked = users.filter(u => u.companyId === c.id);
    return [c.name,c.cnpj,c.id,c.paymentPlan,...linked.flatMap(u=>[u.name,u.email])]
      .filter(Boolean).some(v=>String(v).toLowerCase().includes(q));
  });

  const beginEdit = c => {
    setEditingId(c.id); setMessage('');
    setCompanyForm({name:c.name||'',cnpj:c.cnpj||'',paymentPlan:c.paymentPlan||''});
    const drafts={}; users.filter(u=>u.companyId===c.id).forEach(u=>drafts[u.id]=u.name||'');
    setUserDrafts(drafts);
  };

  const save = async c => {
    setSaving(true); setMessage('');
    try {
      const updates={name:companyForm.name.trim(),cnpj:companyForm.cnpj.trim()||null,paymentPlan:companyForm.paymentPlan.trim()||null};
      const cr=await fetchSupabase(`/rest/v1/companies?id=eq.${encodeURIComponent(c.id)}`,{method:'PATCH',body:JSON.stringify(updates)});
      if(cr.error) throw new Error(cr.error.message||'Não foi possível atualizar a empresa.');
      for(const u of users.filter(u=>u.companyId===c.id)){
        const newName=(userDrafts[u.id]??u.name??'').trim();
        if(newName && newName!==u.name){
          const ur=await fetchSupabase(`/rest/v1/profiles?id=eq.${encodeURIComponent(u.id)}`,{method:'PATCH',body:JSON.stringify({name:newName})});
          if(ur.error) throw new Error(ur.error.message||`Não foi possível atualizar ${u.name}.`);
        }
      }
      setCompanies(prev=>prev.map(x=>x.id===c.id?{...x,...updates}:x));
      setUsers(prev=>prev.map(u=>u.companyId===c.id&&userDrafts[u.id]!==undefined?{...u,name:userDrafts[u.id].trim()||u.name}:u));
      setEditingId(null); setMessage('Informações atualizadas com sucesso.');
    } catch(err){ setMessage(err.message||'Erro ao salvar alterações.'); }
    finally{ setSaving(false); }
  };

  const remove = async id => {
    if(!confirm('Excluir esta empresa?')) return;
    const r=await fetchSupabase(`/rest/v1/companies?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});
    if(r.error) return alert('A empresa possui vínculos e não pôde ser excluída.');
    setCompanies(x=>x.filter(c=>c.id!==id));
  };

  return <div className="space-y-4">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div><h2 className="page-title">Clientes</h2><p className="page-subtitle">Informações completas em cards compactos e editáveis.</p></div>
      <SearchBox value={search} onChange={setSearch}/>
    </div>
    {message&&<Notice type={message.includes('sucesso')?'success':'error'}>{message}</Notice>}
    <div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-3">
      {filtered.map(c=>{
        const linkedUsers=users.filter(u=>u.companyId===c.id);
        const clientProjects=projects.filter(p=>p.companyId===c.id);
        const clientFinancials=financials.filter(f=>f.companyId===c.id);
        const clientTickets=tickets.filter(t=>t.companyId===c.id);
        const openAmount=clientFinancials.filter(f=>f.status==='pending').reduce((s,f)=>s+Number(f.amount||0),0);
        const paidAmount=clientFinancials.filter(f=>f.status==='paid').reduce((s,f)=>s+Number(f.amount||0),0);
        const openTickets=clientTickets.filter(t=>t.status==='open').length;
        const isEditing=editingId===c.id;
        const primary=linkedUsers[0];
        return <article key={c.id} className="card compact-card p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center flex-none"><Building2 size={16}/></div>
            <div className="min-w-0 flex-1">
              {isEditing?<input className="input compact-input" value={companyForm.name} onChange={e=>setCompanyForm(f=>({...f,name:e.target.value}))}/>:<div className="text-[13px] text-slate-900 truncate">{c.name}</div>}
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">{c.id}</div>
            </div>
            {!isEditing&&<button onClick={()=>beginEdit(c)} className="mini-btn">Editar</button>}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="mini-card"><span>CNPJ</span>{isEditing?<input className="input compact-input mt-1" value={companyForm.cnpj} onChange={e=>setCompanyForm(f=>({...f,cnpj:e.target.value}))}/>:<b>{c.cnpj||'Não informado'}</b>}</div>
            <div className="mini-card"><span>Responsável</span><b>{primary?.name||'Sem responsável'}</b></div>
            <div className="mini-card"><span>Projetos</span><b>{clientProjects.length}</b></div>
            <div className="mini-card"><span>Chamados</span><b>{openTickets}</b></div>
            <div className="mini-card"><span>A receber</span><b>{money(openAmount)}</b></div>
            <div className="mini-card"><span>Recebido</span><b>{money(paidAmount)}</b></div>
          </div>
          <div className="mini-card mt-2"><span>Plano de pagamento</span>{isEditing?<input className="input compact-input mt-1" value={companyForm.paymentPlan} onChange={e=>setCompanyForm(f=>({...f,paymentPlan:e.target.value}))}/>:<b>{c.paymentPlan||'Não definido'}</b>}</div>
          <div className="mt-2 rounded-xl border border-slate-100 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Acessos</div>
            {linkedUsers.length===0?<div className="text-[11px] text-slate-400">Nenhum usuário cadastrado.</div>:linkedUsers.map(u=><div key={u.id} className="py-1.5 first:pt-0 last:pb-0 border-b last:border-0 border-slate-100">
              {isEditing?<input className="input compact-input" value={userDrafts[u.id]??u.name??''} onChange={e=>setUserDrafts(d=>({...d,[u.id]:e.target.value}))}/>:<div className="text-[11px] text-slate-700">{u.name}</div>}
              <div className="text-[10px] text-slate-400 truncate mt-0.5">{u.email||'Sem e-mail'}</div>
            </div>)}
          </div>
          {isEditing&&<div className="flex justify-between gap-2 mt-3 pt-3 border-t border-slate-100">
            <button onClick={()=>remove(c.id)} className="mini-btn text-red-600">Excluir</button>
            <div className="flex gap-2"><button onClick={()=>setEditingId(null)} className="mini-btn">Cancelar</button><button disabled={saving} onClick={()=>save(c)} className="mini-btn mini-btn-primary">{saving?'Salvando...':'Salvar'}</button></div>
          </div>}
        </article>;
      })}
    </div>
    {filtered.length===0&&<Empty title="Nenhum cliente encontrado" text="Tente outro termo de busca."/>}
  </div>;
}

function InfoLine({ label, value }) {
  return <div className="flex gap-2"><span className="text-slate-400 min-w-20">{label}</span><span className="text-slate-700 break-all">{value}</span></div>;
}

function AdminRegisterCompany({ onDone }) {
  const { setCompanies, setUsers, createManagedUser, fetchSupabase, generateId } = useContext(AppContext);
  const [form,setForm]=useState({name:'',cnpj:'',clientName:'',clientEmail:'',clientPassword:''});
  const [loading,setLoading]=useState(false); const [msg,setMsg]=useState('');
  const change=(k,v)=>setForm(f=>({...f,[k]:v}));
  const submit=async e=>{e.preventDefault();setLoading(true);setMsg('');const id=generateId('CMP');const company={id,name:form.name.trim(),cnpj:form.cnpj.trim()||null};
    try{const cr=await fetchSupabase('/rest/v1/companies',{method:'POST',body:JSON.stringify(company)});if(cr.error)throw new Error(cr.error.message||'Erro ao criar empresa');let profile=null;if(form.clientEmail&&form.clientPassword){const r=await createManagedUser({name:form.clientName||form.name,email:form.clientEmail.toLowerCase(),password:form.clientPassword,role:'client',companyId:id});profile=r.profile;}setCompanies(x=>[...x,company]);if(profile)setUsers(x=>[...x,profile]);setMsg('Cliente cadastrado com sucesso.');setForm({name:'',cnpj:'',clientName:'',clientEmail:'',clientPassword:''});setTimeout(()=>onDone?.(),700);}catch(err){await fetchSupabase(`/rest/v1/companies?id=eq.${id}`,{method:'DELETE'});setMsg(err.message);}finally{setLoading(false)}};
  return <div className="max-w-3xl"><div className="card p-6 sm:p-8"><h2 className="text-2xl font-normal">Cadastrar cliente</h2><p className="text-slate-500 mt-1 mb-7">Crie a empresa e, se desejar, o acesso do responsável.</p>{msg&&<Notice>{msg}</Notice>}<form onSubmit={submit} className="grid sm:grid-cols-2 gap-5"><Field label="Empresa"><input className="input" value={form.name} onChange={e=>change('name',e.target.value)} required/></Field><Field label="CNPJ"><input className="input" value={form.cnpj} onChange={e=>change('cnpj',e.target.value)}/></Field><div className="sm:col-span-2 border-t pt-5"><h3 className="font-normal">Acesso do cliente</h3></div><Field label="Responsável"><input className="input" value={form.clientName} onChange={e=>change('clientName',e.target.value)}/></Field><Field label="E-mail"><input className="input" type="email" value={form.clientEmail} onChange={e=>change('clientEmail',e.target.value)}/></Field><Field label="Senha temporária"><input className="input" type="password" minLength={8} value={form.clientPassword} onChange={e=>change('clientPassword',e.target.value)}/></Field><div className="sm:col-span-2"><button disabled={loading} className="btn-primary">{loading?'Salvando...':'Cadastrar cliente'}</button></div></form></div></div>;
}

function AdminRegisterAdmin(){
  const {setUsers,createManagedUser}=useContext(AppContext);const [f,setF]=useState({name:'',email:'',password:''});const [loading,setLoading]=useState(false);const [msg,setMsg]=useState('');
  const submit=async e=>{e.preventDefault();setLoading(true);try{const r=await createManagedUser({...f,email:f.email.toLowerCase(),role:'admin'});if(r.profile)setUsers(x=>[...x,r.profile]);setMsg('Administrador criado.');setF({name:'',email:'',password:''});}catch(err){setMsg(err.message)}finally{setLoading(false)}};
  return <div className="max-w-2xl card p-8"><h2 className="text-2xl font-normal mb-6">Novo administrador</h2>{msg&&<Notice>{msg}</Notice>}<form onSubmit={submit} className="space-y-4"><Field label="Nome"><input className="input" value={f.name} onChange={e=>setF({...f,name:e.target.value})} required/></Field><Field label="E-mail"><input className="input" type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})} required/></Field><Field label="Senha temporária"><input className="input" type="password" minLength={8} value={f.password} onChange={e=>setF({...f,password:e.target.value})} required/></Field><button className="btn-primary" disabled={loading}>{loading?'Criando...':'Criar administrador'}</button></form></div>;
}

function AdminProjects() {
  const {projects,setProjects,companies,history,setHistory,fetchSupabase,generateId}=useContext(AppContext);
  const [selected,setSelected]=useState(null); const [adding,setAdding]=useState(false); const [loading,setLoading]=useState(false);
  const [newP,setNewP]=useState({name:'',companyId:''});
  const [form,setForm]=useState(null); const [newUpdate,setNewUpdate]=useState('');
  const open=p=>{setSelected(p);setForm({...p,stage:p.stage||'planning',progress:Number(p.progress||0),deadline:p.deadline||'',nextStep:p.nextStep||'',observation:p.observation||''});};
  const create=async e=>{e.preventDefault();const item={id:generateId('PRJ'),companyId:newP.companyId,name:newP.name,status:'active',stage:'planning',progress:0,startDate:new Date().toISOString().slice(0,10),deadline:null,nextStep:'Definir escopo e cronograma'};setLoading(true);const r=await fetchSupabase('/rest/v1/projects',{method:'POST',body:JSON.stringify(item)});setLoading(false);if(r.error)return alert(r.error.message||'Erro');setProjects(x=>[item,...x]);setAdding(false);setNewP({name:'',companyId:''});};
  const save=async e=>{e.preventDefault();setLoading(true);const updates={status:form.status,stage:form.stage,progress:Math.max(0,Math.min(100,Number(form.progress||0))),deadline:form.deadline||null,nextStep:form.nextStep||null,observation:form.observation||null};const r=await fetchSupabase(`/rest/v1/projects?id=eq.${selected.id}`,{method:'PATCH',body:JSON.stringify(updates)});setLoading(false);if(r.error)return alert(r.error.message||'Erro');setProjects(x=>x.map(p=>p.id===selected.id?{...p,...updates}:p));setSelected({...selected,...updates});};
  const addUpdate=async e=>{e.preventDefault();if(!newUpdate.trim())return;const item={id:generateId('HST'),projectId:selected.id,description:newUpdate.trim(),date:new Date().toISOString()};const r=await fetchSupabase('/rest/v1/history',{method:'POST',body:JSON.stringify(item)});if(r.error)return alert('Erro ao salvar atualização');setHistory(x=>[item,...x]);setNewUpdate('');};
  if(selected&&form){const company=companies.find(c=>c.id===selected.companyId);const h=history.filter(x=>x.projectId===selected.id).sort((a,b)=>new Date(b.date)-new Date(a.date));return <div className="space-y-6"><button className="text-sm font-normal text-blue-700" onClick={()=>setSelected(null)}>← Voltar</button><div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><h2 className="page-title">{selected.name}</h2><p className="page-subtitle">{company?.name}</p></div><StageBadge stage={form.stage}/></div><div className="grid xl:grid-cols-[1.2fr_.8fr] gap-6"><form onSubmit={save} className="card p-6 space-y-5"><div className="grid sm:grid-cols-2 gap-4"><Field label="Etapa"><select className="input" value={form.stage} onChange={e=>setForm({...form,stage:e.target.value})}>{PROJECT_STAGES.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></Field><Field label="Status"><select className="input" value={form.status||'active'} onChange={e=>setForm({...form,status:e.target.value})}><option value="active">Ativo</option><option value="paused">Pausado</option><option value="closed">Encerrado</option></select></Field><Field label="Progresso (%)"><input className="input" type="number" min="0" max="100" value={form.progress} onChange={e=>setForm({...form,progress:e.target.value})}/></Field><Field label="Previsão de entrega"><input className="input" type="date" value={form.deadline||''} onChange={e=>setForm({...form,deadline:e.target.value})}/></Field></div><Progress value={form.progress}/><Field label="Próximo passo"><input className="input" value={form.nextStep||''} onChange={e=>setForm({...form,nextStep:e.target.value})} placeholder="Ex: Aprovação do layout pelo cliente"/></Field><Field label="Observação visível ao cliente"><textarea className="input min-h-28" value={form.observation||''} onChange={e=>setForm({...form,observation:e.target.value})}/></Field><button className="btn-primary" disabled={loading}>Salvar andamento</button></form><div className="space-y-6"><form onSubmit={addUpdate} className="card p-6"><h3 className="font-normal mb-4">Nova atualização</h3><textarea className="input min-h-28" value={newUpdate} onChange={e=>setNewUpdate(e.target.value)} placeholder="Ex: Integração concluída e enviada para testes."/><button className="btn-dark mt-3">Registrar no histórico</button></form><Panel title="Histórico" icon={History}><div className="space-y-4 max-h-[420px] overflow-auto">{h.map(i=><div key={i.id} className="border-l-2 border-blue-200 pl-4"><p className="text-sm font-normal">{i.description}</p><p className="text-xs text-slate-400 mt-1">{new Date(i.date).toLocaleString('pt-BR')}</p></div>)}</div></Panel></div></div></div>}
  return <div className="space-y-6"><div className="flex flex-col sm:flex-row justify-between gap-4"><div><h2 className="page-title">Desenvolvimentos</h2><p className="page-subtitle">Controle etapa, prazo, progresso e próximo passo.</p></div><button onClick={()=>setAdding(!adding)} className="btn-primary"><Plus size={17}/> Novo projeto</button></div>{adding&&<form onSubmit={create} className="card p-5 grid md:grid-cols-3 gap-4"><Field label="Projeto"><input className="input" value={newP.name} onChange={e=>setNewP({...newP,name:e.target.value})} required/></Field><Field label="Cliente"><select className="input" value={newP.companyId} onChange={e=>setNewP({...newP,companyId:e.target.value})} required><option value="">Selecione...</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><div className="flex items-end"><button className="btn-primary w-full" disabled={loading}>Criar</button></div></form>}<div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{projects.map(p=><button key={p.id} onClick={()=>open(p)} className="card p-6 text-left hover:-translate-y-0.5 transition-transform"><div className="flex justify-between gap-3"><div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center"><FolderKanban/></div><StageBadge stage={p.stage}/></div><h3 className="font-normal text-lg mt-5">{p.name}</h3><p className="text-sm text-slate-500">{companies.find(c=>c.id===p.companyId)?.name}</p><div className="mt-5"><Progress value={p.progress}/></div><div className="mt-4 flex justify-between text-xs text-slate-500"><span>Entrega: {dateBR(p.deadline)}</span><span>{Number(p.progress||0)}%</span></div><div className="mt-4 p-3 rounded-xl bg-slate-50 text-sm"><span className="font-normal">Próximo:</span> {p.nextStep||'Não definido'}</div></button>)}</div></div>;
}

function AdminFinancial() {
  const {financials,setFinancials,companies,fetchSupabase,generateId,financialSettings}=useContext(AppContext);
  const [form,setForm]=useState({companyId:'',description:'',amount:'',dueDate:'',installments:1,customerPhone:'',paymentNotes:''});
  const [loading,setLoading]=useState(false);
  const [filter,setFilter]=useState('all');
  const [editingId,setEditingId]=useState(null);
  const [editForm,setEditForm]=useState({});
  const normalizeMoney=value=>{const raw=String(value||'').trim();const normalized=raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw;return Number(normalized);};
  const create=async e=>{e.preventDefault();const numericAmount=normalizeMoney(form.amount);if(!Number.isFinite(numericAmount)||numericAmount<=0)return alert('Informe um valor válido.');if(!form.customerPhone.trim())return alert('Informe o WhatsApp do cliente.');setLoading(true);try{const total=Math.max(1,Number(form.installments||1));const [y,m,d]=form.dueDate.split('-').map(Number);const base=new Date(y,m-1,d,12);const created=[];for(let i=0;i<total;i++){const due=new Date(base.getFullYear(),base.getMonth()+i,base.getDate(),12);const item={id:generateId('FIN'),companyId:form.companyId,description:total>1?`${form.description} ${i+1}/${total}`:form.description,amount:numericAmount,dueDate:`${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,'0')}-${String(due.getDate()).padStart(2,'0')}`,status:'pending',paymentMethod:'pix',customerPhone:form.customerPhone.trim(),paymentNotes:form.paymentNotes.trim()||null,reminderSent:false,reminderSentAt:null,paidAt:null};const r=await fetchSupabase('/rest/v1/financials',{method:'POST',body:JSON.stringify(item)});if(r.error)throw new Error(r.error.message||'Erro ao criar cobrança.');created.push(item);}setFinancials(x=>[...created,...x]);setForm({companyId:'',description:'',amount:'',dueDate:'',installments:1,customerPhone:'',paymentNotes:''});}catch(err){alert(err.message||'Erro ao criar cobrança.');}finally{setLoading(false);}};
  const markPaid=async id=>{const updates={status:'paid',paidAt:new Date().toISOString()};const r=await fetchSupabase(`/rest/v1/financials?id=eq.${id}`,{method:'PATCH',body:JSON.stringify(updates)});if(r.error)return alert('Erro ao confirmar pagamento.');setFinancials(x=>x.map(f=>f.id===id?{...f,...updates}:f));};
  const reopen=async id=>{const updates={status:'pending',paidAt:null};const r=await fetchSupabase(`/rest/v1/financials?id=eq.${id}`,{method:'PATCH',body:JSON.stringify(updates)});if(r.error)return alert('Erro ao reabrir cobrança.');setFinancials(x=>x.map(f=>f.id===id?{...f,...updates}:f));};
  const resetReminder=async id=>{const updates={reminderSent:false,reminderSentAt:null};const r=await fetchSupabase(`/rest/v1/financials?id=eq.${id}`,{method:'PATCH',body:JSON.stringify(updates)});if(r.error)return alert('Erro ao liberar lembrete.');setFinancials(x=>x.map(f=>f.id===id?{...f,...updates}:f));};
  const beginEdit=f=>{setEditingId(f.id);setEditForm({companyId:f.companyId||'',description:f.description||'',amount:String(f.amount||''),dueDate:String(f.dueDate||'').slice(0,10),customerPhone:f.customerPhone||'',paymentNotes:f.paymentNotes||''});};
  const saveEdit=async id=>{const amount=normalizeMoney(editForm.amount);if(!Number.isFinite(amount)||amount<=0)return alert('Valor inválido.');setLoading(true);const updates={...editForm,amount,customerPhone:String(editForm.customerPhone||'').replace(/\D/g,''),paymentNotes:editForm.paymentNotes||null};const r=await fetchSupabase(`/rest/v1/financials?id=eq.${id}`,{method:'PATCH',body:JSON.stringify(updates)});setLoading(false);if(r.error)return alert(r.error.message||'Erro ao editar cobrança.');setFinancials(x=>x.map(f=>f.id===id?{...f,...updates}:f));setEditingId(null);};
  const isOverdue=f=>f.status==='pending'&&f.dueDate&&new Date(`${f.dueDate}T23:59:59`)<new Date();
  const rows=financials.filter(f=>filter==='all'?true:filter==='overdue'?isOverdue(f):f.status===filter).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));
  const pending=financials.filter(f=>f.status==='pending').reduce((s,f)=>s+Number(f.amount||0),0), paid=financials.filter(f=>f.status==='paid').reduce((s,f)=>s+Number(f.amount||0),0), overdueCount=financials.filter(isOverdue).length;
  return <div className="space-y-4">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3"><div><h2 className="page-title">Financeiro</h2><p className="page-subtitle">Cobranças PIX em cards compactos, editáveis e preparados para o n8n.</p></div><div className="text-[11px] text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2">PIX: <span className="text-slate-900">{financialSettings?.pix_key?'configurado':'não configurado'}</span></div></div>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-2"><Metric icon={WalletCards} label="A receber" value={money(pending)}/><Metric icon={CheckCircle2} label="Recebido" value={money(paid)}/><Metric icon={AlertCircle} label="Vencidas" value={overdueCount}/><Metric icon={Bell} label="Lembretes" value={financials.filter(f=>f.reminderSent).length}/></div>
    <form onSubmit={create} className="card compact-card p-4 grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <Field label="Cliente"><select className="input compact-input" value={form.companyId} onChange={e=>setForm({...form,companyId:e.target.value})} required><option value="">Selecione...</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Descrição"><input className="input compact-input" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} required/></Field>
      <Field label="Valor"><input className="input compact-input" inputMode="decimal" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} required/></Field>
      <Field label="1º vencimento"><input className="input compact-input" type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})} required/></Field>
      <Field label="Parcelas"><input className="input compact-input" type="number" min="1" max="36" value={form.installments} onChange={e=>setForm({...form,installments:e.target.value})}/></Field>
      <Field label="WhatsApp"><input className="input compact-input" inputMode="tel" value={form.customerPhone} onChange={e=>setForm({...form,customerPhone:e.target.value.replace(/\D/g,'')})} required/></Field>
      <div className="sm:col-span-2"><Field label="Observação"><input className="input compact-input" value={form.paymentNotes} onChange={e=>setForm({...form,paymentNotes:e.target.value})}/></Field></div>
      <div className="sm:col-span-2 xl:col-span-4"><button className="mini-btn mini-btn-primary" disabled={loading}>{loading?'Criando...':'Gerar cobrança'}</button></div>
    </form>
    <div className="flex gap-1.5 flex-wrap">{['all','pending','overdue','paid'].map(x=><button key={x} onClick={()=>setFilter(x)} className={`mini-btn ${filter===x?'mini-btn-primary':''}`}>{x==='all'?'Todas':x==='pending'?'Pendentes':x==='overdue'?'Vencidas':'Pagas'}</button>)}</div>
    <div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-3">{rows.length?rows.map(f=>{const overdue=isOverdue(f),editing=editingId===f.id;return <article key={f.id} className="card compact-card p-4">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-[12px] text-slate-900 truncate">{companies.find(c=>c.id===f.companyId)?.name||'Cliente'}</div><div className="text-[10px] text-slate-400 mt-0.5">{f.id}</div></div>{!editing&&<button onClick={()=>beginEdit(f)} className="mini-btn">Editar</button>}</div>
      {editing?<div className="grid grid-cols-2 gap-2 mt-3"><div className="col-span-2"><Field label="Cliente"><select className="input compact-input" value={editForm.companyId} onChange={e=>setEditForm({...editForm,companyId:e.target.value})}>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field></div><div className="col-span-2"><Field label="Descrição"><input className="input compact-input" value={editForm.description} onChange={e=>setEditForm({...editForm,description:e.target.value})}/></Field></div><Field label="Valor"><input className="input compact-input" value={editForm.amount} onChange={e=>setEditForm({...editForm,amount:e.target.value})}/></Field><Field label="Vencimento"><input type="date" className="input compact-input" value={editForm.dueDate} onChange={e=>setEditForm({...editForm,dueDate:e.target.value})}/></Field><div className="col-span-2"><Field label="WhatsApp"><input className="input compact-input" value={editForm.customerPhone} onChange={e=>setEditForm({...editForm,customerPhone:e.target.value})}/></Field></div><div className="col-span-2"><Field label="Observação"><input className="input compact-input" value={editForm.paymentNotes} onChange={e=>setEditForm({...editForm,paymentNotes:e.target.value})}/></Field></div></div>:<>
        <div className="grid grid-cols-2 gap-2 mt-3"><div className="mini-card"><span>Descrição</span><b>{f.description}</b></div><div className="mini-card"><span>Valor</span><b>{money(f.amount)}</b></div><div className="mini-card"><span>Vencimento</span><b>{dateBR(f.dueDate)}</b></div><div className="mini-card"><span>Status</span><b>{overdue?'Vencida':f.status==='paid'?'Paga':'Pendente'}</b></div><div className="mini-card"><span>WhatsApp</span><b>{f.customerPhone||'—'}</b></div><div className="mini-card"><span>Lembrete</span><b>{f.reminderSent?'Enviado':'Pendente'}</b></div></div>
        {f.paymentNotes&&<div className="mini-card mt-2"><span>Observação</span><b>{f.paymentNotes}</b></div>}
      </>}
      <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">{editing?<><button onClick={()=>setEditingId(null)} className="mini-btn">Cancelar</button><button disabled={loading} onClick={()=>saveEdit(f.id)} className="mini-btn mini-btn-primary">Salvar</button></>:<>{f.status!=='paid'?<button onClick={()=>markPaid(f.id)} className="mini-btn mini-btn-primary">Marcar pago</button>:<button onClick={()=>reopen(f.id)} className="mini-btn">Reabrir</button>}{f.reminderSent&&f.status!=='paid'&&<button onClick={()=>resetReminder(f.id)} className="mini-btn">Liberar lembrete</button>}</>}</div>
    </article>}):<Empty title="Nenhuma cobrança" text="Não há cobranças neste filtro."/>}</div>
  </div>;
}

function AdminFinancialSettings(){
  const {financialSettings,setFinancialSettings,fetchSupabase}=useContext(AppContext);
  const [form,setForm]=useState({pix_key:'',pix_name:'',pix_bank:'',reminder_enabled:true});
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState('');

  useEffect(()=>{
    if(financialSettings)setForm({
      pix_key:financialSettings.pix_key||'',
      pix_name:financialSettings.pix_name||'',
      pix_bank:financialSettings.pix_bank||'',
      reminder_enabled:financialSettings.reminder_enabled!==false,
    });
  },[financialSettings]);

  const save=async e=>{
    e.preventDefault();setLoading(true);setMessage('');
    const payload={...form,updated_at:new Date().toISOString()};
    const r=await fetchSupabase('/rest/v1/ls_financial_settings?id=eq.default',{method:'PATCH',body:JSON.stringify(payload)});
    if(r.error){setLoading(false);return setMessage(r.error.message||'Erro ao salvar.');}
    setFinancialSettings(prev=>({...((prev)||{id:'default'}),...payload}));
    setMessage('Configurações financeiras salvas.');setLoading(false);
  };

  return <div className="max-w-3xl space-y-6">
    <div><h2 className="page-title">Configurações financeiras</h2><p className="page-subtitle">Dados PIX usados no portal e nas mensagens automáticas do n8n.</p></div>
    <form onSubmit={save} className="card p-6 sm:p-8 space-y-5">
      {message&&<Notice type={message.includes('salvas')?'success':'error'}>{message}</Notice>}
      <Field label="Chave PIX"><input className="input" placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" value={form.pix_key} onChange={e=>setForm({...form,pix_key:e.target.value})} required/></Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nome do favorecido"><input className="input" placeholder="Ex: LS Tecnologia" value={form.pix_name} onChange={e=>setForm({...form,pix_name:e.target.value})} required/></Field>
        <Field label="Banco"><input className="input" placeholder="Ex: Nubank" value={form.pix_bank} onChange={e=>setForm({...form,pix_bank:e.target.value})}/></Field>
      </div>
      <label className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer">
        <input type="checkbox" checked={form.reminder_enabled} onChange={e=>setForm({...form,reminder_enabled:e.target.checked})}/>
        <div><div className="text-sm text-slate-800">Lembretes automáticos ativos</div><div className="text-xs text-slate-500 mt-1">O n8n poderá usar esta configuração para decidir se deve enviar cobranças.</div></div>
      </label>
      <button className="btn-primary" disabled={loading}>{loading?'Salvando...':'Salvar configurações'}</button>
    </form>
  </div>;
}

function AdminTickets(){
  const {tickets,setTickets,companies,fetchSupabase}=useContext(AppContext);
  const close=async id=>{const r=await fetchSupabase(`/rest/v1/tickets?id=eq.${id}`,{method:'PATCH',body:JSON.stringify({status:'closed'})});if(!r.error)setTickets(x=>x.map(t=>t.id===id?{...t,status:'closed'}:t));};
  return <div className="space-y-6"><div><h2 className="page-title">Suporte</h2><p className="page-subtitle">Chamados dos clientes.</p></div><div className="grid lg:grid-cols-2 gap-5">{tickets.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(t=><div key={t.id} className="card p-6"><div className="flex items-start justify-between gap-3"><div><div className="text-xs text-blue-600 font-normal uppercase">{companies.find(c=>c.id===t.companyId)?.name}</div><h3 className="font-normal text-lg mt-1">{t.title}</h3></div><span className={`status ${t.status==='open'?'status-warn':'status-muted'}`}>{t.status==='open'?'Aberto':'Fechado'}</span></div><p className="text-sm text-slate-600 mt-4 whitespace-pre-wrap">{t.description}</p><div className="mt-5 flex items-center justify-between"><span className="text-xs text-slate-400">{new Date(t.date).toLocaleString('pt-BR')}</span>{t.status==='open'&&<button onClick={()=>close(t.id)} className="btn-secondary">Encerrar</button>}</div></div>)}</div></div>;
}

function ClientPortal(){
  const [view,setView]=useState('home');
  const menu=[{id:'home',label:'Início',icon:LayoutDashboard},{id:'projects',label:'Projetos',icon:FolderKanban},{id:'financial',label:'Financeiro',icon:CreditCard},{id:'support',label:'Suporte',icon:MessageSquareText},{id:'profile',label:'Minha conta',icon:Users}];
  const titles=Object.fromEntries(menu.map(x=>[x.id,x.label]));const content={home:<ClientHome go={setView}/>,projects:<ClientProjects/>,financial:<ClientFinancial/>,support:<ClientSupport/>,profile:<ClientProfile/>}[view];
  return <PortalShell menu={menu} currentView={view} setView={setView} title={titles[view]}>{content}</PortalShell>;
}

function ClientHome({go}){
  const {currentUser,companies,projects,financials}=useContext(AppContext);const company=companies.find(c=>c.id===currentUser.companyId);const mine=projects.filter(p=>p.companyId===currentUser.companyId);const open=financials.filter(f=>f.companyId===currentUser.companyId&&f.status==='pending').sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));const next=open[0];
  return <div className="space-y-7"><div className="relative overflow-hidden rounded-[28px] bg-slate-950 text-white p-7 sm:p-10"><div className="absolute right-0 top-0 w-72 h-72 bg-blue-500/20 blur-3xl rounded-full"/><div className="relative"><p className="text-blue-300 text-sm font-normal">{company?.name}</p><h2 className="text-3xl sm:text-4xl font-normal mt-2">Olá, {currentUser.name?.split(' ')[0]}.</h2><p className="text-slate-400 mt-3">Acompanhe o que está acontecendo agora com a LS.</p></div></div><div className="grid xl:grid-cols-3 gap-5"><div className="xl:col-span-2 space-y-5">{mine.map(p=><div key={p.id} className="card p-6"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h3 className="font-normal text-xl">{p.name}</h3><div className="mt-2"><StageBadge stage={p.stage}/></div></div><div className="text-right"><div className="text-3xl font-normal">{Number(p.progress||0)}%</div><div className="text-xs text-slate-400">concluído</div></div></div><div className="mt-5"><Progress value={p.progress}/></div><div className="grid sm:grid-cols-2 gap-3 mt-5"><InfoCard label="Próximo passo" value={p.nextStep||'A definir'}/><InfoCard label="Previsão" value={dateBR(p.deadline)}/></div><button onClick={()=>go('projects')} className="mt-5 text-sm font-normal text-blue-700 flex items-center gap-1">Ver detalhes <ArrowRight size={15}/></button></div>)}</div><div className="space-y-5"><div className="card p-6"><div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><BadgeDollarSign/></div><h3 className="font-normal mt-4">Próxima cobrança</h3>{next?<><div className="text-2xl font-normal mt-3">{money(next.amount)}</div><div className="text-sm text-slate-500">{next.description}</div><div className="text-xs text-slate-400 mt-2">Vencimento {dateBR(next.dueDate)}</div><button onClick={()=>go('financial')} className="btn-primary w-full mt-5">Ver financeiro</button></>:<p className="text-sm text-slate-500 mt-3">Nenhuma pendência financeira.</p>}</div></div></div></div>;
}

function ClientProjects(){
  const {currentUser,projects,history}=useContext(AppContext);const mine=projects.filter(p=>p.companyId===currentUser.companyId);const [id,setId]=useState(mine[0]?.id||'');const p=mine.find(x=>x.id===id)||mine[0];if(!p)return <Empty title="Nenhum projeto" text="Ainda não há desenvolvimentos vinculados à sua conta."/>;const h=history.filter(x=>x.projectId===p.id).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const currentIndex=Math.max(0,PROJECT_STAGES.findIndex(([v])=>v===(p.stage||'planning')));
  return <div className="space-y-6"><div className="flex flex-col sm:flex-row justify-between gap-4"><div><h2 className="page-title">Seus projetos</h2><p className="page-subtitle">Etapas, entregas e histórico do desenvolvimento.</p></div><select className="input sm:max-w-xs" value={p.id} onChange={e=>setId(e.target.value)}>{mine.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></div><div className="card p-6 sm:p-8"><div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h3 className="text-2xl font-normal">{p.name}</h3><div className="mt-2"><StageBadge stage={p.stage}/></div></div><div className="text-4xl font-normal">{Number(p.progress||0)}%</div></div><div className="mt-6"><Progress value={p.progress}/></div><div className="grid sm:grid-cols-2 gap-4 mt-6"><InfoCard label="Próximo passo" value={p.nextStep||'A definir'}/><InfoCard label="Previsão de entrega" value={dateBR(p.deadline)}/></div>{p.observation&&<div className="mt-6 p-5 bg-blue-50 border border-blue-100 rounded-2xl"><div className="text-xs uppercase tracking-wider text-blue-600 font-normal">Última orientação da equipe</div><p className="mt-2 text-sm text-slate-700">{p.observation}</p></div>}</div><Panel title="Etapas do desenvolvimento" icon={Gauge}><div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">{PROJECT_STAGES.map(([v,l],i)=><div key={v} className={`p-3 rounded-2xl border text-center ${i<currentIndex?'bg-emerald-50 border-emerald-100 text-emerald-700':i===currentIndex?'bg-blue-600 border-blue-600 text-white':'bg-slate-50 border-slate-100 text-slate-400'}`}><div className="mx-auto w-7 h-7 rounded-full flex items-center justify-center bg-white/20 mb-2">{i<currentIndex?<Check size={15}/>:i+1}</div><div className="text-[11px] font-normal leading-tight">{l}</div></div>)}</div></Panel><Panel title="Histórico de atualizações" icon={History}><div className="space-y-5">{h.length?h.map(i=><div key={i.id} className="flex gap-4"><div className="w-2 h-2 mt-2 bg-blue-600 rounded-full flex-none"/><div><p className="text-sm font-normal">{i.description}</p><p className="text-xs text-slate-400 mt-1">{new Date(i.date).toLocaleString('pt-BR')}</p></div></div>):<p className="text-sm text-slate-500">Nenhuma atualização registrada.</p>}</div></Panel></div>;
}

function ClientFinancial(){
  const {currentUser,financials,financialSettings}=useContext(AppContext);
  const [copied,setCopied]=useState(false);
  const mine=financials.filter(f=>f.companyId===currentUser.companyId).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));
  const pending=mine.filter(f=>f.status==='pending').reduce((sum,f)=>sum+Number(f.amount||0),0);
  const copyPix=async()=>{
    if(!financialSettings?.pix_key)return;
    try{await navigator.clipboard.writeText(financialSettings.pix_key);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{alert('Não foi possível copiar automaticamente. Selecione a chave PIX manualmente.');}
  };
  const isOverdue=f=>f.status==='pending'&&f.dueDate&&new Date(`${f.dueDate}T23:59:59`)<new Date();

  return <div className="space-y-6">
    <div><h2 className="page-title">Financeiro</h2><p className="page-subtitle">Consulte suas cobranças e os dados PIX para pagamento.</p></div>
    <div className="grid sm:grid-cols-2 gap-4"><Metric icon={WalletCards} label="Em aberto" value={money(pending)}/><Metric icon={CheckCircle2} label="Pagas" value={mine.filter(f=>f.status==='paid').length}/></div>

    <div className="card p-6 sm:p-7 bg-gradient-to-br from-slate-950 to-slate-900 text-white border-slate-800">
      <div className="flex flex-col md:flex-row md:items-center gap-5">
        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center"><BadgeDollarSign/></div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-slate-400">Pagamento via PIX</div>
          <div className="text-lg mt-2 break-all">{financialSettings?.pix_key||'Chave PIX ainda não cadastrada'}</div>
          <div className="text-sm text-slate-400 mt-2">{financialSettings?.pix_name||'LS Tecnologia'}{financialSettings?.pix_bank?` • ${financialSettings.pix_bank}`:''}</div>
        </div>
        {financialSettings?.pix_key&&<button onClick={copyPix} className="bg-white text-slate-950 rounded-xl px-4 py-3 text-sm">{copied?'Chave copiada':'Copiar chave PIX'}</button>}
      </div>
    </div>

    <div className="space-y-3">{mine.length?mine.map(f=>{
      const overdue=isOverdue(f);
      return <div key={f.id} className="card p-5 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1"><div className="font-normal">{f.description}</div><div className="text-sm text-slate-500 mt-1">Vencimento {dateBR(f.dueDate)}</div>{f.paymentNotes&&<div className="text-xs text-slate-400 mt-2">{f.paymentNotes}</div>}</div>
        <div className="font-normal text-xl">{money(f.amount)}</div>
        {overdue?<span className="status status-warn">Vencida</span>:<PaymentStatus status={f.status}/>} 
      </div>
    }):<Empty title="Nenhuma cobrança" text="Você não possui cobranças registradas no momento."/>}</div>

    <div className="text-xs text-slate-500 px-1">No dia do vencimento, a LS poderá enviar um lembrete automático pelo WhatsApp com o valor e a chave PIX.</div>
  </div>;
}

function ClientSupport(){
  const {currentUser,tickets,setTickets,fetchSupabase,generateId}=useContext(AppContext);const [open,setOpen]=useState(false);const [f,setF]=useState({title:'',description:''});const mine=tickets.filter(t=>t.companyId===currentUser.companyId).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const submit=async e=>{e.preventDefault();const item={id:generateId('TCK'),companyId:currentUser.companyId,title:f.title,description:f.description,status:'open',date:new Date().toISOString()};const r=await fetchSupabase('/rest/v1/tickets',{method:'POST',body:JSON.stringify(item)});if(r.error)return alert('Erro ao abrir chamado.');setTickets(x=>[item,...x]);setOpen(false);setF({title:'',description:''});};
  return <div className="space-y-6"><div className="flex flex-col sm:flex-row justify-between gap-4"><div><h2 className="page-title">Suporte LS</h2><p className="page-subtitle">Fale com a equipe e acompanhe suas solicitações.</p></div><button className="btn-primary" onClick={()=>setOpen(!open)}><Plus size={17}/> Novo chamado</button></div>{open&&<form onSubmit={submit} className="card p-6 space-y-4"><Field label="Assunto"><input className="input" value={f.title} onChange={e=>setF({...f,title:e.target.value})} required/></Field><Field label="Descrição"><textarea className="input min-h-28" value={f.description} onChange={e=>setF({...f,description:e.target.value})} required/></Field><button className="btn-primary">Enviar</button></form>}<div className="grid lg:grid-cols-2 gap-4">{mine.map(t=><div className="card p-6" key={t.id}><div className="flex justify-between gap-3"><h3 className="font-normal">{t.title}</h3><span className={`status ${t.status==='open'?'status-warn':'status-muted'}`}>{t.status==='open'?'Aberto':'Fechado'}</span></div><p className="text-sm text-slate-600 mt-3">{t.description}</p><p className="text-xs text-slate-400 mt-4">{new Date(t.date).toLocaleString('pt-BR')}</p></div>)}</div></div>;
}

function ClientProfile(){const {currentUser,companies}=useContext(AppContext);const c=companies.find(x=>x.id===currentUser.companyId);return <div className="max-w-3xl card p-7 sm:p-9"><div className="w-14 h-14 bg-slate-950 text-white rounded-2xl flex items-center justify-center"><Users/></div><h2 className="text-2xl font-normal mt-5">{currentUser.name}</h2><p className="text-slate-500">{currentUser.email}</p><div className="grid sm:grid-cols-2 gap-4 mt-7"><InfoCard label="Empresa" value={c?.name||'—'}/><InfoCard label="CNPJ" value={c?.cnpj||'—'}/><InfoCard label="Perfil" value="Cliente autorizado"/><InfoCard label="ID LS" value={c?.id||'—'}/></div></div>}

function Metric({icon:Icon,label,value}){return <div className="card p-4 sm:p-5"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center flex-none"><Icon size={19}/></div><div className="min-w-0"><div className="text-[11px] uppercase tracking-wider font-normal text-slate-400">{label}</div><div className="text-xl sm:text-2xl font-normal truncate">{value}</div></div></div></div>}
function MiniStat({label,value}){return <div className="bg-slate-50 rounded-xl p-3"><div className="font-normal text-xs sm:text-sm truncate">{value}</div><div className="text-[10px] text-slate-400 mt-1">{label}</div></div>}
function Panel({title,icon:Icon,children}){return <section className="card p-6"><div className="flex items-center gap-2 mb-5"><div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center"><Icon size={17}/></div><h3 className="font-normal">{title}</h3></div>{children}</section>}
function ProjectCompact({p,company}){return <div className="p-4 rounded-2xl border border-slate-100"><div className="flex justify-between gap-3"><div><div className="font-normal">{p.name}</div><div className="text-xs text-slate-400">{company?.name}</div></div><StageBadge stage={p.stage}/></div><div className="mt-4"><Progress value={p.progress}/></div></div>}
function StageBadge({stage}){return <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-normal whitespace-nowrap">{STAGE_LABEL[stage]||'Planejamento'}</span>}
function PaymentStatus({status}){return <span className={`status ${status==='paid'?'status-ok':status==='in_review'?'status-info':'status-warn'}`}>{status==='paid'?'Pago':status==='in_review'?'Em análise':'Aguardando'}</span>}
function Progress({value}){const n=Math.max(0,Math.min(100,Number(value||0)));return <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all" style={{width:`${n}%`}}/></div>}
function InfoCard({label,value}){return <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100"><div className="text-[10px] uppercase tracking-wider font-normal text-slate-400">{label}</div><div className="font-normal mt-1 break-words">{value}</div></div>}
function Field({label,children}){return <label className="block"><span className="block text-xs font-normal text-slate-600 mb-2">{label}</span>{children}</label>}
function SearchBox({value,onChange}){return <div className="relative w-full sm:w-72"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input className="input pl-10" placeholder="Buscar..." value={value} onChange={e=>onChange(e.target.value)}/></div>}
function Notice({type='info',children}){const cls=type==='error'?'bg-red-50 text-red-700 border-red-100':type==='success'?'bg-emerald-50 text-emerald-700 border-emerald-100':'bg-blue-50 text-blue-700 border-blue-100';return <div className={`p-3.5 rounded-xl border text-sm font-normal mb-4 ${cls}`}>{children}</div>}
function Empty({title,text}){return <div className="card p-12 text-center"><div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400"><BriefcaseBusiness/></div><h3 className="font-normal mt-4">{title}</h3><p className="text-sm text-slate-500 mt-1">{text}</p></div>}

function GlobalStyles(){return <style>{`
  .portal-ui{font-size:12.5px}
  .portal-ui .text-3xl{font-size:1.35rem!important;line-height:1.7rem!important}
  .portal-ui .text-2xl{font-size:1.15rem!important;line-height:1.5rem!important}
  .portal-ui .text-xl{font-size:1rem!important;line-height:1.35rem!important}
  .portal-ui .text-lg{font-size:.9rem!important;line-height:1.25rem!important}
  .portal-ui .text-sm{font-size:.76rem!important;line-height:1.05rem!important}
  .card{background:white;border:1px solid rgb(226 232 240);border-radius:16px;box-shadow:0 7px 24px rgba(15,23,42,.035)}
  .compact-card{box-shadow:0 4px 14px rgba(15,23,42,.025)}
  .input{width:100%;border:1px solid rgb(203 213 225);background:white;border-radius:10px;padding:.58rem .7rem;outline:none;transition:.2s;color:rgb(15 23 42);font-size:.76rem}
  .compact-input{padding:.48rem .6rem;font-size:.72rem;border-radius:9px}
  .input:focus{border-color:rgb(59 130 246);box-shadow:0 0 0 3px rgba(59,130,246,.08)}
  .btn-primary,.btn-dark,.btn-secondary{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;border-radius:10px;padding:.56rem .78rem;font-size:.74rem;font-weight:400;transition:.2s}
  .btn-primary{background:linear-gradient(135deg,#2563eb,#4f46e5);color:white;box-shadow:0 7px 14px rgba(37,99,235,.14)}
  .btn-primary:hover{filter:brightness(.95)} .btn-primary:disabled{opacity:.55}
  .btn-dark{background:#0f172a;color:white}.btn-secondary{background:white;border:1px solid #cbd5e1;color:#334155}
  .mini-btn{display:inline-flex;align-items:center;justify-content:center;border:1px solid #e2e8f0;background:white;color:#475569;border-radius:8px;padding:.38rem .58rem;font-size:.66rem;line-height:1;transition:.2s}
  .mini-btn:hover{background:#f8fafc}.mini-btn-primary{background:#0f172a;color:white;border-color:#0f172a}.mini-btn-primary:hover{background:#1e293b}
  .mini-card{background:#f8fafc;border:1px solid #f1f5f9;border-radius:10px;padding:.55rem .65rem;min-width:0}
  .mini-card span{display:block;font-size:.58rem;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8;margin-bottom:.18rem}
  .mini-card b{display:block;font-size:.7rem;line-height:1rem;font-weight:400;color:#334155;overflow-wrap:anywhere}
  .page-title{font-size:1.25rem;line-height:1.55rem;font-weight:400;letter-spacing:-.025em;color:#0f172a}.page-subtitle{font-size:.72rem;color:#64748b;margin-top:.12rem}
  .status{display:inline-flex;align-items:center;justify-content:center;padding:.28rem .52rem;border-radius:999px;font-size:.61rem;font-weight:400;white-space:nowrap}
  .status-ok{background:#dcfce7;color:#15803d}.status-warn{background:#fff7ed;color:#c2410c}.status-info{background:#eff6ff;color:#1d4ed8}.status-muted{background:#f1f5f9;color:#64748b}
  @media(max-width:640px){.portal-ui{font-size:12px}.page-title{font-size:1.15rem}.card{border-radius:14px}}
`}</style>}
