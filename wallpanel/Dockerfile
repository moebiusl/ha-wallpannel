ARG BUILD_FROM
FROM $BUILD_FROM

WORKDIR /app

RUN apk add --no-cache nodejs npm bash

COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
COPY public ./public

RUN npm ci \
  && npm run build \
  && npm prune --omit=dev

COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
