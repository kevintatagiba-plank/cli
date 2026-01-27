# Testing the Invoice Downloader

## Prerequisites

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values:
   # - ANTHROPIC_API_KEY (required)
   # - PORTAL_URL, PORTAL_USERNAME, PORTAL_PASSWORD (optional, can pass in payload)
   ```

3. **Login to Kernel:**
   ```bash
   kernel login
   ```

## Option 1: Deploy and Test on Kernel (Recommended)

This is the standard way to test since the template uses Kernel's browser API.

### Step 1: Deploy

```bash
kernel deploy index.ts --env-file .env
```

### Step 2: Test Download by Invoice ID

```bash
kernel invoke ts-invoice-downloader download-invoice-by-id \
  --payload '{
    "invoiceId": "INV-001",
    "portalUrl": "https://your-billing-portal.com",
    "username": "your_username",
    "password": "your_password"
  }'
```

### Step 3: Test Download by Date

```bash
kernel invoke ts-invoice-downloader download-invoice-by-date \
  --payload '{
    "date": "2024-01-15",
    "portalUrl": "https://your-billing-portal.com",
    "username": "your_username",
    "password": "your_password"
  }'
```

### Step 4: Test with Replay Recording

To see a video of what Claude did:

```bash
kernel invoke ts-invoice-downloader download-invoice-by-id \
  --payload '{
    "invoiceId": "INV-001",
    "portalUrl": "https://your-billing-portal.com",
    "username": "your_username",
    "password": "your_password",
    "recordReplay": true
  }'
```

The response will include a `replayUrl` you can open in your browser.

## Option 2: Type Check Locally

Verify TypeScript compilation without deploying:

```bash
npx tsc --noEmit
```

## Option 3: View Deployment Logs

While testing, you can watch logs in real-time:

```bash
# Get the deployment ID from the deploy output, then:
kernel deploy logs <deployment_id> --follow
```

## Troubleshooting

### "ANTHROPIC_API_KEY is required"
- Make sure your `.env` file has `ANTHROPIC_API_KEY` set
- Or pass it via `--env ANTHROPIC_API_KEY=your_key` when deploying

### "Portal URL is required"
- Either set `PORTAL_URL` in `.env` or pass it in the payload

### Browser session fails
- Check that you're logged into Kernel: `kernel login`
- Verify your Kernel API key is valid
- Check deployment logs for errors

### Claude can't find the invoice
- The portal UI might be different than expected
- Try enabling `recordReplay: true` to see what Claude sees
- You may need to customize the system prompt in `loop.ts` for your specific portal

## Example Test Flow

```bash
# 1. Setup
cd /path/to/invoice-downloader
npm install
cp .env.example .env
# Edit .env with your keys

# 2. Deploy
kernel deploy index.ts --env-file .env

# 3. Test
kernel invoke ts-invoice-downloader download-invoice-by-id \
  --payload '{
    "invoiceId": "TEST-001",
    "portalUrl": "https://billing.example.com",
    "username": "test@example.com",
    "password": "testpass123",
    "recordReplay": true
  }'

# 4. Check logs (in another terminal)
kernel deploy logs <deployment_id> --follow
```
