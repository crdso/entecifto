// Configuração do Supabase lida das variáveis de ambiente do Vite.
// Preencha em .env.local (ou nas variáveis de ambiente após exportar o projeto).
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);