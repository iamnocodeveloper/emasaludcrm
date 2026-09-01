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

const normalizeDoc = (v: unknown) =>
  String(v ?? "").replace(/\D/g, "").replace(/^0+/, "");

/** Devuelve todas las variantes de documento de un valor (DNI y CUIL -> DNI central) */
const docVariants = (v: unknown): string[] => {
  const n = normalizeDoc(v);
  if (!n) return [];
  const out = [n];
  if (n.length === 11) {
    const central = n.slice(2, 10).replace(/^0+/, "");
    if (central) out.push(central);
  }
  return out;
};

const PATIENT_FIELDS = [
  "nombre",
  "apellido",
  "apellido_y_nombre",
  "dni",
  "nro_doc",
  "tipo_doc",
  "cuil_titular",
  "cuil_beneficiario",
  "fecha_nacimiento",
  "sexo",
  "estado_civil",
  "nacionalidad",
  "parentesco",
  "numero_afiliado",
  "plan",
  "localidad",
  "provincia",
  "direccion",
  "telefono",
  "email",
  "fecha_alta",
  "descripcion_paciente",
];

const cleanRow = (row: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  for (const f of PATIENT_FIELDS) {
    const v = row[f];
    if (v !== undefined && v !== null && String(v).trim() !== "") out[f] = v;
  }
  return out;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    /** Trae todos los pacientes de una obra social (activos e inactivos) */
    const fetchPadronActual = async (obraSocialId: number) => {
      const all: any[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("pacientes")
          .select("id, dni, nro_doc, cuil_beneficiario, apellido, nombre, numero_afiliado, activo, estado_padron")
          .eq("obra_social_id", obraSocialId)
          .range(from, from + pageSize - 1);
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
      }
      return all;
    };

    // ---------------------------------------------------------------
    // PLAN: clasifica el archivo en altas / actualizaciones / reactivaciones / bajas
    // ---------------------------------------------------------------
    if (action === "plan") {
      const obraSocialId = Number(body?.obra_social_id);
      const rows: any[] = Array.isArray(body?.rows) ? body.rows : [];
      if (!obraSocialId || rows.length === 0) {
        return json({ error: "obra_social_id y rows son requeridos" }, 400);
      }

      const padron = await fetchPadronActual(obraSocialId);

      // Índice de pacientes existentes por cada variante de documento
      const byDoc = new Map<string, any>();
      for (const p of padron) {
        for (const src of [p.dni, p.nro_doc, p.cuil_beneficiario]) {
          for (const variant of docVariants(src)) {
            if (!byDoc.has(variant)) byDoc.set(variant, p);
          }
        }
      }

      const altas: any[] = [];
      const actualizaciones: any[] = [];
      const reactivaciones: any[] = [];
      const sinDocumento: any[] = [];
      const vistos = new Set<number>();
      const docsArchivo = new Set<string>();

      for (const r of rows) {
        const variants = [
          ...docVariants(r.dni),
          ...docVariants(r.nro_doc),
          ...docVariants(r.cuil_beneficiario),
        ];
        if (variants.length === 0) {
          sinDocumento.push(r);
          continue;
        }
        variants.forEach((v) => docsArchivo.add(v));

        const match = variants.map((v) => byDoc.get(v)).find(Boolean);
        const info = {
          dni: r.dni ?? r.nro_doc ?? null,
          apellido: r.apellido ?? null,
          nombre: r.nombre ?? null,
          apellido_y_nombre: r.apellido_y_nombre ?? null,
        };
        if (!match) {
          altas.push(info);
        } else {
          vistos.add(match.id);
          if (match.activo === false) reactivaciones.push({ ...info, id: match.id });
          else actualizaciones.push({ ...info, id: match.id });
        }
      }

      const bajas = padron
        .filter((p) => p.activo === true && !vistos.has(p.id))
        .map((p) => ({
          id: p.id,
          dni: p.dni,
          apellido: p.apellido,
          nombre: p.nombre,
          numero_afiliado: p.numero_afiliado,
        }));

      return json({
        obra_social_id: obraSocialId,
        total_archivo: rows.length,
        total_activos: padron.filter((p) => p.activo === true).length,
        altas,
        actualizaciones,
        reactivaciones,
        bajas,
        sin_documento: sinDocumento.length,
      });
    }

    // ---------------------------------------------------------------
    // APPLY_SYNC: upsert de un lote de filas del archivo
    // ---------------------------------------------------------------
    if (action === "apply_sync") {
      const obraSocialId = Number(body?.obra_social_id);
      const rows: any[] = Array.isArray(body?.rows) ? body.rows : [];
      if (!obraSocialId) return json({ error: "obra_social_id es requerido" }, 400);

      const result = { creados: 0, actualizados: 0, reactivados: 0, errores: [] as string[] };
      if (rows.length === 0) return json(result);

      // Documentos del lote para una única consulta
      const docs = new Set<string>();
      for (const r of rows) {
        for (const v of [...docVariants(r.dni), ...docVariants(r.nro_doc), ...docVariants(r.cuil_beneficiario)]) {
          docs.add(v);
        }
      }

      const { data: existentes, error: fetchError } = await supabase
        .from("pacientes")
        .select("id, dni, nro_doc, cuil_beneficiario, activo")
        .eq("obra_social_id", obraSocialId)
        .in("dni", Array.from(docs));
      if (fetchError) result.errores.push(`lookup: ${fetchError.message}`);

      const byDoc = new Map<string, any>();
      for (const p of existentes || []) {
        for (const src of [p.dni, p.nro_doc, p.cuil_beneficiario]) {
          for (const v of docVariants(src)) if (!byDoc.has(v)) byDoc.set(v, p);
        }
      }

      for (const r of rows) {
        const variants = [
          ...docVariants(r.dni),
          ...docVariants(r.nro_doc),
          ...docVariants(r.cuil_beneficiario),
        ];
        if (variants.length === 0) {
          result.errores.push(`Fila sin documento: ${r.apellido_y_nombre ?? "(sin nombre)"}`);
          continue;
        }

        const payload = {
          ...cleanRow(r),
          obra_social_id: obraSocialId,
          activo: true,
          estado_padron: "Activo",
        };

        try {
          const match = variants.map((v) => byDoc.get(v)).find(Boolean);
          if (match) {
            const { error } = await supabase.from("pacientes").update(payload).eq("id", match.id);
            if (error) {
              result.errores.push(`UPDATE ${r.dni ?? variants[0]}: ${error.message}`);
            } else if (match.activo === false) {
              result.reactivados++;
            } else {
              result.actualizados++;
            }
          } else {
            const { error } = await supabase.from("pacientes").insert({
              ...payload,
              consultas_maximas: r.consultas_maximas ?? 999,
              consultas_mes_actual: 0,
            });
            if (error) result.errores.push(`INSERT ${r.dni ?? variants[0]}: ${error.message}`);
            else result.creados++;
          }
        } catch (e) {
          result.errores.push(`${r.dni ?? variants[0]}: ${(e as Error).message}`);
        }
      }

      return json(result);
    }

    // ---------------------------------------------------------------
    // DIFF (legacy): activos que no están en la lista de DNIs
    // ---------------------------------------------------------------
    if (action === "diff") {
      const obraSocialId = Number(body?.obra_social_id);
      const dnis: string[] = Array.isArray(body?.dnis) ? body.dnis : [];
      if (!obraSocialId || dnis.length === 0) {
        return json({ error: "obra_social_id y dnis son requeridos" }, 400);
      }

      const fileSet = new Set<string>();
      for (const d of dnis) for (const v of docVariants(d)) fileSet.add(v);

      const padron = await fetchPadronActual(obraSocialId);
      const activos = padron.filter((p) => p.activo === true);

      const ausentes = activos.filter((p) => {
        const candidates = [
          ...docVariants(p.dni),
          ...docVariants(p.nro_doc),
          ...docVariants(p.cuil_beneficiario),
        ];
        return !candidates.some((c) => fileSet.has(c));
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
        })),
      });
    }

    // ---------------------------------------------------------------
    // APPLY: bajas confirmadas + registro en el historial
    // ---------------------------------------------------------------
    if (action === "apply") {
      const obraSocialId = Number(body?.obra_social_id);
      const periodo: string = body?.periodo; // YYYY-MM-01
      const ids: number[] = Array.isArray(body?.paciente_ids) ? body.paciente_ids.map(Number) : [];
      if (!obraSocialId || !periodo) {
        return json({ error: "obra_social_id y periodo son requeridos" }, 400);
      }

      let dadosDeBaja = 0;
      const errores: string[] = Array.isArray(body?.errores) ? body.errores.slice(0, 200) : [];

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
          reactivados: Number(body?.reactivados ?? 0),
          dados_de_baja: dadosDeBaja,
          errores: errores.length ? errores : [],
          usuario_id: body?.usuario_id ?? null,
        })
        .select()
        .single();

      if (logError) errores.push(`log: ${logError.message}`);

      return json({ dados_de_baja: dadosDeBaja, carga, errores });
    }

    return json({ error: "action inválida (usar 'plan', 'apply_sync', 'diff' o 'apply')" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
