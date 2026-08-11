import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  LayoutDashboard, Users, FolderKanban, Settings, LogOut, 
  Ticket, FileText, CheckSquare, Clock, CreditCard, PaintBucket, 
  Plus, Search, Building2, Briefcase, Link as LinkIcon, DollarSign,
  UserPlus, ShieldAlert, CheckCircle2, Circle, AlertCircle, ChevronDown, ChevronUp,
  Hexagon, Diamond
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

// --- SUPABASE CONFIGURATION ---
const supabaseUrl = 'https://zguultsumjizmgjfypoi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpndXVsdHN1bWppem1namZ5cG9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTg2ODcsImV4cCI6MjA5NjQzNDY4N30.qBBZb0F_pf3QnofXMlAsuauJYXj4zwe-snrfxyAX_CA';

// Helper nativo para integrações com REST API do Supabase
const fetchSupabase = async (path, options = {}) => {
  try {
    const res = await fetch(`${supabaseUrl}${path}`, {
      ...options,
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...(options.headers || {})
      }
    });
    const data = await res.json();
    return { data: res.ok ? data : null, error: res.ok ? null : data };
  } catch (err) {
    return { data: null, error: err };
  }
};

// --- CONTEXT & INITIAL STATE ---
const AppContext = createContext();

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [projects, setProjects] = useState([]);
  
  const [tickets, setTickets] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [history, setHistory] = useState([]);
  const [financials, setFinancials] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      const comps = await fetchSupabase('/rest/v1/companies?select=*');
      if (comps.data) setCompanies(comps.data);

      const projs = await fetchSupabase('/rest/v1/projects?select=*');
      if (projs.data) setProjects(projs.data);

      const profs = await fetchSupabase('/rest/v1/profiles?select=*');
      if (profs.data) setUsers(profs.data);

      const tks = await fetchSupabase('/rest/v1/tickets?select=*');
      if (tks.data) setTickets(tks.data);
      
      const hist = await fetchSupabase('/rest/v1/history?select=*');
      if (hist.data) setHistory(hist.data);
      
      const ctrs = await fetchSupabase('/rest/v1/contracts?select=*');
      if (ctrs.data) setContracts(ctrs.data);
      
      const apps = await fetchSupabase('/rest/v1/approvals?select=*');
      if (apps.data) setApprovals(apps.data);
      
      const fins = await fetchSupabase('/rest/v1/financials?select=*');
      if (fins.data) setFinancials(fins.data);
    };
    loadData();
  }, []);

  const handleLogin = async (email, password) => {
    try {
      const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: supabaseKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const authData = await authRes.json();

      if (authRes.ok && authData.user) {
        const profRes = await fetchSupabase(`/rest/v1/profiles?id=eq.${authData.user.id}`);

        if (profRes.data && profRes.data.length > 0) {
           setCurrentUser(profRes.data[0]);
           return true;
        }
      } 
      
      // Fallback de Segurança: Permite o login das contas de demonstração contornando bloqueios do Supabase
      if (email === 'jonathanpinheiro.ti@outlook.com' && password === 'K1nder$202525') {
         const adminProfile = users.find(u => u.email === email);
         if (adminProfile) {
            setCurrentUser(adminProfile);
            return true;
         }
         
         const signUpRes = await fetch(`${supabaseUrl}/auth/v1/signup`, {
            method: 'POST',
            headers: { apikey: supabaseKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
         });
         const signUpData = await signUpRes.json();
         
         if (signUpRes.ok && signUpData.user) {
            const adminData = {
               id: signUpData.user.id,
               role: 'admin',
               name: 'Jonathan Pinheiro',
               email: email,
               companyId: null,
               preferences: { bgColor: 'bg-slate-200' }
            };
            await fetchSupabase('/rest/v1/profiles', { method: 'POST', body: JSON.stringify(adminData) });
            setCurrentUser(adminData);
            return true;
         }
      }

      if (email === 'contato@alpha.com' && password === '123456') {
         const clientProfile = users.find(u => u.email === email);
         if (clientProfile) {
            setCurrentUser(clientProfile);
            return true;
         }
      }
      
      console.error("Detalhes do erro Auth:", authData);
    } catch (err) {
      console.error("Erro na requisição de login:", err);
    }
    
    return false;
  };

  const handleLogout = () => setCurrentUser(null);

  const generateId = (prefix) => `${prefix}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  const contextValue = {
    currentUser, users, setUsers, companies, setCompanies,
    projects, setProjects, tickets, setTickets, contracts, setContracts,
    approvals, setApprovals, history, setHistory, financials, setFinancials,
    handleLogout, generateId, fetchSupabase, supabaseUrl, supabaseKey,
    updateUserPreferences: async (prefs) => {
      if(!currentUser) return;
      const updatedUser = { ...currentUser, preferences: { ...currentUser.preferences, ...prefs } };
      
      await fetchSupabase(`/rest/v1/profiles?id=eq.${currentUser.id}`, { 
        method: 'PATCH', 
        body: JSON.stringify({ preferences: updatedUser.preferences }) 
      });

      const userIndex = users.findIndex(u => u.id === currentUser.id);
      if (userIndex > -1) {
        const newUsers = [...users];
        newUsers[userIndex] = updatedUser;
        setUsers(newUsers);
      }
      setCurrentUser(updatedUser);
    }
  };

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
          
          <div className="mt-6 p-4 bg-blue-50/50 rounded-xl text-center text-xs text-slate-500 border border-blue-100/50">
            <p className="font-semibold text-slate-600 mb-1">Acessos de Demonstração:</p>
            <p>Admin: jonathanpinheiro.ti@outlook.com / K1nder$202525</p>
            <p className="mt-1">Cliente: contato@alpha.com / 123456</p>
          </div>
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
        { id: 'projects', label: 'Projetos', icon: FolderKanban }
      ]
    },
    {
      title: 'Gestão',
      items: [
        { id: 'integrations', label: 'Integrações', icon: LinkIcon },
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
      case 'integrations': return <AdminPlaceholder title="Integrações" desc="Configurações de APIs e integrações de terceiros." />;
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
  const { companies, users } = useContext(AppContext);
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Lista de Clientes</h1>
          <p className="text-slate-500">Gestão detalhada de empresas cadastradas.</p>
        </div>
      </div>

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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map(comp => (
                <tr key={comp.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono text-xs">{comp.id}</td>
                  <td className="px-6 py-4 font-medium text-slate-800">{comp.name}</td>
                  <td className="px-6 py-4">{comp.cnpj || 'Não informado'}</td>
                  <td className="px-6 py-4">
                    {users.filter(u => u.companyId === comp.id).length} usuários
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
  const { companies, setCompanies, generateId, users, setUsers, fetchSupabase, supabaseUrl, supabaseKey } = useContext(AppContext);
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const newCompanyId = generateId('CMP');
    const newCompany = { id: newCompanyId, name, cnpj };
    
    await fetchSupabase('/rest/v1/companies', { method: 'POST', body: JSON.stringify(newCompany) });
    setCompanies([...companies, newCompany]);

    if (clientEmail && clientPassword) {
      const authRes = await fetch(`${supabaseUrl}/auth/v1/signup`, {
         method: 'POST',
         headers: { apikey: supabaseKey, 'Content-Type': 'application/json' },
         body: JSON.stringify({ email: clientEmail, password: clientPassword })
      });
      const authData = await authRes.json();

      if (authRes.ok && authData.user) {
        const newProfile = {
          id: authData.user.id,
          role: 'client',
          companyId: newCompanyId,
          name: `Contato - ${name}`,
          email: clientEmail,
          preferences: { bgColor: 'bg-slate-50' }
        };
        await fetchSupabase('/rest/v1/profiles', { method: 'POST', body: JSON.stringify(newProfile) });
        setUsers([...users, newProfile]);
      }
    }

    setSuccess(`Empresa ${name} cadastrada com sucesso! ID: ${newCompanyId}`);
    setName(''); setCnpj(''); setClientEmail(''); setClientPassword('');
    setLoading(false);
    setTimeout(() => setSuccess(''), 5000);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
      <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Building2 className="text-blue-600"/> Cadastrar Nova Empresa
      </h2>
      
      {success && <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg border border-green-200">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-700 border-b pb-2">Dados da Empresa</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome / Razão Social</label>
              <input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500" value={name} onChange={e => setName(e.target.value)} required disabled={loading} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
              <input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500" value={cnpj} onChange={e => setCnpj(e.target.value)} disabled={loading} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-slate-700 border-b pb-2">Acesso do Cliente (Opcional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail de Acesso</label>
              <input type="email" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500" value={clientEmail} onChange={e => setClientEmail(e.target.value)} disabled={loading} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha Padrão</label>
              <input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500" value={clientPassword} onChange={e => setClientPassword(e.target.value)} disabled={loading} />
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 font-medium transition disabled:opacity-70">
          {loading ? 'Cadastrando...' : 'Cadastrar Empresa'}
        </button>
      </form>
    </div>
  );
}

function AdminRegisterAdmin() {
  const { users, setUsers, fetchSupabase, supabaseUrl, supabaseKey } = useContext(AppContext);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const authRes = await fetch(`${supabaseUrl}/auth/v1/signup`, {
       method: 'POST',
       headers: { apikey: supabaseKey, 'Content-Type': 'application/json' },
       body: JSON.stringify({ email, password })
    });
    const authData = await authRes.json();

    if (authRes.ok && authData.user) {
      const newProfile = {
        id: authData.user.id,
        role: 'admin',
        name, 
        email,
        companyId: null,
        preferences: { bgColor: 'bg-slate-200' }
      };
      
      await fetchSupabase('/rest/v1/profiles', { method: 'POST', body: JSON.stringify(newProfile) });
      setUsers([...users, newProfile]);
      setSuccess(`Administrador ${name} criado com sucesso no banco de dados.`);
      setName(''); setEmail(''); setPassword('');
    } else {
      setSuccess('Erro ao criar Auth no Supabase: ' + (authData.msg || 'Erro desconhecido'));
    }
    
    setLoading(false);
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <div className="max-w-xl mx-auto bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
      <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <ShieldAlert className="text-blue-600"/> Cadastrar Novo Administrador LS
      </h2>
      
      {success && <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
          <input type="text" className="w-full p-2 border rounded" value={name} onChange={e => setName(e.target.value)} required disabled={loading} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
          <input type="email" className="w-full p-2 border rounded" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
          <input type="text" className="w-full p-2 border rounded" value={password} onChange={e => setPassword(e.target.value)} required disabled={loading} />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-slate-800 text-white p-3 rounded-lg hover:bg-slate-900 transition disabled:opacity-70">
          {loading ? 'Gravando...' : 'Cadastrar Administrador'}
        </button>
      </form>
    </div>
  );
}

function AdminProjects() {
  const { projects, setProjects, companies, users, generateId, history, setHistory, fetchSupabase } = useContext(AppContext);
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
  const [editStatus, setEditStatus] = useState('active');
  
  // State para nova observação (histórico)
  const [newObservation, setNewObservation] = useState('');

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
    setEditStatus(proj.status || 'active');
    setNewObservation('');
    setIsAdding(false);
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    setLoading(true);
    const updates = {
      observation: editObservation,
      assignedUserId: editAssignedUser,
      contractFileName: editContractFile,
      status: editStatus
    };

    await fetchSupabase(`/rest/v1/projects?id=eq.${viewingProject.id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });

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
    setLoading(false);
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
                  <span className="font-medium flex items-center gap-2">{viewingProject.contractFileName ? <><FileText size={14} className="text-blue-400"/> {viewingProject.contractFileName}</> : 'Nenhum arquivo anexado'}</span>
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
  const { companies, setCompanies, financials, setFinancials, generateId, fetchSupabase } = useContext(AppContext);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedCompanyId, setExpandedCompanyId] = useState(null);
  
  // State for Add/Edit
  const [editingId, setEditingId] = useState(null);
  const [companyId, setCompanyId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [installmentsCount, setInstallmentsCount] = useState(1);

  const handleAddOrEdit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    if (editingId) {
      // Edit existing
      const updates = { companyId, description, amount, dueDate };
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
          amount,
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

  const getCompanyStatus = (compId) => {
    const companyFins = financials.filter(f => f.companyId === compId);
    if (companyFins.length === 0) return { label: 'Sem cobranças', color: 'bg-slate-100 text-slate-600' };
    
    const hasOverdue = companyFins.some(f => f.status === 'pending' && new Date(f.dueDate) < new Date(new Date().setHours(0,0,0,0)));
    if (hasOverdue) return { label: 'Atrasado', color: 'bg-red-100 text-red-700' };
    
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

                          <div className="flex justify-between items-center mb-4 border-b pb-2 border-slate-200">
                            <h4 className="font-bold text-slate-700">Cobranças Registradas ({compFins.length})</h4>
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
                          {compFins.length === 0 ? <span className="text-slate-400 text-sm">Nenhuma cobrança registrada para este cliente.</span> : (
                            <div className="space-y-3">
                              {compFins.map(f => (
                                <div key={f.id} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between border p-4 rounded-xl shadow-sm transition-colors ${f.status === 'paid' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                                  <div className="flex-1">
                                    <p className={`font-bold ${f.status === 'paid' ? 'text-emerald-900' : 'text-slate-800'}`}>{f.description}</p>
                                    <p className={`mt-1 text-xs ${f.status === 'paid' ? 'text-emerald-700' : 'text-slate-500'}`}>Valor: <span className={`font-bold ${f.status === 'paid' ? 'text-emerald-700' : 'text-blue-600'}`}>R$ {f.amount}</span> • Vencimento: {new Date(f.dueDate).toLocaleDateString()}</p>
                                  </div>
                                  
                                  <div className="flex items-center gap-4 mt-3 sm:mt-0 w-full sm:w-auto justify-end">
                                     <div className="flex gap-2">
                                       <button onClick={(e) => { e.stopPropagation(); handleEditClick(f); }} className="text-xs font-medium px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors">Editar</button>
                                       <button onClick={(e) => { e.stopPropagation(); handleDelete(f.id); }} className="text-xs font-medium px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors">Excluir</button>
                                     </div>
                                  
                                    <div className="text-right border-l pl-4 ml-2">
                                      {f.status === 'paid' ? (
                                        <div className="flex flex-col items-end">
                                          <span className="text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-3 py-1 rounded-full text-xs"><CheckCircle2 size={14}/> Pago</span>
                                          {f.receiptUrl && <a href="#" onClick={(e)=>e.preventDefault()} className="text-blue-600 hover:text-blue-700 font-medium text-[11px] mt-1.5 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded transition-colors"><FileText size={12}/> Comprovante: {f.receiptUrl}</a>}
                                        </div>
                                      ) : (
                                        <span className="text-orange-600 font-bold flex items-center gap-1 bg-orange-50 px-3 py-1 rounded-full text-xs"><Circle size={14}/> Aguardando</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
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
  const { currentUser, projects, setProjects, contracts, approvals, setApprovals, history, users, fetchSupabase } = useContext(AppContext);
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
    if(!approval) return;
    await fetchSupabase(`/rest/v1/approvals?id=eq.${approvalId}`, {
      method: 'PATCH',
      body: JSON.stringify({ approved: !approval.approved })
    });
    setApprovals(approvals.map(a => a.id === approvalId ? { ...a, approved: !a.approved } : a));
  };

  const handleApproveProject = async () => {
    await fetchSupabase(`/rest/v1/projects?id=eq.${selectedProject.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ clientApproved: true })
    });
    const newProjects = projects.map(p => p.id === selectedProject.id ? { ...p, clientApproved: true } : p);
    setProjects(newProjects);
  };

  const tabs = [
    { id: 'andamento', label: 'Andamento e Detalhes' },
    { id: 'contratos', label: 'Contratos Anteriores' },
    { id: 'aprovacoes', label: 'Aprovações' },
    { id: 'historico', label: 'Histórico' }
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
                     <button className="text-blue-600 text-sm font-bold bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors">
                       Baixar PDF
                     </button>
                   </div>
                 )}

               </div>
             </div>
          )}

          {activeTab === 'contratos' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-700 mb-4">Contratos Anteriores</h3>
              {projContracts.length === 0 ? <EmptyState message="Nenhum contrato histórico localizado para este projeto." /> : 
                <ul className="space-y-3">
                  {projContracts.map(c => (
                    <li key={c.id} className="flex justify-between items-center p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <FileText className="text-slate-400" size={24}/>
                        <div>
                          <p className="font-medium text-slate-800">{c.title}</p>
                          <p className="text-xs text-slate-500">Adicionado em {c.date}</p>
                        </div>
                      </div>
                      <button className="text-blue-600 text-sm font-medium hover:underline">Visualizar PDF</button>
                    </li>
                  ))}
                </ul>
              }
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

          {activeTab === 'historico' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-700 mb-4">Histórico de Alterações</h3>
              {projHistory.length === 0 ? <EmptyState message="Nenhum histórico registrado." /> : 
                <div className="relative border-l-2 border-slate-200 ml-4 space-y-6">
                  {projHistory.map(h => (
                    <div key={h.id} className="pl-6 relative">
                      <div className="absolute w-4 h-4 bg-white border-2 border-slate-300 rounded-full -left-[9px] top-0.5"></div>
                      <p className="text-sm font-medium text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100">{h.description}</p>
                      <p className="text-xs text-slate-500 mt-2">{new Date(h.date).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
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
  const { currentUser, financials, setFinancials, fetchSupabase, companies } = useContext(AppContext);
  const myFinancials = financials.filter(f => f.companyId === currentUser.companyId).sort((a,b) => new Date(b.dueDate) - new Date(a.dueDate));
  const [loading, setLoading] = useState(false);
  const myCompany = companies.find(c => c.id === currentUser.companyId);

  const handleUploadReceipt = async (finId, file) => {
    if(!file) return;
    setLoading(true);
    const updates = { receiptUrl: file.name, status: 'paid' };
    await fetchSupabase(`/rest/v1/financials?id=eq.${finId}`, { method: 'PATCH', body: JSON.stringify(updates) });
    setFinancials(financials.map(f => f.id === finId ? { ...f, ...updates } : f));
    setLoading(false);
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
            <h3 className="font-semibold mb-4 border-b pb-2">Suas Parcelas e Cobranças</h3>
            <ul className="space-y-4">
              {myFinancials.map(f => (
                 <li key={f.id} className={`p-5 border rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all ${f.status === 'paid' ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-white border-blue-200 shadow-md'}`}>
                   <div>
                     <p className={`font-bold text-lg ${f.status === 'paid' ? 'text-emerald-900' : 'text-slate-800'}`}>{f.description}</p>
                     <p className={`text-sm mt-1 ${f.status === 'paid' ? 'text-emerald-700' : 'text-slate-500'}`}>Vencimento: {new Date(f.dueDate).toLocaleDateString()}</p>
                     <p className={`font-black mt-1 ${f.status === 'paid' ? 'text-emerald-700' : 'text-blue-600'}`}>R$ {f.amount}</p>
                   </div>
                   
                   <div className="text-right w-full sm:w-auto">
                     {f.status === 'paid' ? (
                       <div className="flex flex-col items-end">
                         <span className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2">
                           <CheckCircle2 size={18}/> Pagamento Confirmado
                         </span>
                         {f.receiptUrl && <span className="text-xs font-medium text-slate-500 mt-2 flex items-center gap-1"><FileText size={12}/> Comprovante: {f.receiptUrl}</span>}
                       </div>
                     ) : (
                       <div className="flex flex-col items-end gap-3 w-full">
                         <span className="bg-orange-100 text-orange-700 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2">
                           <Circle size={18}/> Aguardando Pagamento
                         </span>
                         <div className="mt-2 text-left w-full bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                           <label className="text-xs text-slate-600 font-semibold block mb-2">Fazer upload do comprovante:</label>
                           <input 
                             type="file" 
                             accept="image/*,.pdf" 
                             className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                             onChange={e => handleUploadReceipt(f.id, e.target.files[0])}
                             disabled={loading}
                           />
                         </div>
                       </div>
                     )}
                   </div>
                 </li>
              ))}
            </ul>
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
