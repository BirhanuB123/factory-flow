# Backend Dockerfile for Factory Flow ERP
# Builds the backend only. Frontend is a separate Vite app in ./frontend.

FROM node:20-alpine AS builder
WORKDIR /usr/src/app

# Install dependencies first to leverage Docker cache
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy full app source
COPY . ./

FROM node:20-alpine AS release
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["npm", "start"]
