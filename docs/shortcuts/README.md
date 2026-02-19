# RA-OS Capture Shortcuts

Two capture integrations: email via Apple Shortcuts, and files via a macOS Quick Action.

Both require RA-OS running locally at `http://localhost:3000`.

---

## 1. Email → Vault (Apple Shortcut)

Adds a "Add to RA-OS Vault" option to the Mail share sheet on macOS and iOS.

### Setup

1. Open the **Shortcuts** app (macOS or iOS).
2. Create a new Shortcut named **"Add to RA-OS Vault"**.
3. Set **"Receive"** input to **Mail Message** from the share sheet.
4. Add these actions in order:

**Action 1 — Get Details of Mail Message**
- Detail: **Subject** → save as `subject`
- Detail: **Body of Mail** → save as `body`
- Detail: **Sender's Name** → save as `from`
- Detail: **Date Sent** → save as `date` (format as ISO 8601: `yyyy-MM-dd'T'HH:mm:ssXXXXX`)

**Action 2 — Get Contents of URL**
- URL: `http://localhost:3000/api/ingest/email`
- Method: **POST**
- Headers: `Content-Type: application/json`
- Request Body: **JSON**
  ```json
  {
    "subject": [subject variable],
    "body": [body variable],
    "from": [from variable],
    "date": [date variable]
  }
  ```

**Action 3 — Show Notification**
- Title: **Added to RA-OS Vault**
- Body: `[subject variable]`

5. In the shortcut settings, enable **"Show in Share Sheet"**.

### Usage

- **macOS Mail**: Select an email → click the Share button → "Add to RA-OS Vault"
- **iOS Mail**: Open an email → tap the Share icon → scroll to find "Add to RA-OS Vault"

### Using over a local network (iOS → Mac)

The shortcut uses `localhost`. On iOS, replace `localhost` with your Mac's local IP address
(e.g., `http://192.168.1.x:3000/api/ingest/email`) or use Tailscale so both devices share
the same VPN network and `localhost` resolves via the Tailscale IP.

---

## 2. File → Vault (macOS Quick Action)

Adds "Add to RA-OS Vault" to Finder's right-click context menu.

**Supported formats:** PDF, TXT, Markdown (.md), Word (.docx)

### Setup via Automator

1. Open **Automator** (Applications → Automator).
2. Choose **New Document** → select **Quick Action**.
3. Set:
   - **Workflow receives current**: `files or folders` in `Finder`
4. Add a **Run Shell Script** action:
   - Shell: `/bin/bash`
   - Pass input: `as arguments`
5. Paste this script:

```bash
#!/bin/bash
FILE="$1"
FILENAME=$(basename "$FILE")

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -F "file=@$FILE" \
  http://localhost:3000/api/extract/file/upload)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [ "$HTTP_CODE" -eq 200 ]; then
  TITLE=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('title','$FILENAME'))" 2>/dev/null || echo "$FILENAME")
  osascript -e "display notification \"$TITLE\" with title \"Added to RA-OS Vault\""
else
  osascript -e "display notification \"Failed: HTTP $HTTP_CODE\" with title \"RA-OS Vault Error\""
fi
```

6. Save as **"Add to RA-OS Vault"** (Automator saves it to `~/Library/Services/` automatically).

### Usage

Right-click any supported file in Finder → **Services** → **Add to RA-OS Vault**

If "Services" is not visible in the context menu, go to **System Settings → Keyboard → Keyboard Shortcuts → Services** and enable the action.

---

## API Reference

### `POST /api/ingest/email`

```json
{
  "subject": "string (required)",
  "body":    "string (required)",
  "from":    "string (required)",
  "date":    "ISO 8601 string (required)",
  "to":      "string (optional)",
  "attachments": ["string"]
}
```

Returns `{ success, nodeId, title }`.

### `POST /api/extract/file/upload`

Multipart form upload with field `file`.

Supported MIME types:
- `application/pdf`
- `text/plain`
- `text/markdown`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

Returns `{ success, nodeId, title, fileType, textLength }`.

---

## Verification

```bash
# Test email ingest
curl -X POST http://localhost:3000/api/ingest/email \
  -H "Content-Type: application/json" \
  -d '{"subject":"Test Email","body":"Hello world","from":"test@example.com","date":"2026-02-19T10:00:00Z"}'

# Test file upload (txt)
echo "My notes" > /tmp/test.txt
curl -F "file=@/tmp/test.txt" http://localhost:3000/api/extract/file/upload

# Test file upload (markdown)
echo "# My Header\nSome content" > /tmp/test.md
curl -F "file=@/tmp/test.md" http://localhost:3000/api/extract/file/upload
```
