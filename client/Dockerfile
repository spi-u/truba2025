FROM node:18-alpine3.17 as development

WORKDIR /app

# Install Python and dependencies needed for node-canvas and ffmpeg for audio processing
RUN apk add --no-cache \
    python3 \
    py3-pip \
    build-base \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    ffmpeg

COPY package*.json ./

RUN npm i

COPY . .

FROM development as build

ENV NODE_PATH=./build

RUN npm run build