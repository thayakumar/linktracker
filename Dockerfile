FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json server.mjs index.html ./
RUN mkdir /data && chown node:node /data
USER node
ENV HOST=0.0.0.0 PORT=3000 DATA_DIR=/data NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.mjs"]
