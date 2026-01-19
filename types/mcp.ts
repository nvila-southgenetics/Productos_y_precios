// Tipos para las funciones MCP de Supabase
// Estos son placeholders para TypeScript

export interface ExecuteSQLParams {
  project_id: string
  query: string
}

export interface ExecuteSQLResult {
  [key: string]: any
}

// Nota: Estas funciones son llamadas a través del MCP, no son funciones reales de TypeScript
// Se usan solo para referencia de tipos
export declare function mcp_supabase_del_work_execute_sql(params: ExecuteSQLParams): Promise<any>
export declare function mcp_supabase_del_work_get_publishable_keys(params: { project_id: string }): Promise<any>
export declare function mcp_supabase_del_work_get_project_url(params: { project_id: string }): Promise<any>



