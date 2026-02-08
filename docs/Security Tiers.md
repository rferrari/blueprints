Security Tiers & Path Resolution Fixes
I have synchronized the refactor/worker2 branch with optimizations from other branches and implemented a new tiered security model for OpenClaw agents.

Changes Made
OpenClaw Multi-Tier Security
Implemented three security flavors for OpenClaw agents, configurable via metadata.security_tier:

Tier	User	Capabilities	Description
Low	node:node (1000)	None	Strict sandbox (default)
Pro	node:node (1000)	SYS_ADMIN	Elevated sandbox for technical tasks
Custom	root (0)	Full	Root mode for unrestricted access
Docker Volume Path Fixes
Standardized projectRoot resolution across all handlers to prevent nested directory duplication.
Ensured Docker volume binds always use absolute paths, resolving the invalid characters for a local volume name error.
Verified that HOST_WORKSPACES_PATH is correctly resolved relative to the monorepo root.
Docker Helper Enhancements
Added 
inspectImage
 and 
pullImage
 to the custom Docker wrapper.
The worker now proactively checks for image existence and attempts to pull missing images from the registry.
ElizaOS Optimizations
Ported the fast-startup Dockerfile and entrypoint from feat/eliza-docker.
Reduced container startup overhead by pre-installing ElizaOS in the base image.
Verification Results
Security Tiers
Verified via docker inspect on a running OpenClaw agent:

low: User 1000:1000, no special caps.
pro: User 1000:1000, CapAdd: [SYS_ADMIN].
custom: User 0:0.
Path Resolution
Verified that workspaces are created at the expected location: [project-root]/packages/worker/workspaces/[agent-id]/.openclaw And mounted correctly as absolute paths to the containers.

Health & Diagnostics
Running 
./scripts/5-vps-diagnostics.sh
 confirms system health.
Worker logs confirm successful reconciliation and state synchronization.
IMPORTANT

Since we share a database with staging, I've added safety checks to ensure the local worker doesn't crash if a specific agent image is not found locally.