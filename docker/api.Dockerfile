FROM node:20-alpine

# tini for proper PID 1 signal handling
RUN apk add --no-cache tini openssl

WORKDIR /app

# Install production dependencies
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy prisma schema and generate client
COPY backend/prisma ./prisma
RUN npx prisma generate

# Copy application code
COPY backend/ .

# Copy entrypoint script
COPY docker/api-entrypoint.sh /usr/local/bin/api-entrypoint.sh
RUN chmod +x /usr/local/bin/api-entrypoint.sh

# Non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3001

ENTRYPOINT ["tini", "--"]
CMD ["api-entrypoint.sh"]
