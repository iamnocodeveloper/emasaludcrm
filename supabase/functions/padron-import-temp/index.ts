import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TOKEN = "b7f3e2a9-41d0-4c8e-9a11-temp-import";

const norm = (v: unknown) => String(v ?? "").replace(/\D/g, "").replace(/^0+/, "");
const variants = (v: unknown): string[] => {
  const n = norm(v);
  if (!n) return [];
  const out = [n];
  if (n.length === 11) {
    const c = n.slice(2, 10).replace(/^0+/, "");
    if (c) out.push(c);
  }
  return out;
};

const FIELDS = [
  "nombre","apellido","apellido_y_nombre","dni","nro_doc","tipo_doc","cuil_titular","cuil_beneficiario",
  "fecha_nacimiento","sexo","estado_civil","nacionalidad","parentesco","numero_afiliado","plan",
  "localidad","provincia","direccion","telefono","email","fecha_alta",
];

const clean = (row: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  for (const f of FIELDS) {
    const v = row[f];
    if (v !== undefined && v !== null && String(v).trim() !== "") out[f] = v;
  }
  return out;
};

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    if (body?.token !== TOKEN) return new Response("no", { status: 401 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const obraSocialId = Number(body.obra_social_id);
    const periodo = String(body.periodo);
    const rows: any[] = await (await fetch(body.url)).json();

    const padron: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("pacientes")
        .select("id, dni, nro_doc, cuil_beneficiario, activo")
        .eq("obra_social_id", obraSocialId)
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      if (!data?.length) break;
      padron.push(...data);
      if (data.length < 1000) break;
    }

    const byDoc = new Map<string, any>();
    for (const p of padron) {
      for (const src of [p.dni, p.nro_doc, p.cuil_beneficiario]) {
        for (const v of variants(src)) if (!byDoc.has(v)) byDoc.set(v, p);
      }
    }

    const res = { creados: 0, actualizados: 0, reactivados: 0, bajas: 0, errores: [] as string[] };
    const vistos = new Set<number>();

    for (const r of rows) {
      const vs = [...variants(r.dni), ...variants(r.nro_doc), ...variants(r.cuil_beneficiario)];
      if (!vs.length) continue;
      const match = vs.map((v) => byDoc.get(v)).find(Boolean);
      const payload = { ...clean(r), obra_social_id: obraSocialId, activo: true, estado_padron: "Activo" };
      if (match) {
        vistos.add(match.id);
        const { error } = await supabase.from("pacientes").update(payload).eq("id", match.id);
        if (error) res.errores.push(`UPDATE ${r.dni}: ${error.message}`);
        else if (match.activo === false) res.reactivados++;
        else res.actualizados++;
      } else {
        const { error } = await supabase.from("pacientes").insert({ ...payload, consultas_maximas: 999, consultas_mes_actual: 0 });
        if (error) res.errores.push(`INSERT ${r.dni}: ${error.message}`);
        else res.creados++;
      }
    }

    const bajaIds = padron.filter((p) => p.activo === true && !vistos.has(p.id)).map((p) => p.id);
    for (let i = 0; i < bajaIds.length; i += 200) {
      const { data, error } = await supabase
        .from("pacientes")
        .update({ activo: false, estado_padron: "BAJA" })
        .in("id", bajaIds.slice(i, i + 200))
        .select("id");
      if (error) res.errores.push(error.message);
      else res.bajas += data?.length ?? 0;
    }

    await supabase.from("padron_cargas").insert({
      obra_social_id: obraSocialId,
      periodo,
      archivo_nombre: body.archivo_nombre ?? null,
      total_procesados: rows.length,
      creados: res.creados,
      actualizados: res.actualizados,
      reactivados: res.reactivados,
      dados_de_baja: res.bajas,
      errores: res.errores.slice(0, 200),
    });

    return new Response(JSON.stringify({ ...res, errores: res.errores.slice(0, 20), total_errores: res.errores.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});
