# Stage 1: Build the frontend
FROM node:20 AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Backend environment
FROM python:3.11-slim
WORKDIR /app

# Install git (required by the app for scanning)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy built frontend from Stage 1 into the location expected by Flask
COPY --from=frontend-build /app/dist ./dist

# Copy backend code
COPY backend/ ./backend

# Set environment variables
ENV FLASK_APP=backend/app.py
ENV PORT=5000

# Expose port (Render will use this or override with PORT env)
EXPOSE 5000

# Run the backend
# We use host 0.0.0.0 to allow external access
CMD ["python", "backend/app.py"]
