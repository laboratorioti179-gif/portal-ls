import React, { useState, useEffect, createContext, useContext } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  LayoutDashboard, Users, FolderKanban, Settings, LogOut, 
  Ticket, FileText, CheckSquare, Clock, CreditCard, PaintBucket, 
  Plus, Search, Building2, Briefcase, Link as LinkIcon, DollarSign,
  UserPlus, ShieldAlert, CheckCircle2, Circle, AlertCircle, ChevronDown, ChevronUp,
  Hexagon, Diamond
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

// --- SUPABASE CONFIGURATION ---
// Configure no .env do Vite:
// VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
// VITE_SUPABASE_ANON_KEY=sua_chave_anon_ou_publishable
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Helper compatível com as chamadas REST já existentes no projeto.
// IMPORTANTE: o Bearer agora é o access_token do usuário autenticado, não a anon key.
const fetchSupabase = async (path, options = {}) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { data: null, error: { message: 'Sessão expirada ou usuário não autenticado.' } };
    }

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
  } catch (err) {
    return { data: null, error: err };
  }
};

const AppContext = createContext();

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [history, setHistory] = useState([]);
  const [financials, setFinancials] = useState([]);

  const clearData = () => {
    setUsers([]); setCompanies([]); setProjects([]); setTickets([]);
    setContracts([]); setApprovals([]); setHistory([]); setFinancials([]);
  };

  const loadData = async () => {
    const endpoints = [
      ['companies', setCompanies],
      ['projects', setProjects],
      ['profiles', setUsers],
      ['tickets', setTickets],
      ['history', setHistory],
      ['contracts', setContracts],
      ['approvals', setApprovals],
      ['financials', setFinancials],
    ];

    const results = await Promise.all(
      endpoints.map(async ([table, setter]) => {
        const result = await fetchSupabase(`/rest/v1/${table}?select=*`);
        if (result.error) console.error(`Erro ao carregar ${table}:`, result.error);
        else setter(result.data || []);
        return result;
      })
    );

    return results.every(r => !r.error);
  };

  const loadProfile = async (authUser) => {
    if (!authUser?.id) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (error) {
      console.error('Perfil não encontrado:', error);
      return null;
    }

    setCurrentUser(data);
    return data;
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (session?.user) {
        const profile = await loadProfile(session.user);
        if (profile) await loadData();
      }
      setAuthLoading(false);
    };

    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT' || !session?.user) {
        setCurrentUser(null);
        clearData();
        return;
      }

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        const profile = await loadProfile(session.user);
        if (profile) await loadData();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.user) {
      console.error('Erro de login:', error);
      return false;
    }

    const profile = await loadProfile(data.user);
    if (!profile) {
      await supabase.auth.signOut({ scope: 'local' });
      return false;
    }

    await loadData();
    return true;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    setCurrentUser(null);
    clearData();
  };

  const generateId = (prefix) => `${prefix}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;

  const createManagedUser = async ({ name, email, password, role, companyId = null }) => {
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: { name, email, password, role, companyId },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const sanitizeFileName = (name) =>
    name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');

  const uploadPrivateFile = async (bucket, path, file) => {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || undefined,
    });
    if (error) throw error;
    return data.path;
  };

  const getSignedFileUrl = async (bucket, path, expiresIn = 120) => {
    if (!path) throw new Error('Arquivo não encontrado.');
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  };

  const contextValue = {
    currentUser, users, setUsers, companies, setCompanies,
    projects, setProjects, tickets, setTickets, contracts, setContracts,
    approvals, setApprovals, history, setHistory, financials, setFinancials,
    handleLogout, generateId, fetchSupabase, supabaseUrl, supabaseKey, supabase,
    createManagedUser, uploadPrivateFile, getSignedFileUrl, sanitizeFileName,
    refreshData: loadData,
    updateUserPreferences: async (prefs) => {
      if (!currentUser) return;
      const updatedPreferences = { ...(currentUser.preferences || {}), ...prefs };
      const { error } = await supabase
        .from('profiles')
        .update({ preferences: updatedPreferences })
        .eq('id', currentUser.id);
      if (error) throw error;

      const updatedUser = { ...currentUser, preferences: updatedPreferences };
      setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
      setCurrentUser(updatedUser);
    },
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-600 font-medium">Carregando portal...</div>;
  }

  return (
    <AppContext.Provider value={contextValue}>
      {!currentUser ? (
        <LoginScreen onLogin={handleLogin} />
      ) : currentUser.role === 'admin' ? (
        <AdminPortal />
      ) : (
        <ClientPortal />
      )}
    </AppContext.Provider>
  );
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const images = [
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [images.length]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const success = await onLogin(email, password);
    if (!success) {
      setError('Credenciais inválidas. Tente novamente.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Lado Esquerdo - Formulário de Login */}
      <div className="w-full md:w-1/2 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-200 to-slate-300 flex items-center justify-center p-4 md:p-12 relative z-10">
        <div className="bg-slate-100/90 backdrop-blur-xl p-10 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white/50 w-full max-w-md">
          <div className="text-center mb-10">
            <style>
              {`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&display=swap');
              `}
            </style>
            
            {/* Premium Alternative Logo */}
            <div className="mx-auto mb-6 relative z-10 w-24 h-24 flex items-center justify-center">
               <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 to-indigo-900 rounded-full blur-xl opacity-40 animate-pulse"></div>
               <div className="relative w-20 h-20 bg-gradient-to-br from-slate-900 to-blue-950 rounded-2xl flex items-center justify-center shadow-2xl border border-blue-500/30 rotate-3">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.5),transparent_70%)] rounded-2xl"></div>
                  <Hexagon size={48} className="text-blue-400 absolute opacity-30 -rotate-12" strokeWidth={1} />
                  <Diamond size={32} className="text-white relative z-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" strokeWidth={1.5} />
               </div>
            </div>

            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>Portal de Acesso</h1>
            <p className="text-slate-500 text-sm mt-2 font-medium">Área restrita para clientes e administradores</p>
          </div>

          {error && <div className="bg-red-50/80 backdrop-blur-sm text-red-600 p-4 rounded-xl mb-6 text-sm font-medium border border-red-100">{error}</div>}

          <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">E-mail</label>
            <input 
              type="email" 
              placeholder="Ex: seuemail@empresa.com"
              className="w-full p-3 bg-white/50 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading}
            />
            {/* Comentário/Ajuda para o campo E-mail */}
            <p className="text-[11px] text-slate-400 mt-1 ml-1">Insira o e-mail corporativo cadastrado.</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Senha</label>
            <input 
              type="password" 
              placeholder="Sua senha de acesso"
              className="w-full p-3 bg-white/50 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading}
            />
            {/* Comentário/Ajuda para o campo Senha */}
            <p className="text-[11px] text-slate-400 mt-1 ml-1">A senha é sensível a maiúsculas e minúsculas.</p>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3.5 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-semibold shadow-lg shadow-blue-600/30 mt-4 disabled:opacity-70">
              {loading ? 'Acessando...' : 'Entrar no Portal'}
            </button>
          </form>
        </div>
      </div>

      {/* Lado Direito - Carrossel de Imagens */}
      <div className="hidden md:block md:w-1/2 relative overflow-hidden bg-slate-900">
        {images.map((img, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentImageIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            <img 
              src={img} 
              alt="LS Inovação" 
              className="object-cover w-full h-full opacity-60"
            />
            {/* Overlay com gradiente para garantir a legibilidade do texto */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent"></div>
          </div>
        ))}

        <div className="absolute bottom-0 left-0 right-0 p-12 text-white z-20">
          <h2 className="text-4xl font-bold mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            Inovação e Excelência
          </h2>
          <p className="text-lg text-slate-200 max-w-lg">
            Transformamos desafios complexos em soluções digitais elegantes. Construindo o futuro da tecnologia com criatividade, precisão e foco no resultado.
          </p>
          
          {/* Indicadores do Carrossel */}
          <div className="flex gap-2 mt-8">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentImageIndex ? 'bg-blue-500 w-6' : 'bg-white/50 hover:bg-white/80'
                }`}
                aria-label={`Ir para a imagem ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ menuItems, currentView, setView, onLogout }) {
  return (
    <div className="w-64 bg-gradient-to-b from-slate-950 to-slate-900 text-slate-300 flex flex-col h-screen fixed left-0 top-0 border-r border-slate-800/50 shadow-2xl z-20">
      <div className="p-6 border-b border-slate-800/80 flex items-center gap-4">
        {/* Premium Alternative Logo (Small) */}
        <div className="w-10 h-10 bg-gradient-to-br from-slate-900 to-blue-950 rounded-lg flex items-center justify-center shadow-lg border border-blue-500/30 flex-shrink-0 relative overflow-hidden">
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.4),transparent_70%)]"></div>
           <Diamond size={20} className="text-white relative z-10" strokeWidth={1.5} />
        </div>
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300 font-bold text-xl tracking-tight">Portal LS</span>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6">
        {menuItems.map((group, i) => (
          <div key={i} className="mb-8">
            <h3 className="px-8 text-[11px] uppercase text-slate-500 font-bold mb-3 tracking-widest">{group.title}</h3>
            <ul className="space-y-1">
              {group.items.map((item, j) => (
                <li key={item.id}>
                  <button
                    onClick={() => setView(item.id)}
                    className={`w-full flex items-center gap-3 px-8 py-3 text-sm transition-all duration-300 font-medium ${
                      currentView === item.id ? 'bg-gradient-to-r from-blue-600/15 to-transparent text-blue-400 border-r-4 border-blue-500 shadow-[inset_4px_0_0_0_rgba(59,130,246,0.05)]' : 'hover:bg-slate-800/50 hover:text-white hover:pl-10'
                    }`}
                  >
                    <item.icon size={18} className={currentView === item.id ? 'text-blue-400' : 'text-slate-500'} />
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="p-6 border-t border-slate-800/80 bg-slate-950/50">
        <button onClick={onLogout} className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 bg-slate-800/50 rounded-xl hover:bg-slate-800 hover:text-white transition-all">
          <LogOut size={18} />
          Sair do sistema
        </button>
      </div>
    </div>
  );
}

function AdminPortal() {
  const [currentView, setCurrentView] = useState('dashboard');
  const { handleLogout } = useContext(AppContext);

  const menuItems = [
    {
      title: 'Visão Geral',
      items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }]
    },
    {
      title: 'Operacional',
      items: [
        { id: 'clients', label: 'Clientes', icon: Users },
        { id: 'projects', label: 'Projetos', icon: FolderKanban },
        { id: 'tickets', label: 'Chamados', icon: Ticket }
      ]
    },
    {
      title: 'Gestão',
      items: [
        { id: 'financial', label: 'Financeiro', icon: DollarSign },
        { id: 'register-admin', label: 'Cadastrar Admin', icon: ShieldAlert },
        { id: 'register-company', label: 'Cadastrar Empresa', icon: Building2 }
      ]
    }
  ];

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <AdminDashboard />;
      case 'clients': return <AdminClients />;
      case 'projects': return <AdminProjects />;
      case 'tickets': return <AdminTickets />;
      case 'financial': return <AdminFinancial />;
      case 'register-admin': return <AdminRegisterAdmin />;
      case 'register-company': return <AdminRegisterCompany />;
      default: return <AdminDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-200 flex selection:bg-blue-100">
      <Sidebar menuItems={menuItems} currentView={currentView} setView={setCurrentView} onLogout={handleLogout} />
      <div className="ml-64 flex-1 p-10 overflow-y-auto h-screen">
        {renderView()}
      </div>
    </div>
  );
}

function AdminDashboard() {
  const { projects, tickets, companies } = useContext(AppContext);
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  
  const activeProjectsCount = projects.filter(p => p.status === 'active').length;
  const openTicketsCount = tickets.filter(t => t.status === 'open').length;

  const COLORS = ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ef4444', '#06b6d4', '#f43f5e', '#eab308'];

  // Dados para os gráficos de pizza
  const companiesData = companies.map((c, i) => ({ 
    name: c.name, 
    value: 1, 
    color: COLORS[i % COLORS.length] 
  }));

  const projectsData = companies.map((c, i) => ({
    name: c.name,
    value: projects.filter(p => p.companyId === c.id).length,
    color: COLORS[i % COLORS.length]
  })).filter(d => d.value > 0);

  const ticketsData = companies.map((c, i) => ({
    name: c.name,
    value: tickets.filter(t => t.companyId === c.id && t.status === 'open').length,
    color: COLORS[i % COLORS.length]
  })).filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard Geral</h1>
        <p className="text-slate-500">Visão consolidada da operação LS.</p>
      </div>

      {/* Gráficos de Pizza */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center">
          <h3 className="text-sm text-slate-500 font-semibold uppercase tracking-wider mb-2">Empresas Atendidas ({companies.length})</h3>
          <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={companiesData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                  {companiesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value, name) => [value, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center">
          <h3 className="text-sm text-slate-500 font-semibold uppercase tracking-wider mb-2">Projetos Ativos ({activeProjectsCount})</h3>
          <div className="w-full h-48">
            {projectsData.length === 0 ? <EmptyState message="Nenhum projeto ativo." /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={projectsData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                    {projectsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value, name) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center">
          <h3 className="text-sm text-slate-500 font-semibold uppercase tracking-wider mb-2">Chamados Abertos ({openTicketsCount})</h3>
          <div className="w-full h-48">
            {ticketsData.length === 0 ? <EmptyState message="Nenhum chamado aberto." /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ticketsData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                    {ticketsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value, name) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Listas Detalhadas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Briefcase size={18}/> Projetos Ativos (Todos)</h3>
          {projects.filter(p => p.status === 'active').length === 0 ? (
             <EmptyState message="Nenhum projeto ativo no momento." />
          ) : (
            <ul className="space-y-3">
              {projects.filter(p => p.status === 'active').map(proj => {
                const comp = companies.find(c => c.id === proj.companyId);
                return (
                  <li key={proj.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg border border-slate-100">
                    <div>
                      <p className="font-medium text-slate-800">{proj.name}</p>
                      <p className="text-xs text-slate-500">{comp?.name || 'Empresa Desconhecida'}</p>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">Ativo</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Ticket size={18}/> Chamados Abertos (Por Cliente)</h3>
          {tickets.filter(t => t.status === 'open').length === 0 ? (
             <EmptyState message="Nenhum chamado aberto no momento." />
          ) : (
            <ul className="space-y-3">
              {tickets.filter(t => t.status === 'open').map(ticket => {
                const comp = companies.find(c => c.id === ticket.companyId);
                const isExpanded = expandedTicketId === ticket.id;
                
                return (
                  <li key={ticket.id} className="p-3 hover:bg-slate-50 rounded-lg border border-slate-100 cursor-pointer transition-colors" onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}>
                     <div className="flex justify-between items-center">
                       <p className="font-medium text-slate-800">{ticket.title}</p>
                       {isExpanded ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                     </div>
                     <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-slate-500">Cliente: {comp?.name || 'N/A'}</p>
                        <span className="text-xs font-medium px-2 py-1 bg-orange-100 text-orange-700 rounded-full">Aberto</span>
                     </div>
                     
                     {/* Detalhes do chamado aberto */}
                     {isExpanded && (
                       <div className="mt-3 pt-3 border-t border-slate-100 bg-white">
                         <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
                         <div className="mt-3 flex justify-between items-center">
                           <p className="text-xs text-slate-400 font-mono">ID: {ticket.id} • Aberto em: {new Date(ticket.date).toLocaleDateString()}</p>
                           <button className="text-xs text-blue-600 hover:underline font-medium">Visualizar &rarr;</button>
                         </div>
                       </div>
                     )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminClients() {
  const { companies, setCompanies, users, fetchSupabase } = useContext(AppContext);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCnpj, setEditCnpj] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleEditClick = (comp) => {
    setEditingId(comp.id);
    setEditName(comp.name);
    setEditCnpj(comp.cnpj || '');
    setDeleteConfirmId(null);
  };

  const handleSaveEdit = async (id) => {
    setLoading(true);
    const updates = { name: editName, cnpj: editCnpj };
    await fetchSupabase(`/rest/v1/companies?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
    setCompanies(companies.map(c => c.id === id ? { ...c, ...updates } : c));
    setEditingId(null);
    setLoading(false);
  };

  const handleDeleteClick = (id) => {
    setDeleteConfirmId(id);
    setEditingId(null);
  };

  const handleConfirmDelete = async (id) => {
    setLoading(true);
    setErrorMsg('');
    const res = await fetchSupabase(`/rest/v1/companies?id=eq.${id}`, { method: 'DELETE' });
    
    if (res.error) {
       setErrorMsg('Não foi possível excluir. A empresa ainda possui vínculos ativos (usuários, projetos ou cobranças) e a exclusão em cascata não está ativada no Supabase.');
    } else {
       setCompanies(companies.filter(c => c.id !== id));
    }
    
    setDeleteConfirmId(null);
    setLoading(false);
    setTimeout(() => setErrorMsg(''), 6000);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Lista de Clientes</h1>
          <p className="text-slate-500">Gestão detalhada de empresas cadastradas.</p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm">
          <AlertCircle size={18} className="flex-shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {companies.length === 0 ? (
          <div className="p-12">
            <EmptyState message="Nenhum cliente cadastrado. Vá em 'Gestão > Cadastrar Empresa' para começar." />
          </div>
        ) : (
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">ID Empresa</th>
                <th className="px-6 py-4 font-semibold">Razão Social / Nome</th>
                <th className="px-6 py-4 font-semibold">CNPJ</th>
                <th className="px-6 py-4 font-semibold">Usuários Vinculados</th>
                <th className="px-6 py-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map(comp => (
                <tr key={comp.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono text-xs align-middle">{comp.id}</td>
                  
                  {editingId === comp.id ? (
                    <>
                      <td className="px-6 py-4 align-middle">
                        <input type="text" className="w-full p-1.5 border rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm" value={editName} onChange={e => setEditName(e.target.value)} disabled={loading} />
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <input type="text" className="w-full p-1.5 border rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm" value={editCnpj} onChange={e => setEditCnpj(e.target.value)} disabled={loading} />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 font-medium text-slate-800 align-middle">{comp.name}</td>
                      <td className="px-6 py-4 align-middle">{comp.cnpj || 'Não informado'}</td>
                    </>
                  )}

                  <td className="px-6 py-4 align-middle">
                    {users.filter(u => u.companyId === comp.id).length} usuários
                  </td>
                  
                  <td className="px-6 py-4 align-middle text-right">
                    {editingId === comp.id ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => handleSaveEdit(comp.id)} disabled={loading} className="text-[10px] font-medium px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded transition-colors disabled:opacity-70">Salvar</button>
                        <button onClick={() => setEditingId(null)} disabled={loading} className="text-[10px] font-medium px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors disabled:opacity-70">Cancelar</button>
                      </div>
                    ) : deleteConfirmId === comp.id ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-[10px] text-red-600 font-bold mr-1">Excluir?</span>
                        <button onClick={() => handleConfirmDelete(comp.id)} disabled={loading} className="text-[10px] font-bold px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-70">Sim</button>
                        <button onClick={() => setDeleteConfirmId(null)} disabled={loading} className="text-[10px] font-medium px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors disabled:opacity-70">Não</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => handleEditClick(comp)} className="text-[10px] font-medium px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors">Editar</button>
                        <button onClick={() => handleDeleteClick(comp.id)} className="text-[10px] font-medium px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors">Excluir</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AdminRegisterCompany() {
  const { companies, setCompanies, users, setUsers, createManagedUser, fetchSupabase, generateId } = useContext(AppContext);
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [success, setSuccess] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setSuccess(''); setErrorMsg('');
    const newCompanyId = generateId('CMP');
    const newCompany = { id: newCompanyId, name: name.trim(), cnpj: cnpj.trim() || null };

    try {
      const companyRes = await fetchSupabase('/rest/v1/companies', { method: 'POST', body: JSON.stringify(newCompany) });
      if (companyRes.error) throw new Error(companyRes.error.message || JSON.stringify(companyRes.error));

      let createdProfile = null;
      if (clientEmail && clientPassword) {
        const result = await createManagedUser({
          name: clientName.trim() || `Contato - ${name.trim()}`,
          email: clientEmail.trim().toLowerCase(),
          password: clientPassword,
          role: 'client',
          companyId: newCompanyId,
        });
        createdProfile = result.profile;
      }

      setCompanies(prev => [...prev, newCompany]);
      if (createdProfile) setUsers(prev => [...prev, createdProfile]);
      setSuccess(`Empresa ${name} cadastrada com sucesso.${createdProfile ? ' Acesso do cliente criado.' : ''}`);
      setName(''); setCnpj(''); setClientName(''); setClientEmail(''); setClientPassword('');
    } catch (err) {
      // Se a criação do usuário falhar após criar a empresa, remove a empresa vazia.
      await fetchSupabase(`/rest/v1/companies?id=eq.${newCompanyId}`, { method: 'DELETE' });
      setErrorMsg(err.message || 'Não foi possível cadastrar a empresa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
      <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Building2 className="text-blue-600"/> Cadastrar Nova Empresa</h2>
      {success && <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg border border-green-200">{success}</div>}
      {errorMsg && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">{errorMsg}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-700 border-b pb-2">Dados da Empresa</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Nome / Razão Social</label><input type="text" className="w-full p-2 border rounded" value={name} onChange={e => setName(e.target.value)} required disabled={loading}/></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label><input type="text" className="w-full p-2 border rounded" value={cnpj} onChange={e => setCnpj(e.target.value)} disabled={loading}/></div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-slate-700 border-b pb-2">Acesso do Cliente (opcional)</h3>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Nome do responsável</label><input type="text" className="w-full p-2 border rounded" value={clientName} onChange={e => setClientName(e.target.value)} disabled={loading}/></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">E-mail de acesso</label><input type="email" className="w-full p-2 border rounded" value={clientEmail} onChange={e => setClientEmail(e.target.value)} disabled={loading}/></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Senha temporária</label><input type="password" minLength={8} className="w-full p-2 border rounded" value={clientPassword} onChange={e => setClientPassword(e.target.value)} disabled={loading}/></div>
          </div>
          <p className="text-xs text-slate-500">Use pelo menos 8 caracteres. O usuário é criado pelo backend seguro, sem expor a service role no navegador.</p>
        </div>

        <button type="submit" disabled={loading || (!!clientEmail !== !!clientPassword)} className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-60">
          {loading ? 'Cadastrando...' : 'Cadastrar Empresa'}
        </button>
      </form>
    </div>
  );
}

function AdminRegisterAdmin() {
  const { setUsers, createManagedUser } = useContext(AppContext);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [success, setSuccess] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setSuccess(''); setErrorMsg('');
    try {
      const result = await createManagedUser({
        name: name.trim(), email: email.trim().toLowerCase(), password, role: 'admin', companyId: null,
      });
      if (result.profile) setUsers(prev => [...prev, result.profile]);
      setSuccess(`Administrador ${name} criado com sucesso.`);
      setName(''); setEmail(''); setPassword('');
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao criar administrador.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
      <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><ShieldAlert className="text-blue-600"/> Cadastrar Novo Administrador LS</h2>
      {success && <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg">{success}</div>}
      {errorMsg && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">{errorMsg}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label><input type="text" className="w-full p-2 border rounded" value={name} onChange={e => setName(e.target.value)} required disabled={loading}/></div>
        <div><label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label><input type="email" className="w-full p-2 border rounded" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading}/></div>
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Senha temporária</label><input type="password" minLength={8} className="w-full p-2 border rounded" value={password} onChange={e => setPassword(e.target.value)} required disabled={loading}/></div>
        <button type="submit" disabled={loading} className="w-full bg-slate-800 text-white p-3 rounded-lg hover:bg-slate-900 disabled:opacity-60">{loading ? 'Gravando...' : 'Cadastrar Administrador'}</button>
      </form>
    </div>
  );
}

function AdminProjects() {
  const { projects, setProjects, companies, users, generateId, history, setHistory, approvals, setApprovals, fetchSupabase, uploadPrivateFile, getSignedFileUrl, sanitizeFileName } = useContext(AppContext);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewingProject, setViewingProject] = useState(null);
  
  const [newProjName, setNewProjName] = useState('');
  const [newProjCompany, setNewProjCompany] = useState('');
  const [newContractTitle, setNewContractTitle] = useState('');

  // States para a edição detalhada
  const [editObservation, setEditObservation] = useState('');
  const [editAssignedUser, setEditAssignedUser] = useState('');
  const [editContractFile, setEditContractFile] = useState('');
  const [editContractObject, setEditContractObject] = useState(null);
  const [editStatus, setEditStatus] = useState('active');
  
  // State para nova observação (histórico)
  const [newObservation, setNewObservation] = useState('');
  const [newApprovalTitle, setNewApprovalTitle] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newProjCompany) return alert("Selecione uma empresa.");
    setLoading(true);
    
    const projectId = generateId('PRJ');
    let contractId = null;

    if (newContractTitle) {
      contractId = generateId('CTR');
    }

    const newProject = {
      id: projectId,
      companyId: newProjCompany,
      name: newProjName,
      status: 'active',
      contractId: contractId,
      startDate: new Date().toISOString().split('T')[0]
    };

    await fetchSupabase('/rest/v1/projects', { method: 'POST', body: JSON.stringify(newProject) });
    setProjects([...projects, newProject]);
    
    setIsAdding(false);
    setNewProjName(''); setNewProjCompany(''); setNewContractTitle('');
    setLoading(false);
  };

  const openProjectDetails = (proj) => {
    setViewingProject(proj);
    setEditObservation(proj.observation || '');
    setEditAssignedUser(proj.assignedUserId || '');
    setEditContractFile(proj.contractFileName || '');
    setEditContractObject(null);
    setEditStatus(proj.status || 'active');
    setNewObservation('');
    setIsAdding(false);
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    setLoading(true);
    const updates = {
      observation: editObservation,
      assignedUserId: editAssignedUser || null,
      status: editStatus
    };

    try {
      if (editContractObject) {
        const safeName = sanitizeFileName(editContractObject.name);
        const storagePath = `${viewingProject.companyId}/${viewingProject.id}/${Date.now()}-${safeName}`;
        const uploadedPath = await uploadPrivateFile('contracts', storagePath, editContractObject);
        updates.contractFileName = editContractObject.name;
        updates.contractStoragePath = uploadedPath;
      }

      const updateRes = await fetchSupabase(`/rest/v1/projects?id=eq.${viewingProject.id}`, {
        method: 'PATCH', body: JSON.stringify(updates)
      });
      if (updateRes.error) throw new Error(updateRes.error.message || 'Falha ao atualizar projeto.');

    // Registra a atividade geral no histórico do projeto
    const histId = generateId('HST');
    const newHist = {
      id: histId,
      projectId: viewingProject.id,
      description: 'Informações gerais, status ou arquivo do projeto atualizados pelo administrador.',
      date: new Date().toISOString()
    };
    await fetchSupabase('/rest/v1/history', { method: 'POST', body: JSON.stringify(newHist) });
    setHistory([...history, newHist]);

    const newProjects = projects.map(p => p.id === viewingProject.id ? { ...p, ...updates } : p);
    setProjects(newProjects);
    setViewingProject({ ...viewingProject, ...updates });
    setEditContractObject(null);
    } catch (err) {
      alert(err.message || 'Erro ao atualizar projeto.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    if (window.confirm('Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita.')) {
      setLoading(true);
      await fetchSupabase(`/rest/v1/projects?id=eq.${viewingProject.id}`, { method: 'DELETE' });
      setProjects(projects.filter(p => p.id !== viewingProject.id));
      setViewingProject(null);
      setLoading(false);
    }
  };

  const handleAddObservation = async (e) => {
    e.preventDefault();
    if(!newObservation.trim()) return;
    setLoading(true);

    const histId = generateId('HST');
    const newHist = {
      id: histId,
      projectId: viewingProject.id,
      description: newObservation,
      date: new Date().toISOString()
    };

    await fetchSupabase('/rest/v1/history', { method: 'POST', body: JSON.stringify(newHist) });
    setHistory([...history, newHist]);
    
    const updates = { observation: newObservation };
    await fetchSupabase(`/rest/v1/projects?id=eq.${viewingProject.id}`, { method: 'PATCH', body: JSON.stringify(updates) });
    const newProjects = projects.map(p => p.id === viewingProject.id ? { ...p, ...updates } : p);
    
    setProjects(newProjects);
    setViewingProject({ ...viewingProject, ...updates });

    setNewObservation('');
    setLoading(false);
  };

  const handleAddApproval = async (e) => {
    e.preventDefault();
    if (!newApprovalTitle.trim()) return;
    setLoading(true);
    try {
      const item = {
        id: generateId('APR'),
        projectId: viewingProject.id,
        title: newApprovalTitle.trim(),
        approved: false,
      };
      const res = await fetchSupabase('/rest/v1/approvals', { method: 'POST', body: JSON.stringify(item) });
      if (res.error) throw new Error(res.error.message || 'Falha ao criar aprovação.');
      setApprovals(prev => [item, ...prev]);
      setNewApprovalTitle('');
    } catch (err) {
      alert(err.message || 'Erro ao solicitar aprovação.');
    } finally {
      setLoading(false);
    }
  };

  // Visão Detalhada (Edição do Projeto)
  if (viewingProject) {
    const comp = companies.find(c => c.id === viewingProject.companyId);
    
    // Filtra usuários: Permite que QUALQUER usuário do sistema (todos) seja selecionado como responsável
    const companyUsers = users;
    
    const projHistory = history.filter(h => h.projectId === viewingProject.id).sort((a,b) => new Date(b.date) - new Date(a.date));
    const assignedUserName = users.find(u => u.id === viewingProject.assignedUserId)?.name;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Detalhes do Projeto</h1>
            <p className="text-slate-500">Gestão completa de escopo e andamento.</p>
          </div>
          <button onClick={() => setViewingProject(null)} className="px-4 py-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-colors">
            Voltar para Lista
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Esquerda: Informações Principais e Edição */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
              <div className="mb-6 pb-6 border-b border-slate-100 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">{viewingProject.name}</h2>
                  <p className="text-sm font-medium text-blue-600 flex items-center gap-1 mt-1"><Building2 size={16}/> {comp?.name || 'Cliente Desconhecido'} (CNPJ: {comp?.cnpj || 'N/A'})</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${
                    viewingProject.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    viewingProject.status === 'paused' ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-200 text-slate-700'
                  }`}>
                    Status: {viewingProject.status === 'active' ? 'Em Andamento' : viewingProject.status === 'paused' ? 'Pausado' : 'Encerrado'}
                  </span>
                  <p className="text-xs text-slate-400 mt-2 font-mono">ID: {viewingProject.id}</p>
                </div>
              </div>

              <form onSubmit={handleUpdateProject} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Usuário Responsável (Admin/Cliente)</label>
                    <select 
                      className="w-full p-3 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none" 
                      value={editAssignedUser} 
                      onChange={e => setEditAssignedUser(e.target.value)} 
                      disabled={loading}
                    >
                      <option value="">Nenhum usuário específico</option>
                      {companyUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role === 'admin' ? 'Admin' : 'Cliente'})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Arquivo de Contrato (PDF)</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="file" 
                        accept=".pdf" 
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-slate-300 rounded-lg"
                        onChange={e => {
                          if(e.target.files[0]) {
                            setEditContractFile(e.target.files[0].name);
                            setEditContractObject(e.target.files[0]);
                          }
                        }}
                        disabled={loading}
                      />
                    </div>
                    {editContractFile && <p className="text-xs text-emerald-600 mt-2 font-medium flex items-center gap-1"><CheckCircle2 size={14}/> Arquivo salvo: {editContractFile}</p>}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Status do Projeto</label>
                    <select 
                      className="w-full p-3 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none" 
                      value={editStatus} 
                      onChange={e => setEditStatus(e.target.value)} 
                      disabled={loading}
                    >
                      <option value="active">Em Andamento (Ativo)</option>
                      <option value="paused">Pausado</option>
                      <option value="closed">Encerrado</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-slate-100">
                  <button type="button" onClick={handleDeleteProject} disabled={loading} className="w-full sm:w-auto px-4 py-2.5 text-red-600 bg-red-50 hover:bg-red-100 font-medium rounded-lg transition-colors">
                    Excluir Projeto
                  </button>
                  <button type="submit" disabled={loading} className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-70 transition-colors shadow-sm w-full md:w-auto">
                    {loading ? 'Salvando Alterações...' : 'Atualizar Dados Básicos'}
                  </button>
                </div>
              </form>
            </div>

            {/* Adicionar Observação / Histórico */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
               <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><CheckSquare className="text-blue-600" size={20}/> Inserir Nova Observação / Andamento</h3>
               <form onSubmit={handleAddObservation}>
                  <textarea 
                    className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none mb-3 bg-slate-50" 
                    placeholder="Descreva o que foi feito ou anote uma observação importante para o histórico do projeto..."
                    value={newObservation}
                    onChange={e => setNewObservation(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <div className="flex justify-end">
                    <button type="submit" disabled={loading} className="px-6 py-2.5 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-900 disabled:opacity-70 transition-colors shadow-sm flex items-center gap-2">
                      <Plus size={18}/> {loading ? 'Salvando...' : 'Salvar no Histórico'}
                    </button>
                  </div>
               </form>
            </div>
          </div>

          {/* Coluna Direita: Resumo e Linha do Tempo */}
          <div className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-800 text-white">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-200"><Briefcase size={18}/> Resumo Atual</h3>
              <div className="space-y-4 text-sm">
                <div>
                  <span className="text-slate-400 block mb-1 text-xs uppercase tracking-wider">Responsável Atribuído</span>
                  <span className="font-medium">{assignedUserName || 'Não atribuído'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1 text-xs uppercase tracking-wider">Contrato Vinculado</span>
                  <span className="font-medium flex items-center gap-2 flex-wrap">{viewingProject.contractFileName ? <><FileText size={14} className="text-blue-400"/> {viewingProject.contractFileName}{viewingProject.contractStoragePath && <button type="button" className="text-blue-400 hover:underline text-xs" onClick={async()=>{ try { const url = await getSignedFileUrl('contracts', viewingProject.contractStoragePath); window.open(url, '_blank', 'noopener,noreferrer'); } catch(err){ alert(err.message); } }}>Abrir</button>}</> : 'Nenhum arquivo anexado'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1 text-xs uppercase tracking-wider">Última Observação</span>
                  <p className="font-medium text-slate-300 italic">"{viewingProject.observation || 'Sem observações registradas.'}"</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-[400px] flex flex-col">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-3"><Clock className="text-blue-600" size={20}/> Histórico Completo</h3>
              <div className="overflow-y-auto flex-1 pr-2">
                {projHistory.length === 0 ? (
                  <EmptyState message="Nenhum histórico registrado para este projeto." />
                ) : (
                  <div className="relative border-l-2 border-slate-200 ml-4 space-y-6 py-2">
                    {projHistory.map((h, idx) => (
                      <div key={h.id} className="pl-6 relative">
                        <div className={`absolute w-4 h-4 rounded-full -left-[9px] top-0.5 border-2 ${idx === 0 ? 'bg-blue-500 border-blue-200' : 'bg-white border-slate-300'}`}></div>
                        <p className="text-sm font-medium text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100">{h.description}</p>
                        <p className="text-xs text-slate-500 mt-2">{new Date(h.date).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Visão Padrão (Lista)
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Projetos</h1>
          <p className="text-slate-500">Clique em um projeto para ver e editar os detalhes completos.</p>
        </div>
        <button onClick={() => setIsAdding(!isAdding)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={18}/> Novo Projeto
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm mb-6">
          <h3 className="font-bold text-slate-800 mb-4">Criar Novo Projeto</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Projeto</label>
              <input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={newProjName} onChange={e=>setNewProjName(e.target.value)} required disabled={loading}/>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cliente Vinculado</label>
              <select className="w-full p-2 border rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={newProjCompany} onChange={e=>setNewProjCompany(e.target.value)} required disabled={loading}>
                <option value="">Selecione a empresa...</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ID Auxiliar de Contrato (Opcional)</label>
              <input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: CTR-2025" value={newContractTitle} onChange={e=>setNewContractTitle(e.target.value)} disabled={loading}/>
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded transition-colors" disabled={loading}>Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-70" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar Projeto Inicial'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {projects.length === 0 ? (
          <div className="p-12"><EmptyState message="Nenhum projeto cadastrado." /></div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {projects.map(proj => {
              const comp = companies.find(c => c.id === proj.companyId);
              const assignedUserName = users.find(u => u.id === proj.assignedUserId)?.name;
              return (
                <li key={proj.id} className="p-6 hover:bg-slate-50 flex justify-between items-center cursor-pointer transition-colors group" onClick={() => openProjectDetails(proj)}>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{proj.name}</h4>
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase tracking-wider border border-slate-200">{proj.id}</span>
                    </div>
                    <div className="mt-2 flex flex-col sm:flex-row gap-2 sm:gap-6 text-sm text-slate-500">
                      <p className="flex items-center gap-1.5"><Building2 size={16} className="text-slate-400"/> {comp?.name || 'Cliente Órfão'}</p>
                      {assignedUserName && <p className="flex items-center gap-1.5"><Users size={16} className="text-slate-400"/> Resp: {assignedUserName}</p>}
                      {proj.contractFileName && <p className="flex items-center gap-1.5"><FileText size={16} className="text-blue-400"/> {proj.contractFileName}</p>}
                    </div>
                    {proj.observation && (
                       <div className="mt-3 bg-white p-2 rounded border border-slate-100 inline-block max-w-full">
                         <p className="text-xs text-slate-500 line-clamp-1 italic"><span className="font-semibold text-slate-700 not-italic">Última Observação:</span> {proj.observation}</p>
                       </div>
                    )}
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full mb-2 shadow-sm border ${
                      proj.status === 'active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                      proj.status === 'paused' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                      'bg-slate-200 text-slate-700 border-slate-300'
                    }`}>
                      {proj.status === 'active' ? 'Em andamento' : proj.status === 'paused' ? 'Pausado' : 'Encerrado'}
                    </span>
                    <p className="text-xs text-slate-400 font-medium group-hover:text-blue-500 transition-colors">Clique para gerenciar &rarr;</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function AdminTickets() {
  const { tickets, setTickets, companies, users, fetchSupabase } = useContext(AppContext);
  const [filter, setFilter] = useState('all');
  const [loadingId, setLoadingId] = useState(null);

  const updateTicket = async (ticket, updates) => {
    setLoadingId(ticket.id);
    try {
      const payload = { ...updates };
      if (updates.status === 'closed') payload.closed_at = new Date().toISOString();
      const res = await fetchSupabase(`/rest/v1/tickets?id=eq.${ticket.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      if (res.error) throw new Error(res.error.message || 'Falha ao atualizar chamado.');
      setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, ...payload } : t));
    } catch (err) {
      alert(err.message || 'Erro ao atualizar chamado.');
    } finally {
      setLoadingId(null);
    }
  };

  const visible = tickets
    .filter(t => filter === 'all' || t.status === filter)
    .sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-slate-800">Chamados de Suporte</h1><p className="text-slate-500">Gerencie solicitações abertas pelos clientes.</p></div>
        <select className="p-2 border rounded-lg bg-white" value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">Todos</option><option value="open">Abertos</option><option value="in_progress">Em atendimento</option><option value="waiting_client">Aguardando cliente</option><option value="closed">Fechados</option>
        </select>
      </div>
      <div className="space-y-4">
        {visible.length===0 ? <div className="bg-white rounded-xl p-8 border"><EmptyState message="Nenhum chamado neste filtro."/></div> : visible.map(t=>{
          const company=companies.find(c=>c.id===t.companyId);
          return <div key={t.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div className="flex-1"><div className="flex items-center gap-2"><h3 className="font-bold text-slate-800">{t.title}</h3><span className="text-xs text-slate-400 font-mono">{t.id}</span></div><p className="text-xs text-blue-600 font-medium mt-1">{company?.name || t.companyId}</p><p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap">{t.description}</p><p className="text-xs text-slate-400 mt-3">{new Date(t.date).toLocaleString()}</p></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-[320px]">
                <select disabled={loadingId===t.id} className="p-2 border rounded-lg text-sm" value={t.status} onChange={e=>updateTicket(t,{status:e.target.value})}><option value="open">Aberto</option><option value="in_progress">Em atendimento</option><option value="waiting_client">Aguardando cliente</option><option value="closed">Fechado</option></select>
                <select disabled={loadingId===t.id} className="p-2 border rounded-lg text-sm" value={t.assignedUserId || ''} onChange={e=>updateTicket(t,{assignedUserId:e.target.value || null})}><option value="">Sem responsável</option>{users.filter(u=>u.role==='admin').map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>
              </div>
            </div>
          </div>
        })}
      </div>
    </div>
  );
}

function AdminPlaceholder({ title, desc }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-slate-300">
        <Settings size={48} />
      </div>
      <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
      <p className="text-slate-500 mt-2 max-w-md">{desc}</p>
      <p className="text-sm text-blue-600 mt-4 bg-blue-50 px-4 py-2 rounded-full">Módulo pronto para receber integração futura.</p>
    </div>
  );
}

function AdminFinancial() {
  const { companies, setCompanies, financials, setFinancials, generateId, fetchSupabase, getSignedFileUrl } = useContext(AppContext);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedCompanyId, setExpandedCompanyId] = useState(null);
  
  // States para ordenação e filtro
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' ou 'desc'
  const [statusFilter, setStatusFilter] = useState('all');

  // State for Add/Edit
  const [editingId, setEditingId] = useState(null);
  const [companyId, setCompanyId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [installmentsCount, setInstallmentsCount] = useState(1);

  const normalizeMoney = (value) => {
    const raw = String(value).trim();
    const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
    return Number(normalized);
  };

  const handleAddOrEdit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const numericAmount = normalizeMoney(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) { setLoading(false); return alert('Informe um valor válido.'); }
    
    if (editingId) {
      // Edit existing
      const updates = { companyId, description, amount: numericAmount, dueDate };
      await fetchSupabase(`/rest/v1/financials?id=eq.${editingId}`, { method: 'PATCH', body: JSON.stringify(updates) });
      setFinancials(financials.map(f => f.id === editingId ? { ...f, ...updates } : f));
    } else {
      // Add new (batch generation)
      const count = parseInt(installmentsCount, 10) || 1;
      const newFins = [];
      
      // Tratamento nativo para garantir que o fuso horário local não altere o dia no banco
      const [year, month, day] = dueDate.split('-').map(Number);
      const baseDate = new Date(year, month - 1, day);

      for (let i = 0; i < count; i++) {
        const currentDueDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, baseDate.getDate());
        
        const yearStr = currentDueDate.getFullYear();
        const monthStr = String(currentDueDate.getMonth() + 1).padStart(2, '0');
        const dayStr = String(currentDueDate.getDate()).padStart(2, '0');
        const formattedDate = `${yearStr}-${monthStr}-${dayStr}`;
        
        const formattedDesc = count > 1 ? `${description} (${i + 1}/${count})` : description;

        const newFin = {
          id: generateId('FIN'),
          companyId,
          description: formattedDesc,
          amount: numericAmount,
          dueDate: formattedDate,
          status: 'pending',
          receiptUrl: null
        };
        await fetchSupabase('/rest/v1/financials', { method: 'POST', body: JSON.stringify(newFin) });
        newFins.push(newFin);
      }
      
      setFinancials([...newFins, ...financials]);
    }
    
    resetForm();
    setLoading(false);
  };

  const handleEditClick = (fin) => {
    setEditingId(fin.id);
    setCompanyId(fin.companyId);
    setDescription(fin.description);
    setAmount(fin.amount);
    setDueDate(fin.dueDate);
    setInstallmentsCount(1);
    setIsAdding(true);
    setTimeout(() => {
      document.getElementById('admin-financial-top')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleDelete = async (finId) => {
    if (window.confirm('Tem certeza que deseja excluir esta cobrança?')) {
      setLoading(true);
      await fetchSupabase(`/rest/v1/financials?id=eq.${finId}`, { method: 'DELETE' });
      setFinancials(financials.filter(f => f.id !== finId));
      setLoading(false);
    }
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setCompanyId(''); setDescription(''); setAmount(''); setDueDate(''); setInstallmentsCount(1);
  };

  const handleUpdatePlan = async (compId, plan) => {
    await fetchSupabase(`/rest/v1/companies?id=eq.${compId}`, { method: 'PATCH', body: JSON.stringify({ paymentPlan: plan }) });
    setCompanies(companies.map(c => c.id === compId ? { ...c, paymentPlan: plan } : c));
  };

  const handleApprovePayment = async (finId) => {
    setLoading(true);
    await fetchSupabase(`/rest/v1/financials?id=eq.${finId}`, { method: 'PATCH', body: JSON.stringify({ status: 'paid' }) });
    setFinancials(financials.map(f => f.id === finId ? { ...f, status: 'paid' } : f));
    setLoading(false);
  };

  const handleViewReceipt = async (e, path) => {
    e.stopPropagation();
    try {
      // Compatibilidade temporária com comprovantes antigos já salvos como data URL.
      if (path?.startsWith('data:') || path?.startsWith('http')) {
        window.open(path, '_blank', 'noopener,noreferrer');
        return;
      }
      const signedUrl = await getSignedFileUrl('receipts', path);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert(err.message || 'Não foi possível abrir o comprovante.');
    }
  };

  const getCompanyStatus = (compId) => {
    const companyFins = financials.filter(f => f.companyId === compId);
    if (companyFins.length === 0) return { label: 'Sem cobranças', color: 'bg-slate-100 text-slate-600' };
    
    const hasOverdue = companyFins.some(f => f.status === 'pending' && new Date(f.dueDate) < new Date(new Date().setHours(0,0,0,0)));
    if (hasOverdue) return { label: 'Atrasado', color: 'bg-red-100 text-red-700' };
    
    const hasInReview = companyFins.some(f => f.status === 'in_review');
    if (hasInReview) return { label: 'Em Análise', color: 'bg-blue-100 text-blue-700' };
    
    const hasPending = companyFins.some(f => f.status === 'pending');
    if (hasPending) return { label: 'Pendente', color: 'bg-orange-100 text-orange-700' };
    
    return { label: 'Em dia', color: 'bg-emerald-100 text-emerald-700' };
  };

  return (
    <div className="space-y-6" id="admin-financial-top">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Financeiro Administrativo</h1>
          <p className="text-slate-500">Gestão de cobranças e status de pagamento das empresas.</p>
        </div>
        <button onClick={() => { resetForm(); setIsAdding(!isAdding); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={18}/> Nova Parcela (Geral)
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm mb-6">
          <h3 className="font-bold text-slate-800 mb-4">{editingId ? 'Editar Parcela / Cobrança' : 'Configurar Parcela do Cliente'}</h3>
          <form onSubmit={handleAddOrEdit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Empresa</label>
              <select className="w-full p-2 border rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={companyId} onChange={e=>setCompanyId(e.target.value)} required disabled={loading}>
                <option value="">Selecione...</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className={editingId ? 'md:col-span-2' : ''}>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição Base</label>
              <input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder={editingId ? "Ex: Parcela 1/3 - Desenvolvimento" : "Ex: Desenvolvimento"} value={description} onChange={e=>setDescription(e.target.value)} required disabled={loading}/>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$ / un.)</label>
              <input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: 1500,00" value={amount} onChange={e=>setAmount(e.target.value)} required disabled={loading}/>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{editingId ? 'Vencimento' : '1º Vencimento'}</label>
              <input type="date" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={dueDate} onChange={e=>setDueDate(e.target.value)} required disabled={loading}/>
            </div>
            {!editingId && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Qtd. de Parcelas</label>
                <input type="number" min="1" max="100" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={installmentsCount} onChange={e=>setInstallmentsCount(e.target.value)} required disabled={loading}/>
              </div>
            )}
            <div className="md:col-span-5 flex justify-end gap-2 mt-2">
              <button type="button" onClick={resetForm} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded transition-colors" disabled={loading}>Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-70" disabled={loading}>
                {loading ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Gerar Parcelas')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold">Empresa</th>
              <th className="px-6 py-4 font-semibold">Status Geral</th>
              <th className="px-6 py-4 font-semibold text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {companies.map(comp => {
              const status = getCompanyStatus(comp.id);
              const compFins = financials.filter(f => f.companyId === comp.id).sort((a,b) => new Date(b.dueDate) - new Date(a.dueDate));
              const isExpanded = expandedCompanyId === comp.id;
              
              return (
                <React.Fragment key={comp.id}>
                  <tr className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => setExpandedCompanyId(isExpanded ? null : comp.id)}>
                    <td className="px-6 py-4 font-medium text-slate-800 align-middle">{comp.name}</td>
                    <td className="px-6 py-4 align-middle">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${status.color}`}>{status.label}</span>
                    </td>
                    <td className="px-6 py-4 align-middle text-right">
                       {isExpanded ? <ChevronUp size={20} className="text-slate-400 inline-block"/> : <ChevronDown size={20} className="text-slate-400 inline-block"/>}
                    </td>
                  </tr>
                  
                  {isExpanded && (
                    <tr className="bg-slate-50/50">
                      <td colSpan="3" className="px-6 py-6 border-t border-slate-100">
                        <div className="max-w-3xl">
                          <div className="mb-6 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                            <label className="block text-sm font-bold text-slate-800 mb-2">Plano de Pagamento Acordado</label>
                            <select 
                              className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-700"
                              value={comp.paymentPlan || ''}
                              onChange={(e) => handleUpdatePlan(comp.id, e.target.value)}
                            >
                              <option value="">Selecione o plano de pagamento para este cliente...</option>
                              <option value="Avista Total + Mensalidade">Avista Total + Mensalidade (Pago o desenvolvimento e mensalidade de suporte)</option>
                              <option value="Entrada 40% + Diluição + Mensalidade">Entrada 40% + Diluição + Mensalidade (Pago 40% e diluído o resto na mensalidade)</option>
                              <option value="Parcelado total na mensalidade">Parcelado total na mensalidade (Desenvolvimento parcelado nas mensalidades)</option>
                            </select>
                          </div>

                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b pb-2 border-slate-200 gap-3">
                            <h4 className="font-bold text-slate-700">Cobranças Registradas ({compFins.length})</h4>
                            <div className="flex flex-wrap items-center gap-2">
                               <select 
                                  className="text-xs border border-slate-300 rounded-lg p-1.5 bg-white text-slate-600 outline-none focus:ring-1 focus:ring-blue-500"
                                  value={statusFilter}
                                  onChange={(e) => { e.stopPropagation(); setStatusFilter(e.target.value); }}
                               >
                                  <option value="all">Todos os Status</option>
                                  <option value="pending">Aguardando</option>
                                  <option value="in_review">Em Análise</option>
                                  <option value="paid">Pago</option>
                               </select>
                               <select 
                                  className="text-xs border border-slate-300 rounded-lg p-1.5 bg-white text-slate-600 outline-none focus:ring-1 focus:ring-blue-500"
                                  value={sortOrder}
                                  onChange={(e) => { e.stopPropagation(); setSortOrder(e.target.value); }}
                               >
                                  <option value="asc">Vencimento (Mais recentes primeiro)</option>
                                  <option value="desc">Vencimento (Mais antigos primeiro)</option>
                               </select>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  resetForm();
                                  setCompanyId(comp.id);
                                  setIsAdding(true);
                                  setTimeout(() => {
                                    document.getElementById('admin-financial-top')?.scrollIntoView({ behavior: 'smooth' });
                                  }, 100);
                                }}
                                className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors"
                              >
                                <Plus size={14}/> Configurar Nova Parcela
                              </button>
                            </div>
                          </div>
                          {compFins.length === 0 ? <span className="text-slate-400 text-sm">Nenhuma cobrança registrada para este cliente.</span> : (
                            <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-sm">
                              <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
                                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                                  <tr>
                                    <th className="px-4 py-3 font-semibold">Descrição</th>
                                    <th className="px-4 py-3 font-semibold">Valor / Venc.</th>
                                    <th className="px-4 py-3 font-semibold text-center">Status</th>
                                    <th className="px-4 py-3 font-semibold text-right">Ações</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {compFins
                                    .filter(f => statusFilter === 'all' ? true : f.status === statusFilter)
                                    .sort((a,b) => sortOrder === 'asc' ? new Date(b.dueDate) - new Date(a.dueDate) : new Date(a.dueDate) - new Date(b.dueDate))
                                    .map(f => (
                                    <tr key={f.id} className={`hover:bg-slate-50 transition-colors ${f.status === 'paid' ? 'bg-emerald-50/50' : f.status === 'in_review' ? 'bg-blue-50/50' : ''}`}>
                                      <td className={`px-4 py-3 font-medium ${f.status === 'paid' ? 'text-emerald-900' : 'text-slate-800'}`}>
                                        {f.description}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className={`font-bold ${f.status === 'paid' ? 'text-emerald-700' : 'text-blue-600'}`}>R$ {f.amount}</span>
                                        <br/><span className="text-[11px] text-slate-500">{new Date(f.dueDate).toLocaleDateString()}</span>
                                      </td>
                                      <td className="px-4 py-3 text-center align-middle">
                                        {f.status === 'paid' ? (
                                          <div className="flex flex-col items-center">
                                            <span className="text-emerald-600 font-bold flex items-center gap-1 bg-emerald-100 px-2.5 py-1 rounded-full text-[11px] w-max"><CheckCircle2 size={12}/> Pago</span>
                                            {f.receiptUrl && (
                                               (f.receiptUrl.startsWith('http') || f.receiptUrl.startsWith('data:')) ? 
                                               <button onClick={(e) => handleViewReceipt(e, f.receiptUrl)} className="text-blue-600 hover:text-blue-700 font-medium text-[10px] mt-1 flex items-center gap-1"><FileText size={10}/> Visualizar Comprovante</button> :
                                               <span className="text-red-500 font-medium text-[10px] mt-1 flex items-center gap-1" title="O upload falhou por bloqueio no banco de dados"><AlertCircle size={10}/> Falha no Upload</span>
                                            )}
                                          </div>
                                        ) : f.status === 'in_review' ? (
                                          <div className="flex flex-col items-center gap-1">
                                            <span className="text-blue-600 font-bold flex items-center gap-1 bg-blue-100 px-2.5 py-1 rounded-full text-[11px] w-max"><Clock size={12}/> Em Análise</span>
                                            {f.receiptUrl && (
                                               (f.receiptUrl.startsWith('http') || f.receiptUrl.startsWith('data:')) ? 
                                               <button onClick={(e) => handleViewReceipt(e, f.receiptUrl)} className="text-blue-600 hover:text-blue-700 font-medium text-[10px] flex items-center gap-1"><FileText size={10}/> Visualizar Comprovante</button> :
                                               <span className="text-red-500 font-medium text-[10px] flex items-center gap-1" title="O upload falhou por bloqueio no banco de dados"><AlertCircle size={10}/> Falha no Upload</span>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-orange-600 font-bold flex items-center gap-1 bg-orange-100 px-2.5 py-1 rounded-full text-[11px] w-max mx-auto"><Circle size={12}/> Aguardando</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-right align-middle">
                                         <div className="flex items-center justify-end gap-1.5">
                                           {f.status === 'in_review' && <button onClick={(e) => { e.stopPropagation(); handleApprovePayment(f.id); }} disabled={loading} className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1.5 rounded font-bold transition-colors disabled:opacity-70">Aprovar</button>}
                                           <button onClick={(e) => { e.stopPropagation(); handleEditClick(f); }} className="text-[10px] font-medium px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors">Editar</button>
                                           <button onClick={(e) => { e.stopPropagation(); handleDelete(f.id); }} className="text-[10px] font-medium px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors">Excluir</button>
                                         </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClientPortal() {
  const { currentUser, handleLogout } = useContext(AppContext);
  const [currentView, setCurrentView] = useState('home');
  const userBg = currentUser?.preferences?.bgColor || 'bg-slate-200';

  const menuItems = [
    {
      title: 'Menu Principal',
      items: [
        { id: 'home', label: 'Início', icon: LayoutDashboard },
        { id: 'projects', label: 'Meus Projetos', icon: FolderKanban },
        { id: 'support', label: 'Suporte LS', icon: Ticket }
      ]
    },
    {
      title: 'Minha Conta',
      items: [
        { id: 'profile', label: 'Perfil', icon: Users },
        { id: 'financial', label: 'Financeiro', icon: CreditCard },
        { id: 'settings', label: 'Configurações', icon: Settings }
      ]
    }
  ];

  const renderView = () => {
    switch (currentView) {
      case 'home': return <ClientHome />;
      case 'projects': return <ClientProjects />;
      case 'support': return <ClientSupport />;
      case 'profile': return <ClientProfile />;
      case 'financial': return <ClientFinancial />;
      case 'settings': return <ClientSettings />;
      default: return <ClientHome />;
    }
  };

  return (
    <div className={`min-h-screen flex ${userBg} transition-colors duration-300 selection:bg-blue-100`}>
      <Sidebar menuItems={menuItems} currentView={currentView} setView={setCurrentView} onLogout={handleLogout} />
      <div className="ml-64 flex-1 p-10 overflow-y-auto h-screen">
        {renderView()}
      </div>
    </div>
  );
}

function ClientHome() {
  const { currentUser, projects, history } = useContext(AppContext);
  const myProjects = projects.filter(p => p.companyId === currentUser.companyId);
  
  const myHistory = history
    .filter(h => myProjects.some(p => p.id === h.projectId))
    .sort((a,b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Bem-vindo, {currentUser.name.split(' ')[0]}</h1>
        <p className="text-slate-600">Aqui está o resumo da sua operação com a LS.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-2"><FolderKanban size={18}/> Resumo de Projetos</h3>
          {myProjects.length === 0 ? (
            <EmptyState message="Você ainda não possui projetos ativos." />
          ) : (
            <ul className="space-y-3">
              {myProjects.map(p => (
                <li key={p.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-700">{p.name}</span>
                  <span className={`text-xs px-2 py-1 rounded font-bold ${
                    p.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    p.status === 'paused' ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-200 text-slate-700'
                  }`}>
                    {p.status === 'active' ? 'Em Andamento' : p.status === 'paused' ? 'Pausado' : 'Encerrado'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-2"><Clock size={18}/> Últimas Atualizações</h3>
          {myHistory.length === 0 ? (
            <EmptyState message="Nenhuma atualização recente no histórico." />
          ) : (
            <div className="relative border-l-2 border-blue-100 ml-3 space-y-4">
              {myHistory.map(h => {
                const projName = myProjects.find(p=>p.id === h.projectId)?.name;
                return (
                  <div key={h.id} className="pl-4 relative">
                    <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[7px] top-1.5 border-2 border-white"></div>
                    <p className="text-sm font-medium text-slate-800">{h.description}</p>
                    <p className="text-xs text-slate-500">{new Date(h.date).toLocaleDateString()} • {projName}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClientProfile() {
  const { currentUser, companies } = useContext(AppContext);
  const myCompany = companies.find(c => c.id === currentUser.companyId);

  return (
    <div className="max-w-3xl bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 border-b pb-4">Dados Cadastrais</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-4">Seu Perfil</h3>
          <div className="space-y-3">
            <div><label className="text-xs text-slate-500 uppercase">Nome</label><p className="font-medium">{currentUser.name}</p></div>
            <div><label className="text-xs text-slate-500 uppercase">E-mail de acesso</label><p className="font-medium">{currentUser.email}</p></div>
            <div><label className="text-xs text-slate-500 uppercase">Papel</label><p className="font-medium">Cliente Autorizado</p></div>
            {currentUser.cpf && <div><label className="text-xs text-slate-500 uppercase">CPF</label><p className="font-medium">{currentUser.cpf}</p></div>}
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-4">Sua Empresa</h3>
          <div className="space-y-3">
            <div><label className="text-xs text-slate-500 uppercase">Razão Social</label><p className="font-medium">{myCompany?.name || 'Não definida'}</p></div>
            <div><label className="text-xs text-slate-500 uppercase">CNPJ</label><p className="font-medium">{myCompany?.cnpj || 'Não definido'}</p></div>
            <div><label className="text-xs text-slate-500 uppercase">ID no Sistema LS</label><p className="font-mono text-sm text-slate-600">{myCompany?.id}</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClientProjects() {
  const { currentUser, projects, setProjects, contracts, approvals, setApprovals, history, users, fetchSupabase, getSignedFileUrl } = useContext(AppContext);
  const myProjects = projects.filter(p => p.companyId === currentUser.companyId);
  const [activeTab, setActiveTab] = useState('andamento');
  const [selectedProjectId, setSelectedProjectId] = useState(myProjects.length > 0 ? myProjects[0].id : null);

  if (myProjects.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState message="Você não possui projetos vinculados à sua conta no momento." />
      </div>
    );
  }

  const selectedProject = myProjects.find(p => p.id === selectedProjectId);
  const projContracts = contracts.filter(c => c.projectId === selectedProjectId); 
  const projApprovals = approvals.filter(a => a.projectId === selectedProjectId);
  const projHistory = history.filter(h => h.projectId === selectedProjectId).sort((a,b) => new Date(b.date) - new Date(a.date));
  
  const assignedUser = users.find(u => u.id === selectedProject?.assignedUserId);

  const handleApprove = async (approvalId) => {
    const approval = approvals.find(a => a.id === approvalId);
    if (!approval || approval.approved) return;
    const updates = { approved: true, approvedAt: new Date().toISOString(), approvedBy: currentUser.id };
    const res = await fetchSupabase(`/rest/v1/approvals?id=eq.${approvalId}`, { method: 'PATCH', body: JSON.stringify(updates) });
    if (res.error) return alert(res.error.message || 'Não foi possível registrar a aprovação.');
    setApprovals(prev => prev.map(a => a.id === approvalId ? { ...a, ...updates } : a));
  };

  const handleApproveProject = async () => {
    await fetchSupabase(`/rest/v1/projects?id=eq.${selectedProject.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ clientApproved: true, clientApprovedAt: new Date().toISOString(), clientApprovedBy: currentUser.id })
    });
    const newProjects = projects.map(p => p.id === selectedProject.id ? { ...p, clientApproved: true, clientApprovedAt: new Date().toISOString(), clientApprovedBy: currentUser.id } : p);
    setProjects(newProjects);
  };

  const tabs = [
    { id: 'andamento', label: 'Andamento e Detalhes' },
    { id: 'aprovacoes', label: 'Aprovações' }
  ];

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Projetos e Entregas</h1>
        <select 
          className="p-2 border border-slate-300 rounded-lg bg-white shadow-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}
        >
          {myProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
                activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {activeTab === 'andamento' && (
             <div>
               <div className="text-center py-8">
                 <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mb-4">
                    <FolderKanban size={32}/>
                 </div>
                 <h3 className="text-xl font-bold text-slate-800">Status: {
                    selectedProject?.status === 'active' ? 'Em Desenvolvimento' : 
                    selectedProject?.status === 'paused' ? 'Pausado' : 'Encerrado'
                 }</h3>
                 <p className="text-slate-500 mt-2 max-w-md mx-auto">A equipe LS está trabalhando no projeto "{selectedProject?.name}".</p>
               </div>

               <div className="max-w-3xl mx-auto space-y-4">
                 
                 {selectedProject?.observation && (
                   <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                     <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2"><CheckSquare size={16}/> Última Atualização da Equipe</h4>
                     <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedProject.observation}</p>
                   </div>
                 )}

                 {projHistory.length > 0 && (
                   <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                     <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><Clock size={16}/> Atualizações do Projeto</h4>
                     <div className="relative border-l-2 border-slate-200 ml-4 space-y-4">
                       {projHistory.map(h => (
                         <div key={h.id} className="pl-6 relative">
                           <div className="absolute w-3 h-3 bg-white border-2 border-slate-300 rounded-full -left-[7px] top-1"></div>
                           <p className="text-sm font-medium text-slate-800">{h.description}</p>
                           <p className="text-xs text-slate-500 mt-1">{new Date(h.date).toLocaleString()}</p>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}

                 {assignedUser && (
                   <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><Users size={20}/></div>
                      <div>
                        <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Responsável LS</p>
                        <p className="text-sm font-medium text-slate-800">{assignedUser.name}</p>
                      </div>
                   </div>
                 )}

                 {selectedProject?.contractFileName && (
                   <div className="p-4 border border-slate-200 bg-white rounded-xl flex justify-between items-center shadow-sm">
                     <div className="flex items-center gap-3">
                       <FileText className="text-red-500" size={28}/>
                       <div>
                         <p className="font-bold text-slate-800">Contrato Vigente</p>
                         <p className="text-xs text-slate-500">{selectedProject.contractFileName}</p>
                       </div>
                     </div>
                     <button
                       onClick={async () => {
                         try {
                           if (!selectedProject.contractStoragePath) return alert('Arquivo do contrato ainda não foi enviado.');
                           const url = await getSignedFileUrl('contracts', selectedProject.contractStoragePath);
                           window.open(url, '_blank', 'noopener,noreferrer');
                         } catch (err) {
                           alert(err.message || 'Não foi possível abrir o contrato.');
                         }
                       }}
                       className="text-blue-600 text-sm font-bold bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors"
                     >
                       Abrir PDF
                     </button>
                   </div>
                 )}

               </div>
             </div>
          )}

          {activeTab === 'aprovacoes' && (
             <div className="space-y-4">
              <h3 className="font-semibold text-slate-700 mb-4">Aprovações Pendentes / Concluídas</h3>
              
              {!selectedProject?.clientApproved ? (
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
                  <div>
                    <h4 className="font-bold text-orange-800 flex items-center gap-2"><AlertCircle size={18}/> Aprovação do Projeto Pendente</h4>
                    <p className="text-sm text-orange-700 mt-1">Confirme o início e o escopo deste projeto. <strong>Esta ação é única e irreversível.</strong></p>
                  </div>
                  <button onClick={handleApproveProject} className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm whitespace-nowrap">
                    Aprovar Projeto
                  </button>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3 shadow-sm">
                  <CheckCircle2 className="text-emerald-600 flex-shrink-0" size={24} />
                  <div>
                    <h4 className="font-bold text-emerald-800">Projeto Aprovado</h4>
                    <p className="text-sm text-emerald-700">Aprovado pelo cliente oficialmente na plataforma.</p>
                  </div>
                </div>
              )}

              {projApprovals.length === 0 ? <EmptyState message="Nenhuma aprovação adicional solicitada para este projeto ainda." /> : 
                <ul className="space-y-3">
                  {projApprovals.map(a => (
                    <li key={a.id} className={`p-4 border rounded-lg flex items-start gap-4 transition-colors ${a.approved ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                      <button onClick={() => handleApprove(a.id)} className={`mt-1 rounded-full flex-shrink-0 transition-colors ${a.approved ? 'text-emerald-500' : 'text-slate-300 hover:text-blue-500'}`}>
                        {a.approved ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                      </button>
                      <div>
                        <p className={`font-medium ${a.approved ? 'text-emerald-800' : 'text-slate-800'}`}>{a.title}</p>
                        <p className={`text-xs mt-1 ${a.approved ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {a.approved ? 'Aprovado por você' : 'Aguardando sua revisão e aprovação (Clique no círculo para aprovar)'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClientSupport() {
  const { currentUser, tickets, setTickets, generateId, fetchSupabase } = useContext(AppContext);
  const myTickets = tickets.filter(t => t.companyId === currentUser.companyId);
  
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [isOpening, setIsOpening] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newTicket = {
      id: generateId('TCK'),
      companyId: currentUser.companyId,
      title,
      description: desc,
      status: 'open',
      date: new Date().toISOString()
    };
    await fetchSupabase('/rest/v1/tickets', { method: 'POST', body: JSON.stringify(newTicket) });
    setTickets([newTicket, ...tickets]);
    setTitle(''); setDesc(''); setIsOpening(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Suporte</h1>
          <p className="text-slate-600">Acompanhe seus chamados ou abra uma nova solicitação.</p>
        </div>
        {!isOpening && (
          <button onClick={()=>setIsOpening(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">
            Abrir Novo Chamado
          </button>
        )}
      </div>

      {isOpening && (
        <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">Descreva sua necessidade</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assunto Breve</label>
              <input type="text" className="w-full p-2 border rounded" value={title} onChange={e=>setTitle(e.target.value)} required placeholder="Ex: Erro ao acessar módulo X" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição Detalhada</label>
              <textarea className="w-full p-2 border rounded h-32" value={desc} onChange={e=>setDesc(e.target.value)} required placeholder="Descreva o que ocorreu..."></textarea>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsOpening(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Enviar Solicitação</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
         {myTickets.length === 0 ? (
           <div className="p-8"><EmptyState message="Nenhum chamado aberto no histórico." /></div>
         ) : (
           <ul className="divide-y divide-slate-100">
             {myTickets.map(t => (
               <li key={t.id} className="p-6 hover:bg-slate-50">
                 <div className="flex justify-between items-start mb-2">
                   <h4 className="font-bold text-slate-800 text-lg">{t.title}</h4>
                   <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${t.status === 'open' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                     {t.status === 'open' ? 'Aberto' : 'Fechado'}
                   </span>
                 </div>
                 <p className="text-slate-600 text-sm mb-3">{t.description}</p>
                 <p className="text-xs text-slate-400">Aberto em: {new Date(t.date).toLocaleString()} • ID: {t.id}</p>
               </li>
             ))}
           </ul>
         )}
      </div>
    </div>
  );
}

function ClientFinancial() {
  const { currentUser, financials, setFinancials, fetchSupabase, companies, uploadPrivateFile, sanitizeFileName } = useContext(AppContext);
  const myFinancials = financials.filter(f => f.companyId === currentUser.companyId);
  const [loading, setLoading] = useState(false);
  const myCompany = companies.find(c => c.id === currentUser.companyId);
  
  // States para ordenação e seleção
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' ou 'desc'
  const [selectedPayId, setSelectedPayId] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const handleUploadReceipt = async (finId, file) => {
    if (!file) return;
    setLoading(true);
    try {
      const safeName = sanitizeFileName(file.name);
      const storagePath = `${currentUser.companyId}/${finId}/${Date.now()}-${safeName}`;
      const uploadedPath = await uploadPrivateFile('receipts', storagePath, file);
      const updates = { receiptUrl: uploadedPath, status: 'in_review' };
      const res = await fetchSupabase(`/rest/v1/financials?id=eq.${finId}`, { method: 'PATCH', body: JSON.stringify(updates) });
      if (res.error) throw new Error(res.error.message || 'Falha ao registrar comprovante.');
      setFinancials(prev => prev.map(f => f.id === finId ? { ...f, ...updates } : f));
      setSelectedPayId('');
      setSelectedFile(null);
    } catch (err) {
      alert(err.message || 'Erro ao enviar comprovante.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Financeiro</h1>
        <p className="text-slate-600">Portal de pagamentos, envio de comprovantes e histórico de faturas.</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1">Plano de Pagamento Vigente</h3>
          <p className="text-lg font-black text-blue-900">{myCompany?.paymentPlan || 'Plano em definição pelo administrador'}</p>
        </div>
        <CreditCard className="text-blue-300 hidden sm:block" size={48} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
        {myFinancials.length === 0 ? (
          <div>
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Tudo em dia!</h3>
            <p className="text-slate-500 mt-2">Você não possui faturas ou pendências financeiras no momento.</p>
          </div>
        ) : (
          <div className="text-left">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b pb-2 gap-3">
               <h3 className="font-semibold">Suas Parcelas e Cobranças</h3>
               <select 
                  className="text-xs border border-slate-300 rounded-lg p-1.5 bg-white text-slate-600 outline-none focus:ring-1 focus:ring-blue-500"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
               >
                  <option value="asc">Vencimento (Mais recentes primeiro)</option>
                  <option value="desc">Vencimento (Mais antigos primeiro)</option>
               </select>
            </div>

            {myFinancials.some(f => f.status === 'pending') && (
                <div className="mb-6 bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm text-left">
                   <label className="block text-sm font-bold text-slate-800 mb-2">Selecione a parcela que deseja pagar:</label>
                   <select 
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-700"
                      value={selectedPayId}
                      onChange={(e) => { setSelectedPayId(e.target.value); setSelectedFile(null); }}
                   >
                      <option value="">Nenhuma selecionada...</option>
                      {myFinancials.filter(f => f.status === 'pending').sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate)).map(f => (
                         <option key={f.id} value={f.id}>{f.description} - Vencimento: {new Date(f.dueDate).toLocaleDateString()} - R$ {f.amount}</option>
                      ))}
                   </select>

                   {selectedPayId && (
                      <div className="mt-4 bg-blue-50/80 p-4 rounded-lg border border-blue-200">
                         <label className="text-xs text-slate-700 font-semibold block mb-2">Faça o upload do comprovante de pagamento:</label>
                         <input 
                            type="file" 
                            accept="image/*,.pdf" 
                            className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                            onChange={e => setSelectedFile(e.target.files[0])}
                            disabled={loading}
                         />
                         {selectedFile && (
                            <button 
                              onClick={() => handleUploadReceipt(selectedPayId, selectedFile)}
                              disabled={loading}
                              className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-2.5 px-4 rounded-lg transition-colors disabled:opacity-70 shadow-sm"
                            >
                              {loading ? 'Enviando...' : 'Enviar pagamento'}
                            </button>
                         )}
                      </div>
                   )}
                </div>
            )}

            <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-sm">
              <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Descrição da Parcela</th>
                    <th className="px-5 py-4 font-semibold">Vencimento</th>
                    <th className="px-5 py-4 font-semibold">Valor</th>
                    <th className="px-5 py-4 font-semibold text-right">Status do Pagamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myFinancials.sort((a,b) => sortOrder === 'asc' ? new Date(b.dueDate) - new Date(a.dueDate) : new Date(a.dueDate) - new Date(b.dueDate)).map(f => (
                     <tr key={f.id} className={`hover:bg-slate-50 transition-all ${f.status === 'paid' ? 'bg-emerald-50/40' : f.status === 'in_review' ? 'bg-blue-50/40' : ''}`}>
                       <td className={`px-5 py-4 font-bold ${f.status === 'paid' ? 'text-emerald-900' : f.status === 'in_review' ? 'text-blue-900' : 'text-slate-800'}`}>
                         {f.description}
                       </td>
                       <td className={`px-5 py-4 font-medium ${f.status === 'paid' ? 'text-emerald-700' : f.status === 'in_review' ? 'text-blue-700' : 'text-slate-600'}`}>
                         {new Date(f.dueDate).toLocaleDateString()}
                       </td>
                       <td className={`px-5 py-4 font-black ${f.status === 'paid' ? 'text-emerald-700' : f.status === 'in_review' ? 'text-blue-700' : 'text-blue-600'}`}>
                         R$ {f.amount}
                       </td>
                       <td className="px-5 py-4 text-right align-middle">
                         {f.status === 'paid' ? (
                           <div className="flex flex-col items-end">
                             <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 w-max ml-auto">
                               <CheckCircle2 size={14}/> Pagamento Aprovado
                             </span>
                             {f.receiptUrl && <span className="text-[11px] font-medium text-slate-500 mt-1.5 flex items-center gap-1 justify-end"><FileText size={12}/> Comprovante: {f.receiptUrl.startsWith('data:') ? 'Anexado no sistema' : f.receiptUrl}</span>}
                           </div>
                         ) : f.status === 'in_review' ? (
                           <div className="flex flex-col items-end">
                             <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 w-max ml-auto">
                               <Clock size={14}/> Em Análise
                             </span>
                             <span className="text-[11px] font-medium text-blue-600 mt-1.5">Aguardando aprovação do admin.</span>
                           </div>
                         ) : (
                           <div className="flex flex-col items-end">
                             <span className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 w-max ml-auto">
                               <Circle size={14}/> Aguardando Pagamento
                             </span>
                           </div>
                         )}
                       </td>
                     </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ClientSettings() {
  const { currentUser, updateUserPreferences } = useContext(AppContext);
  
  const colors = [
    { name: 'Padrão (Cinza Claro)', class: 'bg-slate-200' },
    { name: 'Branco Puro', class: 'bg-white' },
    { name: 'Azul Suave', class: 'bg-blue-50' },
    { name: 'Verde Suave', class: 'bg-emerald-50' },
    { name: 'Quente Suave', class: 'bg-orange-50' }
  ];

  return (
    <div className="max-w-2xl bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Configurações de Visualização</h2>
        <p className="text-slate-500 text-sm mt-1">Personalize a aparência do seu portal.</p>
      </div>

      <div>
        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><PaintBucket size={18}/> Cor de Fundo do Portal</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {colors.map(color => (
            <button
              key={color.class}
              onClick={() => updateUserPreferences({ bgColor: color.class })}
              className={`p-4 border rounded-lg flex items-center justify-between transition-all ${
                currentUser.preferences?.bgColor === color.class ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="text-sm font-medium text-slate-700">{color.name}</span>
              <div className={`w-6 h-6 rounded-full border border-slate-300 ${color.class}`}></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Utility Components
function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <AlertCircle className="text-slate-300 mb-3" size={32} />
      <p className="text-slate-500 text-sm">{message}</p>
    </div>
  );
}
