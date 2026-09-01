import * as XLSX from 'xlsx';

export interface PadronRow {
  dni?: string;
  nro_doc?: string;
  tipo_doc?: string;
  cuil_titular?: string;
  cuil_beneficiario?: string;
  apellido?: string;
  nombre?: string;
  apellido_y_nombre?: string;
  fecha_nacimiento?: string;
  sexo?: string;
  estado_civil?: string;
  nacionalidad?: string;
  parentesco?: string;
  numero_afiliado?: string;
  plan?: string;
  localidad?: string;
  provincia?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  fecha_alta?: string;
}

const stripAccents = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normHeader = (s: unknown) =>
  stripAccents(String(s ?? ''))
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

/** Mapa de campo destino -> posibles encabezados (normalizados) */
const HEADER_MAP: Record<keyof PadronRow, string[]> = {
  cuil_beneficiario: ['CUIL BENEFICIARIO', 'CUIL BENEF', 'CUIL AFILIADO', 'CUIL'],
  cuil_titular: ['CUIL TITULAR', 'CUIT TITULAR'],
  dni: ['DNI', 'NRO DOC', 'NUMERO DOC', 'NUMERO DE DOCUMENTO', 'NRO DOCUMENTO', 'N DOCUMENTO', 'DOCUMENTO', 'NRO DNI', 'DOC'],
  nro_doc: ['NRO DOC BENEFICIARIO', 'NRO DOC AFILIADO'],
  tipo_doc: ['TIPO DOC', 'TIPO DE DOCUMENTO', 'TIPO DOCUMENTO'],
  apellido_y_nombre: ['APELLIDO Y NOMBRE', 'APELLIDO Y NOMBRES', 'APELLIDO NOMBRE', 'NOMBRE Y APELLIDO', 'NOMBRE COMPLETO', 'BENEFICIARIO', 'AFILIADO', 'APELLIDO NOMBRES'],
  apellido: ['APELLIDO', 'APELLIDOS'],
  nombre: ['NOMBRE', 'NOMBRES'],
  fecha_nacimiento: ['FECHA NACIMIENTO', 'FECHA DE NACIMIENTO', 'FEC NAC', 'FECHA NAC', 'F NAC', 'NACIMIENTO', 'FNAC'],
  sexo: ['SEXO', 'GENERO'],
  estado_civil: ['ESTADO CIVIL'],
  nacionalidad: ['NACIONALIDAD'],
  parentesco: ['PARENTESCO', 'VINCULO', 'RELACION'],
  numero_afiliado: ['NRO AFILIADO', 'NUMERO AFILIADO', 'N AFILIADO', 'NRO CREDENCIAL', 'CREDENCIAL', 'NUMERO DE AFILIADO', 'AFILIADO NRO'],
  plan: ['PLAN', 'PLAN MEDICO', 'COBERTURA'],
  localidad: ['LOCALIDAD', 'CIUDAD'],
  provincia: ['PROVINCIA'],
  direccion: ['DIRECCION', 'DOMICILIO', 'CALLE'],
  telefono: ['TELEFONO', 'TEL', 'CELULAR', 'TELEFONO CELULAR'],
  email: ['EMAIL', 'MAIL', 'CORREO', 'CORREO ELECTRONICO'],
  fecha_alta: ['FECHA ALTA', 'FEC ALTA', 'ALTA'],
};

const FIELD_KEYS = Object.keys(HEADER_MAP) as (keyof PadronRow)[];

/** Encuentra a qué campo corresponde un encabezado */
const matchField = (header: string): keyof PadronRow | null => {
  const h = normHeader(header);
  if (!h) return null;
  // coincidencia exacta primero (más precisa)
  for (const field of FIELD_KEYS) {
    if (HEADER_MAP[field].some((c) => c === h)) return field;
  }
  for (const field of FIELD_KEYS) {
    if (HEADER_MAP[field].some((c) => h.includes(c))) return field;
  }
  return null;
};

/** Convierte serial de Excel o texto a YYYY-MM-DD */
export const parseFecha = (value: unknown): string | undefined => {
  if (value === null || value === undefined || value === '') return undefined;

  if (typeof value === 'number' && isFinite(value) && value > 0 && value < 100000) {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  }

  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += year > 40 ? 1900 : 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // serial numérico como texto
  if (/^\d{5}$/.test(s)) return parseFecha(Number(s));

  return undefined;
};

export const onlyDigits = (v: unknown) => String(v ?? '').replace(/\D/g, '');

/** DNI a partir de DNI o CUIL (11 dígitos -> parte central) */
export const extraerDni = (v: unknown): string | undefined => {
  const n = onlyDigits(v).replace(/^0+/, '');
  if (!n) return undefined;
  if (n.length === 11) {
    const central = n.slice(2, 10).replace(/^0+/, '');
    return central || undefined;
  }
  if (n.length >= 6 && n.length <= 10) return n;
  return undefined;
};

const normSexo = (v: unknown): string | undefined => {
  const s = stripAccents(String(v ?? '')).trim().toUpperCase();
  if (!s) return undefined;
  if (s.startsWith('M') || s === '1') return 'M';
  if (s.startsWith('F') || s === '2') return 'F';
  return undefined;
};

const normParentesco = (v: unknown): string | undefined => {
  const s = stripAccents(String(v ?? '')).trim().toUpperCase();
  if (!s) return undefined;
  if (s.includes('TITULAR') || s === '0' || s === '00') return 'TITULAR';
  if (s.includes('CONYUGE') || s.includes('ESPOSA') || s.includes('ESPOSO')) return 'CONYUGE';
  if (s.includes('HIJO') || s.includes('HIJA')) return 'HIJO/A';
  return s;
};

const splitNombre = (completo: string) => {
  const s = completo.replace(/\s+/g, ' ').trim();
  if (!s) return {};
  if (s.includes(',')) {
    const [ap, no] = s.split(',');
    return { apellido: ap.trim(), nombre: (no || '').trim() };
  }
  const parts = s.split(' ');
  if (parts.length === 1) return { apellido: parts[0], nombre: '' };
  return { apellido: parts[0], nombre: parts.slice(1).join(' ') };
};

interface SheetParse {
  rows: PadronRow[];
  headersDetectados: string[];
  filasDescartadas: number;
}

/** Lee un archivo de padrón (xlsx/xls/csv) y devuelve filas normalizadas */
export const parsePadronFile = async (file: File): Promise<SheetParse> => {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: null });

  // Detectar la fila de encabezados: la que mapea más campos conocidos
  let headerIdx = 0;
  let bestScore = -1;
  const limit = Math.min(matrix.length, 20);
  for (let i = 0; i < limit; i++) {
    const row = matrix[i] || [];
    const score = row.filter((c) => matchField(String(c ?? ''))).length;
    if (score > bestScore) {
      bestScore = score;
      headerIdx = i;
    }
  }

  const headerRow = matrix[headerIdx] || [];
  const colField = new Map<number, keyof PadronRow>();
  const headersDetectados: string[] = [];
  headerRow.forEach((h, idx) => {
    const field = matchField(String(h ?? ''));
    if (field && !Array.from(colField.values()).includes(field)) {
      colField.set(idx, field);
      headersDetectados.push(`${String(h)} → ${field}`);
    }
  });

  const rows: PadronRow[] = [];
  let filasDescartadas = 0;

  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const raw = matrix[i];
    if (!raw || raw.every((c) => c === null || String(c).trim() === '')) continue;

    const out: PadronRow = {};
    colField.forEach((field, idx) => {
      const value = raw[idx];
      if (value === null || value === undefined || String(value).trim() === '') return;
      switch (field) {
        case 'fecha_nacimiento':
        case 'fecha_alta': {
          const f = parseFecha(value);
          if (f) out[field] = f;
          break;
        }
        case 'sexo': {
          const s = normSexo(value);
          if (s) out.sexo = s;
          break;
        }
        case 'parentesco': {
          const p = normParentesco(value);
          if (p) out.parentesco = p;
          break;
        }
        case 'dni':
        case 'nro_doc': {
          const d = extraerDni(value);
          if (d) out.dni = d;
          const digits = onlyDigits(value);
          if (digits) out.nro_doc = digits;
          break;
        }
        case 'cuil_beneficiario':
        case 'cuil_titular': {
          const digits = onlyDigits(value);
          if (digits) out[field] = digits;
          break;
        }
        default:
          out[field] = String(value).trim() as never;
      }
    });

    // Si no se encontró columna de documento, buscar cualquier celda con pinta de DNI/CUIL
    if (!out.dni) {
      const fromCuil = extraerDni(out.cuil_beneficiario);
      if (fromCuil) out.dni = fromCuil;
    }
    if (!out.dni) {
      for (const cell of raw) {
        const digits = onlyDigits(cell);
        if (digits.length === 11 || (digits.length >= 7 && digits.length <= 8)) {
          const d = extraerDni(digits);
          if (d) {
            out.dni = d;
            out.nro_doc = out.nro_doc || digits;
            break;
          }
        }
      }
    }

    // Nombre y apellido
    if (out.apellido_y_nombre && (!out.apellido || !out.nombre)) {
      const { apellido, nombre } = splitNombre(out.apellido_y_nombre);
      out.apellido = out.apellido || apellido;
      out.nombre = out.nombre || nombre;
    }
    if (!out.apellido_y_nombre && (out.apellido || out.nombre)) {
      out.apellido_y_nombre = `${out.apellido ?? ''} ${out.nombre ?? ''}`.trim();
    }

    if (!out.dni) {
      filasDescartadas++;
      continue;
    }

    rows.push(out);
  }

  // Deduplicar por DNI (se queda con la última aparición)
  const dedup = new Map<string, PadronRow>();
  for (const r of rows) dedup.set(r.dni as string, r);

  return { rows: Array.from(dedup.values()), headersDetectados, filasDescartadas };
};

/** Intenta deducir la obra social a partir del nombre del archivo */
export const detectarObraSocial = (
  fileName: string,
  opciones: { id: number; nombre: string }[]
): number | null => {
  const n = stripAccents(fileName).toUpperCase().replace(/[^A-Z]/g, '');
  // Ordenar por nombre más largo primero para que OSCEARA gane sobre OSCE
  const ordenadas = [...opciones].sort((a, b) => b.nombre.length - a.nombre.length);
  for (const os of ordenadas) {
    if (n.includes(os.nombre.toUpperCase().replace(/[^A-Z]/g, ''))) return os.id;
  }
  return null;
};
