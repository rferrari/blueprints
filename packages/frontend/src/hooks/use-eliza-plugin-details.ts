import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

// Registry configuration - same as in use-plugins.ts
const REGISTRY_ORG = 'elizaos-plugins';
const REGISTRY_REPO = 'registry';
const REGISTRY_URL = `https://raw.githubusercontent.com/${REGISTRY_ORG}/${REGISTRY_REPO}/refs/heads/main/generated-registry.json`;

// Define the structure of plugin secrets requirements
export interface PluginSecret {
    name: string;
    description?: string;
    required: boolean;
    example?: string;
}

interface PluginPackageJson {
    name: string;
    version: string;
    description?: string;
    elizaos?: {
        secrets?: PluginSecret[];
        requiredSecrets?: string[]; // Legacy format - just array of secret names
    };
    agentConfig?: {
        pluginType?: string;
        pluginParameters?: Record<
            string,
            {
                type: string;
                description?: string;
                required: boolean;
                sensitive?: boolean;
                example?: string;
            }
        >;
    };
}

export interface PluginDetails {
    name: string;
    requiredSecrets: PluginSecret[];
}

// Core plugins that are part of the monorepo and don't need external fetching
export const CORE_PLUGINS = ['@elizaos/plugin-bootstrap', '@elizaos/plugin-sql'];

// Registry types
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
 * Fetch the plugin registry to get GitHub repo information
 */
async function fetchPluginRegistry(): Promise<RegistryResponse | null> {
    try {
        const response = await fetch(REGISTRY_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch registry: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch plugin registry:', error);
        return null;
    }
}

/**
 * Convert plugin name for registry lookup - handles both @elizaos and @elizaos-plugins formats
 */
function getRegistryPluginName(pluginName: string): string {
    // If already in @elizaos-plugins format, return as is
    if (pluginName.startsWith('@elizaos-plugins/')) {
        return pluginName;
    }
    // Convert @elizaos to @elizaos-plugins format
    return pluginName.replace('@elizaos/', '@elizaos-plugins/');
}

/**
 * Check if a plugin is a core plugin that doesn't need external fetching
 */
function isCorePlugin(pluginName: string): boolean {
    return CORE_PLUGINS.includes(pluginName);
}

/**
 * Get GitHub repo path from registry data
 */
function getGitHubRepoPath(
    pluginName: string,
    registryData: RegistryResponse | null
): string | null {
    // Skip core plugins
    if (isCorePlugin(pluginName)) {
        return null;
    }

    if (!registryData) {
        return null;
    }

    // Try both naming conventions
    const registryName = getRegistryPluginName(pluginName);
    const alternativeName = pluginName; // Try the original name as well

    // Try primary registry name first
    let pluginInfo = registryData.registry[registryName];

    // If not found, try the alternative name
    if (!pluginInfo && registryName !== alternativeName) {
        pluginInfo = registryData.registry[alternativeName];
    }

    if (!pluginInfo?.git?.repo) {
        console.warn(
            `No GitHub repo found in registry for plugin: ${pluginName} (tried ${registryName} and ${alternativeName})`
        );
        return null;
    }

    // Get the appropriate branch/version
    const gitInfo = pluginInfo.git.v1.branch ? pluginInfo.git.v1 : pluginInfo.git.v0;
    const branch = gitInfo?.branch || 'main'; // Default to 'main' if no branch info

    if (!gitInfo?.branch) {
        console.warn(`No branch information found for plugin: ${pluginName}`);
        // Don't return null here - we'll try default branches in fetchPluginPackageJson
    }

    // Extract owner/repo from the git URL
    let ownerRepo: string;

    const repoMatch = pluginInfo.git.repo.match(/github\.com[:/]([^/]+\/[^/.]+)(\.git)?$/);
    if (repoMatch) {
        ownerRepo = repoMatch[1];
    } else {
        // Try to parse as a simple owner/repo format (e.g., "elizaos-plugins/plugin-google-genai")
        const simpleMatch = pluginInfo.git.repo.match(/^([^/]+\/[^/.]+)$/);
        if (simpleMatch) {
            ownerRepo = simpleMatch[1];
        } else {
            console.warn(`Could not parse GitHub repo URL: ${pluginInfo.git.repo}`);
            return null;
        }
    }

    // Return a simple path without packages subdirectory
    // fetchPluginPackageJson will try various combinations
    return `${ownerRepo}/${branch}`;
}

/**
 * Fetches package.json for a single plugin from GitHub
 */
async function fetchPluginPackageJson(
    pluginName: string,
    repoPath: string | null
): Promise<PluginPackageJson | null> {
    // Skip core plugins
    if (isCorePlugin(pluginName)) {
        return null;
    }

    if (!repoPath) {
        return null;
    }

    // Extract the base repo path
    const pathParts = repoPath.split('/');
    const owner = pathParts[0];
    const repo = pathParts[1];
    const branch = pathParts[2] || 'main';
    const packageName = pluginName.replace('@elizaos/', '');

    // Try multiple possible paths for package.json
    // Prioritize root-level (standalone repos) over monorepo structure
    const possiblePaths = [
        // Try with the provided branch first at root level
        `${owner}/${repo}/${branch}`,
        // Try common branch names at root level
        `${owner}/${repo}/main`,
        `${owner}/${repo}/master`,
        `${owner}/${repo}/1.x`,
        `${owner}/${repo}/v1`,
        `${owner}/${repo}/v2`,
        // Only try packages subdirectory as a last resort for monorepo structure
        `${owner}/${repo}/${branch}/packages/${packageName}`,
        `${owner}/${repo}/main/packages/${packageName}`,
        `${owner}/${repo}/master/packages/${packageName}`,
    ];

    // Remove duplicates while preserving order
    const uniquePaths = [...new Set(possiblePaths)];

    for (const path of uniquePaths) {
        try {
            const url = `https://raw.githubusercontent.com/${path}/package.json`;
            const response = await fetch(url);

            if (response.ok) {
                const packageJson: PluginPackageJson = await response.json();
                return packageJson;
            }
        } catch (error) {
            // Silently continue to next path
        }
    }

    return null;
}

/**
 * Extract required secrets from package.json
 */
function extractRequiredSecrets(
    pluginName: string,
    packageJson: PluginPackageJson | null
): PluginSecret[] {
    // Core plugins don't have required secrets
    if (isCorePlugin(pluginName)) {
        return [];
    }

    if (!packageJson) {
        return [];
    }

    // First, try to get secrets from agentConfig.pluginParameters (new format)
    if (packageJson?.agentConfig?.pluginParameters) {
        const secrets: PluginSecret[] = [];
        for (const [name, config] of Object.entries(packageJson.agentConfig.pluginParameters)) {
            if (config.required === true) {
                secrets.push({
                    name,
                    description: config.description,
                    required: true,
                    example: config.example,
                });
            }
        }
        return secrets;
    }

    // Try to get secrets from elizaos.secrets
    if (packageJson?.elizaos?.secrets) {
        return packageJson.elizaos.secrets.filter((secret) => secret.required);
    }

    // Legacy format - convert string array to PluginSecret array
    if (packageJson?.elizaos?.requiredSecrets) {
        return packageJson.elizaos.requiredSecrets.map((secretName) => ({
            name: secretName,
            required: true,
        }));
    }

    return [];
}

/**
 * Hook to fetch plugin details including required secrets
 */
export function useElizaPluginDetails(pluginNames: string[]) {
    // Create a stable key for the query to prevent infinite loops
    const stablePluginNames = useMemo(() => {
        return [...pluginNames].sort().join(',');
    }, [pluginNames]);

    return useQuery({
        queryKey: ['eliza-plugin-details', stablePluginNames],
        queryFn: async () => {
            const details: PluginDetails[] = [];

            // Separate core plugins from external plugins
            const corePlugins = pluginNames.filter(isCorePlugin);
            const externalPlugins = pluginNames.filter((name) => !isCorePlugin(name));

            // Add core plugins with empty secrets
            corePlugins.forEach((name) => {
                details.push({
                    name,
                    requiredSecrets: [],
                });
            });

            // Only fetch registry if we have external plugins
            if (externalPlugins.length > 0) {
                // Fetch the registry to get repo information
                const registryData = await fetchPluginRegistry();

                // Fetch package.json for each external plugin in parallel
                const packageJsonPromises = externalPlugins.map(async (name) => {
                    const repoPath = getGitHubRepoPath(name, registryData);
                    const packageJson = await fetchPluginPackageJson(name, repoPath);
                    return { name, packageJson };
                });

                const results = await Promise.all(packageJsonPromises);

                // Extract required secrets for each plugin
                for (const { name, packageJson } of results) {
                    const requiredSecrets = extractRequiredSecrets(name, packageJson);
                    details.push({
                        name,
                        requiredSecrets,
                    });
                }
            }

            return details;
        },
        enabled: pluginNames.length > 0,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        retry: 2,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });
}

/**
 * Hook to get all required secrets for a list of plugins
 */
export function useRequiredSecrets(pluginNames: string[]) {
    const { data: pluginDetails, isLoading, error } = useElizaPluginDetails(pluginNames);

    const requiredSecrets = useMemo(() => {
        if (!pluginDetails) return [];

        return pluginDetails.reduce(
            (acc, plugin) => {
                plugin.requiredSecrets.forEach((secret) => {
                    // Avoid duplicates
                    if (!acc.find((s) => s.name === secret.name)) {
                        acc.push({
                            ...secret,
                            plugin: plugin.name,
                        });
                    }
                });
                return acc;
            },
            [] as (PluginSecret & { plugin: string })[]
        );
    }, [pluginDetails]);

    return {
        requiredSecrets,
        isLoading,
        error,
    };
}
