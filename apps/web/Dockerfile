FROM node:20-alpine AS builder

WORKDIR /app

# Copy root configuration and manifests
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN npm install
RUN npm --workspace=@online-chess/shared run build

ARG VITE_API_URL
ARG VITE_SOCKET_URL
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

RUN npm --workspace=@online-chess/web run build

# Production static file serving with Nginx
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
