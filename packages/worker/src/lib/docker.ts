import http from 'node:http';
import { logger } from './logger';

export const docker = {
    async _request(method: string, path: string, body?: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const options = {
                socketPath: '/var/run/docker.sock',
                path: `/v1.44${path}`,
                method,
                headers: body ? { 'Content-Type': 'application/json' } : {}
            };

            const startTime = Date.now();
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    const duration = Date.now() - startTime;
                    logger.debug(`Docker API: [${method} ${path}] Response ended. Status: ${res.statusCode}. Duration: ${duration}ms. Data length: ${data.length}`);
                    if (res.statusCode && res.statusCode >= 400) {
                        const err = new Error(`Docker API Error (${res.statusCode}): ${data}`);
                        (err as any).status = res.statusCode;
                        (err as any).data = data;
                        return reject(err);
                    }
                    try {
                        resolve(data ? JSON.parse(data) : {});
                    } catch (e) {
                        resolve(data);
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
            inspect: () => this._request('GET', `/containers/${name}/json`),
            start: () => this._request('POST', `/containers/${name}/start`),
            stop: () => this._request('POST', `/containers/${name}/stop`),
            remove: () => this._request('DELETE', `/containers/${name}?v=true&force=true`),
            wait: () => this._request('POST', `/containers/${name}/wait`)
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
            const options = {
                socketPath: '/var/run/docker.sock',
                path: `/v1.44/images/create?fromImage=${encodeURIComponent(name)}`,
                method: 'POST'
            };

            const req = http.request(options, (res) => {
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
