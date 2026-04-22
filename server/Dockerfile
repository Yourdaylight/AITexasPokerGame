FROM node:18-alpine AS build

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --production=false

COPY . .

ARG IDENTIFY_VERSION_KEY
RUN sed -i "s/IDENTIFY_VERSION_KEY/${IDENTIFY_VERSION_KEY:=tiger}/g" /app/src/app/io/middleware/auth.ts
ARG NODE_ENV
RUN yarn build

FROM node:18-alpine

RUN apk add --no-cache libstdc++

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/yarn.lock ./

EXPOSE 7001

ENV POKER_DB_PATH=/data/poker.db
ENV NODE_ENV=production

CMD ["yarn", "online"]
