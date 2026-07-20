import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
      const insertData = { ...dataToInsert, documento_url };

      const { data: autorizacion, error } = await supabase
        .from('autorizaciones')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;

      if (prestaciones && prestaciones.length > 0) {
        const prestacionesData = prestaciones.map(prestacion => ({
          autorizacion_id: autorizacion.id,
          ...prestacion
        }));

        const { error: prestacionesError } = await supabase
          .from('autorizacion_prestaciones')
          .insert(prestacionesData);

        if (prestacionesError) throw prestacionesError;
      }

      return autorizacion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autorizaciones'] });
      queryClient.invalidateQueries({ queryKey: ['autorizacion-prestaciones'] });
      toast({
        title: "Autorización creada",
        description: "La autorización se ha creado exitosamente.",
      });
    },
    onError: (error: any) => {
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
      const updateData = { ...dataToUpdate, ...(documento_url && { documento_url }) };

      const { error } = await supabase
        .from('autorizaciones')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      if (prestaciones !== undefined) {
        const { error: deleteError } = await supabase
          .from('autorizacion_prestaciones')
          .delete()
          .eq('autorizacion_id', id);

        if (deleteError) throw deleteError;

        if (prestaciones.length > 0) {
          const prestacionesData = prestaciones.map(prestacion => ({
            autorizacion_id: id,
            ...prestacion
          }));

          const { error: prestacionesError } = await supabase
            .from('autorizacion_prestaciones')
            .insert(prestacionesData);

          if (prestacionesError) throw prestacionesError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autorizaciones'] });
      queryClient.invalidateQueries({ queryKey: ['autorizacion-prestaciones'] });
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
