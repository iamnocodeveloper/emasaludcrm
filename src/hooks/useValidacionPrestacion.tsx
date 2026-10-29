import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type MotivoValidacion =
  | 'ok'
  | 'practica'
  | 'grupo'
  | 'cupo_mensual'
  | 'padron'
  | 'identidad'
  | 'sin_regla';

export interface ReglaConsumo {
  grupo_id: number;
  grupo_codigo: string;
  grupo_nombre: string;
  ambito: 'general' | 'solo_mendoza';
  limite_practica: number | null;
  periodo_practica_dias: number | null;
  consumido_practica: number | null;
  restante_practica: number | null;
  desde_practica: string | null;
  hasta_practica: string | null;
  limite_grupo: number | null;
  periodo_grupo_dias: number | null;
  consumido_grupo: number | null;
  restante_grupo: number | null;
  desde_grupo: string | null;
  hasta_grupo: string | null;
  excepcion_practica: number;
  excepcion_grupo: number;
}

export interface CupoMensual {
  limite: number | null;
  consumido: number | null;
  excepcion: number | null;
}

export interface ValidacionPractica {
  permitido: boolean;
  motivo: MotivoValidacion | string;
  mensaje: string;
  paciente_id: number;
  dni: string | null;
  codigo_practica: string;
  cantidad: number;
  fecha: string;
  cupo_mensual: CupoMensual;
  reglas: ReglaConsumo[];
}

export interface ResumenConsumo {
  grupo_id: number;
  grupo_codigo: string;
  grupo_nombre: string;
  ambito: 'general' | 'solo_mendoza';
  limite_grupo: number | null;
  periodo_grupo_dias: number | null;
  desde: string;
  hasta: string;
  consumido_grupo: number | null;
  restante_grupo: number | null;
}

export interface CupoMensualPaciente {
  limite: number | null;
  consumido: number;
  excepcion: number;
  sin_limite: boolean;
  desde: string;
  hasta: string;
}

interface ValidarParams {
  pacienteId?: number | null;
  codigoPractica?: string;
  cantidad?: number;
  dni?: string | null;
  fecha?: string;
  enabled?: boolean;
}

export const useValidarPrestacion = ({
  pacienteId,
  codigoPractica,
  cantidad = 1,
  dni,
  fecha,
  enabled = true,
}: ValidarParams) => {
  return useQuery({
    queryKey: [
      'validacion-prestacion',
      pacienteId,
      codigoPractica,
      cantidad,
      fecha ?? 'hoy',
    ],
    enabled:
      enabled &&
      !!pacienteId &&
      !!codigoPractica &&
      codigoPractica.trim().length > 0,
    staleTime: 15_000,
    retry: false,
    queryFn: async (): Promise<ValidacionPractica> => {
      const { data, error } = await supabase.rpc('validar_prestacion', {
        p_paciente_id: pacienteId as number,
        p_codigo_practica: codigoPractica as string,
        p_cantidad: cantidad,
        p_dni: dni ?? undefined,
        p_fecha: fecha,
        p_log: false,
      });

      if (error) throw error;
      return data as unknown as ValidacionPractica;
    },
  });
};

export const useResumenConsumos = (
  pacienteId?: number | null,
  fecha?: string
) => {
  return useQuery({
    queryKey: ['resumen-consumos', pacienteId, fecha ?? 'hoy'],
    enabled: !!pacienteId,
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<ResumenConsumo[]> => {
      const { data, error } = await supabase.rpc('resumen_consumos_paciente', {
        p_paciente_id: pacienteId as number,
        p_fecha: fecha,
      });

      if (error) throw error;
      return (data as unknown as ResumenConsumo[]) ?? [];
    },
  });
};

export const useCupoMensualPaciente = (
  pacienteId?: number | null,
  fecha?: string
) => {
  return useQuery({
    queryKey: ['cupo-mensual', pacienteId, fecha ?? 'hoy'],
    enabled: !!pacienteId,
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<CupoMensualPaciente> => {
      const { data, error } = await supabase.rpc('cupo_mensual_paciente', {
        p_paciente_id: pacienteId as number,
        p_fecha: fecha,
      });

      if (error) throw error;
      return data as unknown as CupoMensualPaciente;
    },
  });
};

