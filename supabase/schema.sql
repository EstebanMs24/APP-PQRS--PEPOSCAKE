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
  telefono_cliente VARCHAR(30),
  correo_cliente VARCHAR(200),
  -- Clasificación
  tipo_solicitud VARCHAR(30) NOT NULL CHECK (tipo_solicitud IN ('Peticion', 'Queja', 'Reclamo', 'Sugerencia')),
  area_responsable VARCHAR(50) NOT NULL CHECK (area_responsable IN ('Produccion', 'Envios', 'Entrega', 'Atencion_cliente')),
  -- Contenido
  motivo VARCHAR(300) NOT NULL,
  descripcion TEXT NOT NULL,
  comentarios_adicionales TEXT,
  -- Estado y resolución
  estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'En_proceso', 'Resuelto')),
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
  estado_nuevo VARCHAR(30) CHECK (estado_nuevo IN ('Pendiente', 'En_proceso', 'Resuelto')),
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
  numero := 'PC-' || año || '-' || LPAD((consecutivo % 100000)::TEXT, 5, '0');
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

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - Seguridad a nivel de fila
-- ============================================================
ALTER TABLE pqrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguimiento_pqrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Política: usuarios autenticados pueden leer todos los PQRS
CREATE POLICY "Leer pqrs autenticado" ON pqrs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Política: usuarios autenticados pueden insertar PQRS
CREATE POLICY "Insertar pqrs autenticado" ON pqrs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Política: usuarios autenticados pueden actualizar PQRS
CREATE POLICY "Actualizar pqrs autenticado" ON pqrs
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Política: usuarios autenticados pueden leer seguimiento
CREATE POLICY "Leer seguimiento autenticado" ON seguimiento_pqrs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Política: usuarios autenticados pueden insertar seguimiento
CREATE POLICY "Insertar seguimiento autenticado" ON seguimiento_pqrs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Política: usuarios autenticados pueden leer usuarios
CREATE POLICY "Leer usuarios autenticado" ON usuarios
  FOR SELECT USING (auth.role() = 'authenticated');

-- Política: solo admin puede cambiar roles
CREATE POLICY "Solo admin puede cambiar roles" ON usuarios
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'admin'
  );

-- Política: consulta pública por número de caso (lectura pública limitada)
CREATE POLICY "Consulta pública por número de caso" ON pqrs
  FOR SELECT USING (true);

-- ============================================================
-- DATOS INICIALES DE PRUEBA
-- ============================================================
-- Nota: Los usuarios reales se crean desde Supabase Auth.
-- Esta tabla 'usuarios' es para datos adicionales del perfil.

-- Insertar usuario administrador de ejemplo (reemplaza el UUID con el de tu auth.users)
-- INSERT INTO usuarios (id, nombre, correo, rol) VALUES
--   ('00000000-0000-0000-0000-000000000001', 'Administrador', 'admin@peposcake.com', 'admin');

-- ============================================================
-- NUEVAS COLUMNAS (ejecutar en Supabase SQL Editor si la tabla ya existe)
-- ============================================================

-- Soft delete: columnas para papelera de reciclaje
ALTER TABLE pqrs ADD COLUMN IF NOT EXISTS eliminado      BOOLEAN DEFAULT FALSE;
ALTER TABLE pqrs ADD COLUMN IF NOT EXISTS eliminado_en   TIMESTAMP WITH TIME ZONE;
ALTER TABLE pqrs ADD COLUMN IF NOT EXISTS eliminado_por  VARCHAR(200);

-- Índice para mejorar performance del filtro de eliminados
CREATE INDEX IF NOT EXISTS idx_pqrs_eliminado ON pqrs(eliminado);

-- Etiquetas personalizables por caso
ALTER TABLE pqrs ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- URLs de imágenes de evidencia (subidas a Supabase Storage)
ALTER TABLE pqrs ADD COLUMN IF NOT EXISTS imagenes TEXT[] DEFAULT '{}';

-- ============================================================
-- STORAGE para evidencias fotográficas
-- Nota: Ejecutar estos comandos desde Supabase SQL Editor
-- ============================================================

-- Crear bucket público para evidencias
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidencias-pqrs', 'evidencias-pqrs', true)
ON CONFLICT (id) DO NOTHING;

-- Permitir subida de archivos a usuarios autenticados
CREATE POLICY "Upload evidencias autenticado" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'evidencias-pqrs' AND auth.role() = 'authenticated'
  );

-- Permitir lectura pública de evidencias
CREATE POLICY "Leer evidencias publico" ON storage.objects
  FOR SELECT USING (bucket_id = 'evidencias-pqrs');

-- Permitir eliminar evidencias a usuarios autenticados
CREATE POLICY "Eliminar evidencias autenticado" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'evidencias-pqrs' AND auth.role() = 'authenticated'
  );
