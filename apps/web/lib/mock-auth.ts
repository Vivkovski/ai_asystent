/**
 * Token używany przez mock sesji w dev bez Supabase.
 * Backend akceptuje go tylko gdy NODE_ENV=development i brak SUPABASE_URL.
 */
export const MOCK_LOCAL_DEV_TOKEN = "mock-local-dev";
