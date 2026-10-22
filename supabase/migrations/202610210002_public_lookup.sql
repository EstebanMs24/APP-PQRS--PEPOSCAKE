BEGIN;
-- Only opaque HMAC hashes and counters; never store documents, emails, phones or raw IPs.
CREATE TABLE IF NOT EXISTS public.consulta_limites(clave text PRIMARY KEY, ventana timestamptz NOT NULL,intentos integer NOT NULL);
ALTER TABLE public.consulta_limites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consulta_limites FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.consumir_consulta(p_ip text,p_objetivo text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE k text; n integer; ok boolean:=true; BEGIN
 IF p_ip !~ '^[a-f0-9]{64}$' OR p_objetivo !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
 DELETE FROM public.consulta_limites WHERE ventana < now()-interval '1 day';
 -- Stable lock order; IP 10 / 15min, case 10 / 15min and whole application 500 / 15min.
 FOREACH k IN ARRAY ARRAY['global','ip:'||p_ip,'case:'||p_objetivo] LOOP
  INSERT INTO public.consulta_limites AS l(clave,ventana,intentos) VALUES(k,now(),1)
  ON CONFLICT(clave) DO UPDATE SET
   intentos=CASE WHEN l.ventana < now()-interval '15 minutes' THEN 1 ELSE least(l.intentos+1,1000000) END,
   ventana=CASE WHEN l.ventana < now()-interval '15 minutes' THEN now() ELSE l.ventana END
  RETURNING intentos INTO n;
  IF n > (CASE WHEN k='global' THEN 500 ELSE 10 END) THEN ok:=false; END IF;
 END LOOP;
 RETURN ok;
END $$;
CREATE OR REPLACE FUNCTION public.consultar_pqrs_servidor(p_criterio text,p_valor text,p_numero text,p_correo text)
RETURNS TABLE(numero_caso varchar,fecha_registro timestamptz,tipo_solicitud varchar,estado varchar,area_responsable varchar,actualizado_en timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_criterio NOT IN ('numero','cedula','telefono') OR length(p_valor) NOT BETWEEN 5 AND 40 OR length(p_numero)>40 OR length(p_correo)>200 OR p_correo !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RETURN; END IF;
 RETURN QUERY SELECT p.numero_caso,p.fecha_registro,p.tipo_solicitud,p.estado,p.area_responsable,p.actualizado_en
 FROM public.pqrs p
 WHERE p.numero_caso=upper(trim(CASE WHEN p_criterio='numero' THEN p_valor ELSE p_numero END))
 AND lower(trim(p.correo_cliente))=lower(trim(p_correo))
 AND coalesce(p.eliminado,false)=false
 AND CASE p_criterio WHEN 'numero' THEN true
  WHEN 'cedula' THEN p_valor ~ '^[0-9 .-]{5,30}$' AND regexp_replace(p.cedula,'[^0-9]','','g')=regexp_replace(p_valor,'[^0-9]','','g')
  WHEN 'telefono' THEN p_valor ~ '^[+0-9 ()-]{7,30}$' AND regexp_replace(p.telefono_cliente,'[^0-9]','','g')=regexp_replace(p_valor,'[^0-9]','','g') ELSE false END
 LIMIT 1;
END $$;
REVOKE ALL ON FUNCTION public.consumir_consulta(text,text),public.consultar_pqrs_servidor(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_consulta(text,text),public.consultar_pqrs_servidor(text,text,text,text) TO service_role;
COMMIT;
