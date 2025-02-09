FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Create data directory
RUN mkdir -p data

# Expose the port the app runs on
EXPOSE 3000

# Ensure environment variables are loaded
ENV NODE_ENV=production

# Start the application
CMD ["node", "main.js"] 