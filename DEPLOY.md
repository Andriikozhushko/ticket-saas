# Production deployment (VPS)

Deploy the Next.js monolith on a clean Ubuntu server. No separate backend; migrations run on container start. No manual SQL import.

## Prerequisites

- Ubuntu 22.04 LTS (or similar)
- Root or sudo access
- GitHub repo with Docker image published to GHCR (`ghcr.io/<owner>/ticket-saas-web:latest`)

## 1. Install Docker and Docker Compose

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
# Log out and back in (or newgrp docker) so docker runs without sudo
```

## 2. Clone the repo and prepare env

```bash
cd /opt   # or your preferred path
sudo git clone https://github.com/YOUR_ORG/ticket-saas.git
cd ticket-saas
```

Create `.env` in the repo root (same directory as `docker-compose.prod.yml`). Required for pull and run:

```bash
# Required for image pull (your GitHub username or org, lowercase)
GITHUB_OWNER=your-github-username

# Database password (used by db and web)
POSTGRES_PASSWORD=your_secure_password

# App (optional but recommended)
DATABASE_URL=postgresql://postgres:your_secure_password@db:5432/tickets?schema=public
ADMIN_EMAIL=admin@example.com
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_TURNSTILE_SITEKEY=
TURNSTILE_SECRET_KEY=
TICKETIER_PASSWORD_SALT=
```

If the image is private, log in to GHCR once:

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

## 3. Pull and run

From the repo root (after clone and `.env` are in place):

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

**Minimal workflow** on an already-configured VPS (no manual SQL, no global Prisma):

```bash
git pull
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Migrations run automatically when the web container starts (project-local Prisma 6.19.2; no global install). If all migrations are already applied, startup does not crash. Uploaded posters are stored in the `uploads_data` volume and persist across restarts.

## 4. Verify

- Homepage: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/` → `200`
- Session API: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/auth/session` → `200`
- Uploaded poster (after at least one upload): e.g. `http://localhost:3001/uploads/posters/<filename>` → `200`

Put Nginx (or another reverse proxy) in front of port 3001 and point your domain to the server. See `nginx.conf.example` for a minimal config.

## 5. Updates

```bash
cd /opt/ticket-saas
git pull
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Uploaded posters and other files under `/app/public/uploads` are persisted in the `uploads_data` volume and survive restarts.
