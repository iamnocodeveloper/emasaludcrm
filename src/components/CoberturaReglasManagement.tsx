import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Save, Search, ShieldAlert, Trash2 } from 'lucide-react';
import {
  CoberturaGrupo,
  useAsignarPractica,
  useCoberturaExcepciones,
  useCoberturaGrupos,
  useCoberturaPracticas,
  useDeleteCoberturaExcepcion,
  useDeleteCoberturaPractica,
  useUpsertCoberturaExcepcion,
  useUpsertCoberturaGrupo,
  useUpdateCoberturaPractica,
} from '@/hooks/useCoberturaReglas';
import { useNomecladorSearch } from '@/hooks/useNomeclador';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePatientSearch } from '@/hooks/usePatientSearch';

const numeroONull = (value: string): number | null => {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const GrupoFila: React.FC<{ grupo: CoberturaGrupo }> = ({ grupo }) => {
  const upsert = useUpsertCoberturaGrupo();
  const [limitePractica, setLimitePractica] = useState(String(grupo.limite_practica_default ?? ''));
  const [periodoPractica, setPeriodoPractica] = useState(String(grupo.periodo_practica_default ?? ''));
  const [limiteGrupo, setLimiteGrupo] = useState(String(grupo.limite_grupo ?? ''));
  const [periodoGrupo, setPeriodoGrupo] = useState(String(grupo.periodo_grupo_dias ?? ''));
  const [ambito, setAmbito] = useState(grupo.ambito);
  const [activo, setActivo] = useState(grupo.activo);

  useEffect(() => {
    setLimitePractica(String(grupo.limite_practica_default ?? ''));
    setPeriodoPractica(String(grupo.periodo_practica_default ?? ''));
    setLimiteGrupo(String(grupo.limite_grupo ?? ''));
    setPeriodoGrupo(String(grupo.periodo_grupo_dias ?? ''));
    setAmbito(grupo.ambito);
    setActivo(grupo.activo);
  }, [grupo]);

  const guardar = () => {
    upsert.mutate({
      id: grupo.id,
      codigo: grupo.codigo,
      nombre: grupo.nombre,
      limite_practica_default: numeroONull(limitePractica),
      periodo_practica_default: numeroONull(periodoPractica),
      limite_grupo: numeroONull(limiteGrupo),
      periodo_grupo_dias: numeroONull(periodoGrupo),
      ambito,
      activo,
    });
  };

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{grupo.nombre}</div>
        <div className="text-xs text-muted-foreground font-mono">{grupo.codigo}</div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min="0"
            className="w-16"
            value={limitePractica}
            onChange={(e) => setLimitePractica(e.target.value)}
            placeholder="—"
          />
          <span className="text-xs text-muted-foreground">cada</span>
          <Input
            type="number"
            min="0"
            className="w-16"
            value={periodoPractica}
            onChange={(e) => setPeriodoPractica(e.target.value)}
            placeholder="—"
          />
          <span className="text-xs text-muted-foreground">días</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min="0"
            className="w-16"
            value={limiteGrupo}
            onChange={(e) => setLimiteGrupo(e.target.value)}
            placeholder="—"
          />
          <span className="text-xs text-muted-foreground">cada</span>
          <Input
            type="number"
            min="0"
            className="w-16"
            value={periodoGrupo}
            onChange={(e) => setPeriodoGrupo(e.target.value)}
            placeholder="—"
          />
          <span className="text-xs text-muted-foreground">días</span>
        </div>
      </TableCell>
      <TableCell>
        <Select value={ambito} onValueChange={setAmbito}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="solo_mendoza">Sólo Mendoza</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Switch checked={activo} onCheckedChange={setActivo} />
      </TableCell>
      <TableCell>
        <Button size="sm" variant="outline" onClick={guardar} disabled={upsert.isPending}>
          <Save className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
};

const PracticaFila: React.FC<{
  practica: NonNullable<ReturnType<typeof useCoberturaPracticas>['data']>[number];
}> = ({ practica }) => {
  const actualizar = useUpdateCoberturaPractica();
  const eliminar = useDeleteCoberturaPractica();
  const [limite, setLimite] = useState(String(practica.limite_practica ?? ''));
  const [periodo, setPeriodo] = useState(String(practica.periodo_practica_dias ?? ''));
  const [activo, setActivo] = useState(practica.activo);

  useEffect(() => {
    setLimite(String(practica.limite_practica ?? ''));
    setPeriodo(String(practica.periodo_practica_dias ?? ''));
    setActivo(practica.activo);
  }, [practica]);

  return (
    <TableRow>
      <TableCell className="font-mono text-sm">{practica.codigo_practica}</TableCell>
      <TableCell className="max-w-xs truncate">
        {practica.descripcion_practica || '—'}
      </TableCell>
      <TableCell>{practica.cobertura_grupos?.nombre || '—'}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min="0"
            className="w-16"
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            placeholder="hereda"
          />
          <span className="text-xs text-muted-foreground">cada</span>
          <Input
            type="number"
            min="0"
            className="w-16"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            placeholder="hereda"
          />
        </div>
      </TableCell>
      <TableCell>
        <Switch
          checked={activo}
          onCheckedChange={(value) => {
            setActivo(value);
            actualizar.mutate({ id: practica.id, activo: value });
          }}
        />
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={actualizar.isPending}
            onClick={() =>
              actualizar.mutate({
                id: practica.id,
                limite_practica: numeroONull(limite),
                periodo_practica_dias: numeroONull(periodo),
              })
            }
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={eliminar.isPending}
            onClick={() => eliminar.mutate(practica.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

const AsignarPracticaForm: React.FC<{ grupos: CoberturaGrupo[] }> = ({ grupos }) => {
  const [termino, setTermino] = useState('');
  const [codigo, setCodigo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [grupoId, setGrupoId] = useState<string>('');
  const { data: sugerencias = [] } = useNomecladorSearch(termino);
  const asignar = useAsignarPractica();

  const limpiar = () => {
    setTermino('');
    setCodigo('');
    setDescripcion('');
    setGrupoId('');
  };

  const asignarPractica = () => {
    if (!codigo || !grupoId) return;
    asignar.mutate(
      { codigo_practica: codigo, grupo_id: Number(grupoId) },
      { onSuccess: limpiar }
    );
  };

  return (
    <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto] md:items-end">
      <div className="space-y-2">
        <Label>Práctica del nomenclador</Label>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por código o descripción..."
            value={termino}
            onChange={(e) => setTermino(e.target.value)}
          />
          {termino.length > 1 && sugerencias.length > 0 && (
            <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-md border bg-popover shadow-lg">
              {sugerencias.slice(0, 12).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
                  onClick={() => {
                    setCodigo(s.codigo_practica);
                    setDescripcion(s.descripcion_practica);
                    setTermino('');
                  }}
                >
                  <span className="font-mono font-medium">{s.codigo_practica}</span>
                  <span className="ml-2 text-muted-foreground">{s.descripcion_practica}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {codigo && (
          <p className="text-sm text-muted-foreground">
            Seleccionada: <span className="font-mono font-medium">{codigo}</span> — {descripcion}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Grupo / categoría</Label>
        <Select value={grupoId} onValueChange={setGrupoId}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar grupo" />
          </SelectTrigger>
          <SelectContent>
            {grupos.map((grupo) => (
              <SelectItem key={grupo.id} value={String(grupo.id)}>
                {grupo.nombre}
                {grupo.ambito === 'solo_mendoza' ? ' (Mendoza)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={asignarPractica} disabled={!codigo || !grupoId || asignar.isPending}>
        <Plus className="h-4 w-4 mr-2" />
        Asignar
      </Button>
    </div>
  );
};

const ExcepcionDialog: React.FC<{
  grupos: CoberturaGrupo[];
  onCreated: () => void;
}> = ({ grupos, onCreated }) => {
  const [open, setOpen] = useState(false);
  const [busquedaPaciente, setBusquedaPaciente] = useState('');
  const [pacienteId, setPacienteId] = useState<number | null>(null);
  const [pacienteNombre, setPacienteNombre] = useState('');
  const [alcance, setAlcance] = useState<'grupo' | 'practica' | 'global'>('grupo');
  const [grupoId, setGrupoId] = useState('');
  const [codigoPractica, setCodigoPractica] = useState('');
  const [cantidadExtra, setCantidadExtra] = useState('1');
  const [vigenteDesde, setVigenteDesde] = useState(new Date().toISOString().slice(0, 10));
  const [vigenteHasta, setVigenteHasta] = useState('');
  const [justificacion, setJustificacion] = useState('');
  const [expediente, setExpediente] = useState('');
  const { data: pacientes = [] } = usePatientSearch(busquedaPaciente, 6, 400);
  const { data: currentUser } = useCurrentUser();
  const crear = useUpsertCoberturaExcepcion();

  const valido =
    pacienteId !== null &&
    justificacion.trim().length >= 5 &&
    (alcance === 'grupo'
      ? !!grupoId
      : alcance === 'practica'
        ? codigoPractica.trim().length > 0
        : true);

  const registrar = () => {
    if (!valido || pacienteId === null) return;

    crear.mutate(
      {
        paciente_id: pacienteId,
        grupo_id: alcance === 'grupo' ? Number(grupoId) : null,
        codigo_practica: alcance === 'practica' ? codigoPractica.trim() : null,
        cantidad_extra: Math.max(Number(cantidadExtra) || 1, 1),
        vigente_desde: vigenteDesde,
        vigente_hasta: vigenteHasta || null,
        justificacion: justificacion.trim(),
        responsable_nombre: currentUser?.full_name ?? null,
        numero_expediente: expediente.trim() || null,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setPacienteId(null);
          setPacienteNombre('');
          setBusquedaPaciente('');
          setJustificacion('');
          setCodigoPractica('');
          setGrupoId('');
          setExpediente('');
          onCreated();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nueva excepción
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar excepción de cupo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Paciente</Label>
            <Input
              placeholder="Buscar por DNI o nombre..."
              value={pacienteNombre || busquedaPaciente}
              onChange={(e) => {
                setBusquedaPaciente(e.target.value);
                setPacienteId(null);
                setPacienteNombre('');
              }}
            />
            {pacienteId === null && busquedaPaciente.trim().length >= 2 && pacientes.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-md border">
                {pacientes.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
                    onClick={() => {
                      setPacienteId(p.id);
                      setPacienteNombre(`${p.apellido}, ${p.nombre} — DNI ${p.dni}`);
                      setBusquedaPaciente('');
                    }}
                  >
                    {p.apellido}, {p.nombre} — DNI {p.dni}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Alcance</Label>
              <Select value={alcance} onValueChange={(v) => setAlcance(v as 'grupo' | 'practica' | 'global')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grupo">Todo un grupo</SelectItem>
                  <SelectItem value="practica">Una práctica puntual</SelectItem>
                  <SelectItem value="global">Cupo mensual del paciente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cupo adicional</Label>
              <Input
                type="number"
                min="1"
                value={cantidadExtra}
                onChange={(e) => setCantidadExtra(e.target.value)}
              />
            </div>
          </div>

          {alcance === 'grupo' ? (
            <div className="space-y-2">
              <Label>Grupo</Label>
              <Select value={grupoId} onValueChange={setGrupoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar grupo" />
                </SelectTrigger>
                <SelectContent>
                  {grupos.map((grupo) => (
                    <SelectItem key={grupo.id} value={String(grupo.id)}>
                      {grupo.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : alcance === 'practica' ? (
            <div className="space-y-2">
              <Label>Código de práctica</Label>
              <Input
                value={codigoPractica}
                onChange={(e) => setCodigoPractica(e.target.value)}
                placeholder="Ej: 420101"
                className="font-mono"
              />
            </div>
          ) : (
            <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              Esta excepción suma cupo al límite mensual asignado al paciente
              (<span className="font-mono">consultas_maximas</span>), sin tocar los topes
              por práctica ni por grupo.
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Vigente desde</Label>
              <Input type="date" value={vigenteDesde} onChange={(e) => setVigenteDesde(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Vigente hasta</Label>
              <Input type="date" value={vigenteHasta} onChange={(e) => setVigenteHasta(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>N° de expediente / autorización</Label>
            <Input value={expediente} onChange={(e) => setExpediente(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Justificación *</Label>
            <Textarea
              rows={3}
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
              placeholder="Motivo clínico y responsable de la autorización"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Se registrará como responsable a {currentUser?.full_name || 'el usuario actual'} con fecha y hora.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={registrar} disabled={!valido || crear.isPending}>
              Registrar excepción
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const CoberturaReglasManagement: React.FC = () => {
  const { data: grupos = [], isLoading: cargandoGrupos } = useCoberturaGrupos();
  const { data: practicas = [], isLoading: cargandoPracticas } = useCoberturaPracticas();
  const { data: excepciones = [], isLoading: cargandoExcepciones } = useCoberturaExcepciones();
  const anularExcepcion = useDeleteCoberturaExcepcion();

  const practicasPorGrupo = useMemo(() => {
    const mapa = new Map<number, number>();
    practicas.forEach((p) => {
      mapa.set(p.grupo_id, (mapa.get(p.grupo_id) ?? 0) + 1);
    });
    return mapa;
  }, [practicas]);

  const gruposSinPracticas = useMemo(
    () => grupos.filter((g) => (practicasPorGrupo.get(g.id) ?? 0) === 0).length,
    [grupos, practicasPorGrupo]
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Topes de prestaciones</h2>
        <p className="text-muted-foreground">
          Configuración de cupos por práctica y por grupo. La validación se ejecuta en la base
          de datos antes de autorizar cualquier prestación.
        </p>
      </div>

      {gruposSinPracticas > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex items-start gap-3 pt-6 text-sm text-amber-900">
            <ShieldAlert className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">
                {gruposSinPracticas} de {grupos.length} grupos todavía no tienen prácticas asignadas.
              </p>
              <p>
                Las prácticas sin grupo se autorizan sin control de cupo. Asignálas en la pestaña
                «Prácticas» para que los topes se apliquen.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="grupos">
        <TabsList>
          <TabsTrigger value="grupos">Grupos y topes</TabsTrigger>
          <TabsTrigger value="practicas">Prácticas</TabsTrigger>
          <TabsTrigger value="excepciones">Excepciones</TabsTrigger>
        </TabsList>

        <TabsContent value="grupos">
          <Card>
            <CardHeader>
              <CardTitle>Topes por grupo</CardTitle>
              <CardDescription>
                «Práctica» limita cada código por separado; «Grupo» limita el total de la
                categoría. Ambas condiciones deben cumplirse.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {cargandoGrupos ? (
                <p className="text-sm text-muted-foreground">Cargando reglas...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Tope por práctica</TableHead>
                      <TableHead>Tope por grupo</TableHead>
                      <TableHead>Ámbito</TableHead>
                      <TableHead>Activo</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grupos.map((grupo) => (
                      <GrupoFila key={grupo.id} grupo={grupo} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="practicas">
          <Card>
            <CardHeader>
              <CardTitle>Prácticas con tope</CardTitle>
              <CardDescription>
                Vincula cada código del nomenclador con su grupo. Si no se define un tope
                propio, hereda el del grupo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <AsignarPracticaForm grupos={grupos} />

              {cargandoPracticas ? (
                <p className="text-sm text-muted-foreground">Cargando prácticas...</p>
              ) : practicas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no hay prácticas asignadas. Mientras no se asignen, no se aplican topes.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Grupo</TableHead>
                        <TableHead>Tope propio</TableHead>
                        <TableHead>Activo</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {practicas.map((practica) => (
                        <PracticaFila key={practica.id} practica={practica} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="excepciones">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Excepciones autorizadas</CardTitle>
                <CardDescription>
                  Cada excepción suma cupo a un paciente y queda registrada con responsable,
                  fecha y justificación.
                </CardDescription>
              </div>
              <ExcepcionDialog grupos={grupos} onCreated={() => undefined} />
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {cargandoExcepciones ? (
                <p className="text-sm text-muted-foreground">Cargando excepciones...</p>
              ) : excepciones.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay excepciones registradas.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Alcance</TableHead>
                      <TableHead>Cupo extra</TableHead>
                      <TableHead>Vigencia</TableHead>
                      <TableHead>Justificación</TableHead>
                      <TableHead>Responsable</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {excepciones.map((excepcion) => (
                      <TableRow key={excepcion.id}>
                        <TableCell>
                          <div className="font-medium">
                            {excepcion.pacientes
                              ? `${excepcion.pacientes.apellido}, ${excepcion.pacientes.nombre}`
                              : `Paciente ${excepcion.paciente_id}`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            DNI {excepcion.pacientes?.dni || '—'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {excepcion.codigo_practica
                            ? `Práctica ${excepcion.codigo_practica}`
                            : excepcion.cobertura_grupos?.nombre || 'Cupo mensual'}
                        </TableCell>
                        <TableCell>+{excepcion.cantidad_extra}</TableCell>
                        <TableCell className="text-sm">
                          {excepcion.vigente_desde}
                          {excepcion.vigente_hasta ? ` → ${excepcion.vigente_hasta}` : ' → sin límite'}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate">{excepcion.justificacion}</div>
                          {excepcion.numero_expediente && (
                            <div className="text-xs text-muted-foreground">
                              Exp. {excepcion.numero_expediente}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {excepcion.responsable_nombre || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={excepcion.activo ? 'default' : 'outline'}>
                            {excepcion.activo ? 'Vigente' : 'Anulada'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {excepcion.activo && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              disabled={anularExcepcion.isPending}
                              onClick={() => anularExcepcion.mutate(excepcion.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CoberturaReglasManagement;
