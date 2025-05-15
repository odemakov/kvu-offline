FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY index.html ./
RUN npm ci

# Copy source files
COPY ./src ./src
COPY ./public ./public

# Build the application
RUN npm run build


FROM node:20-alpine AS node

WORKDIR /app

# Copy necessary server files and build output
COPY package*.json ./
COPY --from=builder /app/dist/ ./dist/
COPY tsconfig.server.json ./
COPY src/server ./src/server
COPY src/utils ./src/utils

# Install production dependencies only
RUN npm ci --omit=dev

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the API port
EXPOSE 3000

# Start the server (using tsx for TypeScript execution)
CMD ["npx", "tsx", "src/server/index.ts"]


FROM nginx:stable-alpine AS nginx

# Copy custom nginx configuration
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

# Copy dist content directly into nginx web root
COPY --from=builder /app/dist/ /usr/share/nginx/html/kvu-offline/

EXPOSE 80

# Default command
CMD ["nginx", "-g", "daemon off;"]
