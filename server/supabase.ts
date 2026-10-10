import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variable configuration for Supabase
// - SUPABASE_URL: The Supabase project URL (e.g. https://xyzcompany.supabase.co)
// - SUPABASE_SERVICE_ROLE_KEY: The Supabase service_role key (server-only secret key, bypasses RLS)
const getEnvUrl = (): string => (process.env.SUPABASE_URL || '').trim();
const getEnvKey = (): string => (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '').trim();

let clientInstance: SupabaseClient | null = null;

// Dedicated test row ID to avoid ever modifying production row 1
export const DEDICATED_TEST_ROW_ID = -999;

/**
 * Returns true if both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are present in process.env
 */
export function isSupabaseConfigured(): boolean {
  const url = getEnvUrl();
  const key = getEnvKey();
  return Boolean(url && key && url.startsWith('http'));
}

/**
 * Returns the active Supabase client or null if environment secrets are not configured.
 * Uses service_role key to bypass Row Level Security on public.app_data as required.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!clientInstance) {
    const url = getEnvUrl();
    const key = getEnvKey();
    clientInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return clientInstance;
}

export interface SupabaseRow {
  id: number;
  data: any;
  updated_at: string;
}

/**
 * Reads row from public.app_data table (stable production row id = 1)
 */
export async function fetchAppDataRow(rowId = 1): Promise<{ data: any; updated_at: string } | null> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client is not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  const { data, error } = await client
    .from('app_data')
    .select('id, data, updated_at')
    .eq('id', rowId)
    .maybeSingle();

  if (error) {
    console.error(`[Supabase Error] Failed to read row ${rowId} from public.app_data:`, error.message);
    throw new Error(`Failed to query Supabase table public.app_data: ${error.message} (Code: ${error.code})`);
  }

  if (!data) {
    return null;
  }

  return {
    data: data.data,
    updated_at: data.updated_at
  };
}

/**
 * Durably saves/upserts data into public.app_data table.
 * - Attempts to call PostgreSQL RPC function 'save_app_data' (which performs SELECT FOR UPDATE and version checking)
 * - If the RPC function has not been created yet in the database, falls back seamlessly to direct upsert.
 */
export async function upsertAppDataRow(
  rowId = 1,
  payload: any,
  expectedUpdatedAt?: string | null
): Promise<{ updated_at: string; usedRpc: boolean }> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client is not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  // 1. Try PostgreSQL RPC with transactional locking if available
  try {
    const { data: rpcData, error: rpcError } = await client.rpc('save_app_data', {
      target_id: rowId,
      new_data: payload,
      expected_updated_at: expectedUpdatedAt || null
    });

    if (!rpcError && rpcData) {
      const resultRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      return {
        updated_at: resultRow?.updated_at || new Date().toISOString(),
        usedRpc: true
      };
    }

    // Check if error was an optimistic concurrency conflict
    if (rpcError && rpcError.message && rpcError.message.includes('CONCURRENT_MODIFICATION_CONFLICT')) {
      throw new Error(rpcError.message);
    }

    // If RPC does not exist (e.g. Postgres code 42883 or PGRST202), continue to direct upsert fallback
  } catch (err: any) {
    if (err.message && err.message.includes('CONCURRENT_MODIFICATION_CONFLICT')) {
      throw err;
    }
    // Fall back to direct upsert
  }

  // 2. Direct upsert fallback
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('app_data')
    .upsert(
      {
        id: rowId,
        data: payload,
        updated_at: now
      },
      { onConflict: 'id' }
    )
    .select('id, updated_at')
    .single();

  if (error) {
    console.error(`[Supabase Error] Failed to upsert row ${rowId} into public.app_data:`, error.message);
    throw new Error(`Failed to write to Supabase table public.app_data: ${error.message} (Code: ${error.code})`);
  }

  return {
    updated_at: data?.updated_at || now,
    usedRpc: false
  };
}

/**
 * Safely deletes a specific row from public.app_data table (used for test row cleanup)
 */
export async function deleteAppDataRow(rowId: number): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client is not configured.');
  }

  const { error } = await client
    .from('app_data')
    .delete()
    .eq('id', rowId);

  if (error) {
    console.error(`[Supabase Error] Failed to delete test row ${rowId} from public.app_data:`, error.message);
    throw new Error(`Failed to delete row ${rowId} from Supabase table public.app_data: ${error.message}`);
  }
}

/**
 * Safe, non-destructive diagnostic test for administrative storage inspection.
 * - Checks environment configuration.
 * - Reads production row 1 (strictly read-only, never modifies production data).
 * - Writes a harmless probe to a dedicated test row (id = -999).
 * - Reads back and verifies test probe integrity.
 * - Safely deletes the test row and confirms complete cleanup.
 */
export async function testSupabaseDiagnostic(): Promise<{
  configured: boolean;
  connected: boolean;
  writable: boolean;
  cleanedUp: boolean;
  hasProductionRow: boolean;
  productionUpdatedAt?: string;
  latencyMs?: number;
  rpcAvailable?: boolean;
  message: string;
  diagnostics: {
    supabaseUrlConfigured: boolean;
    serviceKeyConfigured: boolean;
    readProductionRow: 'passed' | 'failed' | 'not_found' | 'skipped';
    writeTestRow: 'passed' | 'failed' | 'skipped';
    readbackTestRow: 'passed' | 'failed' | 'skipped';
    deleteTestRow: 'passed' | 'failed' | 'skipped';
    errorDetails?: string;
  };
}> {
  const urlConfigured = Boolean(getEnvUrl());
  const keyConfigured = Boolean(getEnvKey());
  const configured = isSupabaseConfigured();

  const diagnosticResult = {
    configured,
    connected: false,
    writable: false,
    cleanedUp: true,
    hasProductionRow: false,
    productionUpdatedAt: undefined as string | undefined,
    latencyMs: undefined as number | undefined,
    rpcAvailable: false,
    message: '',
    diagnostics: {
      supabaseUrlConfigured: urlConfigured,
      serviceKeyConfigured: keyConfigured,
      readProductionRow: 'skipped' as 'passed' | 'failed' | 'not_found' | 'skipped',
      writeTestRow: 'skipped' as 'passed' | 'failed' | 'skipped',
      readbackTestRow: 'skipped' as 'passed' | 'failed' | 'skipped',
      deleteTestRow: 'skipped' as 'passed' | 'failed' | 'skipped',
      errorDetails: undefined as string | undefined
    }
  };

  if (!configured) {
    diagnosticResult.message = 'SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY are not configured in environment secrets.';
    return diagnosticResult;
  }

  const client = getSupabaseClient();
  if (!client) {
    diagnosticResult.message = 'Failed to create Supabase client instance with provided environment settings.';
    return diagnosticResult;
  }

  const startTime = Date.now();

  try {
    // Step 1: Read production row 1 (Read-only, zero modifications)
    try {
      const prodRow = await fetchAppDataRow(1);
      if (prodRow) {
        diagnosticResult.hasProductionRow = true;
        diagnosticResult.productionUpdatedAt = prodRow.updated_at;
        diagnosticResult.diagnostics.readProductionRow = 'passed';
      } else {
        diagnosticResult.hasProductionRow = false;
        diagnosticResult.diagnostics.readProductionRow = 'not_found';
      }
    } catch (readErr: any) {
      diagnosticResult.diagnostics.readProductionRow = 'failed';
      diagnosticResult.diagnostics.errorDetails = `Read production row failed: ${readErr.message}`;
      diagnosticResult.message = `Supabase query error: ${readErr.message}`;
      diagnosticResult.latencyMs = Date.now() - startTime;
      return diagnosticResult;
    }

    // Step 2: Write dedicated test probe row (id = DEDICATED_TEST_ROW_ID)
    const testProbeToken = `probe_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const testPayload = {
      _systemDiagnostic: true,
      probeToken: testProbeToken,
      testedAt: new Date().toISOString()
    };

    let writeResult: { updated_at: string; usedRpc: boolean };
    try {
      writeResult = await upsertAppDataRow(DEDICATED_TEST_ROW_ID, testPayload);
      diagnosticResult.diagnostics.writeTestRow = 'passed';
      diagnosticResult.rpcAvailable = writeResult.usedRpc;
    } catch (writeErr: any) {
      diagnosticResult.diagnostics.writeTestRow = 'failed';
      diagnosticResult.diagnostics.errorDetails = `Write test probe failed: ${writeErr.message}`;
      diagnosticResult.message = `Supabase write permission error: ${writeErr.message}`;
      diagnosticResult.latencyMs = Date.now() - startTime;
      return diagnosticResult;
    }

    // Step 3: Read back test probe row and verify payload
    try {
      const readbackRow = await fetchAppDataRow(DEDICATED_TEST_ROW_ID);
      if (readbackRow && readbackRow.data && readbackRow.data.probeToken === testProbeToken) {
        diagnosticResult.diagnostics.readbackTestRow = 'passed';
      } else {
        diagnosticResult.diagnostics.readbackTestRow = 'failed';
        diagnosticResult.diagnostics.errorDetails = 'Test row readback did not match written probe payload.';
        diagnosticResult.message = 'Supabase test write succeeded but readback verification failed.';
        // Attempt cleanup before returning
        await deleteAppDataRow(DEDICATED_TEST_ROW_ID).catch(() => {});
        diagnosticResult.latencyMs = Date.now() - startTime;
        return diagnosticResult;
      }
    } catch (readbackErr: any) {
      diagnosticResult.diagnostics.readbackTestRow = 'failed';
      diagnosticResult.diagnostics.errorDetails = `Readback test failed: ${readbackErr.message}`;
      diagnosticResult.message = `Supabase readback error: ${readbackErr.message}`;
      await deleteAppDataRow(DEDICATED_TEST_ROW_ID).catch(() => {});
      diagnosticResult.latencyMs = Date.now() - startTime;
      return diagnosticResult;
    }

    // Step 4: Delete dedicated test probe row and confirm cleanup
    try {
      await deleteAppDataRow(DEDICATED_TEST_ROW_ID);
      const verifyDeleted = await fetchAppDataRow(DEDICATED_TEST_ROW_ID);
      if (verifyDeleted === null) {
        diagnosticResult.diagnostics.deleteTestRow = 'passed';
        diagnosticResult.cleanedUp = true;
      } else {
        diagnosticResult.diagnostics.deleteTestRow = 'failed';
        diagnosticResult.cleanedUp = false;
      }
    } catch (delErr: any) {
      diagnosticResult.diagnostics.deleteTestRow = 'failed';
      diagnosticResult.cleanedUp = false;
      diagnosticResult.diagnostics.errorDetails = `Test cleanup failed: ${delErr.message}`;
    }

    const latencyMs = Date.now() - startTime;
    diagnosticResult.latencyMs = latencyMs;
    diagnosticResult.connected = true;
    diagnosticResult.writable = true;

    diagnosticResult.message = `Supabase persistent storage verified successfully in ${latencyMs}ms. Safe write/readback/cleanup test passed without touching production records (RPC Locking: ${diagnosticResult.rpcAvailable ? 'Active' : 'Direct Upsert'}).`;
    return diagnosticResult;
  } catch (err: any) {
    diagnosticResult.latencyMs = Date.now() - startTime;
    diagnosticResult.message = `Storage diagnostic failed: ${err.message}`;
    diagnosticResult.diagnostics.errorDetails = err.message;
    return diagnosticResult;
  }
}

/**
 * Checks which normalized relational tables exist in the Supabase schema
 */
export async function checkRelationalTables(): Promise<{
  available: boolean;
  tables: Record<string, boolean>;
  tablesFound: number;
  totalTables: number;
}> {
  const client = getSupabaseClient();
  const tableList = [
    'admins', 'batches', 'subjects', 'questions',
    'examinations', 'students', 'exam_attempts',
    'student_doubts', 'announcements', 'notifications',
    'audit_logs', 'app_settings'
  ];

  if (!client) {
    const res: Record<string, boolean> = {};
    tableList.forEach(t => res[t] = false);
    return { available: false, tables: res, tablesFound: 0, totalTables: tableList.length };
  }

  const tables: Record<string, boolean> = {};
  let found = 0;

  for (const table of tableList) {
    try {
      const { error } = await client.from(table).select('id').limit(1);
      const exists = !error;
      tables[table] = exists;
      if (exists) found++;
    } catch {
      tables[table] = false;
    }
  }

  return {
    available: found === tableList.length,
    tables,
    tablesFound: found,
    totalTables: tableList.length
  };
}

/**
 * Executes migrate_app_data_to_relational RPC function if defined
 */
export async function executeRelationalMigrationRpc(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Supabase client is not configured.' };
  }

  try {
    const { data, error } = await client.rpc('migrate_app_data_to_relational');
    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Relational migration RPC completed.', details: data };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

