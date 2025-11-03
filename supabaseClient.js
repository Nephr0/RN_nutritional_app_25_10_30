import { createClient } from '@supabase/supabase-js';

// ⭐️ 1단계에서 복사한 본인의 URL과 anon 키로 교체
const supabaseUrl = 'https://tzqtxmjsryojewmuxspk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6cXR4bWpzcnlvamV3bXV4c3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxNDEzNjksImV4cCI6MjA3NzcxNzM2OX0.i1OCGlA68P1FNy_eRK62c_ppUchDE-87LLhYhGG7MpY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);