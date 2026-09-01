import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Upload, X } from 'lucide-react';
import { OBRAS_SOCIALES_OFICIALES } from './PadronStatus';
import { periodoActual } from '@/hooks/usePadronCargas';
import { parsePadronFile, detectarObraSocial, PadronRow } from '@/lib/padronParse';

interface PlanPersona {
  id?: number;
  dni: string | null;
  apellido: string | null;
  nombre: string | null;
  apellido_y_nombre?: string | null;
  numero_afiliado?: string | null;
}

interface PlanResult {
  obra_social_id: number;
  total_archivo: number;
  total_activos: number;
  altas: PlanPersona[];
  actualizaciones: PlanPersona[];
  reactivaciones: PlanPersona[];
  bajas: PlanPersona[];
  sin_documento: number;
}

interface ArchivoItem {
  id: string;
  file: File;
  obraSocialId: string;
}

interface AnalisisItem {
  obraSocialId: number;
  nombreOS: string;
  archivoNombre: string;
  rows: PadronRow[];
  plan: PlanResult;
  excluidos: number[];
  filasDescartadas: number;
}

const nombreOS = (id: number) =>
  OBRAS_SOCIALES_OFICIALES.find((o) => o.id === id)?.nombre ?? `Obra social ${id}`;

const personaLabel = (p: PlanPersona) =>
  p.apellido_y_nombre || `${p.apellido ?? ''}${p.nombre ? ', ' + p.nombre : ''}`.trim() || '(sin nombre)';

const PersonasTable: React.FC<{ personas: PlanPersona[]; vacio: string }> = ({ personas, vacio }) => {
  if (personas.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">{vacio}</p>;
  }
  return (
    <div className="max-h-72 overflow-y-auto border border-border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Paciente</TableHead>
            <TableHead className="w-32">DNI</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {personas.slice(0, 500).map((p, i) => (
            <TableRow key={`${p.dni}-${i}`}>
              <TableCell>{personaLabel(p)}</TableCell>
              <TableCell>{p.dni ?? '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {personas.length > 500 && (
        <p className="text-xs text-muted-foreground p-2">Mostrando 500 de {personas.length}.</p>
      )}
    </div>
  );
};

const PadronSync: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [periodo, setPeriodo] = useState<string>(periodoActual().slice(0, 7));
  const [archivos, setArchivos] = useState<ArchivoItem[]>([]);
  const [analisis, setAnalisis] = useState<AnalisisItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progreso, setProgreso] = useState<{ current: number; total: number; label: string } | null>(null);

  const onFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const nuevos: ArchivoItem[] = Array.from(fileList).map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      obraSocialId: String(detectarObraSocial(file.name, OBRAS_SOCIALES_OFICIALES) ?? ''),
    }));
    setArchivos((prev) => [...prev, ...nuevos]);
    setAnalisis(null);
  };

  const analizar = async () => {
    if (archivos.length === 0) {
      toast({ title: 'Faltan archivos', description: 'Subí al menos un padrón.', variant: 'destructive' });
      return;
    }
    if (archivos.some((a) => !a.obraSocialId)) {
      toast({ title: 'Falta obra social', description: 'Asigná la obra social de cada archivo.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setAnalisis(null);
    try {
      const resultados: AnalisisItem[] = [];
      for (let i = 0; i < archivos.length; i++) {
        const item = archivos[i];
        setProgreso({ current: i + 1, total: archivos.length, label: `Analizando ${item.file.name}` });

        const parsed = await parsePadronFile(item.file);
        if (parsed.rows.length === 0) {
          throw new Error(`No se detectaron pacientes con documento en "${item.file.name}".`);
        }

        const obraSocialId = Number(item.obraSocialId);
        const { data, error } = await supabase.functions.invoke('padron-sync', {
          body: { action: 'plan', obra_social_id: obraSocialId, rows: parsed.rows },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);

        resultados.push({
          obraSocialId,
          nombreOS: nombreOS(obraSocialId),
          archivoNombre: item.file.name,
          rows: parsed.rows,
          plan: data as PlanResult,
          excluidos: [],
          filasDescartadas: parsed.filasDescartadas,
        });
      }
      setAnalisis(resultados);
    } catch (e: any) {
      toast({ title: 'Error al analizar', description: e.message, variant: 'destructive' });
    } finally {
      setProgreso(null);
      setLoading(false);
    }
  };

  const toggleExcluido = (obraSocialId: number, pacienteId: number) => {
    setAnalisis((prev) =>
      prev?.map((a) =>
        a.obraSocialId !== obraSocialId
          ? a
          : {
              ...a,
              excluidos: a.excluidos.includes(pacienteId)
                ? a.excluidos.filter((id) => id !== pacienteId)
                : [...a.excluidos, pacienteId],
            }
      ) ?? prev
    );
  };

  const aplicar = async () => {
    if (!analisis) return;
    const { data: authData } = await supabase.auth.getUser();
    const usuarioId = authData?.user?.id ?? null;

    setApplying(true);
    try {
      const resumen: string[] = [];

      for (const item of analisis) {
        const batchSize = 200;
        const totalBatches = Math.ceil(item.rows.length / batchSize);
        let creados = 0;
        let actualizados = 0;
        let reactivados = 0;
        const errores: string[] = [];

        for (let b = 0; b < totalBatches; b++) {
          setProgreso({
            current: b + 1,
            total: totalBatches,
            label: `${item.nombreOS}: procesando pacientes (${b + 1}/${totalBatches})`,
          });
          const batch = item.rows.slice(b * batchSize, (b + 1) * batchSize);
          const { data, error } = await supabase.functions.invoke('padron-sync', {
            body: { action: 'apply_sync', obra_social_id: item.obraSocialId, rows: batch },
          });
          if (error) throw error;
          if ((data as any)?.error) throw new Error((data as any).error);
          creados += (data as any).creados ?? 0;
          actualizados += (data as any).actualizados ?? 0;
          reactivados += (data as any).reactivados ?? 0;
          errores.push(...((data as any).errores ?? []));
        }

        const idsBaja = item.plan.bajas
          .filter((p) => p.id !== undefined && !item.excluidos.includes(p.id))
          .map((p) => p.id as number);

        setProgreso({ current: 1, total: 1, label: `${item.nombreOS}: aplicando bajas` });
        const { data: applyData, error: applyError } = await supabase.functions.invoke('padron-sync', {
          body: {
            action: 'apply',
            obra_social_id: item.obraSocialId,
            periodo: `${periodo}-01`,
            paciente_ids: idsBaja,
            archivo_nombre: item.archivoNombre,
            total_procesados: item.rows.length,
            creados,
            actualizados,
            reactivados,
            errores: errores.slice(0, 200),
            usuario_id: usuarioId,
          },
        });
        if (applyError) throw applyError;
        if ((applyData as any)?.error) throw new Error((applyData as any).error);

        resumen.push(
          `${item.nombreOS}: ${creados} altas, ${reactivados} reactivados, ${actualizados} actualizados, ${(applyData as any).dados_de_baja} bajas`
        );
      }

      toast({ title: 'Sincronización aplicada', description: resumen.join(' · ') });
      setAnalisis(null);
      setArchivos([]);
      queryClient.invalidateQueries({ queryKey: ['padron-cargas'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['autorizaciones'] });
    } catch (e: any) {
      toast({ title: 'Error al aplicar', description: e.message, variant: 'destructive' });
    } finally {
      setProgreso(null);
      setApplying(false);
    }
  };

  const bajasTotales =
    analisis?.reduce(
      (acc, a) => acc + a.plan.bajas.filter((p) => p.id !== undefined && !a.excluidos.includes(p.id)).length,
      0
    ) ?? 0;

  const hayRiesgo = analisis?.some(
    (a) => a.plan.total_activos > 0 && a.plan.total_archivo < a.plan.total_activos * 0.5
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Sincronizar padrones del mes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Subí uno o varios padrones vigentes. El sistema da de alta a los nuevos, actualiza y reactiva a los que
            figuran, y da de baja (bloqueados para autorizaciones) a los activos que ya no aparecen en el archivo.
            Nada se aplica hasta que confirmes.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Período</Label>
            <Input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Archivos de padrón</Label>
            <Input
              type="file"
              multiple
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                onFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {archivos.length > 0 && (
          <div className="space-y-2">
            {archivos.map((a) => (
              <div key={a.id} className="flex flex-col md:flex-row md:items-center gap-2 border border-border rounded-md p-2">
                <span className="flex-1 text-sm truncate">{a.file.name}</span>
                <Select
                  value={a.obraSocialId}
                  onValueChange={(v) => {
                    setArchivos((prev) => prev.map((x) => (x.id === a.id ? { ...x, obraSocialId: v } : x)));
                    setAnalisis(null);
                  }}
                >
                  <SelectTrigger className="w-full md:w-52">
                    <SelectValue placeholder="Obra social" />
                  </SelectTrigger>
                  <SelectContent>
                    {OBRAS_SOCIALES_OFICIALES.map((os) => (
                      <SelectItem key={os.id} value={String(os.id)}>
                        {os.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setArchivos((prev) => prev.filter((x) => x.id !== a.id));
                    setAnalisis(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button onClick={analizar} disabled={loading || applying || archivos.length === 0}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analizando...
            </>
          ) : (
            'Analizar padrones'
          )}
        </Button>

        {progreso && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{progreso.label}</p>
            <Progress value={(progreso.current / Math.max(progreso.total, 1)) * 100} />
          </div>
        )}

        {analisis && (
          <div className="space-y-4">
            {hayRiesgo && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Alguno de los archivos tiene menos de la mitad de los pacientes activos actuales. Revisá que el
                  archivo esté completo antes de confirmar: se darían de baja muchos pacientes.
                </AlertDescription>
              </Alert>
            )}

            <Accordion type="multiple" defaultValue={analisis.map((a) => String(a.obraSocialId))}>
              {analisis.map((a) => {
                const bajasActivas = a.plan.bajas.filter((p) => p.id !== undefined && !a.excluidos.includes(p.id));
                return (
                  <AccordionItem key={a.obraSocialId} value={String(a.obraSocialId)}>
                    <AccordionTrigger>
                      <div className="flex flex-wrap items-center gap-2 text-left">
                        <span className="font-semibold">{a.nombreOS}</span>
                        <span className="text-xs text-muted-foreground">{a.archivoNombre}</span>
                        <Badge className="bg-green-600 text-white">{a.plan.altas.length} altas</Badge>
                        <Badge className="bg-blue-600 text-white">{a.plan.reactivaciones.length} reactivan</Badge>
                        <Badge variant="secondary">{a.plan.actualizaciones.length} actualizan</Badge>
                        <Badge variant="destructive">{bajasActivas.length} bajas</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">En el archivo</p>
                          <p className="text-xl font-bold">{a.plan.total_archivo}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Activos en sistema</p>
                          <p className="text-xl font-bold">{a.plan.total_activos}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Quedarán activos</p>
                          <p className="text-xl font-bold">
                            {a.plan.total_activos + a.plan.altas.length + a.plan.reactivaciones.length - bajasActivas.length}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Filas sin documento</p>
                          <p className="text-xl font-bold">{a.filasDescartadas}</p>
                        </div>
                      </div>

                      <Tabs defaultValue="bajas">
                        <TabsList>
                          <TabsTrigger value="bajas">Bajas ({a.plan.bajas.length})</TabsTrigger>
                          <TabsTrigger value="altas">Altas ({a.plan.altas.length})</TabsTrigger>
                          <TabsTrigger value="react">Reactivaciones ({a.plan.reactivaciones.length})</TabsTrigger>
                          <TabsTrigger value="upd">Actualizaciones ({a.plan.actualizaciones.length})</TabsTrigger>
                        </TabsList>

                        <TabsContent value="bajas">
                          {a.plan.bajas.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4">
                              Ningún paciente activo quedó fuera del archivo.
                            </p>
                          ) : (
                            <div className="max-h-72 overflow-y-auto border border-border rounded-md">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-12">Baja</TableHead>
                                    <TableHead>Paciente</TableHead>
                                    <TableHead className="w-32">DNI</TableHead>
                                    <TableHead className="w-32">N° Afiliado</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {a.plan.bajas.map((p) => (
                                    <TableRow key={p.id}>
                                      <TableCell>
                                        <Checkbox
                                          checked={!a.excluidos.includes(p.id as number)}
                                          onCheckedChange={() => toggleExcluido(a.obraSocialId, p.id as number)}
                                        />
                                      </TableCell>
                                      <TableCell>{personaLabel(p)}</TableCell>
                                      <TableCell>{p.dni ?? '-'}</TableCell>
                                      <TableCell>{p.numero_afiliado || '-'}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </TabsContent>

                        <TabsContent value="altas">
                          <PersonasTable personas={a.plan.altas} vacio="No hay pacientes nuevos en este archivo." />
                        </TabsContent>
                        <TabsContent value="react">
                          <PersonasTable
                            personas={a.plan.reactivaciones}
                            vacio="No hay pacientes dados de baja que reingresen."
                          />
                        </TabsContent>
                        <TabsContent value="upd">
                          <PersonasTable personas={a.plan.actualizaciones} vacio="No hay pacientes a actualizar." />
                        </TabsContent>
                      </Tabs>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>

            <div className="flex flex-wrap gap-2">
              <Button onClick={aplicar} disabled={applying}>
                {applying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Aplicando...
                  </>
                ) : (
                  `Aplicar sincronización (${bajasTotales} bajas)`
                )}
              </Button>
              <Button variant="outline" onClick={() => setAnalisis(null)} disabled={applying}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PadronSync;
