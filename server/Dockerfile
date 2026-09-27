# Zenith API — container for Google Cloud Run (or any container host).
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

# Production dependencies only: the test-only in-memory MongoDB stays out of the image.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js ./
COPY src ./src

# Cloud Run sends traffic to $PORT (8080); the app reads PORT from the environment.
ENV PORT=8080
EXPOSE 8080

USER node
CMD ["node", "index.js"]
