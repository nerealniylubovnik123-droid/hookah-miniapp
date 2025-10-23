# === Этап 1: сборка ===
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

# === Этап 2: запуск ===
FROM node:18-alpine
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080
CMD ["node", "server.cjs"]
