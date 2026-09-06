/**
 * ============================================================
 *  SUPABASE CLIENT — Habit Hero
 * ============================================================
 *  Único punto de configuración de credenciales de Supabase.
 *  Como no usamos bundler (Vite/webpack), el SDK se carga
 *  directo desde CDN (esm.sh) en vez de un `npm install`.
 *
 *  IMPORTANTE:
 *  - Reemplaza SUPABASE_URL y SUPABASE_ANON_KEY con los valores
 *    reales de tu proyecto (Settings → API en el dashboard).
 *  - La "anon key" es segura de exponer en el frontend: la
 *    protección real de los datos la da Row Level Security
 *    (RLS), no el secreto de esta key.
 * ============================================================
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://svmyadulbljzpybaqmbk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JeplMg5qv6oVfLQ0B8WQOA_rs_2ZFn_';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
