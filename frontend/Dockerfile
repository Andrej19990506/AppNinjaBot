# Stage 1: Build the React application
FROM node:18 as builder

WORKDIR /app

# Define build-time arguments received from docker-compose
ARG REACT_APP_API_URL
ARG REACT_APP_WS_URL
# ARG REACT_APP_VERSION # Uncomment if version is passed as arg and needed during build

# Copy package files and install dependencies
COPY package.json ./
# Use ci for potentially faster and more reliable installs in CI/CD
# RUN npm ci 
# Trying npm install as a workaround for ci failure
RUN npm install

# Copy the rest of the application code
COPY . .

# Set NODE_ENV for the build process
ENV NODE_ENV=production

# Build the application
# Build-time args are available as env vars if needed by the build script
# e.g., if REACT_APP_VERSION was needed: ENV REACT_APP_VERSION=$REACT_APP_VERSION
RUN npm run build

# --- The final 'production-build' stage --- #
# This stage is targeted by docker-compose.
# It inherits the /app/build directory from the 'builder' stage.
# Giving it an explicit name to be referenced by other Dockerfiles
FROM builder as production-build
# No further commands needed, the build artifact /app/build is ready.

# --- REMOVED STAGES --- #
# Development stage is removed
# Production (nginx) stage is removed (handled by separate nginx service) 