
import React, { useState, useMemo, useDeferredValue } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Patient } from '@/hooks/usePatients';

interface PatientSelectorProps {
  patients: Patient[];
  selectedPatientId?: number;
  onSelect: (patientId: number) => void;
  placeholder?: string;
}

const MAX_RESULTS = 50;

const normalize = (s: string) =>
  (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const PatientSelector: React.FC<PatientSelectorProps> = ({
  patients,
  selectedPatientId,
  onSelect,
  placeholder = "Seleccionar paciente..."
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const selectedPatient = useMemo(
    () => patients.find(p => p.id === selectedPatientId),
    [patients, selectedPatientId]
  );

  const results = useMemo(() => {
    if (!open) return [];
    const q = normalize(deferredSearch).trim();
    if (!q) return patients.slice(0, MAX_RESULTS);
    const parts = q.split(/\s+/).filter(Boolean);
    const out: Patient[] = [];
    for (let i = 0; i < patients.length && out.length < MAX_RESULTS; i++) {
      const p = patients[i];
      const hay = normalize(`${p.nombre} ${p.apellido} ${p.dni}`);
      if (parts.every(part => hay.includes(part))) out.push(p);
    }
    return out;
  }, [patients, deferredSearch, open]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedPatient ? (
            <div className="flex flex-col items-start">
              <span>{selectedPatient.nombre} {selectedPatient.apellido}</span>
              <span className="text-xs text-muted-foreground">DNI: {selectedPatient.dni}</span>
            </div>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[9999]" align="start" sideOffset={4}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nombre, apellido o DNI..."
            className="h-9"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>
              {deferredSearch.trim()
                ? 'No se encontraron pacientes.'
                : 'Escribí para buscar…'}
            </CommandEmpty>
            <CommandGroup>
              {results.map((patient) => (
                <CommandItem
                  key={patient.id}
                  value={String(patient.id)}
                  onSelect={() => {
                    onSelect(patient.id);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <div className="flex flex-col w-full">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {patient.nombre} {patient.apellido}
                      </span>
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          selectedPatientId === patient.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>DNI: {patient.dni}</span>
                      {patient.obra_social?.nombre && (
                        <span>OS: {patient.obra_social.nombre}</span>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
              {results.length === MAX_RESULTS && (
                <div className="px-3 py-2 text-xs text-muted-foreground border-t">
                  Mostrando primeros {MAX_RESULTS}. Refiná la búsqueda…
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default PatientSelector;
