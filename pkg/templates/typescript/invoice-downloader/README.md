# Invoice Downloader (Anthropic Computer Use)

An AI-powered invoice downloader that uses **Anthropic Computer Use** to visually navigate billing portals and download invoices. Claude sees the screen, clicks buttons, fills forms, and downloads PDFs - just like a human would.

## How It Works

This template uses the **Computer Controls API adapter** pattern:

1. **Claude sees the screen** via screenshots
2. **Claude controls the browser** via mouse clicks, keyboard input, and scrolling
3. **Claude navigates** to the portal, logs in, finds invoices, and downloads them
4. **No brittle selectors** - Claude adapts to any UI layout

## Setup

1. Get your API keys:
   - **Kernel**: [dashboard.onkernel.com](https://dashboard.onkernel.com)
   - **Anthropic**: [console.anthropic.com](https://console.anthropic.com)

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY and portal credentials
```

3. Install dependencies:
```bash
npm install
```

4. Deploy:
```bash
kernel login
kernel deploy index.ts --env-file .env
```

## Usage

### Download by Invoice ID

```bash
kernel invoke ts-invoice-downloader download-invoice-by-id \
  --payload '{
    "invoiceId": "INV-001",
    "portalUrl": "https://billing.example.com",
    "username": "user@example.com",
    "password": "secret"
  }'
```

### Download by Date

```bash
kernel invoke ts-invoice-downloader download-invoice-by-date \
  --payload '{
    "date": "2024-01-15",
    "portalUrl": "https://billing.example.com",
    "username": "user@example.com",
    "password": "secret"
  }'
```

### Record a Replay

Add `"recordReplay": true` to capture a video of the browser session:

```bash
kernel invoke ts-invoice-downloader download-invoice-by-id \
  --payload '{
    "invoiceId": "INV-001",
    "recordReplay": true
  }'
```

The response will include a `replayUrl` to view the recorded session.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | **Required.** Your Anthropic API key |
| `PORTAL_URL` | Default billing portal URL |
| `PORTAL_USERNAME` | Default portal username |
| `PORTAL_PASSWORD` | Default portal password |

Credentials can be set via environment variables or passed in the payload.

## Testing

### Quick Test

1. **Local validation:**
   ```bash
   npm install
   npx tsx test.local.ts
   ```

2. **Deploy and test:**
   ```bash
   kernel deploy index.ts --env-file .env
   kernel invoke ts-invoice-downloader download-invoice-by-id \
     --payload '{"invoiceId": "TEST-001", "portalUrl": "...", "username": "...", "password": "..."}'
   ```

3. **View logs:**
   ```bash
   kernel deploy logs <deployment_id> --follow
   ```

See [TESTING.md](./TESTING.md) for detailed testing instructions.

## Architecture

```
invoice-downloader/
├── index.ts           # Kernel action handlers
├── loop.ts            # Anthropic Computer Use sampling loop
├── session.ts         # Browser session management
├── tools/
│   ├── computer.ts    # Computer Controls API adapter
│   ├── collection.ts  # Tool collection
│   ├── types/         # Type definitions
│   └── utils/         # Validators
├── types/             # Beta API types
└── utils/             # Message processing
```

## Customization

The `loop.ts` file contains the system prompt that guides Claude. You can modify it to:

- Add specific instructions for your portal's layout
- Handle multi-factor authentication
- Download multiple invoices in one session
- Extract invoice data before downloading

## Resources

- [Anthropic Computer Use Documentation](https://docs.anthropic.com/en/docs/build-with-claude/computer-use)
- [Kernel Computer Controls API](https://www.kernel.sh/docs/browsers/computer-controls)
- [Kernel Documentation](https://www.kernel.sh/docs/quickstart)
