FROM node:22-slim AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .

ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
ENV DIRECT_URL="postgresql://user:pass@localhost:5432/db"
ENV AI_SERVER_URL="http://127.0.0.1:8000"
ENV NEXT_PUBLIC_SUPABASE_URL="https://placeholder.supabase.co"
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder"
ENV SUPABASE_SERVICE_ROLE_KEY="placeholder"
ENV GROQ_API_KEY="placeholder"
ENV RESEND_API_KEY="placeholder"
ENV GMAIL_USER="placeholder@gmail.com"
ENV GMAIL_APP_PASSWORD="placeholder"
ENV TWILIO_ACCOUNT_SID="placeholder"
ENV TWILIO_AUTH_TOKEN="placeholder"
ENV TWILIO_PHONE_NUMBER="+10000000000"

RUN npx prisma generate
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y \
    libgl1 libglib2.0-0 libsm6 libxext6 curl gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend ./backend

COPY --from=frontend-builder /app/.next ./.next
COPY --from=frontend-builder /app/node_modules ./node_modules
COPY --from=frontend-builder /app/package.json ./package.json
COPY --from=frontend-builder /app/public ./public
COPY --from=frontend-builder /app/prisma ./prisma

COPY start.sh ./start.sh
RUN chmod +x start.sh

EXPOSE 3000 8000
CMD ["./start.sh"]