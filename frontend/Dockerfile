# ==========================================
# Step 1: Build the Vite / React Application
# ==========================================
FROM node:22-alpine AS build

WORKDIR /app

# Ensure devDependencies (Vite, TypeScript, etc.) are installed even in production
ENV NODE_ENV=development

# Copy package manifests
COPY package*.json ./

# Install ALL dependencies including Vite
RUN npm install --include=dev

# Copy application source code
COPY . .

# Pass build-time environment variables for Vite
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build static production assets into /app/dist
RUN npm run build

# ==========================================
# Step 2: Serve with Nginx
# ==========================================
FROM nginx:1.27-alpine

# Copy custom Nginx configuration (handles SPA routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static files from build stage to Nginx web root
COPY --from=build /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]