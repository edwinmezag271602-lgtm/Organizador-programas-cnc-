const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
