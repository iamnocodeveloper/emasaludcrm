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
      const normalizedDigits = q.replace(/\D/g, '');
      const isNumeric = normalizedDigits.length > 0 && normalizedDigits.length === q.replace(/[\s.-]/g, '').length;
      let query = supabase
        .from('pacientes')
        .select('id, nombre, apellido, dni, numero_afiliado, consultas_mes_actual, consultas_maximas, estado_padron, activo, obra_social:obras_sociales(nombre)')
        .eq('activo', true)
        .limit(limit)
        .order('apellido');

      const escaped = q.replace(/[%_,]/g, '');
      if (isNumeric) {
        query = query.or(`dni.ilike.${normalizedDigits}%,nro_doc.ilike.${normalizedDigits}%,cuil_beneficiario.ilike.${normalizedDigits}%`);
      } else {
        query = query.or(`apellido.ilike.${escaped}%,nombre.ilike.${escaped}%,apellido_y_nombre.ilike.%${escaped}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Patient[];
    },
  });
};

