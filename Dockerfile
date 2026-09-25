# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/contratos/package.json packages/contratos/package.json
RUN npm ci

COPY tsconfig.json tsconfig.base.json vite.config.ts ./
COPY app ./app
COPY packages/contratos ./packages/contratos
COPY public ./public
RUN npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/contratos/package.json packages/contratos/package.json
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/build ./build
COPY --from=build /app/packages/contratos ./packages/contratos
COPY public ./public

USER node
EXPOSE 8080
CMD ["npm", "run", "start"]
