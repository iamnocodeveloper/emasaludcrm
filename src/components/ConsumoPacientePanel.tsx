import React, { useMemo } from 'react';
import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useCupoMensualPaciente,
  useResumenConsumos,
} from '@/hooks/useValidacionPrestacion';

interface ConsumoPacientePanelProps {
  pacienteId?: number | null;
  className?: string;
}

const formatearFecha = (iso?: string | null) => {
  if (!iso) return '';
  const [anio, mes, dia] = iso.split('T')[0].split('-');
  return dia && mes && anio ? `${dia}/${mes}/${anio}` : iso;
};

const porcentaje = (usado: number, limite: number) => {
  if (!limite || limite <= 0) return 0;
  return Math.min(100, Math.round((usado / limite) * 100));
};

const colorBarra = (pct: number) =>
  pct >= 100 ? 'bg-destructive' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

const colorTexto = (pct: number) =>
  pct >= 100 ? 'text-destructive' : pct >= 70 ? 'text-amber-700' : 'text-emerald-700';

const varianteBadge = (pct: number): 'destructive' | 'outline' | 'secondary' =>
  pct >= 100 ? 'destructive' : pct >= 70 ? 'outline' : 'secondary';

interface BarraConsumoProps {
  etiqueta: string;
  detalle?: string;
  usado: number;
  limite: number;
  periodo?: number | null;
  desde?: string | null;
  hasta?: string | null;
  extra?: number;
}

export const BarraConsumo: React.FC<BarraConsumoProps> = ({
  etiqueta,
  detalle,
  usado,
  limite,
  periodo,
  desde,
  hasta,
  extra = 0,
}) => {
  const pct = porcentaje(usado, limite + extra);
  const restante = Math.max(limite + extra - usado, 0);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2">
          {pct >= 100 ? (
            <AlertTriangle className={cn('h-4 w-4', colorTexto(pct))} />
          ) : (
            <CheckCircle2 className={cn('h-4 w-4', colorTexto(pct))} />
          )}
          <span className="font-medium">{etiqueta}</span>
          {detalle && <span className="text-xs text-muted-foreground">{detalle}</span>}
        </span>
        <span className={cn('font-semibold tabular-nums', colorTexto(pct))}>
          {usado} / {limite + extra}
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', colorBarra(pct))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {periodo ? `Cada ${periodo} días` : 'Período'}
          {desde && hasta ? ` · ${formatearFecha(desde)} al ${formatearFecha(hasta)}` : ''}
        </span>
        <Badge variant={varianteBadge(pct)} className="text-[11px]">
          {pct >= 100 ? 'Agotado' : `Restan ${restante}`}
        </Badge>
      </div>
      {extra > 0 && (
        <p className="text-xs text-muted-foreground">Incluye {extra} por excepción autorizada.</p>
      )}
    </div>
  );
};

const ConsumoPacientePanel: React.FC<ConsumoPacientePanelProps> = ({ pacienteId, className }) => {
  const { data: cupo, isLoading: cargandoCupo } = useCupoMensualPaciente(pacienteId);
  const { data: resumen = [], isLoading: cargandoResumen } = useResumenConsumos(pacienteId);

  const grupos = useMemo(() => {
    return resumen
      .filter((g) => g.limite_grupo !== null && g.limite_grupo > 0)
      .map((g) => ({
        ...g,
        usado: g.consumido_grupo ?? 0,
        pct: porcentaje(g.consumido_grupo ?? 0, g.limite_grupo ?? 0),
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [resumen]);

  if (!pacienteId) return null;

  if (cargandoCupo || cargandoResumen) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            Consumo del paciente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-2 w-full" />
        </CardContent>
      </Card>
    );
  }

  const sinLimite = cupo?.sin_limite ?? true;
  const cupoPct = sinLimite ? 0 : porcentaje(cupo?.consumido ?? 0, (cupo?.limite ?? 0) + (cupo?.excepcion ?? 0));

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" />
          Consumo del paciente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              {sinLimite ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : cupoPct >= 100 ? (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              ) : (
                <CheckCircle2 className={cn('h-4 w-4', colorTexto(cupoPct))} />
              )}
              <span className="font-medium">Cupo mensual de consultas</span>
            </span>
            <span className={cn('font-semibold tabular-nums', sinLimite ? 'text-muted-foreground' : colorTexto(cupoPct))}>
              {cupo?.consumido ?? 0} / {sinLimite ? '∞' : (cupo?.limite ?? 0) + (cupo?.excepcion ?? 0)}
            </span>
          </div>
          {!sinLimite && (
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', colorBarra(cupoPct))}
                style={{ width: `${cupoPct}%` }}
              />
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {cupo?.desde && cupo?.hasta
                ? `${formatearFecha(cupo.desde)} al ${formatearFecha(cupo.hasta)}`
                : 'Mes en curso'}
            </span>
            {sinLimite ? (
              <Badge variant="secondary" className="text-[11px]">Sin límite</Badge>
            ) : (
              <Badge variant={varianteBadge(cupoPct)} className="text-[11px]">
                {cupoPct >= 100
                  ? 'Agotado'
                  : `Restan ${Math.max((cupo?.limite ?? 0) + (cupo?.excepcion ?? 0) - (cupo?.consumido ?? 0), 0)}`}
              </Badge>
            )}
          </div>
          {(cupo?.excepcion ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground">
              Incluye {cupo?.excepcion} consultas por excepción autorizada.
            </p>
          )}
        </div>

        {grupos.length > 0 && (
          <div className="border-t pt-4 space-y-4">
            <p className="text-sm font-medium">Topes por grupo de prestaciones</p>
            {grupos.map((grupo) => (
              <BarraConsumo
                key={grupo.grupo_id}
                etiqueta={grupo.grupo_nombre}
                detalle={grupo.ambito === 'solo_mendoza' ? 'Mendoza' : undefined}
                usado={grupo.usado}
                limite={grupo.limite_grupo ?? 0}
                periodo={grupo.periodo_grupo_dias}
                desde={grupo.desde}
                hasta={grupo.hasta}
              />
            ))}
          </div>
        )}

        {grupos.length === 0 && sinLimite && (
          <p className="text-sm text-muted-foreground">
            No hay topes configurados para las prestaciones de este paciente.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default ConsumoPacientePanel;
