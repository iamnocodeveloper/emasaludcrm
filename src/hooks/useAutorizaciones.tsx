import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUser } from './useCurrentUser';
import { AutorizacionPrestacionFormData } from './useAutorizacionPrestaciones';

export interface Autorizacion {
  id: number;
  paciente_id: number;
  medico_id?: number;
  obra_social_id?: number;
  tipo_autorizacion: string;
  descripcion?: string;
  fecha_solicitud?: string;
  fecha_vencimiento?: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'vencida';
  numero_autorizacion?: string;
  observaciones?: string;
  documento_url?: string;
  activa: boolean;
  numero_credencial?: string;
  parentesco_beneficiario?: string;
  profesional_solicitante?: string;
  prestador?: string;
  copago?: number;
  pacientes?: { nombre: string; apellido: string; dni: string };
  medicos?: { nombre: string; apellido: string; matricula: string };
  obras_sociales?: { nombre: string };
  prestaciones?: Array<{
    id: number;
    prestacion_codigo: string;
    prestacion_descripcion: string;
    cantidad: number;
    observaciones?: string;
  }>;
}

export interface AutorizacionFormData {
  paciente_id: number;
  medico_id?: number;
  obra_social_id?: number;
  tipo_autorizacion: string;
  descripcion?: string;
  fecha_vencimiento?: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'vencida';
  numero_autorizacion?: string;
  observaciones?: string;
  documento?: File;
  numero_credencial?: string;
  parentesco_beneficiario?: string;
  profesional_solicitante?: string;
  prestador?: string;
  copago?: number;
  prestaciones: AutorizacionPrestacionFormData[];
}

export const useAutorizaciones = () => {
  return useQuery({
    queryKey: ['autorizaciones'],
    queryFn: async () => {
      const { data: autorizaciones, error } = await supabase
        .from('autorizaciones')
        .select(`
          *,
          pacientes (nombre, apellido, dni),
          medicos (nombre, apellido, matricula),
          obras_sociales (nombre)
        `)
        .eq('activa', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!autorizaciones || autorizaciones.length === 0) return [] as Autorizacion[];

      // Batch query: get ALL prestaciones in one query instead of N+1
      const ids = autorizaciones.map(a => a.id);
      const { data: allPrestaciones, error: prestError } = await supabase
        .from('autorizacion_prestaciones')
        .select('id, autorizacion_id, prestacion_codigo, prestacion_descripcion, cantidad, observaciones')
        .in('autorizacion_id', ids)
        .order('created_at', { ascending: true });

      if (prestError) throw prestError;

      // Map prestaciones to each autorización in memory
      const prestacionesMap = new Map<number, typeof allPrestaciones>();
      for (const p of (allPrestaciones || [])) {
        const list = prestacionesMap.get(p.autorizacion_id) || [];
        list.push(p);
        prestacionesMap.set(p.autorizacion_id, list);
      }

      return autorizaciones.map(a => ({
        ...a,
        prestaciones: prestacionesMap.get(a.id) || []
      })) as Autorizacion[];
    },
  });
};

export const AUTORIZACIONES_PAGE_SIZE = 20;

export const useAutorizacionesInfinite = (pageSize = AUTORIZACIONES_PAGE_SIZE) => {
  return useInfiniteQuery({
    queryKey: ['autorizaciones-infinite', pageSize],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const from = (pageParam as number) * pageSize;
      const to = from + pageSize - 1;

      const { data: autorizaciones, error } = await supabase
        .from('autorizaciones')
        .select(`
          *,
          pacientes (nombre, apellido, dni),
          medicos (nombre, apellido, matricula),
          obras_sociales (nombre)
        `)
        .eq('activa', true)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      if (!autorizaciones || autorizaciones.length === 0) {
        return { items: [] as Autorizacion[], nextPage: null as number | null };
      }

      const ids = autorizaciones.map(a => a.id);
      const { data: allPrestaciones, error: prestError } = await supabase
        .from('autorizacion_prestaciones')
        .select('id, autorizacion_id, prestacion_codigo, prestacion_descripcion, cantidad, observaciones')
        .in('autorizacion_id', ids)
        .order('created_at', { ascending: true });

      if (prestError) throw prestError;

      const prestacionesMap = new Map<number, typeof allPrestaciones>();
      for (const p of (allPrestaciones || [])) {
        const list = prestacionesMap.get(p.autorizacion_id) || [];
        list.push(p);
        prestacionesMap.set(p.autorizacion_id, list);
      }

      const items = autorizaciones.map(a => ({
        ...a,
        prestaciones: prestacionesMap.get(a.id) || []
      })) as Autorizacion[];

      const nextPage = autorizaciones.length === pageSize ? (pageParam as number) + 1 : null;
      return { items, nextPage };
    },
    getNextPageParam: (last) => last.nextPage,
  });
};

// Historial COMPLETO de autorizaciones de un paciente (sin paginado)
export const useAutorizacionesPaciente = (pacienteId?: number | null) => {
  return useQuery({
    queryKey: ['autorizaciones-paciente', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data: autorizaciones, error } = await supabase
        .from('autorizaciones')
        .select(`
          *,
          pacientes (nombre, apellido, dni),
          medicos (nombre, apellido, matricula),
          obras_sociales (nombre)
        `)
        .eq('activa', true)
        .eq('paciente_id', pacienteId as number)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!autorizaciones || autorizaciones.length === 0) return [] as Autorizacion[];

      const ids = autorizaciones.map(a => a.id);
      const { data: allPrestaciones, error: prestError } = await supabase
        .from('autorizacion_prestaciones')
        .select('id, autorizacion_id, prestacion_codigo, prestacion_descripcion, cantidad, observaciones')
        .in('autorizacion_id', ids)
        .order('created_at', { ascending: true });

      if (prestError) throw prestError;

      const prestacionesMap = new Map<number, typeof allPrestaciones>();
      for (const p of (allPrestaciones || [])) {
        const list = prestacionesMap.get(p.autorizacion_id) || [];
        list.push(p);
        prestacionesMap.set(p.autorizacion_id, list);
      }

      return autorizaciones.map(a => ({
        ...a,
        prestaciones: prestacionesMap.get(a.id) || []
      })) as Autorizacion[];
    },
  });
};



export const useCreateAutorizacion = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (autorizacionData: AutorizacionFormData) => {
      console.log('Creating authorization with data:', autorizacionData);
      
      let documento_url = null;

      if (autorizacionData.documento) {
        const fileExt = autorizacionData.documento.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('autorizaciones')
          .upload(fileName, autorizacionData.documento);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('autorizaciones')
          .getPublicUrl(fileName);

        documento_url = publicUrl;
      }

      const { documento, prestaciones, ...dataToInsert } = autorizacionData;
      const { data: authData } = await supabase.auth.getUser();

      const payload = {
        ...dataToInsert,
        documento_url,
        created_by_user_id: authData?.user?.id ?? null,
        prestaciones: (prestaciones ?? []).map(prestacion => ({
          prestacion_codigo: prestacion.prestacion_codigo,
          prestacion_descripcion: prestacion.prestacion_descripcion,
          cantidad: prestacion.cantidad ?? 1,
          observaciones: prestacion.observaciones ?? null,
        })),
      };

      const { data: autorizacionId, error } = await supabase.rpc(
        'crear_autorizacion',
        { p_payload: payload as unknown as Json }
      );

      if (error) throw error;

      const { data: createdAutorizacion, error: createdError } = await supabase
        .from('autorizaciones')
        .select(`
          *,
          pacientes (nombre, apellido, dni),
          medicos (nombre, apellido, matricula),
          obras_sociales (nombre)
        `)
        .eq('id', autorizacionId as number)
        .single();

      if (createdError) throw createdError;

      const { data: createdPrestaciones, error: createdPrestacionesError } = await supabase
        .from('autorizacion_prestaciones')
        .select('id, autorizacion_id, prestacion_codigo, prestacion_descripcion, cantidad, observaciones')
        .eq('autorizacion_id', autorizacionId as number)
        .order('created_at', { ascending: true });

      if (createdPrestacionesError) throw createdPrestacionesError;

      return {
        ...createdAutorizacion,
        prestaciones: createdPrestaciones || [],
      } as Autorizacion;
    },
    onSuccess: (createdAutorizacion) => {
      queryClient.setQueriesData(
        { queryKey: ['autorizaciones-infinite'] },
        (current: any) => {
          if (!current?.pages?.length) return current;
          const alreadyPresent = current.pages.some((page: any) =>
            page.items?.some((item: Autorizacion) => item.id === createdAutorizacion.id)
          );
          if (alreadyPresent) return current;

          const pages = current.pages.map((page: any, index: number) =>
            index === 0
              ? { ...page, items: [createdAutorizacion, ...(page.items || [])] }
              : page
          );
          return { ...current, pages };
        }
      );
      queryClient.invalidateQueries({ queryKey: ['autorizaciones'] });
      queryClient.invalidateQueries({ queryKey: ['autorizaciones-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['autorizaciones-paciente'] });
      queryClient.invalidateQueries({ queryKey: ['autorizacion-prestaciones'] });
      queryClient.invalidateQueries({ queryKey: ['resumen-consumos'] });
      queryClient.invalidateQueries({ queryKey: ['validacion-prestacion'] });
      toast({
        title: "Autorización creada",
        description: "La autorización se ha creado exitosamente.",
      });
    },
    onError: async (error: any, variables: AutorizacionFormData) => {
      // El bloqueo revierte la transacción, incluido su log. Se vuelve a validar
      // fuera de ella para dejar registrado el motivo del rechazo.
      if ((error?.code === 'P0001' || error?.code === '23514') && variables?.prestaciones) {
        await Promise.all(
          variables.prestaciones
            .filter(prestacion => prestacion.prestacion_codigo)
            .map(prestacion =>
              Promise.resolve(
                supabase.rpc('validar_prestacion', {
                  p_paciente_id: variables.paciente_id,
                  p_codigo_practica: prestacion.prestacion_codigo,
                  p_cantidad: prestacion.cantidad ?? 1,
                  p_log: true,
                })
              ).catch(() => undefined)
            )
        );
      }

      toast({
        title: "Error",
        description: `Error al crear autorización: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateAutorizacion = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<AutorizacionFormData> }) => {
      let documento_url = undefined;

      if (data.documento) {
        const fileExt = data.documento.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('autorizaciones')
          .upload(fileName, data.documento);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('autorizaciones')
          .getPublicUrl(fileName);

        documento_url = publicUrl;
      }

      const { documento, prestaciones, ...dataToUpdate } = data;

      const payload: Record<string, unknown> = { ...dataToUpdate };
      if (documento_url) payload.documento_url = documento_url;
      if (prestaciones !== undefined) {
        payload.prestaciones = prestaciones.map(prestacion => ({
          prestacion_codigo: prestacion.prestacion_codigo,
          prestacion_descripcion: prestacion.prestacion_descripcion,
          cantidad: prestacion.cantidad ?? 1,
          observaciones: prestacion.observaciones ?? null,
        }));
      }

      const { error } = await supabase.rpc('actualizar_autorizacion', {
        p_id: id,
        p_payload: payload as unknown as Json,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autorizaciones'] });
      queryClient.invalidateQueries({ queryKey: ['autorizaciones-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['autorizaciones-paciente'] });
      queryClient.invalidateQueries({ queryKey: ['autorizacion-prestaciones'] });
      queryClient.invalidateQueries({ queryKey: ['resumen-consumos'] });
      queryClient.invalidateQueries({ queryKey: ['validacion-prestacion'] });
      toast({
        title: "Autorización actualizada",
        description: "Los datos de la autorización se han actualizado exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Error al actualizar autorización: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useDeleteAutorizacion = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();

  return useMutation({
    mutationFn: async (autorizacionId: number) => {
      if (currentUser?.role !== 'admin') {
        throw new Error('No tiene permisos para eliminar registros');
      }

      const { error } = await supabase
        .from('autorizaciones')
        .update({ activa: false })
        .eq('id', autorizacionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autorizaciones'] });
      queryClient.invalidateQueries({ queryKey: ['autorizaciones-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['autorizaciones-paciente'] });
      queryClient.invalidateQueries({ queryKey: ['resumen-consumos'] });
      queryClient.invalidateQueries({ queryKey: ['validacion-prestacion'] });
      toast({
        title: "Autorización eliminada",
        description: "La autorización se ha eliminado exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Error al eliminar autorización: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};
