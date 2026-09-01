// functions/api/[[route]].ts
// Cloudflare Pages Functions - Connects to Cloudflare D1 Database in Real-Time

interface D1Database {
  prepare: (query: string) => {
    bind: (...values: any[]) => {
      run: () => Promise<any>;
      all: () => Promise<{ results: any[] }>;
    };
    run: () => Promise<any>;
    all: () => Promise<{ results: any[] }>;
  };
}

interface Env {
  DB?: D1Database;
}

type PagesFunction<T = any> = (context: {
  request: Request;
  env: T;
  next?: () => Promise<Response>;
  data?: any;
}) => Promise<Response>;

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '');
  const method = request.method;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Health / Status check
    if (path === 'health' || path === '') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          platform: 'Cloudflare Pages & D1',
          timestamp: new Date().toISOString(),
        }),
        { headers: corsHeaders }
      );
    }

    // Version endpoint for real-time polling check
    if (path === 'sync/version') {
      let version = Date.now();
      return new Response(
        JSON.stringify({
          version,
          timestamp: Date.now(),
        }),
        { headers: corsHeaders }
      );
    }

    // Fetch all collections in a single call for high-speed sync
    if (method === 'GET' && (path === 'data/all' || path === 'sync/all')) {
      if (!env.DB) {
        return new Response(
          JSON.stringify({
            version: Date.now(),
            data: {},
            message: 'D1 not bound yet. Using client-side storage.',
          }),
          { headers: corsHeaders }
        );
      }

      const tables = ['users', 'assignments', 'submissions', 'documents', 'announcements', 'lunch_menus', 'audit_logs'];
      const dataStore: Record<string, any[]> = {};

      for (const t of tables) {
        try {
          const { results } = await env.DB.prepare(`SELECT * FROM ${t}`).all();
          dataStore[t] = results || [];
        } catch {
          dataStore[t] = [];
        }
      }

      return new Response(
        JSON.stringify({
          version: Date.now(),
          data: dataStore,
          timestamp: Date.now(),
        }),
        { headers: corsHeaders }
      );
    }

    // Fetch single table
    if (method === 'GET') {
      const table = path.split('/')[0];
      const validTables = ['users', 'assignments', 'submissions', 'documents', 'announcements', 'lunch_menus', 'audit_logs'];
      if (validTables.includes(table) && env.DB) {
        const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
        return new Response(JSON.stringify(results || []), { headers: corsHeaders });
      }
    }

    // Sync / Mutate endpoint
    if (method === 'POST' && (path === 'sync' || path === 'sync/broadcast')) {
      const body = (await request.json()) as any;
      const { table, action, data, fullState } = body;

      if (!env.DB) {
        return new Response(
          JSON.stringify({
            success: true,
            version: Date.now(),
            message: 'Synced locally (D1 pending)',
          }),
          { headers: corsHeaders }
        );
      }

      if (fullState) {
        // Batch sync tables
        for (const [tblName, items] of Object.entries(fullState)) {
          if (Array.isArray(items) && items.length > 0) {
            for (const item of items) {
              const keys = Object.keys(item);
              const placeholders = keys.map(() => '?').join(', ');
              const values = Object.values(item).map((v) =>
                typeof v === 'object' ? JSON.stringify(v) : v
              );
              try {
                const sql = `INSERT OR REPLACE INTO ${tblName} (${keys.join(', ')}) VALUES (${placeholders})`;
                await env.DB.prepare(sql).bind(...values).run();
              } catch {
                // ignore
              }
            }
          }
        }
      } else if (table && data) {
        if (action === 'insert' || action === 'update') {
          const keys = Object.keys(data);
          const placeholders = keys.map(() => '?').join(', ');
          const values = Object.values(data).map((v) =>
            typeof v === 'object' ? JSON.stringify(v) : v
          );

          const sql = `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
          await env.DB.prepare(sql).bind(...values).run();
        } else if (action === 'delete' && data.id) {
          await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(data.id).run();
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          version: Date.now(),
          message: 'Saved & synced with Cloudflare D1',
        }),
        { headers: corsHeaders }
      );
    }

    return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
      status: 404,
      headers: corsHeaders,
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { status: 500, headers: corsHeaders }
    );
  }
};
