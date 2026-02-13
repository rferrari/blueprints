export interface Model {
    id: string;
    name: string;
    isCompatible?: boolean;
}

export interface OpenClawConfig {
    provider: string;
    mode: string;
    token: string;
    gatewayToken: string;
    modelId: string;
    channels: {
        blueprints_chat: boolean;
        telegram: boolean;
        discord: boolean;
        whatsapp: boolean;
        slack: boolean;
        [key: string]: boolean;
    };
    telegramToken: string;
    discordToken: string;
    whatsappToken: string;
    slackToken: string;
    [key: string]: unknown; // Allow for other fields from existingConfig (changed from any to unknown for lint)
}

export interface OpenClawWizardProps {
    agent: {
        id: string;
        name: string;
        agent_desired_state: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    };
    onSave: (config: OpenClawConfig | undefined, metadata?: Record<string, unknown>, name?: string) => Promise<void>;
    onClose: () => void;
}

export function getOne<T>(val: T | T[]): T {
    return Array.isArray(val) ? val[0] : val;
}
