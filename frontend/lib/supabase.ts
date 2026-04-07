import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://gorwxfzzyzxmxnizmebw.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdvcnd4Znp6eXp4bXhuaXptZWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NjM2ODgsImV4cCI6MjA3NzIzOTY4OH0.39ev2bNI0RacrEQh57wEsYgBoxdZAD76AEpIkmLcVNw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
