
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAutorizacionesInfinite, useUpdateAutorizacion, useDeleteAutorizacion, useCreateAutorizacion, AUTORIZACIONES_PAGE_SIZE } from '@/hooks/useAutorizaciones';
import { usePatientSearch } from '@/hooks/usePatientSearch';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import AutorizacionForm from './AutorizacionForm';
import AutorizacionPDF from './AutorizacionPDF';
import { Plus, Edit, Trash2, Search, AlertTriangle, User, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';

const AutorizacionManagement = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAutorizacion, setSelectedAutorizacion] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  // New: patient search first flow
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  const { data: autorizacionesPages, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAutorizacionesInfinite(AUTORIZACIONES_PAGE_SIZE);
  const autorizaciones = React.useMemo(() => autorizacionesPages?.pages.flatMap(p => p.items) ?? [], [autorizacionesPages]);
  const { data: patients = [] } = usePatientSearch(patientSearchTerm, 8, 400);

  const { data: currentUser } = useCurrentUser();
  const updateAutorizacion = useUpdateAutorizacion();
  const deleteAutorizacion = useDeleteAutorizacion();
  const createAutorizacion = useCreateAutorizacion();
  const { toast } = useToast();

  const selectedPatient = patients?.find(p => p.id === selectedPatientId);

  // Filter patients by search
  const filteredPatients = patientSearchTerm.trim().length >= 3 ? patients : [];

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case 'pendiente': return <Badge variant="secondary">Pendiente</Badge>;
      case 'aprobada': return <Badge variant="default">Aprobada</Badge>;
      case 'rechazada': return <Badge variant="destructive">Rechazada</Badge>;
      case 'vencida': return <Badge variant="outline">Vencida</Badge>;
      default: return <Badge>{estado}</Badge>;
    }
  };

  const handleStatusChange = async (autorizacionId: number, newStatus: string) => {
    try {
      await updateAutorizacion.mutateAsync({ id: autorizacionId, data: { estado: newStatus as any } });
      toast({ title: "Estado actualizado", description: "El estado de la autorización se ha actualizado exitosamente." });
    } catch (error: any) {
      toast({ title: "Error", description: `Error al actualizar el estado: ${error.message}`, variant: "destructive" });
    }
  };

  const handleDelete = async (autorizacionId: number) => {
    try {
      await deleteAutorizacion.mutateAsync(autorizacionId);
      toast({ title: "Autorización eliminada", description: "La autorización se ha eliminado exitosamente." });
      setSelectedIds(prev => prev.filter(id => id !== autorizacionId));
    } catch (error: any) {
      toast({ title: "Error", description: `Error al eliminar la autorización: ${error.message}`, variant: "destructive" });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(selectedIds.map(id => deleteAutorizacion.mutateAsync(id)));
      toast({ title: "Autorizaciones eliminadas", description: `Se eliminaron ${selectedIds.length} autorizaciones exitosamente.` });
      setSelectedIds([]);
    } catch (error: any) {
      toast({ title: "Error", description: `Error al eliminar las autorizaciones: ${error.message}`, variant: "destructive" });
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredAutorizaciones.length) setSelectedIds([]);
    else setSelectedIds(filteredAutorizaciones.map(a => a.id));
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]);
  };

  const handleFormSubmit = async (data: any) => {
    try {
      if (selectedAutorizacion) {
        await updateAutorizacion.mutateAsync({ id: selectedAutorizacion.id, data });
      } else {
        await createAutorizacion.mutateAsync(data);
      }
      setIsFormOpen(false);
      setSelectedAutorizacion(null);
    } catch (error) {}
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedAutorizacion(null);
  };

  const canCreateAutorizacion = () => {
    if (!selectedPatient) return false;
    const estado = (selectedPatient as any).estado_padron;
    if (estado === 'BDA' || estado === 'FDP') return false;
    const max = selectedPatient.consultas_maximas ?? 999;
    const actual = selectedPatient.consultas_mes_actual ?? 0;
    if (actual >= max) return false;
    return true;
  };

  // Filter autorizaciones - if patient selected, show only theirs
  const filteredAutorizaciones = autorizaciones?.filter(autorizacion => {
    if (selectedPatientId && autorizacion.paciente_id !== selectedPatientId) return false;
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const safeIncludes = (str: string | null | undefined, term: string) => str ? str.toLowerCase().includes(term) : false;
      const pacienteMatch = safeIncludes(autorizacion.pacientes?.nombre, searchLower) ||
                           safeIncludes(autorizacion.pacientes?.apellido, searchLower) ||
                           safeIncludes(autorizacion.pacientes?.dni, searchTerm);
      const numeroMatch = safeIncludes(autorizacion.numero_autorizacion, searchLower);
      const obraSocialMatch = safeIncludes(autorizacion.obras_sociales?.nombre, searchLower);
      const prestacionMatch = autorizacion.prestaciones?.some(p =>
        safeIncludes(p.prestacion_codigo, searchLower) || safeIncludes(p.prestacion_descripcion, searchLower)
      ) || false;
      if (!pacienteMatch && !numeroMatch && !obraSocialMatch && !prestacionMatch) return false;
    }
    return true;
  }) || [];

  if (isLoading) return <div>Cargando autorizaciones...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Gestión de Autorizaciones</h2>
        <div className="flex gap-2">
          {currentUser?.role === 'admin' && selectedIds.length > 0 && (
            <Button variant="destructive" onClick={handleDeleteSelected}>
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar Seleccionados ({selectedIds.length})
            </Button>
          )}
        </div>
      </div>

      {/* Step 1: Patient Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Buscar Paciente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Input
              placeholder="Buscar por DNI o nombre del paciente..."
              value={patientSearchTerm}
              onChange={(e) => {
                setPatientSearchTerm(e.target.value);
                if (!e.target.value.trim()) setSelectedPatientId(null);
              }}
            />
            {/* Patient suggestions dropdown */}
            {filteredPatients.length > 0 && !selectedPatientId && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredPatients.map(p => (
                  <button
                    key={p.id}
                    className="w-full text-left px-4 py-2 hover:bg-accent text-sm flex justify-between items-center"
                    onClick={() => {
                      setSelectedPatientId(p.id);
                      setPatientSearchTerm(`${p.apellido}, ${p.nombre} - DNI: ${p.dni}`);
                    }}
                  >
                    <span className="font-medium">{p.apellido}, {p.nombre}</span>
                    <span className="text-muted-foreground">DNI: {p.dni} | {p.obra_social?.nombre || 'Sin OS'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedPatientId && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setSelectedPatientId(null); setPatientSearchTerm(''); }}>
                Limpiar selección
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Patient Info Panel with Topes & BDA/FDP */}
      {selectedPatient && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Patient Info */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Paciente</p>
                <p className="text-lg font-bold">{selectedPatient.apellido}, {selectedPatient.nombre}</p>
                <p className="text-sm text-muted-foreground">DNI: {selectedPatient.dni}</p>
              </div>
              
              {/* Obra Social */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Obra Social</p>
                <p className="text-lg font-bold">{selectedPatient.obra_social?.nombre || 'Sin OS'}</p>
                {selectedPatient.numero_afiliado && (
                  <p className="text-sm text-muted-foreground">N° Afiliado: {selectedPatient.numero_afiliado}</p>
                )}
              </div>

              {/* Topes Mensuales */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Topes Mensuales</p>
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  <p className="text-lg font-bold">
                    {selectedPatient.consultas_mes_actual ?? 0} / {selectedPatient.consultas_maximas ?? '∞'}
                  </p>
                </div>
                {(selectedPatient.consultas_mes_actual ?? 0) >= (selectedPatient.consultas_maximas ?? 999) && (
                  <Badge variant="destructive">Tope alcanzado</Badge>
                )}
              </div>

              {/* Estado Padrón */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Estado Padrón</p>
                {(() => {
                  const estado = (selectedPatient as any).estado_padron || 'Activo';
                  if (estado === 'BDA') return <Badge variant="destructive" className="text-base px-3 py-1">BDA - Baja De Aporte</Badge>;
                  if (estado === 'FDP') return <Badge variant="destructive" className="text-base px-3 py-1">FDP - Fuera De Prestación</Badge>;
                  return <Badge variant="default" className="text-base px-3 py-1 bg-green-600">Activo</Badge>;
                })()}
              </div>
            </div>

            {/* Alert if BDA/FDP */}
            {((selectedPatient as any).estado_padron === 'BDA' || (selectedPatient as any).estado_padron === 'FDP') && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Este paciente está en estado <strong>{(selectedPatient as any).estado_padron === 'BDA' ? 'Baja De Aporte (BDA)' : 'Fuera De Prestación (FDP)'}</strong>. 
                  No se pueden crear autorizaciones.
                </AlertDescription>
              </Alert>
            )}

            {/* Alert if tope reached */}
            {(selectedPatient.consultas_mes_actual ?? 0) >= (selectedPatient.consultas_maximas ?? 999) && 
             (selectedPatient as any).estado_padron !== 'BDA' && (selectedPatient as any).estado_padron !== 'FDP' && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Este paciente alcanzó el tope mensual de {selectedPatient.consultas_maximas} consultas. No se pueden crear más autorizaciones este mes.
                </AlertDescription>
              </Alert>
            )}

            {/* New Authorization Button */}
            <div className="mt-4">
              <Button
                disabled={!canCreateAutorizacion()}
                onClick={() => { setSelectedAutorizacion(null); setIsFormOpen(true); }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva Autorización
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search within authorizations */}
      {selectedPatientId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Filtrar autorizaciones del paciente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Buscar por número, obra social o prestación..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Autorizaciones Table */}
      {(selectedPatientId || !selectedPatientId) && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {currentUser?.role === 'admin' && (
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.length === filteredAutorizaciones.length && filteredAutorizaciones.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                  )}
                  <TableHead>Paciente</TableHead>
                  <TableHead>Obra Social</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Prestaciones</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Solicitud</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAutorizaciones.map((autorizacion) => (
                  <TableRow key={autorizacion.id}>
                    {currentUser?.role === 'admin' && (
                      <TableCell>
                        <Checkbox checked={selectedIds.includes(autorizacion.id)} onCheckedChange={() => toggleSelect(autorizacion.id)} />
                      </TableCell>
                    )}
                    <TableCell>
                      <div>
                        <div className="font-medium">{autorizacion.pacientes?.nombre} {autorizacion.pacientes?.apellido}</div>
                        <div className="text-sm text-muted-foreground">DNI: {autorizacion.pacientes?.dni}</div>
                        {autorizacion.numero_autorizacion && (
                          <div className="text-sm text-primary">#{autorizacion.numero_autorizacion}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{autorizacion.obras_sociales?.nombre || 'No especificada'}</TableCell>
                    <TableCell><Badge variant="outline">{autorizacion.tipo_autorizacion}</Badge></TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        {autorizacion.prestaciones && autorizacion.prestaciones.length > 0 ? (
                          <div className="space-y-1">
                            {autorizacion.prestaciones.slice(0, 2).map((p, i) => (
                              <div key={i} className="text-sm">
                                <span className="font-medium">{p.prestacion_codigo}</span>
                                {p.prestacion_descripcion && (
                                  <span className="text-muted-foreground ml-1">
                                    - {p.prestacion_descripcion.length > 30 ? `${p.prestacion_descripcion.substring(0, 30)}...` : p.prestacion_descripcion}
                                  </span>
                                )}
                                <span className="text-muted-foreground ml-1">(x{p.cantidad})</span>
                              </div>
                            ))}
                            {autorizacion.prestaciones.length > 2 && (
                              <div className="text-sm text-muted-foreground">+{autorizacion.prestaciones.length - 2} más...</div>
                            )}
                          </div>
                        ) : <span className="text-muted-foreground">Sin prestaciones</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {currentUser?.role === 'admin' ? (
                        <Select value={autorizacion.estado} onValueChange={(v) => handleStatusChange(autorizacion.id, v)}>
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendiente">Pendiente</SelectItem>
                            <SelectItem value="aprobada">Aprobada</SelectItem>
                            <SelectItem value="rechazada">Rechazada</SelectItem>
                            <SelectItem value="vencida">Vencida</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : getStatusBadge(autorizacion.estado)}
                    </TableCell>
                    <TableCell>
                      {autorizacion.fecha_solicitud ? format(new Date(autorizacion.fecha_solicitud), 'dd/MM/yyyy', { locale: es }) : 'No especificada'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleDelete(autorizacion.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <AutorizacionPDF autorizacion={autorizacion} />
                        <Button variant="outline" size="sm" onClick={() => { setSelectedAutorizacion(autorizacion); setIsFormOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredAutorizaciones.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                {selectedPatientId ? 'Este paciente no tiene autorizaciones.' : 'No se encontraron autorizaciones.'}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedAutorizacion ? 'Editar Autorización' : 'Nueva Autorización'}</DialogTitle>
          </DialogHeader>
          <AutorizacionForm
            autorizacion={selectedAutorizacion}
            preselectedPatientId={selectedPatientId || undefined}
            onSubmit={handleFormSubmit}
            onCancel={handleFormClose}
            isLoading={updateAutorizacion.isPending || createAutorizacion.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AutorizacionManagement;
