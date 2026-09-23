import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Search, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { parseLocalDate } from '@/lib/utils';
import html2canvas from 'html2canvas';

interface CredencialData {
  paciente: {
    nombre: string;
    apellido: string;
    dni: string;
    numero_afiliado: string | null;
    obra_social: string | null;
  };
  credencial: {
    numero_credencial: string;
    fecha_vencimiento: string;
    fecha_emision: string;
  };
  config: {
    name: string;
    logo_url: string | null;
    subtitle: string;
  };
}

const formatDate = (dateString: string) => {
  const date = parseLocalDate(dateString);
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const CredencialCard: React.FC<{ data: CredencialData }> = ({ data }) => {
  const { paciente, credencial, config } = data;
  return (
    <div className="w-full max-w-md mx-auto bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 rounded-lg p-6 text-white shadow-lg relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-32 h-32 border-2 border-white rounded-full transform translate-x-16 -translate-y-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 border-2 border-white rounded-full transform -translate-x-12 translate-y-12"></div>
      </div>
      <div className="relative z-10 flex items-start justify-between mb-6">
        <div className="flex items-center">
          {config.logo_url && (
            <div className="w-16 h-16 bg-white rounded-lg p-2 mr-4 flex items-center justify-center">
              <img src={config.logo_url} alt="Logo" className="w-full h-full object-contain" />
            </div>
          )}
          <div>
            <h3 className="text-lg font-bold">{config.name}</h3>
            <p className="text-blue-100 text-sm">Su seguridad en salud</p>
          </div>
        </div>
      </div>
      <div className="relative z-10 mb-4">
        <div className="text-right">
          <p className="text-blue-100 text-sm">REGIMEN GENERAL</p>
          <p className="text-blue-100 text-xs">TIPO DE BENEFICIARIO</p>
        </div>
      </div>
      <div className="relative z-10 space-y-2">
        <p className="text-lg font-bold">{paciente.nombre} {paciente.apellido}</p>
        <div>
          <p className="text-blue-100 text-sm">AFILIADO</p>
          <p className="font-semibold">{paciente.numero_afiliado || `${paciente.dni}-001`}</p>
        </div>
        <div className="flex justify-between items-end">
          <div className="flex gap-6">
            <div>
              <p className="text-blue-100 text-sm">FECHA DE EMISIÓN</p>
              <p className="font-semibold">{formatDate(credencial.fecha_emision)}</p>
            </div>
            <div>
              <p className="text-blue-100 text-sm">VIGENCIA HASTA</p>
              <p className="font-semibold">{formatDate(credencial.fecha_vencimiento)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-blue-200">{credencial.numero_credencial.slice(-3)}</p>
            <p className="text-blue-100 text-xs">TOKEN</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const PublicCredencial: React.FC = () => {
  const [dni, setDni] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<CredencialData | null>(null);
  const credencialRef = useRef<HTMLDivElement>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dni.trim()) return;
    setLoading(true);
    setError('');
    setData(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('public-credencial', {
        body: { dni: dni.trim() },
      });

      if (fnError) throw fnError;
      if (result?.error) {
        setError(result.error);
      } else {
        setData(result);
      }
    } catch {
      setError('Error al buscar credencial. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!credencialRef.current || !data) return;
    const canvas = await html2canvas(credencialRef.current, { scale: 2, backgroundColor: null });
    const link = document.createElement('a');
    link.download = `credencial-${data.paciente.dni}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <CreditCard className="w-12 h-12 text-blue-600 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-800">Credencial Digital</h1>
          <p className="text-gray-500">Ingresá tu DNI para generar tu credencial</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="dni" className="sr-only">DNI</Label>
                <Input
                  id="dni"
                  placeholder="Ingresá tu DNI"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button type="submit" disabled={loading || !dni.trim()}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Buscar
              </Button>
            </form>
            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          </CardContent>
        </Card>

        {data && (
          <div className="space-y-4">
            <div ref={credencialRef}>
              <CredencialCard data={data} />
            </div>
            <div className="text-center">
              <Button onClick={handleDownload} variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Descargar Credencial
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicCredencial;
