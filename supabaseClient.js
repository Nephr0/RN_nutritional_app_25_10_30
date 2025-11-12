import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tzqtxmjsryojewmuxspk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6cXR4bWpzcnlvamV3bXV4c3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxNDEzNjksImV4cCI6MjA3NzcxNzM2OX0.i1OCGlA68P1FNy_eRK62c_ppUchDE-87LLhYhGG7MpY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);