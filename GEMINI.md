# Project Overview

This is the `blueprints` a monorepo for managing "AI Agents". From the database schema, it appears to be a system for managing the deployment and state of AI agents.

The project is structured as a monorepo with the following packages:

*   **`packages/frontend`**: A [Next.js](https://nextjs.org/) application that provides the user interface for managing projects and agents. It uses [React](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/), and [Supabase](https://supabase.io/) for authentication and data fetching.
*   **`packages/backend`**: A [Fastify](https.www.fastify.io/) backend server that likely provides a REST API for the frontend to interact with. It also connects to the Supabase database.
*   **`packages/worker`**: A worker process that likely performs background tasks related to agent management, such as syncing state between the desired and actual state of agents.
*   **`packages/shared`**: A shared package for code that is used across the other packages, such as type definitions and validation schemas using [Zod](https://zod.dev/).

## Building and Running

The project uses `bun` as the package manager and task runner.

### Running the development servers:

*   **Frontend**: `bun run dev:frontend`
*   **Backend**: `bun run dev:backend`
*   **Worker**: `bun run dev:worker`

### Building the project:

*   `bun run build`

### Linting the project:

*   `bun run lint`

## Development Conventions

*   The project is written in [TypeScript](https://www.typescriptlang.org/).
*   The monorepo is managed with `bun` workspaces.
*   The project uses [Supabase](https://supabase.io/) for the database and authentication. The database schema is defined in `schema.sql`.
*   The frontend uses [Tailwind CSS](https://tailwindcss.com/) for styling.
*   The backend uses [Fastify](https://www.fastify.io/).
*   The shared package uses [Zod](https://zod.dev/) for data validation.
