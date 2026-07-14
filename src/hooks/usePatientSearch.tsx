import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Patient } from './usePatients';

/**
 * Búsqueda server-side de pacientes con debounce.
 * Ideal para dropdowns/filtros con miles de registros.
 */
export const usePatientSearch = (term: string, limit = 50, debounceMs = 250) => {
  const [debounced, setDebounced] = useState(term);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), debounceMs);
    return () => clearTimeout(t);
  }, [term, debounceMs]);

  return useQuery({
    queryKey: ['patients-search', debounced, limit],
    enabled: debounced.trim().length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const q = debounced.trim();
      const isNumeric = /^\d+$/.test(q);
      let query = supabase
        .from('pacientes')
        .select('*, obra_social:obras_sociales(nombre)')
        .eq('activo', true)
        .limit(limit)
        .order('apellido');

      if (isNumeric) {
        query = query.ilike('dni', `${q}%`);
      } else {
        query = query.or(
          `nombre.ilike.%${q}%,apellido.ilike.%${q}%,dni.ilike.${q}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Patient[];
    },
  });
};
