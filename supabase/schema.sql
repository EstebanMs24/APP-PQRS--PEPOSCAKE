-- ============================================================
-- SISTEMA PQRS - REPOSTERÍA PEPO'S CAKE
-- Script SQL para Supabase
-- ============================================================

-- Tabla de usuarios del sistema (personal de la empresa)
CREATE TABLE usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre VARCHAR(150) NOT NULL,
  correo VARCHAR(200) UNIQUE NOT NULL,
  rol VARCHAR(50) NOT NULL DEFAULT 'empleado' CHECK (rol IN ('cliente', 'empleado', 'admin')),
  area VARCHAR(100),
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla principal de PQRS
CREATE TABLE pqrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_caso VARCHAR(20) UNIQUE NOT NULL,
  fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Datos del cliente
  nombre_cliente VARCHAR(200) NOT NULL,
  cedula VARCHAR(30),
  telefono_cliente VARCHAR(30),
  correo_cliente VARCHAR(200),
  -- Clasificación
  tipo_solicitud VARCHAR(30) NOT NULL CHECK (tipo_solicitud IN ('Peticion', 'Queja', 'Reclamo', 'Sugerencia')),
  area_responsable VARCHAR(50) NOT NULL CHECK (area_responsable IN ('Produccion', 'Envios', 'Entrega', 'Atencion_cliente')),
  prioridad VARCHAR(10) NOT NULL DEFAULT 'Media' CHECK (prioridad IN ('Alta', 'Media', 'Baja')),
  -- Contenido
  motivo VARCHAR(300) NOT NULL,
  descripcion TEXT NOT NULL,
  comentarios_adicionales TEXT,
  -- Estado y resolución
  estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'En_proceso', 'Resuelto', 'Rechazado')),
  fecha_resolucion TIMESTAMP WITH TIME ZONE,
  solucion TEXT,
  -- Metadatos
  creado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de seguimiento / historial de comentarios por caso
CREATE TABLE seguimiento_pqrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pqrs_id UUID NOT NULL REFERENCES pqrs(id) ON DELETE CASCADE,
  comentario TEXT NOT NULL,
  estado_nuevo VARCHAR(30) CHECK (estado_nuevo IN ('Pendiente', 'En_proceso', 'Resuelto', 'Rechazado')),
  creado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre_usuario VARCHAR(150),
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- FUNCIÓN: Generar número de caso automático
-- Formato: PC-YYYY-NNNNN (ej: PC-2026-00042)
-- Nota: Usa secuencias (nextval) para evitar colisiones bajo concurrencia
-- ============================================================

-- Crear secuencia atómica para garantizar unicidad bajo inserts simultáneos
CREATE SEQUENCE IF NOT EXISTS pqrs_consecutivo_seq START 1 INCREMENT 1;

CREATE OR REPLACE FUNCTION generar_numero_caso()
RETURNS TRIGGER AS $$
DECLARE
  año TEXT;
  consecutivo BIGINT;
  numero TEXT;
BEGIN
  año := TO_CHAR(NOW(), 'YYYY');
  -- nextval() es atómico en PostgreSQL: seguro bajo concurrencia
  consecutivo := nextval('pqrs_consecutivo_seq');
  -- Usar módulo para mantener el número dentro de 5 dígitos (00000-99999)
  numero := 'PC-' || año || '-' || LPAD(consecutivo::TEXT, GREATEST(5, length(consecutivo::TEXT)), '0');
  NEW.numero_caso := numero;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_numero_caso
BEFORE INSERT ON pqrs
FOR EACH ROW
WHEN (NEW.numero_caso IS NULL OR NEW.numero_caso = '')
EXECUTE FUNCTION generar_numero_caso();

-- ============================================================
-- FUNCIÓN: Actualizar campo actualizado_en automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizado_en
BEFORE UPDATE ON pqrs
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp();


ALTER TABLE public.pqrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seguimiento_pqrs ENABLE ROW LEVEL SECURITY;
-- Fresh installations only: provision a real administrator from SQL, then apply migrations in order.
