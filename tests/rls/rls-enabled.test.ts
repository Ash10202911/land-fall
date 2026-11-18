import { describe, expect, it } from "vitest";
import { Client } from "pg";
import { loadLocalEnv } from "./env";

// Non-negotiable: Row Level Security is enabled on every table in the public schema.
describe("RLS is enabled on every table", () => {
  it("has row level security on for all public tables", async () => {
    const client = new Client({ connectionString: loadLocalEnv().DB_URL });
    await client.connect();
    try {
      const { rows } = await client.query<{ tablename: string; rowsecurity: boolean }>(
        "select tablename, rowsecurity from pg_tables where schemaname = 'public'",
      );
      expect(rows.length).toBeGreaterThanOrEqual(6);
      const without = rows.filter((r) => !r.rowsecurity).map((r) => r.tablename);
      expect(without).toEqual([]);
    } finally {
      await client.end();
    }
  });

  it("gives every public table at least one policy", async () => {
    const client = new Client({ connectionString: loadLocalEnv().DB_URL });
    await client.connect();
    try {
      const { rows } = await client.query<{ tablename: string; n: string }>(
        `select t.tablename, count(p.policyname)::text as n
           from pg_tables t
           left join pg_policies p on p.schemaname = t.schemaname and p.tablename = t.tablename
          where t.schemaname = 'public'
          group by t.tablename`,
      );
      const empty = rows.filter((r) => Number(r.n) === 0).map((r) => r.tablename);
      expect(empty).toEqual([]);
    } finally {
      await client.end();
    }
  });
});
