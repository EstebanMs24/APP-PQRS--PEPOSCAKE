-- Read only. Run/export results before approving migrations; contains no customer rows.
SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('public','storage');
SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position;
SELECT count(*) AS active_admins FROM public.usuarios WHERE rol='admin' AND activo IS TRUE;
SELECT n.nspname,p.proname,p.prosecdef,p.proacl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public';
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='evidencias-pqrs';
