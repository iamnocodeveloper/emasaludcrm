import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePadronCargas, estadoSemaforo } from '@/hooks/usePadronCargas';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const OBRAS_SOCIALES_OFICIALES = [
  { id: 7, nombre: 'OSPSIP' },
  { id: 8, nombre: 'OSCEARA' },
  { id: 9, nombre: 'OSCE' },
  { id: 13, nombre: 'OSPIV' },
  { id: 14, nombre: 'OSPE' },
];

const semaforoBadge = (estado: 'verde' | 'amarillo' | 'rojo') => {
  if (estado === 'verde') return <Badge className="bg-green-600 text-white">Al día</Badge>;
  if (estado === 'amarillo') return <Badge className="bg-amber-500 text-white">Mes anterior</Badge>;
  return <Badge variant="destructive">Pendiente</Badge>;
};

const PadronStatus: React.FC = () => {
  const { data: cargas = [], isLoading } = usePadronCargas();

  const ultimaPorOS = React.useMemo(() => {
    const map = new Map<number, typeof cargas[number]>();
    for (const c of cargas) {
      const prev = map.get(c.obra_social_id);
      if (!prev || c.periodo > prev.periodo) map.set(c.obra_social_id, c);
    }
    return map;
  }, [cargas]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Estado de padrones del mes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Obra Social</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último período cargado</TableHead>
                <TableHead>Fecha de carga</TableHead>
                <TableHead>Bajas aplicadas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {OBRAS_SOCIALES_OFICIALES.map(os => {
                const carga = ultimaPorOS.get(os.id);
                const estado = estadoSemaforo(carga?.periodo);
                return (
                  <TableRow key={os.id}>
                    <TableCell className="font-medium">{os.nombre}</TableCell>
                    <TableCell>{semaforoBadge(estado)}</TableCell>
                    <TableCell>
                      {carga ? format(new Date(`${carga.periodo}T00:00:00`), 'MMMM yyyy', { locale: es }) : 'Sin cargas registradas'}
                    </TableCell>
                    <TableCell>
                      {carga ? format(new Date(carga.created_at), 'dd/MM/yyyy HH:mm', { locale: es }) : '-'}
                    </TableCell>
                    <TableCell>{carga?.dados_de_baja ?? 0}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de cargas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-muted-foreground">Cargando historial...</div>
          ) : cargas.length === 0 ? (
            <div className="p-6 text-muted-foreground">Todavía no hay cargas registradas.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Obra Social</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Archivo</TableHead>
                  <TableHead>Procesados</TableHead>
                  <TableHead>Bajas</TableHead>
                  <TableHead>Errores</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargas.map(c => {
                  const errores = Array.isArray(c.errores) ? c.errores : [];
                  return (
                    <TableRow key={c.id}>
                      <TableCell>{format(new Date(c.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</TableCell>
                      <TableCell>{c.obras_sociales?.nombre || c.obra_social_id}</TableCell>
                      <TableCell>{format(new Date(`${c.periodo}T00:00:00`), 'MM/yyyy')}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{c.archivo_nombre || '-'}</TableCell>
                      <TableCell>{c.total_procesados}</TableCell>
                      <TableCell>{c.dados_de_baja}</TableCell>
                      <TableCell>
                        {errores.length === 0
                          ? <Badge className="bg-green-600 text-white">OK</Badge>
                          : <span className="text-destructive text-sm">{errores.length}</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PadronStatus;
