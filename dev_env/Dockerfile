# Use an official Node.js runtime as a parent image
FROM node:18

# Set the working directory in the container
WORKDIR /app

# Copy the package.json and package-lock.json files to the container
#COPY package*.json ./

# Install the application dependencies
RUN npm install express
RUN npm install pg
RUN npm install cors

# Copy the rest of the application code to the container
COPY . .

# Expose the port the app runs on
EXPOSE 3001

# Define the command to run the app
CMD ["node", "server.js"]