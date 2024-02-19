################################################################################
# Use node image for base image for all stages.
FROM node:alpine

# Set working directory for all build stages.
WORKDIR /usr/vpnssconf

# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install app dependencies
RUN npm install

# Bundle app source
COPY . .

# Creates a "dist" folder with the production build
RUN npm run build

# Use production node environment by default.
ENV NODE_ENV production

# Expose the port that the application listens on.
EXPOSE 80

# Run the application.
CMD ["node", "./dist/main.js"]
