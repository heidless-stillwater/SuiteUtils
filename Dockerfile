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
ENV VITE_FIREBASE_API_KEY=AIzaSyAIxCHDN8J-zi3h4ms7hqVbN0qd2YDUGhU
ENV VITE_FIREBASE_AUTH_DOMAIN=heidless-apps-2.firebaseapp.com
ENV VITE_FIREBASE_PROJECT_ID=heidless-apps-2
ENV VITE_FIREBASE_STORAGE_BUCKET=heidless-apps-2.firebasestorage.app
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=789026577646
ENV VITE_FIREBASE_APP_ID=1:789026577646:web:6fed28bd312738c20fa7ff
ENV VITE_FIRESTORE_DATABASE_ID=suiteutils-db-0

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
