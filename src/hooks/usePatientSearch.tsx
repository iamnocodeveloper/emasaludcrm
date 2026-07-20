import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Patient } from './usePatients';

/**
 * Búsqueda server-side de pacientes con debounce.
 * Ideal para dropdowns/filtros con miles de registros.
 */
export const usePatientSearch = (term: string, limit = 5, debounceMs = 250) => {
  const [debounced, setDebounced] = useState(term);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), debounceMs);
    return () => clearTimeout(t);
  }, [term, debounceMs]);

  return useQuery({
    queryKey: ['patients-search', debounced, limit],
    enabled: debounced.trim().length >= 2,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const q = debounced.trim();
      const isNumeric = /^\d+$/.test(q);
      let query = supabase
        .from('pacientes')
        .select('id, nombre, apellido, dni, activo, obra_social:obras_sociales(nombre)')
        .eq('activo', true)
        .limit(limit)
        .order('apellido');

      const escaped = q.replace(/[%_,]/g, '');
      if (isNumeric) {
        query = query.ilike('dni', `${escaped}%`);
      } else {
        // Prefix ilike on apellido/nombre — uses text_pattern_ops indexes
        query = query.or(`apellido.ilike.${escaped}%,nombre.ilike.${escaped}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Patient[];
    },
  });
};

