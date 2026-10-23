FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:24-bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/lib/jiange \
    && chown node:node /var/lib/jiange
WORKDIR /app
ENV NODE_ENV=production PORT=3020 DB_PATH=/var/lib/jiange/app.sqlite
COPY --chown=node:node server ./server
COPY --chown=node:node projects/yini-website ./projects/yini-website
COPY --chown=node:node data/*.json ./data/
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3020
VOLUME ["/var/lib/jiange"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.mjs"]
