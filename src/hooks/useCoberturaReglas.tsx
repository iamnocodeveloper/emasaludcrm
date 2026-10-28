import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

type GrupoRow = Database['public']['Tables']['cobertura_grupos']['Row'];
type GrupoInsert = Database['public']['Tables']['cobertura_grupos']['Insert'];
type PracticaRow = Database['public']['Tables']['cobertura_practicas']['Row'];
type PracticaInsert = Database['public']['Tables']['cobertura_practicas']['Insert'];
type ExcepcionRow = Database['public']['Tables']['cobertura_excepciones']['Row'];
type ExcepcionInsert = Database['public']['Tables']['cobertura_excepciones']['Insert'];

export type CoberturaGrupo = GrupoRow;
export type CoberturaPractica = PracticaRow & {
  cobertura_grupos?: { nombre: string; codigo: string } | null;
  descripcion_practica?: string;
};
export type CoberturaExcepcion = ExcepcionRow;

const mensajeDeError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return String(error);
};

const esDuplicado = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === '23505';

export const useCoberturaGrupos = () => {
  return useQuery({
    queryKey: ['cobertura-grupos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobertura_grupos')
        .select('*')
        .order('nombre');

      if (error) throw error;
      return (data ?? []) as CoberturaGrupo[];
    },
  });
};

export const useUpsertCoberturaGrupo = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (grupo: GrupoInsert & { id?: number }) => {
      const { id, ...payload } = grupo;

      const { data, error } = id
        ? await supabase
            .from('cobertura_grupos')
            .update(payload)
            .eq('id', id)
            .select()
            .single()
        : await supabase
            .from('cobertura_grupos')
            .insert(payload)
            .select()
            .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobertura-grupos'] });
      queryClient.invalidateQueries({ queryKey: ['cobertura-practicas'] });
      toast({
        title: 'Regla guardada',
        description: 'Los topes del grupo se actualizaron correctamente.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error',
        description: `No se pudo guardar la regla: ${mensajeDeError(error)}`,
        variant: 'destructive',
      });
    },
  });
};

export const useCoberturaPracticas = () => {
  return useQuery({
    queryKey: ['cobertura-practicas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobertura_practicas')
        .select('*, cobertura_grupos (nombre, codigo)')
        .order('codigo_practica');

      if (error) throw error;

      const practicas = (data ?? []) as CoberturaPractica[];
      const codigos = practicas.map(p => p.codigo_practica);

      if (codigos.length === 0) return practicas;

      const { data: nomenclador } = await supabase
        .from('nomeclador')
        .select('codigo_practica, descripcion_practica')
        .in('codigo_practica', codigos);

      const descripciones = new Map(
        (nomenclador ?? []).map(n => [n.codigo_practica, n.descripcion_practica])
      );

      return practicas.map(p => ({
        ...p,
        descripcion_practica: descripciones.get(p.codigo_practica),
      }));
    },
  });
};

export const useAsignarPractica = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: PracticaInsert) => {
      const { data, error } = await supabase
        .from('cobertura_practicas')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobertura-practicas'] });
      toast({
        title: 'Práctica asignada',
        description: 'La práctica ahora aplica los topes del grupo seleccionado.',
      });
    },
    onError: (error: unknown) => {
      const duplicada = esDuplicado(error);
      toast({
        title: 'Error',
        description: duplicada
          ? 'La práctica ya está asignada a ese grupo.'
          : `No se pudo asignar la práctica: ${mensajeDeError(error)}`,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateCoberturaPractica = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: { id: number } & Partial<PracticaInsert>) => {
      const { data, error } = await supabase
        .from('cobertura_practicas')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobertura-practicas'] });
      toast({
        title: 'Práctica actualizada',
        description: 'Los topes de la práctica se guardaron correctamente.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error',
        description: `No se pudo actualizar la práctica: ${mensajeDeError(error)}`,
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteCoberturaPractica = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('cobertura_practicas')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobertura-practicas'] });
      toast({
        title: 'Práctica quitada',
        description: 'La práctica dejó de estar sujeta a topes.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error',
        description: `No se pudo quitar la práctica: ${mensajeDeError(error)}`,
        variant: 'destructive',
      });
    },
  });
};

export const useCoberturaExcepciones = (pacienteId?: number | null) => {
  return useQuery({
    queryKey: ['cobertura-excepciones', pacienteId ?? 'todas'],
    queryFn: async () => {
      let query = supabase
        .from('cobertura_excepciones')
        .select('*, pacientes (nombre, apellido, dni), cobertura_grupos (nombre)')
        .order('created_at', { ascending: false });

      if (pacienteId) {
        query = query.eq('paciente_id', pacienteId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as (CoberturaExcepcion & {
        pacientes?: { nombre: string; apellido: string; dni: string } | null;
        cobertura_grupos?: { nombre: string } | null;
      })[];
    },
  });
};

export const useUpsertCoberturaExcepcion = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (excepcion: ExcepcionInsert & { id?: number }) => {
      const { id, ...payload } = excepcion;

      const { data, error } = id
        ? await supabase
            .from('cobertura_excepciones')
            .update(payload)
            .eq('id', id)
            .select()
            .single()
        : await supabase
            .from('cobertura_excepciones')
            .insert(payload)
            .select()
            .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobertura-excepciones'] });
      queryClient.invalidateQueries({ queryKey: ['validacion-prestacion'] });
      queryClient.invalidateQueries({ queryKey: ['resumen-consumos'] });
      toast({
        title: 'Excepción registrada',
        description: 'La excepción quedó registrada con su responsable y justificación.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error',
        description: `No se pudo registrar la excepción: ${mensajeDeError(error)}`,
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteCoberturaExcepcion = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('cobertura_excepciones')
        .update({ activo: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobertura-excepciones'] });
      queryClient.invalidateQueries({ queryKey: ['validacion-prestacion'] });
      queryClient.invalidateQueries({ queryKey: ['resumen-consumos'] });
      toast({
        title: 'Excepción anulada',
        description: 'La excepción dejó de estar vigente.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error',
        description: `No se pudo anular la excepción: ${mensajeDeError(error)}`,
        variant: 'destructive',
      });
    },
  });
};
