import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PadronCarga {
  id: string;
  obra_social_id: number;
  periodo: string;
  archivo_nombre: string | null;
  total_procesados: number;
  creados: number;
  actualizados: number;
  reactivados?: number;

  dados_de_baja: number;
  errores: any;
  usuario_id: string | null;
  created_at: string;
  obras_sociales?: { nombre: string } | null;
}

export const usePadronCargas = () => {
  return useQuery({
    queryKey: ['padron-cargas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('padron_cargas')
        .select('*, obras_sociales (nombre)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as PadronCarga[];
    },
  });
};

export type SemaforoEstado = 'verde' | 'amarillo' | 'rojo';

export const periodoActual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

export const periodoAnterior = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

export const estadoSemaforo = (ultimoPeriodo?: string | null): SemaforoEstado => {
  if (!ultimoPeriodo) return 'rojo';
  const p = ultimoPeriodo.slice(0, 7);
  if (p === periodoActual().slice(0, 7)) return 'verde';
  if (p === periodoAnterior().slice(0, 7)) return 'amarillo';
  return 'rojo';
};
