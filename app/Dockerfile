FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build
ENV PORT=4173
EXPOSE 4173
CMD ["sh", "-c", "npx vite preview --port $PORT --host 0.0.0.0"]
