FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.server.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src

RUN npm run build

FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

EXPOSE 8080

CMD ["node", "dist/server/index.js"]
