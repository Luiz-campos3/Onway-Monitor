import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';


import {
  Zap, Calendar, User, LogOut, LayoutDashboard, History, CheckCircle2,
  AlertCircle, Download, Eye, EyeOff, Menu, X, Activity, ArrowLeft, Mail,
  Users, Plus, Trash2, Save, Search, Settings, Cpu, Lock, Key, Bell, Server,
  Map, Upload, Image as ImageIcon, Layers
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart,
  Area, BarChart, Bar
} from 'recharts';

// --- CONFIGURAÇÃO SUPABASE ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Tenta conectar se as chaves existirem
let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn("Faltam chaves do Supabase no .env");
}

// ===============================
// 📌 Gera timestamps UNIX de hoje (início e fim do dia)
// ===============================
// ===============================
// 📌 Gera timestamps UNIX de hoje (início e fim do dia)
// ===============================
function getUnixRangeOfToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  const start = Math.floor(new Date(year, month, day, 0, 0, 0).getTime() / 1000);
  const end = Math.floor(new Date(year, month, day, 23, 59, 59).getTime() / 1000);

  return { start, end };
}

// ===============================
// 🔥 Buscar potência do dia (para o gráfico)
// ===============================
async function fetchPotenciaHoje(clienteId) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("view_potencia_grafico")
    .select("hora, kwh, acumulado_kwh, data_hora")
    .eq("id_cliente", clienteId)
    .order("data_hora", { ascending: true });

  if (error) {
    console.error("Erro ao buscar potência:", error);
    return [];
  }

  console.log("📊 Dados da view potencia_grafico:", data);

  // Aqui você escolhe qual tipo de gráfico quer usar:
  // -> acumulado_kwh  (curva do dia)
  // -> kwh            (potência instantânea)

  return data.map(row => ({
    time: row.hora,            // eixo X
    val: row.kwh    // valor acumulado em kWh
  }));
}


// ===============================
// 🔥 FUNÇÃO: Somar ENWH do dia (kWh)
// ===============================
// 🔥 Função: Somar ENWH do dia (kWh)
// Função: Somar ENWH do dia (kWh)
async function fetchGeracaoDia(clienteId) {
  if (!supabase) return 0;

  try {
    // Consulta o total de geração de energia do cliente na view
    const { data, error } = await supabase
      .from('view_geracao_diaria')  // Acessa a view
      .select('total_enwh')  // Seleciona o total de enwh
      .eq('id_cliente', clienteId)  // Filtra pelo cliente
      .eq('data', new Date().toISOString().split('T')[0]);  // Filtra pelo dia atual (CURRENT_DATE)

    if (error) {
      console.error("Erro ao consultar geração diária:", error);
      return 0;
    }

    // Se não houver dados, retorna 0
    if (!data || data.length === 0) {
      console.log("Nenhum dado encontrado para o dia de hoje.");
      return 0;
    }

    // Converte o total_enwh para kWh (dividindo por 1000)
    const totalKWh = (data[0].total_enwh / 1000).toFixed(2);

    console.log("Total gerado de hoje (kWh):", totalKWh);

    return Number(totalKWh);  // Retorna o total gerado em kWh
  } catch (error) {
    console.error("Erro ao calcular a geração do dia:", error);
    return 0;
  }
}
  

// Função para obter o Access Token usando email e senha
async function getAccessToken() {
  const email = process.env.ENPHASE_USER_EMAIL;   // Email do usuário
  const password = process.env.ENPHASE_USER_PASSWORD; // Senha do usuário
  const clientId = process.env.ENPHASE_CLIENT_ID;  // Client ID
  const clientSecret = process.env.ENPHASE_CLIENT_SECRET; // Client Secret
  const apiUrl = process.env.ENPHASE_API_URL;      // URL da API

  try {
    const response = await fetch(`${apiUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: clientId,
        client_secret: clientSecret,
        username: email,
        password: password,
      }),
    });

    const data = await response.json();

    // Verifica se a resposta foi bem-sucedida
    if (data.access_token) {
      console.log("Access Token obtido com sucesso:", data.access_token);
      return data; // Retorna os tokens (access_token e refresh_token)
    } else {
      throw new Error("Falha ao obter o Access Token");
    }
  } catch (error) {
    console.error("Erro ao obter o Access Token:", error);
    return null;
  }
}

// Função para atualizar o Access Token com o Refresh Token
async function refreshAccessToken(refreshToken) {
  const clientId = process.env.ENPHASE_CLIENT_ID;
  const clientSecret = process.env.ENPHASE_CLIENT_SECRET;
  const apiUrl = process.env.ENPHASE_API_URL;

  try {
    const response = await fetch(`${apiUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    const data = await response.json();

    if (data.access_token) {
      console.log("Access Token atualizado com sucesso:", data.access_token);
      return data; // Retorna os novos tokens
    } else {
      throw new Error("Falha ao atualizar o Access Token");
    }
  } catch (error) {
    console.error("Erro ao atualizar o Access Token:", error);
    return null;
  }
}

// Função para obter a geração de energia de um cliente
async function fetchGeracaoEnphase(id_sistema, micros, startDate, endDate, accessToken) {
  let totalGeneration = 0;

  try {
    // Percorre todos os micros do cliente
    for (const micro of micros) {
      const url = `https://api.enphaseenergy.com/api/v4/systems/${id_sistema}/devices/micros/${micro}/telemetry?start_date=${startDate}&end_date=${endDate}&granularity=day&enwh=1&powr=1`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,  // Usando o Access Token como Bearer
        }
      });

      const data = await response.json();

      if (data && data.intervals && Array.isArray(data.intervals)) {
        for (const interval of data.intervals) {
          if (typeof interval.enwh === "number") {
            totalGeneration += interval.enwh;  // Soma os valores de enwh
          }
        }
      }
    }

    return totalGeneration / 1000;  // Converte de Wh para kWh
  } catch (error) {
    console.error("Erro ao consultar dados da Enphase:", error);
    return 0;
  }
}




// --- COMPONENTES ---

const Logo = ({ className = "h-12" }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <img src="/Logo.png" alt="ONWAY Logo" className="h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
    <div className="hidden items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/50 text-emerald-500"><Zap size={20} fill="currentColor" /></div>
    <div className="flex flex-col"><span className="font-bold text-white tracking-wide text-lg leading-tight">ONWAY</span><span className="text-[10px] text-emerald-500 font-medium tracking-[0.2em] uppercase leading-tight">Energy</span></div>
  </div>
);

const Card = ({ children, className = '' }) => (<div className={`bg-zinc-900 rounded-xl shadow-lg border border-zinc-800/50 p-6 ${className}`}>{children}</div>);

const Badge = ({ status }) => {
  const styles = { online: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20', offline: 'bg-rose-500/10 text-rose-400 border-rose-500/20', ativo: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', pendente: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
  const normalizedStatus = (status || 'normal').toLowerCase();
  return (<span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${styles[normalizedStatus] || styles.online} flex items-center gap-1.5`}>{['online', 'ativo'].includes(normalizedStatus) && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}{status}</span>);
};

// --- TELAS ---

const AdminScreen = ({ onLogout }) => {
  const [view, setView] = useState('list');
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ nome: '', email: '', telefone: '', senha: '', id_sistema: '', ap: '' });

  useEffect(() => {
    const fetchClients = async () => {
      if (!supabase) return;
      try {
        const { data, error } = await supabase.from('clientes_monitora').select('*');
        if (error) throw error;
        const mapped = (data || []).map(c => ({ id: c.id, name: c.nome, email: c.email, phone: c.telefone, systemId: c.id_sistema, ap: c.ap, status: c.status || 'Ativo' }));
        setClients(mapped);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchClients();
  }, []);

  const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleCreateClick = () => { setEditingId(null); setFormData({ nome: '', email: '', telefone: '', senha: '', id_sistema: '', ap: '' }); setView('create'); };
  const handleEditClick = (client) => { setEditingId(client.id); setFormData({ nome: client.name, email: client.email, telefone: client.phone || '', senha: '', id_sistema: client.systemId, ap: client.ap }); setView('edit'); };

  const saveClientData = async () => {
    setIsSaving(true);
    try {
      const payload = { action: editingId ? 'update' : 'create', client: formData, timestamp: new Date().toISOString() };
      const params = new URLSearchParams();
      params.append('data', JSON.stringify(payload));
      await fetch(`https://cafe-sitio.app.n8n.cloud/webhook-test/3ba6316f-49de-4777-91a1-fd095719b50b?${params.toString()}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      alert('Dados enviados!');
      setView('list');
    } catch (error) { alert('Erro ao salvar.'); } finally { setIsSaving(false); }
  };

  return (
    <div className="min-h-screen bg-[#09090b] font-sans text-zinc-100 flex">
      <aside className="w-64 bg-zinc-950 border-r border-zinc-800/50 p-6 flex flex-col">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <button onClick={() => setView('list')} className="w-full flex items-center px-4 py-3 rounded-lg bg-zinc-800 text-emerald-400 mb-2"><Users size={20} className="mr-3"/> Clientes</button>
        <div className="mt-auto"><button onClick={onLogout} className="w-full flex items-center px-4 py-3 text-rose-400 hover:bg-rose-950/30 rounded-lg"><LogOut size={18} className="mr-2"/> Sair</button></div>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        {view === 'list' && (
          <div className="max-w-5xl mx-auto animate-in fade-in">
            <div className="flex justify-between items-center mb-8"><h1 className="text-2xl font-bold">Gerenciar Clientes</h1><button onClick={handleCreateClick} className="flex items-center px-4 py-2 bg-emerald-600 rounded-lg font-bold text-white hover:bg-emerald-500"><Plus size={18} className="mr-2"/> Novo</button></div>
            {loading ? <div className="text-zinc-500">Carregando...</div> :
              <Card className="p-0 overflow-hidden">
                <table className="w-full text-sm text-left"><thead className="bg-zinc-950 text-zinc-400 text-xs uppercase border-b border-zinc-800"><tr><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">Sistema</th><th className="px-6 py-4">AP</th><th className="px-6 py-4 text-right">Ações</th></tr></thead>
                <tbody className="divide-y divide-zinc-800">{clients.map(c => (<tr key={c.id} className="hover:bg-zinc-800/50"><td className="px-6 py-4"><p className="font-bold">{c.name}</p><p className="text-zinc-500">{c.email}</p></td><td className="px-6 py-4 text-emerald-500 font-mono">{c.systemId}</td><td className="px-6 py-4 text-zinc-300">{c.ap}</td><td className="px-6 py-4 text-right"><button onClick={() => handleEditClick(c)} className="text-zinc-400 hover:text-white">Editar</button></td></tr>))}</tbody></table>
              </Card>
            }
          </div>
        )}
        {(view === 'create' || view === 'edit') && (
           <div className="max-w-3xl mx-auto animate-in fade-in">
              <div className="flex items-center mb-6"><button onClick={() => setView('list')} className="mr-4 p-2 hover:bg-zinc-800 rounded-full"><ArrowLeft size={24}/></button><h1 className="text-2xl font-bold">{view === 'edit' ? 'Editar' : 'Novo'} Cliente</h1></div>
              <Card><h3 className="text-lg font-bold mb-4 flex gap-2 text-emerald-500"><User/> Dados</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2"><label className="text-xs text-zinc-400 uppercase">Nome</label><input name="nome" value={formData.nome} onChange={handleInputChange} className="w-full p-2 bg-zinc-950 border border-zinc-700 rounded text-white"/></div>
                  <div><label className="text-xs text-zinc-400 uppercase">Email</label><input name="email" value={formData.email} onChange={handleInputChange} className="w-full p-2 bg-zinc-950 border border-zinc-700 rounded text-white"/></div>
                  <div><label className="text-xs text-zinc-400 uppercase">Telefone</label><input name="telefone" value={formData.telefone} onChange={handleInputChange} className="w-full p-2 bg-zinc-950 border border-zinc-700 rounded text-white"/></div>
                  <div className="col-span-2"><label className="text-xs text-zinc-400 uppercase">Senha</label><input name="senha" value={formData.senha} onChange={handleInputChange} className="w-full p-2 bg-zinc-950 border border-zinc-700 rounded text-white"/></div>
                  <div><label className="text-xs text-zinc-400 uppercase">ID Sistema</label><input type="number" name="id_sistema" value={formData.id_sistema} onChange={handleInputChange} className="w-full p-2 bg-zinc-950 border border-zinc-700 rounded text-white"/></div>
                  <div><label className="text-xs text-zinc-400 uppercase">AP</label><input name="ap" value={formData.ap} onChange={handleInputChange} className="w-full p-2 bg-zinc-950 border border-zinc-700 rounded text-white"/></div>
                </div>
                <button onClick={saveClientData} disabled={isSaving} className="w-full mt-6 py-3 bg-emerald-600 rounded font-bold text-white hover:bg-emerald-500">{isSaving ? 'Salvando...' : 'Salvar'}</button>
              </Card>
           </div>
        )}
      </main>
    </div>
  );
};

const LoginScreen = ({ onLoginSuccess, onAdminLoginClick }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

const handleLogin = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError(null);

  try {
    if (!supabase) throw new Error("Conexão com banco falhou.");

    const { data, error } = await supabase
      .from("clientes_monitora")
      .select("id, nome, email, telefone, id_sistema, ap, n_inversor, senha")
      .eq("email", email)
      .maybeSingle(); // 👈 em vez de .single()

    console.log("Resposta do Supabase:", { data, error });

    // se vier algum erro "real" de supabase
    if (error) {
      console.error(error);
      throw new Error("Erro ao consultar o banco de dados.");
    }

    // se não veio nenhuma linha => credenciais inválidas
    if (!data) {
      throw new Error("Credenciais inválidas.");
    }

    // conferência da senha (já que estamos usando a coluna senha em texto)
    if (data.senha !== password) {
      throw new Error("Credenciais inválidas.");
    }

    // se chegou até aqui, login OK
    onLoginSuccess({
      id: data.id,
      name: data.nome,
      email: data.email,
      phone: data.telefone,
      systemId: data.id_sistema,
      ap: data.ap,
      invertersCount: data.n_inversor,
    });
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="flex flex-col items-center mb-10"><Logo className="h-16 mb-4" /><h1 className="text-2xl font-bold text-white">Monitoramento Solar</h1></div>
        <Card>
          <form onSubmit={handleLogin} className="space-y-5">
            <div><label className="text-xs text-zinc-400 uppercase">E-mail</label><input value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-3 bg-zinc-950/50 border border-zinc-700 rounded text-white outline-none focus:border-emerald-500"/></div>
            <div><label className="text-xs text-zinc-400 uppercase">Senha</label><div className="relative"><input type={showPassword ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-3 bg-zinc-950/50 border border-zinc-700 rounded text-white outline-none focus:border-emerald-500"/><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-zinc-500"><Eye size={18}/></button></div></div>
            {error && <p className="text-rose-500 text-xs text-center">{error}</p>}
            <button disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded mt-4 disabled:opacity-50">{loading ? 'Entrando...' : 'ACESSAR'}</button>
          </form>
        </Card>
        <div className="text-center mt-8"><button onClick={onAdminLoginClick} className="text-[10px] text-zinc-500 hover:text-emerald-500 uppercase tracking-widest"><Lock size={12} className="inline mr-1"/> Área Administrativa</button></div>
      </div>
    </div>
  );
};

const AdminLoginScreen = ({ onLogin, onBack }) => {
  const [showPassword, setShowPassword] = useState(false);
  return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 border-t-4 border-emerald-600">
        <div className="max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-white uppercase mb-6">Acesso Administrativo</h1>
          <Card>
             <div className="space-y-4">
               <input className="w-full p-3 bg-black/50 border border-zinc-700 rounded text-white" placeholder="admin@onway.com.br"/>
               <div className="relative"><input type={showPassword ? "text" : "password"} className="w-full p-3 bg-black/50 border border-zinc-700 rounded text-white" placeholder="••••••"/><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-zinc-500"><Eye size={18}/></button></div>
               <button onClick={onLogin} className="w-full bg-white text-black font-bold py-3 rounded">ENTRAR</button>
             </div>
             <button onClick={onBack} className="w-full mt-4 text-xs text-zinc-500 hover:text-white">Voltar</button>
          </Card>
        </div>
      </div>
  );
}

const DashboardScreen = ({ user }) => {
  const [geracaoDia, setGeracaoDia] = useState("--");
  const [potenciaRealData, setPotenciaRealData] = useState([]);
  const [loading, setLoading] = useState(true);

  // ---- FUNÇÃO ATUALIZADA (USA VIEW NOVA) ----
  async function fetchPotenciaHoje(clienteId) {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("view_potencia_grafico")
      .select("hora,enwh, kwh, acumulado_kwh, data_hora")
      .eq("id_cliente", clienteId)
      .order("data_hora", { ascending: true });

    if (error) {
      console.error("Erro ao buscar potência:", error);
      return [];
    }

    console.log("📊 Dados da view potencia_grafico:", data);

    return data.map(row => ({
      time: row.hora,             // eixo X (hora formatada)
      val: row.enwh      // ACUMULADO em kWh
    }));
  }

  // ---- FUNÇÃO PARA GERAÇÃO DO DIA (JÁ EXISTENTE, NÃO ALTERADA) ----
  async function fetchGeracaoDia(clienteId) {
    if (!supabase) return 0;

    try {
      const { data, error } = await supabase
        .from('view_geracao_diaria')
        .select('total_enwh')
        .eq('id_cliente', clienteId)
        .eq('data', new Date().toISOString().split('T')[0]);

      if (error) {
        console.error("Erro ao consultar geração diária:", error);
        return 0;
      }

      if (!data || data.length === 0) {
        return 0;
      }

      return Number((data[0].total_enwh / 1000).toFixed(2));
    } catch (error) {
      console.error("Erro ao obter geração do dia:", error);
      return 0;
    }
  }
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="p-3 rounded-md shadow-lg border border-zinc-700"
        style={{
          background: "#0f0f10",   // fundo escuro
          color: "#fff",
        }}
      >
        <p className="text-sm text-zinc-400">{label}h</p>

        <p className="text-lg font-bold text-emerald-400">
          {payload[0].value} W
        </p>
      </div>
    );
  }
  return null;
};

  // ---- CARREGAR DADOS QUANDO ENTRA NO DASHBOARD ----
  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const dia = await fetchGeracaoDia(user.id);
      setGeracaoDia(dia);

      const potenciaData = await fetchPotenciaHoje(user.id);
      setPotenciaRealData(potenciaData);

      setLoading(false);
    };

    load();
  }, [user.id]);

  // ---- ESTADO DE LOADING ----
  if (loading) {
    return (
      <div className="text-center text-zinc-300 text-lg mt-10">
        Carregando dados...
      </div>
    );
  }

  // ---- DASHBOARD COMPLETO ----
  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* CARDS SUPERIORES */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-sm text-zinc-400">Geração Hoje</p>
          <h3 className="text-3xl font-bold text-white">
            {geracaoDia} kWh
          </h3>
        </Card>

        <Card>
          <p className="text-sm text-zinc-400">Geração Mês</p>
          <h3 className="text-3xl font-bold text-white">--</h3>
        </Card>
      </div>

      {/* GRÁFICO ACUMULADO */}
      <Card>
        <h3 className="text-lg font-bold text-white mb-4">Grafico de Potencia</h3>

        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={potenciaRealData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="val" 
              stroke="#22c55e" 
              fill="#22c55e" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};




export default function App() {
  const [authStatus, setAuthStatus] = useState('none'); // none, user_logged, admin_logged
  const [authView, setAuthView] = useState('login'); // login, admin_login
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (authStatus === 'none') {
    if (authView === 'admin_login') return <AdminLoginScreen onLogin={() => setAuthStatus('admin_logged')} onBack={() => setAuthView('login')} />;
    return <LoginScreen onLoginSuccess={(u) => { setLoggedInUser(u); setAuthStatus('user_logged'); }} onForgotPassword={() => alert('Consulte o suporte')} onAdminLoginClick={() => setAuthView('admin_login')} />;
  }
  if (authStatus === 'admin_logged') return <AdminScreen onLogout={() => setAuthStatus('none')} />;

  // User Dashboard
return (
  <div className="min-h-screen bg-[#09090b] font-sans text-zinc-100 flex overflow-hidden">

    {/* --- BOTÃO MOBILE (ABRIR MENU) --- */}
    <div className="md:hidden fixed top-0 left-0 w-full bg-[#09090b] p-4 flex justify-between items-center z-30 border-b border-zinc-800/50">
      <Logo className="h-10" />
      <button onClick={() => setSidebarOpen(true)}>
        <Menu size={28} className="text-zinc-300" />
      </button>
    </div>

    {/* --- SIDEBAR (ANIMAÇÃO SLIDE) --- */}
    <aside
      className={`
        fixed top-0 left-0 h-full w-64 bg-zinc-950 border-r border-zinc-800/50 p-6 flex-col 
        transform transition-transform duration-300 z-40
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0 md:static md:flex
      `}
    >
      {/* botão fechar no mobile */}
      <button
        className="md:hidden absolute right-4 top-4 text-zinc-300"
        onClick={() => setSidebarOpen(false)}
      >
        <X size={26} />
      </button>

      <div className="mb-8 flex justify-center"><Logo /></div>

      <button 
        className="w-full flex items-center px-4 py-3 rounded-lg bg-zinc-800 text-emerald-400 mb-2 transition-all hover:bg-zinc-700"
      >
        <LayoutDashboard size={20} className="mr-3"/> 
        Visão Geral
      </button>

      <div className="mt-auto">
        <button 
          onClick={() => setAuthStatus('none')} 
          className="w-full flex items-center px-4 py-3 text-rose-400 hover:text-rose-300 hover:bg-rose-900/30 transition rounded-lg"
        >
          <LogOut size={18} className="mr-3"/> 
          Sair
        </button>
      </div>
    </aside>

    {/* --- BACKDROP MOBILE --- */}
    {sidebarOpen && (
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden animate-fadeIn"
        onClick={() => setSidebarOpen(false)}
      />
    )}

    {/* --- ÁREA PRINCIPAL --- */}
    <main className="flex-1 p-8 md:ml-64 pt-24 md:pt-8 transition-all duration-300">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">
            Olá, {loggedInUser.name}
          </h2>
          <p className="text-zinc-500">
            Sistema: {loggedInUser.systemId} | AP: {loggedInUser.ap}
          </p>
        </div>

        <DashboardScreen user={loggedInUser} />
      </div>
    </main>
  </div>
);
;
}