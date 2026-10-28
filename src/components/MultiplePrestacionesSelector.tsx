import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { AutorizacionPrestacionFormData } from '@/hooks/useAutorizacionPrestaciones';
import { useNomecladorSearch } from '@/hooks/useNomeclador';
import { useValidarPrestacion } from '@/hooks/useValidacionPrestacion';

interface SimplePrestacionInputProps {
  index: number;
  prestacion: AutorizacionPrestacionFormData;
  prestaciones: AutorizacionPrestacionFormData[];
  onPrestacionesChange: (prestaciones: AutorizacionPrestacionFormData[]) => void;
}

const SimplePrestacionInput: React.FC<SimplePrestacionInputProps> = ({ 
  index, 
  prestacion, 
  prestaciones, 
  onPrestacionesChange 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const { data: suggestions } = useNomecladorSearch(searchTerm);

  const handleInputChange = (value: string) => {
    setSearchTerm(value);
    setShowSuggestions(value.length > 0);
  };

  const handleSuggestionClick = (suggestion: {
    codigo_practica: string;
    descripcion_practica: string;
  }) => {
    // Limpiar el campo de búsqueda
    setSearchTerm('');
    setShowSuggestions(false);
    
    // Actualizar la prestación en el índice específico
    const nuevasPrestaciones = [...prestaciones];
    nuevasPrestaciones[index] = {
      ...nuevasPrestaciones[index],
      prestacion_codigo: suggestion.codigo_practica,
      prestacion_descripcion: suggestion.descripcion_practica
    };
    
    // Actualizar el estado global
    onPrestacionesChange(nuevasPrestaciones);
  };

  return (
    <div className="relative">
      <Input
        value={searchTerm}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setShowSuggestions(searchTerm.length > 0)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder="Buscar prestación por código o descripción..."
      />
      
      {showSuggestions && suggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.slice(0, 10).map((suggestion) => (
            <div
              key={suggestion.id}
              className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="font-medium text-sm">{suggestion.codigo_practica}</div>
              <div className="text-gray-600 text-xs truncate">{suggestion.descripcion_practica}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface ConsumoPrestacionProps {
  pacienteId?: number | null;
  prestacion: AutorizacionPrestacionFormData;
}

const ConsumoPrestacion: React.FC<ConsumoPrestacionProps> = ({ pacienteId, prestacion }) => {
  const { data, isLoading } = useValidarPrestacion({
    pacienteId,
    codigoPractica: prestacion.prestacion_codigo,
    cantidad: prestacion.cantidad,
  });

  if (!pacienteId || !prestacion.prestacion_codigo) return null;

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verificando cupo disponible...
      </p>
    );
  }

  if (!data) return null;

  if (!data.permitido) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>{data.mensaje}</span>
      </div>
    );
  }

  if (data.motivo === 'sin_regla') {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>{data.mensaje}</span>
      </div>
    );
  }

  const regla = data.reglas?.[0];
  const cupoMensual = data.cupo_mensual;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {cupoMensual?.limite !== null && cupoMensual?.limite !== undefined && (
        <Badge
          variant={(cupoMensual.consumido ?? 0) >= cupoMensual.limite ? 'destructive' : 'secondary'}
          className="text-xs"
        >
          Cupo mensual: {cupoMensual.consumido ?? 0}/{cupoMensual.limite}
        </Badge>
      )}
      {!regla && <span className="text-xs text-muted-foreground">{data.mensaje}</span>}
      {regla && (
        <>
          <Badge variant="outline" className="text-xs">
        {regla.grupo_nombre}
        {regla.ambito === 'solo_mendoza' ? ' · Mendoza' : ''}
      </Badge>
      {regla.limite_practica !== null && (
        <Badge
          variant={regla.restante_practica === 0 ? 'destructive' : 'secondary'}
          className="text-xs"
        >
          Práctica: {regla.consumido_practica ?? 0}/{regla.limite_practica}
          {regla.periodo_practica_dias ? ` cada ${regla.periodo_practica_dias} días` : ''}
        </Badge>
      )}
      {regla.limite_grupo !== null && (
        <Badge
          variant={regla.restante_grupo === 0 ? 'destructive' : 'secondary'}
          className="text-xs"
        >
          Grupo: {regla.consumido_grupo ?? 0}/{regla.limite_grupo}
          {regla.periodo_grupo_dias ? ` cada ${regla.periodo_grupo_dias} días` : ''}
        </Badge>
      )}
      {regla.restante_practica !== null && (
        <span className="text-xs text-muted-foreground">
          Restante práctica: {regla.restante_practica}
        </span>
      )}
      {regla.restante_grupo !== null && (
        <span className="text-xs text-muted-foreground">
          Restante grupo: {regla.restante_grupo}
        </span>
      )}
        </>
      )}
    </div>
  );
};

interface MultiplePrestacionesSelectorProps {
  prestaciones: AutorizacionPrestacionFormData[];
  onPrestacionesChange: (prestaciones: AutorizacionPrestacionFormData[]) => void;
  pacienteId?: number | null;
}

const MultiplePrestacionesSelector: React.FC<MultiplePrestacionesSelectorProps> = ({
  prestaciones,
  onPrestacionesChange,
  pacienteId
}) => {
  const addPrestacion = () => {
    const nuevaPrestacion: AutorizacionPrestacionFormData = {
      prestacion_codigo: '',
      prestacion_descripcion: '',
      cantidad: 1,
      observaciones: ''
    };
    onPrestacionesChange([...prestaciones, nuevaPrestacion]);
  };

  const removePrestacion = (index: number) => {
    const nuevasPrestaciones = prestaciones.filter((_, i) => i !== index);
    onPrestacionesChange(nuevasPrestaciones);
  };

  const updatePrestacion = (
    index: number,
    field: keyof AutorizacionPrestacionFormData,
    value: string | number
  ) => {
    const nuevasPrestaciones = [...prestaciones];
    nuevasPrestaciones[index] = {
      ...nuevasPrestaciones[index],
      [field]: value
    };
    onPrestacionesChange(nuevasPrestaciones);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-lg font-semibold">Prestaciones</Label>
        <Button type="button" onClick={addPrestacion} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Agregar Prestación
        </Button>
      </div>

      {prestaciones.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-gray-500">
            No hay prestaciones agregadas. Haz clic en "Agregar Prestación" para empezar.
          </CardContent>
        </Card>
      )}

      {prestaciones.map((prestacion, index) => (
        <Card key={index}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Prestación {index + 1}</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removePrestacion(index)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Buscar Prestación</Label>
                <SimplePrestacionInput
                  index={index}
                  prestacion={prestacion}
                  prestaciones={prestaciones}
                  onPrestacionesChange={onPrestacionesChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  min="1"
                  value={prestacion.cantidad}
                  onChange={(e) => updatePrestacion(index, 'cantidad', parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            <ConsumoPrestacion pacienteId={pacienteId} prestacion={prestacion} />

            {prestacion.prestacion_codigo && (
              <div className="space-y-2">
                <Label>Código de Prestación Seleccionado</Label>
                <Input
                  value={prestacion.prestacion_codigo}
                  disabled
                  className="bg-green-50 border-green-200 font-mono"
                />
              </div>
            )}

            {prestacion.prestacion_descripcion && (
              <div className="space-y-2">
                <Label>Descripción de la Prestación</Label>
                <Input
                  value={prestacion.prestacion_descripcion}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea
                value={prestacion.observaciones || ''}
                onChange={(e) => updatePrestacion(index, 'observaciones', e.target.value)}
                placeholder="Observaciones específicas para esta prestación"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default MultiplePrestacionesSelector;
