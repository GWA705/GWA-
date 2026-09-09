# Container image for running the portal on AWS (ECS Fargate) in ca-central-1,
# co-located with the RDS database + S3 bucket to remove the US↔Canada round trip.
#
# NOTE: Render does NOT use this file — the Render service is configured with
# `runtime: node` (build: `npm install && npm run build`, start: `sh scripts/start.sh`).
# Committing this Dockerfile is therefore safe and does not affect the live service.
# See docs/AWS-MIGRATION.md for the full cutover.

# ---- build stage ----
FROM node:20-bookworm-slim AS build
WORKDIR /app

# openssl is required by Prisma; ca-certificates for outbound TLS (SMTP, Google, S3).
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* variables are inlined into the client bundle at BUILD time, so
# they must be present during `next build` (not just at runtime). Pass them as
# --build-arg and expose them to the build.
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

# `npm run build` = `prisma generate && next build`.
RUN npm run build

# ---- runtime stage ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    TZ=America/Toronto \
    PORT=3000

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Bring the fully built app (incl. node_modules with the generated Prisma client).
COPY --from=build /app ./

EXPOSE 3000

# start.sh: waits for the DB, runs `prisma migrate deploy`, seeds (idempotent),
# then starts Next on $PORT. Health check path: /api/health.
CMD ["sh", "scripts/start.sh"]
