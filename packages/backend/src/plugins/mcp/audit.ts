import { FastifyInstance } from 'fastify';

interface AuditEntry {
    mcpKeyId: string;
    userId: string;
    toolName: string;
    agentId?: string;
    payloadSummary?: any;
    status: 'success' | 'failure';
    errorCode?: string;
}

export class McpAuditService {
    constructor(private fastify: FastifyInstance) { }

    async log(entry: AuditEntry) {
        // Fire and forget, but handle errors
        this.fastify.supabase
            .from('mcp_audit_logs')
            .insert({
                mcp_key_id: entry.mcpKeyId,
                user_id: entry.userId,
                tool_name: entry.toolName,
                agent_id: entry.agentId,
                payload_summary: entry.payloadSummary,
                status: entry.status,
                error_code: entry.errorCode
            })
            .then(({ error }) => {
                if (error) {
                    this.fastify.log.error({ error, entry }, 'Failed to write MCP audit log');
                }
            });
    }
}
