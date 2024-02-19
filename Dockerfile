FROM node:latest as builder
# Set working directory for all build stages.
WORKDIR /usr/vpnssconf
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./
COPY src/prisma ./src/prisma/
# Install app dependencies
RUN npm install
# Prisma generate db based on ORM
RUN npx prisma generate
# Bundle app source
COPY . .
RUN npm run build

################################################################################
# Use node image for base image for all stages.
FROM node:alpine
COPY --from=builder /usr/vpnssconf/node_modules ./node_modules
COPY --from=builder /usr/vpnssconf/package*.json ./
COPY --from=builder /usr/vpnssconf/dist ./dist
COPY --from=builder /usr/vpnssconf/src/prisma ./src/prisma
# Use production node environment by default.
ENV NODE_ENV production
# Expose the port that the application listens on.
EXPOSE 80
# Run the application.
CMD ["node", "run", "start:migrate:prod"]
