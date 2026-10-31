-- Review preflight and back up first. Run as database owner, in staging before production.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE rol='admin' AND activo IS TRUE) THEN
  RAISE EXCEPTION 'No active administrator. Verify/provision the legitimate admin before migrating.';
 END IF;
END $$;
ALTER TABLE public.pqrs ADD COLUMN IF NOT EXISTS eliminado boolean DEFAULT false;
ALTER TABLE public.pqrs ADD COLUMN IF NOT EXISTS eliminado_en timestamptz;
ALTER TABLE public.pqrs ADD COLUMN IF NOT EXISTS eliminado_por varchar(200);
ALTER TABLE public.pqrs ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE public.pqrs ADD COLUMN IF NOT EXISTS imagenes text[] DEFAULT '{}';
DROP TRIGGER IF EXISTS trigger_numero_caso ON public.pqrs;
ALTER TABLE public.pqrs ALTER COLUMN numero_caso TYPE varchar(40);
ALTER TABLE public.seguimiento_pqrs ADD COLUMN IF NOT EXISTS estado_anterior varchar(30);
ALTER TABLE public.usuarios ALTER COLUMN activo SET DEFAULT false;
ALTER FUNCTION public.actualizar_timestamp() SET search_path = '';
CREATE OR REPLACE FUNCTION public.es_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.usuarios WHERE id=auth.uid() AND rol='admin' AND activo IS TRUE);
$$;
REVOKE ALL ON FUNCTION public.es_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_admin() TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.es_lector() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.usuarios WHERE id=auth.uid() AND rol IN ('admin','empleado') AND activo IS TRUE);
$$;
REVOKE ALL ON FUNCTION public.es_lector() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_lector() TO anon, authenticated;
-- Replace policies on these three application-owned tables only.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT schemaname,tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('pqrs','usuarios','seguimiento_pqrs') LOOP
  EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname,p.schemaname,p.tablename);
 END LOOP;
END $$;
ALTER TABLE public.pqrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seguimiento_pqrs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pqrs, public.usuarios, public.seguimiento_pqrs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pqrs TO authenticated;
GRANT SELECT, UPDATE ON public.usuarios TO authenticated;
GRANT SELECT ON public.seguimiento_pqrs TO authenticated;
CREATE POLICY internal_read ON public.pqrs FOR SELECT TO authenticated USING ((SELECT public.es_lector()));
CREATE POLICY admin_insert ON public.pqrs FOR INSERT TO authenticated WITH CHECK ((SELECT public.es_admin()));
CREATE POLICY admin_update ON public.pqrs FOR UPDATE TO authenticated USING ((SELECT public.es_admin())) WITH CHECK ((SELECT public.es_admin()));
CREATE POLICY profile_read ON public.usuarios FOR SELECT TO authenticated USING (id=auth.uid() OR (SELECT public.es_admin()));
CREATE POLICY profile_admin_update ON public.usuarios FOR UPDATE TO authenticated USING ((SELECT public.es_admin()) AND id<>auth.uid()) WITH CHECK ((SELECT public.es_admin()) AND id<>auth.uid());
CREATE POLICY history_internal_read ON public.seguimiento_pqrs FOR SELECT TO authenticated USING ((SELECT public.es_lector()));
-- Disable the legacy direct public RPC; never leave a route around server abuse controls.
DO $$ BEGIN
 IF to_regprocedure('public.consultar_pqrs_publico(text,text)') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION public.consultar_pqrs_publico(text,text) FROM PUBLIC,anon,authenticated;
 END IF;
END $$;
LOCK TABLE public.pqrs IN SHARE ROW EXCLUSIVE MODE;
CREATE SEQUENCE IF NOT EXISTS public.pqrs_consecutivo_seq;
SELECT setval('public.pqrs_consecutivo_seq', GREATEST(
 (SELECT last_value FROM public.pqrs_consecutivo_seq),
 COALESCE((SELECT max(split_part(numero_caso,'-',3)::bigint) FROM public.pqrs WHERE numero_caso ~ '^PC-[0-9]{4}-[0-9]{1,18}$'),0),1),true);
CREATE OR REPLACE FUNCTION public.generar_numero_caso() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n text; BEGIN
 n := nextval('public.pqrs_consecutivo_seq')::text;
 NEW.numero_caso := 'PC-' || to_char(now() AT TIME ZONE 'America/Bogota','YYYY') || '-' || lpad(n,greatest(5,length(n)),'0');
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trigger_numero_caso ON public.pqrs;
CREATE TRIGGER trigger_numero_caso BEFORE INSERT ON public.pqrs FOR EACH ROW EXECUTE FUNCTION public.generar_numero_caso();
CREATE OR REPLACE FUNCTION public.validar_pqrs() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NOT public.es_admin() THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;

 -- Preserve unchanged legacy values; validate every newly supplied/edited field.
 IF (TG_OP='INSERT' OR NEW.nombre_cliente IS DISTINCT FROM OLD.nombre_cliente) AND coalesce(length(trim(NEW.nombre_cliente)),0) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid customer name' USING ERRCODE='23514'; END IF;
 IF (TG_OP='INSERT' OR NEW.motivo IS DISTINCT FROM OLD.motivo) AND coalesce(length(trim(NEW.motivo)),0) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'Invalid subject' USING ERRCODE='23514'; END IF;
 IF (TG_OP='INSERT' OR NEW.descripcion IS DISTINCT FROM OLD.descripcion) AND coalesce(length(trim(NEW.descripcion)),0) NOT BETWEEN 10 AND 3000 THEN RAISE EXCEPTION 'Invalid description' USING ERRCODE='23514'; END IF;
 IF (TG_OP='INSERT' OR NEW.imagenes IS DISTINCT FROM OLD.imagenes) AND cardinality(NEW.imagenes)>5 THEN RAISE EXCEPTION 'Too many attachments' USING ERRCODE='23514'; END IF;
 IF (TG_OP='INSERT' OR NEW.tags IS DISTINCT FROM OLD.tags) AND cardinality(NEW.tags)>10 THEN RAISE EXCEPTION 'Too many tags' USING ERRCODE='23514'; END IF;
 IF (TG_OP='INSERT' OR NEW.cedula IS DISTINCT FROM OLD.cedula) AND NEW.cedula IS NOT NULL AND NEW.cedula !~ '^[0-9 .-]{5,30}$' THEN RAISE EXCEPTION 'Invalid document' USING ERRCODE='23514'; END IF;
 IF (TG_OP='INSERT' OR NEW.telefono_cliente IS DISTINCT FROM OLD.telefono_cliente) AND NEW.telefono_cliente IS NOT NULL AND (NEW.telefono_cliente !~ '^[+0-9 ()-]+$' OR length(regexp_replace(NEW.telefono_cliente,'[^0-9]','','g')) NOT BETWEEN 7 AND 15) THEN RAISE EXCEPTION 'Invalid phone' USING ERRCODE='23514'; END IF;
 IF (TG_OP='INSERT' OR NEW.correo_cliente IS DISTINCT FROM OLD.correo_cliente) AND NEW.correo_cliente IS NOT NULL AND NEW.correo_cliente !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Invalid email' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN NEW.creado_por:=auth.uid(); NEW.fecha_registro:=now();
 ELSE
  NEW.id:=OLD.id; NEW.numero_caso:=OLD.numero_caso; NEW.creado_por:=OLD.creado_por; NEW.fecha_registro:=OLD.fecha_registro;
 END IF;
 IF NEW.estado='Resuelto' THEN
  IF (TG_OP='INSERT' OR OLD.estado IS DISTINCT FROM NEW.estado OR OLD.solucion IS DISTINCT FROM NEW.solucion) AND coalesce(length(trim(NEW.solucion)),0)=0 THEN RAISE EXCEPTION 'Resolution required' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' THEN NEW.fecha_resolucion:=now();
  ELSIF OLD.estado IS DISTINCT FROM NEW.estado THEN NEW.fecha_resolucion:=now(); ELSE NEW.fecha_resolucion:=OLD.fecha_resolucion; END IF;
 ELSE NEW.fecha_resolucion:=NULL; END IF;
 IF NEW.eliminado IS TRUE THEN
  IF TG_OP='INSERT' THEN NEW.eliminado_en:=now(); NEW.eliminado_por:=auth.uid()::text;
  ELSIF OLD.eliminado IS NOT TRUE THEN NEW.eliminado_en:=now(); NEW.eliminado_por:=auth.uid()::text;
  ELSE NEW.eliminado_en:=OLD.eliminado_en; NEW.eliminado_por:=OLD.eliminado_por; END IF;
 ELSE NEW.eliminado_en:=NULL; NEW.eliminado_por:=NULL; END IF;
 NEW.actualizado_en:=clock_timestamp();
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validar_pqrs ON public.pqrs;
CREATE TRIGGER validar_pqrs BEFORE INSERT OR UPDATE ON public.pqrs FOR EACH ROW EXECUTE FUNCTION public.validar_pqrs();
CREATE OR REPLACE FUNCTION public.auditar_pqrs() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE action text; BEGIN
 action := CASE WHEN TG_OP='INSERT' THEN 'Caso creado' WHEN NEW.eliminado IS TRUE AND OLD.eliminado IS NOT TRUE THEN 'Caso archivado' WHEN OLD.eliminado IS TRUE AND NEW.eliminado IS NOT TRUE THEN 'Caso restaurado' ELSE 'Caso actualizado' END;
 INSERT INTO public.seguimiento_pqrs(pqrs_id,comentario,estado_anterior,estado_nuevo,creado_por,nombre_usuario)
 VALUES(NEW.id,action,CASE WHEN TG_OP='UPDATE' THEN OLD.estado ELSE NULL END,NEW.estado,auth.uid(),(SELECT nombre FROM public.usuarios WHERE id=auth.uid()));
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS auditar_pqrs ON public.pqrs;
CREATE TRIGGER auditar_pqrs AFTER INSERT OR UPDATE ON public.pqrs FOR EACH ROW EXECUTE FUNCTION public.auditar_pqrs();
CREATE OR REPLACE FUNCTION public.actualizar_estado_pqrs(p_id uuid,p_estado text,p_comentario text,p_solucion text,p_version timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_status text; BEGIN
 IF NOT public.es_admin() THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF coalesce(length(trim(p_comentario)),0) NOT BETWEEN 1 AND 3000 THEN RAISE EXCEPTION 'Comment required' USING ERRCODE='23514'; END IF;
 SELECT estado INTO old_status FROM public.pqrs WHERE id=p_id AND coalesce(eliminado,false)=false AND actualizado_en=p_version FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Case changed or unavailable' USING ERRCODE='40001'; END IF;
 UPDATE public.pqrs SET estado=p_estado,solucion=CASE WHEN p_estado='Resuelto' THEN p_solucion ELSE solucion END WHERE id=p_id;
 INSERT INTO public.seguimiento_pqrs(pqrs_id,comentario,estado_anterior,estado_nuevo,creado_por,nombre_usuario)
 VALUES(p_id,trim(p_comentario),old_status,p_estado,auth.uid(),(SELECT nombre FROM public.usuarios WHERE id=auth.uid()));
 RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.actualizar_estado_pqrs(uuid,text,text,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.actualizar_estado_pqrs(uuid,text,text,text,timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.generar_numero_caso(),public.validar_pqrs(),public.auditar_pqrs() FROM PUBLIC,anon,authenticated;
-- Preserve objects and legacy references. Frontend converts old public URLs to paths and signs them.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('evidencias-pqrs','evidencias-pqrs',false,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=5242880,allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'];
DROP POLICY IF EXISTS "Upload evidencias autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Leer evidencias publico" ON storage.objects;
DROP POLICY IF EXISTS "Eliminar evidencias autenticado" ON storage.objects;
DROP POLICY IF EXISTS evidence_admin ON storage.objects;
CREATE POLICY evidence_admin ON storage.objects FOR ALL TO authenticated USING (bucket_id='evidencias-pqrs' AND (SELECT public.es_admin())) WITH CHECK (bucket_id='evidencias-pqrs' AND (SELECT public.es_admin()));
DROP POLICY IF EXISTS evidence_read ON storage.objects;
CREATE POLICY evidence_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id='evidencias-pqrs' AND (SELECT public.es_lector()));
-- Fence reads separately from mutations, including pre-existing permissive policies.
DROP POLICY IF EXISTS evidence_fence ON storage.objects;
DROP POLICY IF EXISTS evidence_read_fence ON storage.objects;
CREATE POLICY evidence_read_fence ON storage.objects AS RESTRICTIVE FOR SELECT TO public
 USING (bucket_id<>'evidencias-pqrs' OR (auth.role()='authenticated' AND (SELECT public.es_lector())));
DROP POLICY IF EXISTS evidence_insert_fence ON storage.objects;
CREATE POLICY evidence_insert_fence ON storage.objects AS RESTRICTIVE FOR INSERT TO public
 WITH CHECK (bucket_id<>'evidencias-pqrs' OR (auth.role()='authenticated' AND (SELECT public.es_admin())));
DROP POLICY IF EXISTS evidence_update_fence ON storage.objects;
CREATE POLICY evidence_update_fence ON storage.objects AS RESTRICTIVE FOR UPDATE TO public
 USING (bucket_id<>'evidencias-pqrs' OR (auth.role()='authenticated' AND (SELECT public.es_admin())))
 WITH CHECK (bucket_id<>'evidencias-pqrs' OR (auth.role()='authenticated' AND (SELECT public.es_admin())));
DROP POLICY IF EXISTS evidence_delete_fence ON storage.objects;
CREATE POLICY evidence_delete_fence ON storage.objects AS RESTRICTIVE FOR DELETE TO public
 USING (bucket_id<>'evidencias-pqrs' OR (auth.role()='authenticated' AND (SELECT public.es_admin())));
CREATE INDEX IF NOT EXISTS pqrs_active_date_idx ON public.pqrs(fecha_registro DESC,id) WHERE coalesce(eliminado,false)=false;
COMMIT;
