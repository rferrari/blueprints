import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const apiKeysRoutes: FastifyPluginAsync = async (fastify) => {

    // LIST KEYS
    fastify.get('/', async (request) => {
        const keys = await fastify.apiKeys.list(request.userId);
        return keys;
    });

    // GENERATE KEY
    const generateSchema = z.object({
        label: z.string().min(1).max(50),
        scopes: z.array(z.string()).optional()
    });

    fastify.post('/', async (request, reply) => {
        const body = generateSchema.parse(request.body);
        const result = await fastify.apiKeys.generate(request.userId, body.label, body.scopes);

        await fastify.settings.get('mcp_enabled'); // Check? No, management is allowed even if MCP disabled? Yes.

        return reply.code(201).send(result);
    });

    // REVOKE KEY
    fastify.delete('/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const success = await fastify.apiKeys.revoke(id, request.userId);
        if (!success) {
            throw fastify.httpErrors.notFound('Key not found');
        }
        return reply.code(204).send();
    });
};

export default apiKeysRoutes;
