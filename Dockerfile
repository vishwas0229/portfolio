FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

ENV NODE_ENV=development
ENV PORT=8888
ENV HOST=0.0.0.0

EXPOSE 8888

USER node

CMD ["npm", "run", "start:docker"]
