import http from 'node:http';
import { logger } from './logger';

export const docker = {
    async _request(method: string, path: string, body?: any, options: { buffer?: boolean } = {}): Promise<any> {
        return new Promise((resolve, reject) => {
            const reqOptions = {
                socketPath: '/var/run/docker.sock',
                path: `/v1.44${path}`,
                method,
                headers: body ? { 'Content-Type': 'application/json' } : {}
            };

            const startTime = Date.now();
            const req = http.request(reqOptions, (res) => {
                const chunks: Buffer[] = [];
                res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
                res.on('end', () => {
                    const data = Buffer.concat(chunks);
                    const duration = Date.now() - startTime;
                    logger.debug(`Docker API: [${method} ${path}] Response ended. Status: ${res.statusCode}. Duration: ${duration}ms. Data length: ${data.length}`);

                    if (res.statusCode && res.statusCode >= 400) {
                        const err = new Error(`Docker API Error (${res.statusCode}): ${data.toString()}`);
                        (err as any).status = res.statusCode;
                        (err as any).data = data.toString();
                        return reject(err);
                    }

                    if (options.buffer) {
                        return resolve(data);
                    }

                    const dataStr = data.toString();
                    try {
                        resolve(dataStr ? JSON.parse(dataStr) : {});
                    } catch (e) {
                        resolve(dataStr);
                    }
                });
            });

            req.setTimeout(30000, () => {
                logger.warn(`Docker API Timeout: [${method} ${path}] after 30s. Destroying request.`);
                req.destroy(new Error('Request Timeout'));
            });

            req.on('error', (err) => {
                logger.error(`Docker API Network Error: [${method} ${path}]`, err.message);
                reject(err);
            });
            if (body) req.write(JSON.stringify(body));
            req.end();
        });
    },

    async listContainers() {
        return this._request('GET', '/containers/json?all=true');
    },

    async getContainer(name: string) {
        return {
            inspect: () => docker._request('GET', `/containers/${name}/json`),
            start: () => docker._request('POST', `/containers/${name}/start`),
            stop: () => docker._request('POST', `/containers/${name}/stop`),
            remove: () => docker._request('DELETE', `/containers/${name}?v=true&force=true`),
            wait: () => docker._request('POST', `/containers/${name}/wait`),
            logs: async (options: { stdout?: boolean, stderr?: boolean, tail?: number | string } = { stdout: true, stderr: true }) => {
                const query = new URLSearchParams({
                    stdout: String(options.stdout ?? true),
                    stderr: String(options.stderr ?? true),
                    tail: String(options.tail ?? 'all'),
                    follow: 'false'
                }).toString();
                const path = `/containers/${name}/logs?${query}`;
                return docker._request('GET', path, undefined, { buffer: true });
            }
        };
    },

    async getStats(name: string) {
        return this._request('GET', `/containers/${name}/stats?stream=false`);
    },

    async createContainer(config: any) {
        const { name, ...rest } = config;
        const data = await this._request('POST', `/containers/create?name=${name}`, rest);
        return this.getContainer(data.Id || data.Id);
    },

    async inspectImage(name: string) {
        return this._request('GET', `/images/${name}/json`);
    },

    async pullImage(name: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const reqOptions = {
                socketPath: '/var/run/docker.sock',
                path: `/v1.44/images/create?fromImage=${encodeURIComponent(name)}`,
                method: 'POST'
            };

            const req = http.request(reqOptions, (res) => {
                if (res.statusCode !== 200) {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => reject(new Error(`Docker Pull Error (${res.statusCode}): ${data}`)));
                    return;
                }
                // We just need to wait for the stream to end
                res.on('data', () => { }); // Consume stream
                res.on('end', () => resolve());
                res.on('error', reject);
            });

            req.on('error', reject);
            req.end();
        });
    },

    async createExec(id: string, config: any) {
        return this._request('POST', `/containers/${id}/exec`, config);
    },

    async startExec(execId: string, config: any) {
        return this._request('POST', `/exec/${execId}/start`, config);
    }
};
