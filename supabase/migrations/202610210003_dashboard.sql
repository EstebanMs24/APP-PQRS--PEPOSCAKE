BEGIN;
CREATE OR REPLACE FUNCTION public.resumen_pqrs() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb; BEGIN
 IF NOT public.es_lector() THEN RAISE EXCEPTION 'Active internal account required' USING ERRCODE='42501'; END IF;
 WITH cases AS (
 SELECT *,fecha_registro + CASE tipo_solicitud WHEN 'Peticion' THEN interval '72 hours' WHEN 'Queja' THEN interval '48 hours' WHEN 'Reclamo' THEN interval '48 hours' ELSE interval '120 hours' END AS limite,
 CASE tipo_solicitud WHEN 'Peticion' THEN interval '18 hours' WHEN 'Queja' THEN interval '12 hours' WHEN 'Reclamo' THEN interval '12 hours' ELSE interval '30 hours' END AS aviso
 FROM public.pqrs WHERE coalesce(eliminado,false)=false)
 SELECT jsonb_build_object('total',count(*),'pendiente',count(*) FILTER(WHERE estado='Pendiente'),'proceso',count(*) FILTER(WHERE estado='En_proceso'),'resuelto',count(*) FILTER(WHERE estado='Resuelto'),
 'vencido',count(*) FILTER(WHERE estado IN ('Pendiente','En_proceso') AND limite<=now()),'por_vencer',count(*) FILTER(WHERE estado IN ('Pendiente','En_proceso') AND limite>now() AND limite-now()<aviso),
 'areas',coalesce((SELECT jsonb_object_agg(area_responsable,n) FROM (SELECT area_responsable,count(*) n FROM cases GROUP BY area_responsable) a),'{}'),
 'tipos',coalesce((SELECT jsonb_object_agg(tipo_solicitud,n) FROM (SELECT tipo_solicitud,count(*) n FROM cases GROUP BY tipo_solicitud) t),'{}'),
 'meses',coalesce((SELECT jsonb_object_agg(mes,n) FROM (SELECT to_char(fecha_registro AT TIME ZONE 'America/Bogota','YYYY-MM') mes,count(*) n FROM cases GROUP BY 1) m),'{}'),
 'archivados',(SELECT count(*) FROM public.pqrs WHERE eliminado IS TRUE)) INTO result FROM cases;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.resumen_pqrs() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resumen_pqrs() TO authenticated;
COMMIT;
