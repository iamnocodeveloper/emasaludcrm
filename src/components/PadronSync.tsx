import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Upload } from 'lucide-react';
import { OBRAS_SOCIALES_OFICIALES } from './PadronStatus';
import { periodoActual } from '@/hooks/usePadronCargas';

interface Ausente {
  id: number;
  dni: string | null;
  apellido: string | null;
  nombre: string | null;
  numero_afiliado: string | null;
}

const extractDnis = (rows: any[][]): string[] => {
  const dnis: string[] = [];
  for (const row of rows) {
    for (const cell of row) {
      const raw = String(cell ?? '').replace(/\D/g, '');
      if (raw.length >= 7 && raw.length <= 11) dnis.push(raw);
    }
  }
  return dnis;
};

const PadronSync: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [obraSocialId, setObraSocialId] = useState<string>('');
  const [periodo, setPeriodo] = useState<string>(periodoActual().slice(0, 7));
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [diff, setDiff] = useState<{ total_activos: number; total_archivo: number; ausentes: Ausente[] } | null>(null);
  const [excluidos, setExcluidos] = useState<number[]>([]);

  const analizar = async () => {
    if (!file || !obraSocialId) {
      toast({ title: 'Faltan datos', description: 'Elegí la obra social y el archivo del padrón.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setDiff(null);
    setExcluidos([]);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false });
      const dnis = extractDnis(rows);

      if (dnis.length === 0) throw new Error('No se detectaron documentos en el archivo.');

      const { data, error } = await supabase.functions.invoke('padron-sync', {
        body: { action: 'diff', obra_social_id: Number(obraSocialId), dnis },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      setDiff(data as any);
    } catch (e: any) {
      toast({ title: 'Error al analizar', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const confirmar = async (aplicarBajas: boolean) => {
    if (!diff || !obraSocialId) return;
    setApplying(true);
    try {
      const ids = aplicarBajas ? diff.ausentes.filter(a => !excluidos.includes(a.id)).map(a => a.id) : [];
      const { data: authData } = await supabase.auth.getUser();

      const { data, error } = await supabase.functions.invoke('padron-sync', {
        body: {
          action: 'apply',
          obra_social_id: Number(obraSocialId),
          periodo: `${periodo}-01`,
          paciente_ids: ids,
          archivo_nombre: file?.name ?? null,
          total_procesados: diff.total_archivo,
          usuario_id: authData?.user?.id ?? null,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast({
        title: aplicarBajas ? 'Bajas aplicadas' : 'Carga registrada',
        description: `${(data as any).dados_de_baja} pacientes dados de baja. Carga del período registrada.`,
      });
      setDiff(null);
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['padron-cargas'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const aBajar = diff ? diff.ausentes.filter(a => !excluidos.includes(a.id)).length : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Sincronizar padrón del mes (detectar bajas)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Subí el padrón vigente: el sistema compara contra los pacientes activos de esa obra social y muestra
            los que ya no figuran, para darlos de baja luego de tu confirmación.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Obra Social</Label>
            <Select value={obraSocialId} onValueChange={setObraSocialId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {OBRAS_SOCIALES_OFICIALES.map(os => (
                  <SelectItem key={os.id} value={String(os.id)}>{os.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Período</Label>
            <Input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Archivo del padrón</Label>
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
        </div>

        <Button onClick={analizar} disabled={loading}>
          {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analizando...</> : 'Comparar con el padrón vigente'}
        </Button>

        {diff && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div><p className="text-sm text-muted-foreground">Documentos en archivo</p><p className="text-2xl font-bold">{diff.total_archivo}</p></div>
              <div><p className="text-sm text-muted-foreground">Activos en sistema</p><p className="text-2xl font-bold">{diff.total_activos}</p></div>
              <div><p className="text-sm text-muted-foreground">Ausentes (a dar de baja)</p><p className="text-2xl font-bold text-destructive">{aBajar}</p></div>
            </div>

            {diff.ausentes.length > 0 && (
              <div className="max-h-80 overflow-y-auto border border-border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Baja</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>DNI</TableHead>
                      <TableHead>N° Afiliado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diff.ausentes.map(a => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <Checkbox
                            checked={!excluidos.includes(a.id)}
                            onCheckedChange={() =>
                              setExcluidos(prev => prev.includes(a.id) ? prev.filter(id => id !== a.id) : [...prev, a.id])
                            }
                          />
                        </TableCell>
                        <TableCell>{a.apellido}, {a.nombre}</TableCell>
                        <TableCell>{a.dni}</TableCell>
                        <TableCell>{a.numero_afiliado || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="destructive" onClick={() => confirmar(true)} disabled={applying || aBajar === 0}>
                {applying ? 'Procesando...' : `Confirmar bajas (${aBajar})`}
              </Button>
              <Button variant="outline" onClick={() => confirmar(false)} disabled={applying}>
                Registrar carga sin bajas
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PadronSync;
