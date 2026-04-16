FROM node:20-alpine

# tini for proper PID 1 signal handling
RUN apk add --no-cache tini openssl

WORKDIR /app

# Install production dependencies
COPY worker/package*.json ./
RUN npm ci --omit=dev

# Copy prisma schema from backend and generate client
COPY backend/prisma ./prisma
RUN npx prisma generate

# Copy application code
COPY worker/ .

# Non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

ENTRYPOINT ["tini", "--"]
CMD ["node", "index.js"]
