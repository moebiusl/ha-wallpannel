FROM ghcr.io/home-assistant/base:latest

WORKDIR /app

RUN apk add --no-cache nodejs npm bash

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY src ./src
COPY public ./public

RUN npm run build \
  && npm prune --omit=dev

COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]