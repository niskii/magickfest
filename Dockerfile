FROM node:25-alpine AS base
WORKDIR /usr/local/app
COPY shared ./../shared
RUN npm install -g corepack --force
RUN corepack enable

FROM base AS frontend-base
COPY frontend/package.json frontend/yarn.lock ./
COPY frontend/.yarn/patches ./.yarn/patches
COPY frontend/.yarn/sdks ./.yarn/sdks
COPY server/security ../server/security
RUN yarn install
COPY frontend/index.html frontend/tsconfig.json frontend/tsconfig.app.json frontend/tsconfig.node.json frontend/vite.config.ts frontend/.env ./
COPY frontend/src ./src

FROM frontend-base AS frontend-dev
CMD ["yarn", "vite", "--host"]

FROM frontend-base AS frontend-build
RUN ["yarn", "build"]

FROM base AS backend-dev
COPY server/package.json server/yarn.lock ./
COPY server/.yarn/patches ./.yarn/patches
COPY server/.yarn/sdks ./.yarn/sdks
RUN yarn install
COPY server/tsconfig.json server/.env ./
COPY server/src ./src
COPY server/config ./config
COPY server/security ./security
RUN mkdir ./temp
CMD ["yarn", "dev"]