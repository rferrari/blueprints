import { expect, test, describe, beforeAll } from "bun:test";
import Fastify from "fastify";
import fp from "fastify-plugin";
import mcpPlugin from "./index.js";

// Mock dependencies
const mockSettings = {
    isMcpEnabled: async () => true,
    get: async () => null
};

const mockApiKeys = {
    verify: async (key: string) => {
        if (key === "bp_sk_valid") {
            return { userId: "user-123", keyId: "key-123", scopes: ["admin"] };
        }
        return null;
    }
};

const mockSupabase = {
    from: () => ({
        select: () => ({
            eq: () => ({
                single: async () => ({ data: { user_id: "user-123", project_id: "proj-123" }, error: null }),
                in: async () => ({ data: [], error: null })
            }),
            in: async () => ({ data: [], error: null })
        }),
        insert: async () => ({ error: null }),
        delete: () => ({ eq: async () => ({ error: null }) }),
        update: () => ({ eq: async () => ({ error: null }) })
    })
};

describe("MCP Plugin", () => {
    let app: any;

    beforeAll(async () => {
        app = Fastify();

        // Register mocks as named plugins to satisfy fp dependencies
        await app.register(fp(async (f: any) => { f.decorate("settings", mockSettings); }, { name: 'settings' }));
        await app.register(fp(async (f: any) => { f.decorate("apiKeys", mockApiKeys); }, { name: 'apiKeys' }));
        await app.register(fp(async (f: any) => { f.decorate("supabase", mockSupabase); }, { name: 'supabase' }));

        app.setErrorHandler((error: any, request: any, reply: any) => {
            reply.status(error.statusCode || 500).send(error);
        });

        app.decorate("httpErrors", {
            serviceUnavailable: (msg: string) => {
                const err = new Error(msg);
                (err as any).statusCode = 503;
                return err;
            },
            unauthorized: (msg: string) => {
                const err = new Error(msg);
                (err as any).statusCode = 401;
                return err;
            },
            badRequest: (msg: string) => {
                const err = new Error(msg);
                (err as any).statusCode = 400;
                return err;
            },
            notFound: (msg: string) => {
                const err = new Error(msg);
                (err as any).statusCode = 404;
                return err;
            }
        });

        await app.register(mcpPlugin);
        await app.ready();
    });

    test("GET /mcp/skill.json returns discovery manifest", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/mcp/skill.json"
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.name).toBe("Blueprints MCP");
        expect(body.capabilities.tools).toContain("list_agents");
        expect(body.mcp_endpoint).toBe("/mcp/sse");
    });

    test("GET /mcp/skill.md returns documentation", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/mcp/skill.md"
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers["content-type"]).toContain("text/markdown");
    });

    test("POST /mcp/messages returns 401 without API Key", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/mcp/messages",
            query: { sessionId: "123" }
        });

        expect(response.statusCode).toBe(401);
    });

    test("POST /mcp/messages returns 404 for invalid session even with valid Key", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/mcp/messages",
            query: { sessionId: "invalid" },
            headers: {
                authorization: "Bearer bp_sk_valid"
            }
        });

        expect(response.statusCode).toBe(404);
        expect(JSON.parse(response.body).message).toBe("Session not found or expired");
    });

    test("GET /mcp/sse returns 401 with invalid key", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/mcp/sse",
            headers: {
                authorization: "Bearer bp_sk_invalid"
            }
        });

        expect(response.statusCode).toBe(401);
    });
});
