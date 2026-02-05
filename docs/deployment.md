# Deployment Guide

This guide explains how to deploy the **Blueprints** monorepo in two main production configurations: **Standalone VPS** or **Hybrid (Render + VPS)**.

---

## Architecture Options

### 1. Standalone VPS (Fully Self-Hosted)
In this mode, everything (Backend, Worker, and Agents) runs on your own VPS.
- **Pros**: Zero third-party costs (excluding VPS), full control over infrastructure.
- **Cons**: You must manage your own SSL (e.g., Nginx + Certbot) and handle firewall security.

### 2. Hybrid Mode (Render + VPS) — RECOMMENDED
In this mode, the **Backend** runs on Render for easy SSL/Public URLs, and the **Worker** runs on your VPS to handle heavy Docker isolation.
- **Pros**: Automatic SSL (`https://your-app.onrender.com`), public URL for the dashboard, but keeps processing power on your VPS.
- **Cons**: Distributed setup (Render Backend talks to VPS Agents over the internet).

---

## Setup Steps

### 1. Prepare your VPS
Run the automated setup scripts from the root of the repository on your VPS:

```bash
# Setup Docker, Node 22, and Permissions
./scripts/setup-vps.sh

# Clone and build the OpenClaw agent image
./scripts/setup-openclaw.sh
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ENCRYPTION_KEY=...

# REQUIRED FOR HYBRID MODE ONLY:
VPS_PUBLIC_IP=your.vps.public.ip
```

### 3. Deploy Orchestration

#### Option A: Standalone (Entire Stack on VPS)
Run everything via Docker Compose:
```bash
docker compose up --build -d
```
*Note: Ensure your firewall allows port 3000 (Backend) and 19000-19999 (Agents).*

#### Option B: Hybrid (Worker ONLY on VPS)
Run only the worker container on the VPS:
```bash
docker compose up worker --build -d
```
Then, deploy the **Backend** to Render using the `packages/backend/Dockerfile` as the build context.

---

## Networking & Proxying
The Backend automatically proxies chat requests to the correct agent. 
- If `VPS_PUBLIC_IP` is set, it proxies to `http://<VPS_IP>:<AgentPort>`.
- ensure your VPS firewall allows incoming traffic on the Agent port range (`19000-19999`).

## Troubleshooting
- **404 Image Missing**: Ensure you ran `./scripts/setup-openclaw.sh` to build the `openclaw:local` image.
- **Permission Denied**: Run `sudo chown -R $USER:$USER .` in the project root.
- **Cannot Reach Agent**: Check that `VPS_PUBLIC_IP` is correct and the firewall is open.
