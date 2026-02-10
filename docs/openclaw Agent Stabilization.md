Walkthrough: OpenClaw Agent Stabilization
I have successfully resolved the startup loops and privilege issues for your local OpenClaw agents. The system is now stable and running with the correct security levels.

Changes Made
1. Rebuilt OpenClaw Image
Fetched a fresh copy of the OpenClaw source and rebuilt the openclaw:local image.
This cleared out legacy state and ensured all latest CLI entrypoints (
openclaw.mjs
) are available.
2. Fixed Startup Loop ("Missing config")
Correct Entrypoint: Switched the worker to use 
openclaw.mjs
 instead of dist/index.js. This is the official CLI entrypoint that handles bootstrapping correctly.
Bootstrapping Flags: Added --allow-unconfigured to the startup command to bypass interactive setup in the container.
Permission Hardening: Tightened permissions on 
openclaw.json
 to 0600 and the workspace directory to 0700. OpenClaw (like SSH) ignores configurations that are world-readable for security reasons.
3. Tier-Based Security
Dynamic Privileges: The worker now correctly resolves the security level from database metadata.
User Switching:
Sandbox/SysAdmin: Runs as node (UID 1000).
Root: Runs as root (UID 0).
Capability Management: Root agents now receive SYS_ADMIN and NET_ADMIN capabilities via Docker's CapAdd.
Verification Results
Stable Container Uptime
The agents are now running stably without restarting (previously crashing every 5 seconds).

bash
CONTAINER ID   STATUS          NAMES
42cc8f001130   Up 2 minutes    openclaw-f82b5c90-89f2-4aa6-853e-ca6b398e119c
c347c96b64cd   Up 2 minutes    openclaw-b8e96670-a7c6-4b68-8b6f-66acc925f1ea
Process Monitoring
Verified that the OpenClaw gateway process is alive and active inside the containers.

bash
USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
node          14  111  5.5 1821816 898652 ?      Rl   22:50   0:47 openclaw
Response to "Two Flavors" Proposal
NOTE

You suggested using two different images (Sandbox vs Privileged). Our current architecture achieves this more cleanly with one versatile image:

Upgrade Path: When an agent is upgraded, we simply recreate the container with a different 
User
 (root) and CapAdd flags.
State Consistency: Because the image is identical, the agent keeps its memories (.openclaw/workspace) perfectly across upgrades without risk of software drift between "flavors".
Reduced Maintenance: We only have to maintain and build one local image.
You are now all set to continue developing with your local agents!