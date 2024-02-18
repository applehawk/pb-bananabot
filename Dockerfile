################################################################################
# Use node image for base image for all stages.
FROM node:alpine
# Set working directory for all build stages.
WORKDIR /usr/horoscope
COPY package.json .
RUN npm install && npm install typescript -g
COPY . .
RUN npm run build
# Use production node environment by default.
ENV NODE_ENV production
# Expose the port that the application listens on.
EXPOSE 80
# Run the application.
CMD ["node", "./dist/main.js"]
