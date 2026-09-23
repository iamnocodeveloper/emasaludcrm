import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  CreditCard, 
  Search, 
  Trash2, 
  Eye, 
  Calendar, 
  User,
  FileText
} from 'lucide-react';
import { useCredenciales, useDeleteCredencial } from '@/hooks/useCredenciales';
import { parseLocalDate } from '@/lib/utils';

const CredencialManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: credenciales, isLoading } = useCredenciales();
  const deleteCredencial = useDeleteCredencial();

  const filteredCredenciales = credenciales?.filter(credencial => {
    const searchLower = searchTerm.toLowerCase();
    return (
      credencial.numero_credencial.toLowerCase().includes(searchLower) ||
      credencial.paciente?.nombre?.toLowerCase().includes(searchLower) ||
      credencial.paciente?.apellido?.toLowerCase().includes(searchLower) ||
      credencial.paciente?.dni?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (estado: string) => {
    const variants = {
      activa: 'default',
      vencida: 'destructive',
      suspendida: 'secondary'
    } as const;

    const labels = {
      activa: 'Activa',
      vencida: 'Vencida',
      suspendida: 'Suspendida'
    };

    return (
      <Badge variant={variants[estado as keyof typeof variants] || 'default'}>
        {labels[estado as keyof typeof labels] || estado}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return parseLocalDate(dateString).toLocaleDateString('es-AR');
  };

  const handleDelete = async (credencialId: string) => {
    await deleteCredencial.mutateAsync(credencialId);
  };

  const isExpired = (fechaVencimiento: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return parseLocalDate(fechaVencimiento) < today;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">
          <p>Cargando credenciales...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Gestión de Credenciales</h1>
        <p className="text-muted-foreground">
          Administre las credenciales digitales de los pacientes
        </p>
      </div>

      {/* Search and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="md:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, DNI o número de credencial..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium">Activas</p>
                <p className="text-2xl font-bold">
                  {credenciales?.filter(c => c.estado === 'activa' && !isExpired(c.fecha_vencimiento)).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-sm font-medium">Vencidas</p>
                <p className="text-2xl font-bold">
                  {credenciales?.filter(c => isExpired(c.fecha_vencimiento)).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credentials Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Lista de Credenciales
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCredenciales && filteredCredenciales.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Credencial</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>DNI</TableHead>
                    <TableHead>ID O.S.</TableHead>
                    <TableHead>Obra Social</TableHead>
                    <TableHead>Fecha Emisión</TableHead>
                    <TableHead>Fecha Vencimiento</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCredenciales.map((credencial) => (
                    <TableRow key={credencial.id}>
                      <TableCell className="font-medium">
                        {credencial.numero_credencial}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {credencial.paciente?.nombre} {credencial.paciente?.apellido}
                        </div>
                      </TableCell>
                      <TableCell>{credencial.paciente?.dni}</TableCell>
                      <TableCell>
                        {credencial.paciente?.obra_social?.id ?? '—'}
                      </TableCell>
                      <TableCell>
                        {credencial.paciente?.obra_social?.nombre || 'Sin obra social'}
                      </TableCell>
                      <TableCell>{formatDate(credencial.fecha_emision)}</TableCell>
                      <TableCell>
                        <div className={isExpired(credencial.fecha_vencimiento) ? 'text-red-600' : ''}>
                          {formatDate(credencial.fecha_vencimiento)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(
                          isExpired(credencial.fecha_vencimiento) ? 'vencida' : credencial.estado
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Suspender credencial?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción suspenderá la credencial de {credencial.paciente?.nombre} {credencial.paciente?.apellido}. 
                                  La credencial no podrá ser utilizada hasta que sea reactivada.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(credencial.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Suspender
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No se encontraron credenciales</p>
              <p>No hay credenciales que coincidan con los criterios de búsqueda.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CredencialManagement;