import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { dni } = await req.json()

    if (!dni || typeof dni !== 'string' || dni.trim().length < 6 || dni.trim().length > 12) {
      return new Response(JSON.stringify({ error: 'DNI inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cleanDni = dni.trim()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Find active patient by DNI
    const { data: paciente, error: pacienteError } = await supabase
      .from('pacientes')
      .select('id, nombre, apellido, dni, numero_afiliado, obra_social_id, obras_sociales(nombre)')
      .eq('dni', cleanDni)
      .eq('activo', true)
      .limit(1)
      .single()

    if (pacienteError || !paciente) {
      return new Response(JSON.stringify({ error: 'No se encontró un paciente activo con ese DNI' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find active credential
    let { data: credencial } = await supabase
      .from('credenciales')
      .select('*')
      .eq('paciente_id', paciente.id)
      .eq('estado', 'activa')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // If no credential, create one (dates in Argentina local time)
    if (!credencial) {
      const todayAR = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
      const [arYear, arMonth] = todayAR.split('-').map(Number)
      const fechaVencimiento = new Date(Date.UTC(arYear, arMonth, 0)).toISOString().split('T')[0]
      const numeroCredencial = `CRED-${cleanDni}-${Date.now().toString(36).toUpperCase()}`

      const { data: newCred, error: credError } = await supabase
        .from('credenciales')
        .insert({
          paciente_id: paciente.id,
          numero_credencial: numeroCredencial,
          fecha_emision: todayAR,
          fecha_vencimiento: fechaVencimiento,
          estado: 'activa',
        })
        .select()
        .single()

      if (credError) {
        return new Response(JSON.stringify({ error: 'Error al generar credencial' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      credencial = newCred
    }

    // Get system config
    const { data: config } = await supabase
      .from('system_config')
      .select('name, logo_url, subtitle')
      .limit(1)
      .single()

    return new Response(JSON.stringify({
      paciente: {
        nombre: paciente.nombre,
        apellido: paciente.apellido,
        dni: paciente.dni,
        numero_afiliado: paciente.numero_afiliado,
        obra_social: (paciente as any).obras_sociales?.nombre || null,
      },
      credencial,
      config: config || { name: 'Sistema Médico', logo_url: null, subtitle: '' },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
