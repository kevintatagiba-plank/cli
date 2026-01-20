# Kernel TypeScript Price Monitor - Stagehand

A Stagehand-powered browser automation app that monitors and extracts price information from product pages on websites.

## What it does

The `monitor-price` action navigates to a product page and extracts the current price, currency, and item name (if available) from the page.

## Input

```json
{
  "url": "https://example.com/product/item-123",  // Required: URL of the product page
  "itemName": "iPhone 15 Pro"  // Optional: Name of the item to help locate it on the page
}
```

## Output

```json
{
  "price": "999.99",  // The current price as a string
  "currency": "$",  // Currency symbol or code (optional)
  "itemName": "iPhone 15 Pro",  // Item name if found on page (optional)
  "url": "https://example.com/product/item-123"  // The URL that was monitored
}
```

## Setup

Create a `.env` file:

```
OPENAI_API_KEY=your-openai-api-key
```

**Note:** Kernel authentication is handled automatically. You can either:
- Run `kernel login` to authenticate with OAuth, or
- Set `KERNEL_API_KEY` environment variable (get from [Kernel Dashboard](https://dashboard.onkernel.com/api-keys))

## Deploy

```bash
kernel login  # or: export KERNEL_API_KEY=<your_api_key>
kernel deploy index.ts --env-file .env
```

## Test

After deploying, you can test the app using `kernel invoke`:

### ⭐ Recommended: Using a payload file (best for URLs with special characters)

Most e-commerce URLs contain special characters (`#`, `&`, `?`) that cause issues when passed directly. **Always use a payload file for real-world URLs:**

```bash
# Create payload.json with your URL and item name
cat > payload.json << 'EOF'
{
  "url": "https://www.amazon.com.br/Apple-iPhone-15-128-GB/dp/B0CP6CVJSG/?_encoding=UTF8&pd_rd_w=S5SPZ",
  "itemName": "iPhone 15"
}
EOF

# Invoke with the payload file
kernel invoke ts-price-monitor monitor-price --payload-file payload.json
```

**Quick tip:** You can edit `payload.json` and reuse it for different products:
```bash
# Edit the file
nano payload.json  # or use your preferred editor

# Run again
kernel invoke ts-price-monitor monitor-price --payload-file payload.json
```

### Alternative: Direct payload (only for simple URLs without special characters)

For simple URLs without query parameters or fragments, you can use `--payload`:

```bash
# Simple URL (no special characters)
kernel invoke ts-price-monitor monitor-price --payload '{"url": "https://www.apple.com/shop/buy-airpods/airpods-max", "itemName": "AirPods Max"}'
```

**Note:** If you get JSON parsing errors, switch to using a payload file instead.

### View logs while testing:
```bash
# In one terminal, follow logs
kernel logs ts-price-monitor --follow

# In another terminal, invoke the action
kernel invoke ts-price-monitor monitor-price --payload '{"url": "https://www.amazon.com/dp/B08N5WRWNW"}'
```

The browser live view URL will be printed in the logs, allowing you to watch the automation in real-time.
