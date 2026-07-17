
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, X, Search } from 'lucide-react';
import { useMedicos } from '@/hooks/useMedicos';
import { useObrasSociales } from '@/hooks/useObrasSociales';
import { AutorizacionFormData, Autorizacion } from '@/hooks/useAutorizaciones';
import { AutorizacionPrestacionFormData } from '@/hooks/useAutorizacionPrestaciones';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import PatientSelector from './PatientSelector';
import MultiplePrestacionesSelector from './MultiplePrestacionesSelector';

interface AutorizacionFormProps {
  autorizacion?: Autorizacion;
  preselectedPatientId?: number;
  onSubmit: (data: AutorizacionFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

// Componente de búsqueda de médico
interface MedicoSearchInputProps {
  onSelect: (medicoId: number) => void;
  selectedMedicoId?: number;
  medicos: any[];
}

const MedicoSearchInput = ({ onSelect, selectedMedicoId, medicos }: MedicoSearchInputProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Buscar el médico seleccionado y mostrar su nombre
  const selectedMedico = medicos.find(m => m.id === selectedMedicoId);
  
  useEffect(() => {
    if (selectedMedico) {
      setSearchTerm(`${selectedMedico.nombre} ${selectedMedico.apellido}`);
    }
  }, [selectedMedico]);

  const filteredMedicos = medicos?.filter(medico =>
    medico.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    medico.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
    medico.matricula.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 5) || [];

  const handleSelect = (medico: any) => {
    onSelect(medico.id);
    setSearchTerm(`${medico.nombre} ${medico.apellido}`);
    setShowSuggestions(false);
  };

  const handleInputChange = (value: string) => {
    setSearchTerm(value);
    setShowSuggestions(true);
    // Si borra el contenido, limpiar la selección
    if (!value.trim()) {
      // No llamar onSelect(undefined) para evitar problemas con react-hook-form
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar médico por nombre o matrícula..."
          value={searchTerm}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          className="pl-10"
        />
      </div>
      
      {showSuggestions && filteredMedicos.length > 0 && searchTerm.trim() && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-40 overflow-y-auto">
          {filteredMedicos.map((medico) => (
            <div
              key={medico.id}
              className="px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-gray-600 last:border-b-0"
              onClick={() => handleSelect(medico)}
            >
              <div className="font-medium">{medico.nombre} {medico.apellido}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Matrícula: {medico.matricula}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AutorizacionForm: React.FC<AutorizacionFormProps> = ({
  autorizacion,
  preselectedPatientId,
  onSubmit,
  onCancel,
  isLoading = false
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [prestaciones, setPrestaciones] = useState<AutorizacionPrestacionFormData[]>([]);
  const { data: currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<Omit<AutorizacionFormData, 'prestaciones'>>({
    defaultValues: {
      paciente_id: autorizacion?.paciente_id || preselectedPatientId || 0,
      medico_id: autorizacion?.medico_id || undefined,
      obra_social_id: autorizacion?.obra_social_id || undefined,
      tipo_autorizacion: autorizacion?.tipo_autorizacion || '',
      descripcion: autorizacion?.descripcion || '',
      fecha_vencimiento: autorizacion?.fecha_vencimiento || '',
      estado: autorizacion?.estado || 'pendiente',
      numero_autorizacion: autorizacion?.numero_autorizacion || '',
      observaciones: autorizacion?.observaciones || '',
      numero_credencial: autorizacion?.numero_credencial || '',
      parentesco_beneficiario: autorizacion?.parentesco_beneficiario || '',
      profesional_solicitante: autorizacion?.profesional_solicitante || '',
      prestador: autorizacion?.prestador || '',
      copago: autorizacion?.copago || undefined,
    }
  });

  const { data: medicos } = useMedicos();
  const { data: obrasSociales } = useObrasSociales();

  const watchedValues = watch();

  // Cargar prestaciones existentes al editar
  useEffect(() => {
    if (autorizacion?.prestaciones) {
      const prestacionesFormData = autorizacion.prestaciones.map(p => ({
        prestacion_codigo: p.prestacion_codigo,
        prestacion_descripcion: p.prestacion_descripcion,
        cantidad: p.cantidad,
        observaciones: p.observaciones || ''
      }));
      setPrestaciones(prestacionesFormData);
    }
  }, [autorizacion]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  const onFormSubmit = (data: Omit<AutorizacionFormData, 'prestaciones'>) => {
    // Para no-admin, forzar tipo consulta y prestación 420101
    const finalData = isAdmin ? data : {
      ...data,
      tipo_autorizacion: 'consulta',
    };
    const finalPrestaciones = isAdmin ? prestaciones : [{
      prestacion_codigo: '420101',
      prestacion_descripcion: 'CONSULTA MEDICA DIURNA',
      cantidad: 1,
      observaciones: '',
    }];
    const formData: AutorizacionFormData = {
      ...finalData,
      documento: selectedFile || undefined,
      prestaciones: finalPrestaciones
    };
    onSubmit(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {autorizacion ? 'Editar Autorización' : 'Nueva Autorización'}
        </h2>
      </div>

      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        {/* Información del Paciente */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información del Paciente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Paciente *</Label>
              <PatientSelector
                patients={[]}
                selectedPatientId={watchedValues.paciente_id}
                onSelect={(patientId) => setValue('paciente_id', patientId)}
                placeholder="Buscar y seleccionar paciente..."
              />
              {errors.paciente_id && (
                <p className="text-sm text-red-600">Debe seleccionar un paciente</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="numero_credencial">Número de Credencial</Label>
                <Input
                  id="numero_credencial"
                  {...register('numero_credencial')}
                  placeholder="Número de credencial"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parentesco_beneficiario">Parentesco Beneficiario</Label>
                <Input
                  id="parentesco_beneficiario"
                  {...register('parentesco_beneficiario')}
                  placeholder="Parentesco del beneficiario"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Información de la Autorización */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detalles de la Autorización</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo_autorizacion">Tipo de Autorización *</Label>
                {isAdmin ? (
                  <Select onValueChange={(value) => setValue('tipo_autorizacion', value)} defaultValue={watchedValues.tipo_autorizacion}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consulta">Consulta</SelectItem>
                      <SelectItem value="estudio">Estudio</SelectItem>
                      <SelectItem value="tratamiento">Tratamiento</SelectItem>
                      <SelectItem value="cirugia">Cirugía</SelectItem>
                      <SelectItem value="medicamento">Medicamento</SelectItem>
                      <SelectItem value="internacion">Internación</SelectItem>
                      <SelectItem value="laboratorio">Laboratorio</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value="Consulta" disabled className="bg-muted" />
                )}
                {errors.tipo_autorizacion && (
                  <p className="text-sm text-red-600">Debe seleccionar un tipo de autorización</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="estado">Estado *</Label>
                <Select onValueChange={(value) => setValue('estado', value as 'pendiente' | 'aprobada' | 'rechazada' | 'vencida')} defaultValue={watchedValues.estado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="aprobada">Aprobada</SelectItem>
                    <SelectItem value="rechazada">Rechazada</SelectItem>
                    <SelectItem value="vencida">Vencida</SelectItem>
                  </SelectContent>
                </Select>
                {errors.estado && (
                  <p className="text-sm text-red-600">Debe seleccionar un estado</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha_vencimiento">Fecha de Vencimiento</Label>
                <Input
                  type="date"
                  id="fecha_vencimiento"
                  {...register('fecha_vencimiento')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="numero_autorizacion">Número de Autorización</Label>
                <Input
                  id="numero_autorizacion"
                  {...register('numero_autorizacion')}
                  placeholder="Número de autorización"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                {...register('descripcion')}
                placeholder="Descripción de la autorización"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                {...register('observaciones')}
                placeholder="Observaciones adicionales"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Información del Médico y Obra Social */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información Adicional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="medico_id">Médico Solicitante</Label>
                <MedicoSearchInput
                  onSelect={(medicoId) => setValue('medico_id', medicoId)}
                  selectedMedicoId={watchedValues.medico_id}
                  medicos={medicos || []}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="obra_social_id">Obra Social</Label>
                <Select onValueChange={(value) => setValue('obra_social_id', parseInt(value))} defaultValue={watchedValues.obra_social_id?.toString()}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar obra social" />
                  </SelectTrigger>
                  <SelectContent>
                    {obrasSociales?.map((obraSocial) => (
                      <SelectItem key={obraSocial.id} value={String(obraSocial.id)}>
                        {obraSocial.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="profesional_solicitante">Profesional Solicitante</Label>
                <Input
                  id="profesional_solicitante"
                  {...register('profesional_solicitante')}
                  placeholder="Nombre del profesional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prestador">Prestador</Label>
                <Input
                  id="prestador"
                  {...register('prestador')}
                  placeholder="Prestador"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Múltiples Prestaciones */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Prestaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdmin ? (
              <MultiplePrestacionesSelector
                prestaciones={prestaciones}
                onPrestacionesChange={setPrestaciones}
              />
            ) : (
              <div className="space-y-2">
                <div>
                  <Label>Código de Prestación</Label>
                  <Input value="420101" disabled className="bg-muted font-mono" />
                </div>
                <div>
                  <Label>Descripción</Label>
                  <Input value="CONSULTA MEDICA DIURNA" disabled className="bg-muted" />
                </div>
                <p className="text-sm text-muted-foreground">Solo se permite la prestación de consulta médica (420101).</p>
              </div>
            )}
            
            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="copago">Copago / A cargo del paciente</Label>
              <Input
                type="number"
                id="copago"
                step="0.01"
                min="0"
                {...register('copago', { valueAsNumber: true })}
                placeholder="Ingrese el monto del copago"
              />
            </div>
          </CardContent>
        </Card>

        {/* Subir Documento */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Documento Adjunto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="documento">
                {selectedFile ? 'Reemplazar Documento' : 'Subir Documento'}
              </Label>
              <Input
                type="file"
                id="documento"
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png"
              />
              <Button asChild variant="outline">
                <label htmlFor="documento" className="cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" />
                  {selectedFile ? 'Reemplazar Archivo' : 'Subir Archivo'}
                </label>
              </Button>
              {selectedFile && (
                <div className="flex items-center justify-between p-2 bg-gray-100 rounded-md">
                  <span className="text-sm text-gray-600">
                    {selectedFile.name} - {(selectedFile.size / 1024).toFixed(2)} KB
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Guardando...' : 'Guardar Autorización'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AutorizacionForm;
