export const supabase = {
  auth: { getSession: async () => ({ data: { session: null } }) },
  rpc: async () => ({ data: [], error: null }),
  from: () => ({
    select: () => ({
      eq: () => ({
        not: () => ({ limit: async () => ({ data: [] }) }),
        order: () => ({ range: async () => ({ data: [], error: null }) }),
      }),
      in: () => ({ data: [] }),
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: null, error: null }),
    }),
    rpc: async () => ({ data: [], error: null }),
  }),
}
