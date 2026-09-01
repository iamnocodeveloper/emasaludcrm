export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      autorizacion_prestaciones: {
        Row: {
          autorizacion_id: number
          cantidad: number
          created_at: string | null
          id: number
          observaciones: string | null
          precio: number
          prestacion_codigo: string
          prestacion_descripcion: string
          updated_at: string | null
        }
        Insert: {
          autorizacion_id: number
          cantidad?: number
          created_at?: string | null
          id?: number
          observaciones?: string | null
          precio?: number
          prestacion_codigo: string
          prestacion_descripcion: string
          updated_at?: string | null
        }
        Update: {
          autorizacion_id?: number
          cantidad?: number
          created_at?: string | null
          id?: number
          observaciones?: string | null
          precio?: number
          prestacion_codigo?: string
          prestacion_descripcion?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "autorizacion_prestaciones_autorizacion_id_fkey"
            columns: ["autorizacion_id"]
            isOneToOne: false
            referencedRelation: "autorizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      autorizaciones: {
        Row: {
          activa: boolean | null
          copago: number | null
          created_at: string | null
          created_by_user_id: string | null
          descripcion: string | null
          documento_url: string | null
          estado: string | null
          estado_facturacion: string
          fecha_solicitud: string | null
          fecha_vencimiento: string | null
          id: number
          lote_facturacion_id: number | null
          medico_id: number | null
          numero_autorizacion: string | null
          numero_credencial: string | null
          obra_social_id: number | null
          observacion_prestacion: string | null
          observaciones: string | null
          paciente_id: number
          parentesco_beneficiario: string | null
          prestacion_cantidad: number | null
          prestacion_codigo: string | null
          prestacion_descripcion: string | null
          prestador: string | null
          profesional_solicitante: string | null
          tipo_autorizacion: string
          updated_at: string | null
        }
        Insert: {
          activa?: boolean | null
          copago?: number | null
          created_at?: string | null
          created_by_user_id?: string | null
          descripcion?: string | null
          documento_url?: string | null
          estado?: string | null
          estado_facturacion?: string
          fecha_solicitud?: string | null
          fecha_vencimiento?: string | null
          id?: number
          lote_facturacion_id?: number | null
          medico_id?: number | null
          numero_autorizacion?: string | null
          numero_credencial?: string | null
          obra_social_id?: number | null
          observacion_prestacion?: string | null
          observaciones?: string | null
          paciente_id: number
          parentesco_beneficiario?: string | null
          prestacion_cantidad?: number | null
          prestacion_codigo?: string | null
          prestacion_descripcion?: string | null
          prestador?: string | null
          profesional_solicitante?: string | null
          tipo_autorizacion: string
          updated_at?: string | null
        }
        Update: {
          activa?: boolean | null
          copago?: number | null
          created_at?: string | null
          created_by_user_id?: string | null
          descripcion?: string | null
          documento_url?: string | null
          estado?: string | null
          estado_facturacion?: string
          fecha_solicitud?: string | null
          fecha_vencimiento?: string | null
          id?: number
          lote_facturacion_id?: number | null
          medico_id?: number | null
          numero_autorizacion?: string | null
          numero_credencial?: string | null
          obra_social_id?: number | null
          observacion_prestacion?: string | null
          observaciones?: string | null
          paciente_id?: number
          parentesco_beneficiario?: string | null
          prestacion_cantidad?: number | null
          prestacion_codigo?: string | null
          prestacion_descripcion?: string | null
          prestador?: string | null
          profesional_solicitante?: string | null
          tipo_autorizacion?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "autorizaciones_lote_facturacion_id_fkey"
            columns: ["lote_facturacion_id"]
            isOneToOne: false
            referencedRelation: "lotes_facturacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autorizaciones_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autorizaciones_obra_social_id_fkey"
            columns: ["obra_social_id"]
            isOneToOne: false
            referencedRelation: "obras_sociales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autorizaciones_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_stop: {
        Row: {
          id: number
          numero: string | null
          stop: boolean | null
        }
        Insert: {
          id?: number
          numero?: string | null
          stop?: boolean | null
        }
        Update: {
          id?: number
          numero?: string | null
          stop?: boolean | null
        }
        Relationships: []
      }
      comprobantes_particulares: {
        Row: {
          autorizacion_id: number
          created_at: string | null
          estado: string
          fecha_emision: string
          fecha_pago: string | null
          id: number
          metodo_pago: string | null
          monto: number
          numero_comprobante: string
          observaciones: string | null
          paciente_id: number
          updated_at: string | null
        }
        Insert: {
          autorizacion_id: number
          created_at?: string | null
          estado?: string
          fecha_emision?: string
          fecha_pago?: string | null
          id?: number
          metodo_pago?: string | null
          monto: number
          numero_comprobante: string
          observaciones?: string | null
          paciente_id: number
          updated_at?: string | null
        }
        Update: {
          autorizacion_id?: number
          created_at?: string | null
          estado?: string
          fecha_emision?: string
          fecha_pago?: string | null
          id?: number
          metodo_pago?: string | null
          monto?: number
          numero_comprobante?: string
          observaciones?: string | null
          paciente_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comprobantes_particulares_autorizacion_id_fkey"
            columns: ["autorizacion_id"]
            isOneToOne: false
            referencedRelation: "autorizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprobantes_particulares_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      consultas: {
        Row: {
          created_at: string | null
          diagnostico: string | null
          fecha_consulta: string | null
          id: number
          medico: string | null
          motivo: string | null
          observaciones: string | null
          paciente_id: number | null
          precio: number | null
          tratamiento: string | null
        }
        Insert: {
          created_at?: string | null
          diagnostico?: string | null
          fecha_consulta?: string | null
          id?: number
          medico?: string | null
          motivo?: string | null
          observaciones?: string | null
          paciente_id?: number | null
          precio?: number | null
          tratamiento?: string | null
        }
        Update: {
          created_at?: string | null
          diagnostico?: string | null
          fecha_consulta?: string | null
          id?: number
          medico?: string | null
          motivo?: string | null
          observaciones?: string | null
          paciente_id?: number | null
          precio?: number | null
          tratamiento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      credenciales: {
        Row: {
          created_at: string
          estado: string
          fecha_emision: string
          fecha_vencimiento: string
          id: string
          numero_credencial: string
          observaciones: string | null
          paciente_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: string
          fecha_emision?: string
          fecha_vencimiento: string
          id?: string
          numero_credencial: string
          observaciones?: string | null
          paciente_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: string
          fecha_emision?: string
          fecha_vencimiento?: string
          id?: string
          numero_credencial?: string
          observaciones?: string | null
          paciente_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      diagnosticos: {
        Row: {
          created_at: string | null
          diagnostico: string
          estado: string | null
          fecha_diagnostico: string
          id: number
          medico_tratante: string | null
          observaciones: string | null
          paciente_id: number
          tratamiento: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          diagnostico: string
          estado?: string | null
          fecha_diagnostico?: string
          id?: number
          medico_tratante?: string | null
          observaciones?: string | null
          paciente_id: number
          tratamiento?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          diagnostico?: string
          estado?: string | null
          fecha_diagnostico?: string
          id?: number
          medico_tratante?: string | null
          observaciones?: string | null
          paciente_id?: number
          tratamiento?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnosticos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      especialidades: {
        Row: {
          activa: boolean | null
          created_at: string | null
          descripcion: string | null
          id: number
          nombre: string
          updated_at: string | null
        }
        Insert: {
          activa?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          id?: number
          nombre: string
          updated_at?: string | null
        }
        Update: {
          activa?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          id?: number
          nombre?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lotes_facturacion: {
        Row: {
          cantidad_estudios: number
          created_at: string | null
          estado: string
          fecha_desde: string
          fecha_hasta: string
          id: number
          numero_lote: string
          obra_social_id: number | null
          observaciones: string | null
          total: number
          updated_at: string | null
        }
        Insert: {
          cantidad_estudios?: number
          created_at?: string | null
          estado?: string
          fecha_desde: string
          fecha_hasta: string
          id?: number
          numero_lote: string
          obra_social_id?: number | null
          observaciones?: string | null
          total?: number
          updated_at?: string | null
        }
        Update: {
          cantidad_estudios?: number
          created_at?: string | null
          estado?: string
          fecha_desde?: string
          fecha_hasta?: string
          id?: number
          numero_lote?: string
          obra_social_id?: number | null
          observaciones?: string | null
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lotes_facturacion_obra_social_id_fkey"
            columns: ["obra_social_id"]
            isOneToOne: false
            referencedRelation: "obras_sociales"
            referencedColumns: ["id"]
          },
        ]
      }
      medicos: {
        Row: {
          activo: boolean | null
          apellido: string
          created_at: string | null
          direccion: string | null
          dni: string
          email: string | null
          especialidad_id: number | null
          id: number
          matricula: string
          nombre: string
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          apellido: string
          created_at?: string | null
          direccion?: string | null
          dni: string
          email?: string | null
          especialidad_id?: number | null
          id?: number
          matricula: string
          nombre: string
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          apellido?: string
          created_at?: string | null
          direccion?: string | null
          dni?: string
          email?: string | null
          especialidad_id?: number | null
          id?: number
          matricula?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medicos_especialidad_id_fkey"
            columns: ["especialidad_id"]
            isOneToOne: false
            referencedRelation: "especialidades"
            referencedColumns: ["id"]
          },
        ]
      }
      n8n_chat_histories: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      n8n_chat_histories_capibet: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      n8n_chat_histories_ema: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      n8n_chat_histories1: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      n8n_chat_histories2: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      nomeclador: {
        Row: {
          codigo_practica: string
          created_at: string | null
          descripcion_practica: string
          id: number
          updated_at: string | null
          valor_resultante_unidades: string | null
        }
        Insert: {
          codigo_practica: string
          created_at?: string | null
          descripcion_practica: string
          id?: never
          updated_at?: string | null
          valor_resultante_unidades?: string | null
        }
        Update: {
          codigo_practica?: string
          created_at?: string | null
          descripcion_practica?: string
          id?: never
          updated_at?: string | null
          valor_resultante_unidades?: string | null
        }
        Relationships: []
      }
      obras_sociales: {
        Row: {
          activa: boolean | null
          codigo: string | null
          created_at: string | null
          direccion: string | null
          email: string | null
          id: number
          nombre: string
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          activa?: boolean | null
          codigo?: string | null
          created_at?: string | null
          direccion?: string | null
          email?: string | null
          id?: number
          nombre: string
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          activa?: boolean | null
          codigo?: string | null
          created_at?: string | null
          direccion?: string | null
          email?: string | null
          id?: number
          nombre?: string
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pacientes: {
        Row: {
          activo: boolean | null
          apellido: string | null
          apellido_y_nombre: string | null
          consultas_maximas: number | null
          consultas_mes_actual: number | null
          created_at: string | null
          cuil_beneficiario: string | null
          cuil_titular: string | null
          descripcion_paciente: string | null
          direccion: string | null
          dni: string | null
          email: string | null
          estado_civil: string | null
          estado_padron: string | null
          fecha_alta: string | null
          fecha_nac_adicional: string | null
          fecha_nacimiento: string | null
          id: number
          localidad: string | null
          nacionalidad: string | null
          nombre: string | null
          nro_doc: string | null
          nro_doc_familiar: string | null
          numero_afiliado: string | null
          obra_social_id: number | null
          observaciones: string | null
          parentesco: string | null
          plan: string | null
          provincia: string | null
          sexo: string | null
          tag_id: number | null
          telefono: string | null
          tipo_doc: string | null
          tipo_doc_familiar: string | null
          ultima_visita: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          apellido?: string | null
          apellido_y_nombre?: string | null
          consultas_maximas?: number | null
          consultas_mes_actual?: number | null
          created_at?: string | null
          cuil_beneficiario?: string | null
          cuil_titular?: string | null
          descripcion_paciente?: string | null
          direccion?: string | null
          dni?: string | null
          email?: string | null
          estado_civil?: string | null
          estado_padron?: string | null
          fecha_alta?: string | null
          fecha_nac_adicional?: string | null
          fecha_nacimiento?: string | null
          id?: number
          localidad?: string | null
          nacionalidad?: string | null
          nombre?: string | null
          nro_doc?: string | null
          nro_doc_familiar?: string | null
          numero_afiliado?: string | null
          obra_social_id?: number | null
          observaciones?: string | null
          parentesco?: string | null
          plan?: string | null
          provincia?: string | null
          sexo?: string | null
          tag_id?: number | null
          telefono?: string | null
          tipo_doc?: string | null
          tipo_doc_familiar?: string | null
          ultima_visita?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          apellido?: string | null
          apellido_y_nombre?: string | null
          consultas_maximas?: number | null
          consultas_mes_actual?: number | null
          created_at?: string | null
          cuil_beneficiario?: string | null
          cuil_titular?: string | null
          descripcion_paciente?: string | null
          direccion?: string | null
          dni?: string | null
          email?: string | null
          estado_civil?: string | null
          estado_padron?: string | null
          fecha_alta?: string | null
          fecha_nac_adicional?: string | null
          fecha_nacimiento?: string | null
          id?: number
          localidad?: string | null
          nacionalidad?: string | null
          nombre?: string | null
          nro_doc?: string | null
          nro_doc_familiar?: string | null
          numero_afiliado?: string | null
          obra_social_id?: number | null
          observaciones?: string | null
          parentesco?: string | null
          plan?: string | null
          provincia?: string | null
          sexo?: string | null
          tag_id?: number | null
          telefono?: string | null
          tipo_doc?: string | null
          tipo_doc_familiar?: string | null
          ultima_visita?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_obra_social_id_fkey"
            columns: ["obra_social_id"]
            isOneToOne: false
            referencedRelation: "obras_sociales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacientes_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "patient_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      padron_cargas: {
        Row: {
          actualizados: number
          archivo_nombre: string | null
          creados: number
          created_at: string
          dados_de_baja: number
          errores: Json
          id: string
          obra_social_id: number
          periodo: string
          reactivados: number
          total_procesados: number
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          actualizados?: number
          archivo_nombre?: string | null
          creados?: number
          created_at?: string
          dados_de_baja?: number
          errores?: Json
          id?: string
          obra_social_id: number
          periodo: string
          reactivados?: number
          total_procesados?: number
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          actualizados?: number
          archivo_nombre?: string | null
          creados?: number
          created_at?: string
          dados_de_baja?: number
          errores?: Json
          id?: string
          obra_social_id?: number
          periodo?: string
          reactivados?: number
          total_procesados?: number
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "padron_cargas_obra_social_id_fkey"
            columns: ["obra_social_id"]
            isOneToOne: false
            referencedRelation: "obras_sociales"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_tags: {
        Row: {
          active: boolean | null
          color: string
          created_at: string | null
          description: string | null
          id: number
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          color?: string
          created_at?: string | null
          description?: string | null
          id?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          color?: string
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      recetarios_emitidos: {
        Row: {
          created_at: string | null
          fecha_emision: string
          id: string
          mes_control: string
          numero_recetario: number
          obra_social_id: number
          observaciones: string | null
          paciente_id: number
          tipo_recetario: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fecha_emision?: string
          id?: string
          mes_control: string
          numero_recetario?: number
          obra_social_id: number
          observaciones?: string | null
          paciente_id: number
          tipo_recetario: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fecha_emision?: string
          id?: string
          mes_control?: string
          numero_recetario?: number
          obra_social_id?: number
          observaciones?: string | null
          paciente_id?: number
          tipo_recetario?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recetarios_emitidos_obra_social_id_fkey"
            columns: ["obra_social_id"]
            isOneToOne: false
            referencedRelation: "obras_sociales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recetarios_emitidos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recetarios_emitidos_tipo_recetario_fkey"
            columns: ["tipo_recetario"]
            isOneToOne: false
            referencedRelation: "recetarios_tipos"
            referencedColumns: ["id"]
          },
        ]
      }
      recetarios_obra_social_config: {
        Row: {
          activo: boolean | null
          created_at: string | null
          id: number
          obra_social_id: number
          tipo_recetario: number
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          id?: number
          obra_social_id: number
          tipo_recetario: number
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          id?: number
          obra_social_id?: number
          tipo_recetario?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recetarios_obra_social_config_obra_social_id_fkey"
            columns: ["obra_social_id"]
            isOneToOne: true
            referencedRelation: "obras_sociales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recetarios_obra_social_config_tipo_recetario_fkey"
            columns: ["tipo_recetario"]
            isOneToOne: false
            referencedRelation: "recetarios_tipos"
            referencedColumns: ["id"]
          },
        ]
      }
      recetarios_tipos: {
        Row: {
          created_at: string | null
          descripcion: string | null
          id: number
          nombre: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          id: number
          nombre: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          id?: number
          nombre?: string
        }
        Relationships: []
      }
      system_config: {
        Row: {
          copyright: string
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          subtitle: string
          updated_at: string | null
          version: string
        }
        Insert: {
          copyright?: string
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          subtitle?: string
          updated_at?: string | null
          version?: string
        }
        Update: {
          copyright?: string
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          subtitle?: string
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      turnos: {
        Row: {
          created_at: string | null
          estado: string
          fecha: string
          hora: string
          id: number
          medico_id: number | null
          motivo: string | null
          observaciones: string | null
          paciente_id: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          estado?: string
          fecha: string
          hora: string
          id?: number
          medico_id?: number | null
          motivo?: string | null
          observaciones?: string | null
          paciente_id: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          estado?: string
          fecha?: string
          hora?: string
          id?: number
          medico_id?: number | null
          motivo?: string | null
          observaciones?: string | null
          paciente_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "turnos_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          dni: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          password_hash: string | null
          patient_id: number | null
          role: string
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          dni?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          password_hash?: string | null
          patient_id?: number | null
          role?: string
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          dni?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          password_hash?: string | null
          patient_id?: number | null
          role?: string
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      change_user_password: {
        Args: { new_password: string; target_user_id: string }
        Returns: Json
      }
      create_audit_log: {
        Args: {
          p_action: string
          p_new_values?: Json
          p_record_id: string
          p_table_name: string
        }
        Returns: undefined
      }
      get_next_recetario_number: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "usuario_normal" | "prestador" | "paciente"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "usuario_normal", "prestador", "paciente"],
    },
  },
} as const
