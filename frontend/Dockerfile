FROM node:22.8.0-alpine as base
WORKDIR /app

RUN apk add --no-cache g++ make py3-pip libc6-compat

COPY package.json package-lock.json ./

RUN npm ci --only=production

FROM node:22.8.0-alpine as builder
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY . . 


RUN npm ci && npm run build

FROM node:22.8.0-alpine as production
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_PUBLIC_WEBSOCKET_URL=ws://backend:8081

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=base /app/node_modules ./node_modules

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
USER nextjs

CMD ["npm", "start"]
