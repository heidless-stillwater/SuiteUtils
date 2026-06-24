# ═══ Stage 1: Dependencies ═══
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
# Install all dependencies for build
RUN npm ci

# ═══ Stage 2: Builder ═══
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Explicitly set build-time environment variables for Vite
ENV VITE_FIREBASE_API_KEY=AIzaSyCiaUg3a8aw72KarxZCUGUMdfaCK7Y-3tk
ENV VITE_FIREBASE_AUTH_DOMAIN=stillwater-sovereign-02.firebaseapp.com
ENV VITE_FIREBASE_PROJECT_ID=stillwater-sovereign-02
ENV VITE_FIREBASE_STORAGE_BUCKET=stillwater-sovereign-02.firebasestorage.app
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=850624280491
ENV VITE_FIREBASE_APP_ID=1:162911733499:web:68e7bfc3e0b00bc8a3125e
ENV VITE_FIRESTORE_DATABASE_ID=suiteutils-db-0
ENV VITE_ADMIN_EMAILS=lockhart.r@gmail.com,heidlessemail19@gmail.com,heidlessemail21@gmail.com

RUN npm run build

# ═══ Stage 3: Runner ═══
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 suiteuser

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy necessary artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/package.json ./package.json

# Ensure directories exist and are writable
RUN mkdir -p logs config && chown -R suiteuser:nodejs /app

USER suiteuser

EXPOSE 8080

# Start using tsx to run the TypeScript server
CMD ["npx", "tsx", "server/deploy-api.ts"]
