import { useQuery } from '@tanstack/react-query';

// Registry configuration - centralized for maintainability
const REGISTRY_ORG = 'elizaos-plugins';
const REGISTRY_REPO = 'registry';
const REGISTRY_URL = `https://raw.githubusercontent.com/${REGISTRY_ORG}/${REGISTRY_REPO}/refs/heads/main/generated-registry.json`;

interface GitVersionInfo {
    version: string | null;
    branch: string | null;
}

interface PluginGitInfo {
    repo: string;
    v0: GitVersionInfo;
    v1: GitVersionInfo;
}

interface PluginNpmInfo {
    repo: string;
    v0: string | null;
    v1: string | null;
}

interface PluginSupport {
    v0: boolean;
    v1: boolean;
}

interface PluginInfo {
    git: PluginGitInfo;
    npm: PluginNpmInfo;
    supports: PluginSupport;
}

interface RegistryResponse {
    lastUpdatedAt: string;
    registry: Record<string, PluginInfo>;
}

/**
 * Function to fetch plugins data from the registry API.
 * Defines the available plugins for the wizard.
 * @returns {UseQueryResult<string[]>} Query result containing array of plugin names
 */
export function useElizaPlugins() {
    return useQuery({
        queryKey: ['eliza-plugins'],
        queryFn: async () => {
            try {
                const response = await fetch(REGISTRY_URL);
                if (!response.ok) {
                    throw new Error(`Failed to fetch registry: ${response.status}`);
                }

                // Process registry data
                const registryData: RegistryResponse = await response.json();

                // Extract plugin names from registry that support v1 and are plugins
                const registryPlugins = Object.entries(registryData.registry || {})
                    .filter(([name, data]: [string, PluginInfo]) => {
                        // Check if it's a plugin and has v1 support
                        const isPlugin = name.includes('plugin');
                        const hasV1Support = data.supports.v1 === true;
                        const hasV1Version =
                            data.npm.v1 !== null || (data.git.v1.version !== null && data.git.v1.branch !== null);

                        return isPlugin && hasV1Support && hasV1Version;
                    })
                    .map(([name]) => name.replace(/^@elizaos-plugins\//, '@elizaos/'))
                    .sort();

                // Return unique plugins
                return [...new Set(registryPlugins)].sort();
            } catch (error) {
                console.error('Failed to fetch from registry, falling back to basic list:', error);

                // Return fallback plugins with basic info
                return [
                    '@elizaos/plugin-bootstrap',
                    '@elizaos/plugin-evm',
                    '@elizaos/plugin-discord',
                    '@elizaos/plugin-elevenlabs',
                    '@elizaos/plugin-anthropic',
                    '@elizaos/plugin-browser',
                    '@elizaos/plugin-farcaster',
                    '@elizaos/plugin-groq',
                    '@elizaos/plugin-sql',
                    '@elizaos/plugin-twitter',
                    '@elizaos/plugin-coingecko'
                ]
                    .filter((name) => name.includes('plugin'))
                    .sort();
            }
        },
        staleTime: 60 * 60 * 1000, // 1 hour
    });
}
