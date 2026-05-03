FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN mkdir -p data logs

RUN addgroup -g 1001 -S botuser && \
    adduser -S -u 1001 -G botuser botuser && \
    chown -R botuser:botuser /app

USER botuser

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('fs').existsSync('/app/src/index.js') && process.exit(0) || process.exit(1)"

CMD ["node", "src/index.js"]
