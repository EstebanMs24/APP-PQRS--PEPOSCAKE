const Data = {
  evidencePath(value) {
    if (typeof value !== 'string' || !value) throw new Error('Referencia inválida.');
    let path = value;
    if (/^https?:/i.test(value)) {
      const url = new URL(value), base = new URL(SUPABASE_URL);
      const prefix = '/storage/v1/object/public/evidencias-pqrs/';
      if (url.origin !== base.origin || !url.pathname.startsWith(prefix)) throw new Error('Origen de evidencia no autorizado.');
      path = decodeURIComponent(url.pathname.slice(prefix.length));
    }
    if (!/^[a-zA-Z0-9_./ -]+$/.test(path) || path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Ruta de evidencia inválida.');
    return path;
  },
  async evidenceUrl(db, value) {
    const { data, error } = await db.storage.from('evidencias-pqrs').createSignedUrl(this.evidencePath(value), 120);
    if (error || !data?.signedUrl) throw new Error('No se pudo abrir la evidencia.');
    const url = new URL(data.signedUrl);
    if (url.protocol !== 'https:' || url.origin !== new URL(SUPABASE_URL).origin) throw new Error('URL no autorizada.');
    return url.href;
  },
  filters(query, f = {}, archived = false) {
    query = archived ? query.eq('eliminado', true) : query.or('eliminado.is.null,eliminado.eq.false');
    // Only literal letters/digits/spaces/hyphens enter PostgREST's filter expression grammar.
    const search = (f.search || '').normalize('NFKC').replace(/[^\p{L}\p{N} @-]/gu, '').slice(0,100);
    if (search) query = query.or(`numero_caso.ilike.%${search}%,nombre_cliente.ilike.%${search}%,cedula.ilike.%${search}%,telefono_cliente.ilike.%${search}%`);
    for (const [key,column] of [['estado','estado'],['area','area_responsable'],['tipo','tipo_solicitud'],['prioridad','prioridad']]) if (f[key]) query = query.eq(column,f[key]);
    if (f.tag) query = query.contains('tags',[f.tag.trim()]);
    if (f.desde) query = query.gte('fecha_registro',f.desde+'T00:00:00-05:00');
    if (f.hasta) {
      const next = new Date(f.hasta+'T00:00:00-05:00'); next.setUTCDate(next.getUTCDate()+1);
      query = query.lt('fecha_registro',next.toISOString());
    }
    return query;
  },
  async all(db, columns, filters = {}, archived = false) {
    filters = {...filters};
    const rows = [], size = 500;
    for (let offset=0;;offset+=size) {
      const { data, error } = await this.filters(db.from('pqrs').select(columns),filters,archived).order('fecha_registro',{ascending:false}).order('id').range(offset,offset+size-1);
      if (error) throw error;
      rows.push(...data);
      if(rows.length>20000) throw new Error('Reduce el período: máximo 20.000 registros por exportación.');
      if (data.length<size) return rows;
    }
  }
};
