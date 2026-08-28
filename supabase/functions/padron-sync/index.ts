import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    // --- DIFF: pacientes activos de la obra social que NO están en el archivo ---
    if (action === "diff") {
      const obraSocialId = Number(body?.obra_social_id);
      const dnis: string[] = Array.isArray(body?.dnis) ? body.dnis : [];
      if (!obraSocialId || dnis.length === 0) {
        return json({ error: "obra_social_id y dnis son requeridos" }, 400);
      }

      const normalize = (v: unknown) => String(v ?? "").replace(/\D/g, "").replace(/^0+/, "");
      const fileSet = new Set<string>();
      for (const d of dnis) {
        const n = normalize(d);
        if (!n) continue;
        fileSet.add(n);
        // CUIL (11 dígitos) -> DNI central
        if (n.length === 11) fileSet.add(n.slice(2, 10).replace(/^0+/, ""));
      }

      const activos: any[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("pacientes")
          .select("id, dni, nro_doc, cuil_beneficiario, apellido, nombre, numero_afiliado, updated_at")
          .eq("obra_social_id", obraSocialId)
          .eq("activo", true)
          .range(from, from + pageSize - 1);
        if (error) return json({ error: error.message }, 500);
        if (!data || data.length === 0) break;
        activos.push(...data);
        if (data.length < pageSize) break;
      }

      const ausentes = activos.filter((p) => {
        const candidates = [p.dni, p.nro_doc, p.cuil_beneficiario]
          .map(normalize)
          .filter(Boolean);
        return !candidates.some((c) => fileSet.has(c) || (c.length === 11 && fileSet.has(c.slice(2, 10).replace(/^0+/, ""))));
      });

      return json({
        total_activos: activos.length,
        total_archivo: fileSet.size,
        ausentes: ausentes.map((p) => ({
          id: p.id,
          dni: p.dni,
          apellido: p.apellido,
          nombre: p.nombre,
          numero_afiliado: p.numero_afiliado,
          updated_at: p.updated_at,
        })),
      });
    }

    // --- APPLY: dar de baja los confirmados y registrar la carga ---
    if (action === "apply") {
      const obraSocialId = Number(body?.obra_social_id);
      const periodo: string = body?.periodo; // YYYY-MM-01
      const ids: number[] = Array.isArray(body?.paciente_ids) ? body.paciente_ids.map(Number) : [];
      if (!obraSocialId || !periodo) {
        return json({ error: "obra_social_id y periodo son requeridos" }, 400);
      }

      let dadosDeBaja = 0;
      const errores: string[] = [];

      for (let i = 0; i < ids.length; i += 200) {
        const batch = ids.slice(i, i + 200);
        const { data, error } = await supabase
          .from("pacientes")
          .update({ activo: false, estado_padron: "BAJA" })
          .in("id", batch)
          .select("id");
        if (error) errores.push(error.message);
        else dadosDeBaja += data?.length ?? 0;
      }

      const { data: carga, error: logError } = await supabase
        .from("padron_cargas")
        .insert({
          obra_social_id: obraSocialId,
          periodo,
          archivo_nombre: body?.archivo_nombre ?? null,
          total_procesados: Number(body?.total_procesados ?? 0),
          creados: Number(body?.creados ?? 0),
          actualizados: Number(body?.actualizados ?? 0),
          dados_de_baja: dadosDeBaja,
          errores: errores.length ? errores : [],
          usuario_id: body?.usuario_id ?? null,
        })
        .select()
        .single();

      if (logError) errores.push(`log: ${logError.message}`);

      return json({ dados_de_baja: dadosDeBaja, carga, errores });
    }

    return json({ error: "action inválida (usar 'diff' o 'apply')" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
