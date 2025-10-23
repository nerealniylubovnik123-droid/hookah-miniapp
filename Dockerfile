FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install --omit=dev
ENV PORT=8080
CMD ["npm", "start"]
