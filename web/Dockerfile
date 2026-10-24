# Warstwa WEB: etap 1 buduje pliki statyczne Vite, etap 2 serwuje je przez Nginx.
# Build: docker build -t zdechpies-web --build-arg VITE_USE_MOCK_API=true .
# Run:   docker run --rm -p 8080:80 zdechpies-web

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_USE_MOCK_API=
ENV VITE_USE_MOCK_API=$VITE_USE_MOCK_API
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
