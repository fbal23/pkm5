# PKM5 Capture Shortcuts

Three capture integrations for iOS and macOS:
- **Quick Task** — capture any task or note from iOS/macOS
- **Email → PKM5** — add emails to the knowledge graph
- **File → PKM5** — ingest PDFs, markdown, and documents

All shortcuts require PKM5 running locally. From iOS, use Tailscale so your phone and MacBook share a VPN network — then replace `localhost` with your Mac's Tailscale IP (e.g. `100.x.x.x`).

---

## 1. Quick Task Capture (iOS + macOS)

Capture any task, idea, or note in a few taps. Supports `domain:X` and `due:YYYY-MM-DD` inline syntax.

**Examples of valid input:**
- `Review EIT Water proposal`
- `domain:HAC26 Write executive summary due:2026-03-01`
- `family: Call parents this weekend`

### iOS Shortcut

1. Open **Shortcuts** → New Shortcut → name it **"Add to PKM5"**
2. Add these actions:

**Action 1 — Ask for Input**
- Input type: **Text**
- Prompt: `Task or note (use domain:X, due:YYYY-MM-DD)`

**Action 2 — Get Contents of URL**
- URL: `http://localhost:3000/api/nodes` *(replace localhost with Tailscale IP for iOS)*
- Method: **POST**
- Headers: `Content-Type: application/json`
- Request Body: **JSON**
  ```json
  {
    "title": [Ask for Input result],
    "dimensions": ["task", "pending"],
    "metadata": {}
  }
  ```

**Action 3 — Show Notification**
- Title: **Captured**
- Body: [Ask for Input result]

3. Enable **"Show in Share Sheet"** and **"Show in Menu Bar"** (macOS) or **"Add to Home Screen"** (iOS)

### macOS Menu Bar Shortcut

Same shortcut works on macOS via the Shortcuts menu bar icon. Assign a keyboard shortcut (e.g. ⌘⇧T) in Shortcut settings → **Use as Quick Action**.

### Parsing domain and due date (optional enhancement)

If you want the shortcut to strip inline `domain:X` and `due:YYYY-MM-DD` from the title and populate metadata properly, use this Python snippet in a **Run Script over SSH** action (requires Tailscale + SSH to Mac):

```bash
python3 -c "
import re, json, sys
text = sys.argv[1]
domain = re.search(r'domain:(\S+)', text)
due = re.search(r'due:(\d{4}-\d{2}-\d{2})', text)
title = re.sub(r'(domain:|due:)\S+', '', text).strip().strip(':').strip()
dims = ['task', 'pending']
if domain: dims.append(domain.group(1))
meta = {}
if due: meta['due'] = due.group(1)
print(json.dumps({'title': title, 'dimensions': dims, 'metadata': meta}))
" \"$1\"
```

Then POST the output directly to `/api/nodes`.

---

## 2. Email → PKM5 (Apple Shortcut)

Adds **"Add to PKM5"** to the Mail share sheet on macOS and iOS.

### Setup

1. Open **Shortcuts** → New Shortcut → name it **"Add Email to PKM5"**
2. Set **"Receive"** input to **Mail Message** from the share sheet.
3. Add these actions:

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
- Title: **Added to PKM5**
- Body: [subject variable]

4. Enable **"Show in Share Sheet"**.

### Usage

- **macOS Mail**: select email → Share → "Add Email to PKM5"
- **iOS Mail**: open email → tap Share → scroll to "Add Email to PKM5"

---

## 3. File → PKM5 (macOS Quick Action)

Adds **"Add to PKM5"** to Finder's right-click menu.

**Supported formats:** PDF, TXT, Markdown (.md), Word (.docx)

### Setup via Automator

1. Open **Automator** → New Document → **Quick Action**
2. Set **Workflow receives current**: `files or folders` in `Finder`
3. Add a **Run Shell Script** action:
   - Shell: `/bin/bash`
   - Pass input: `as arguments`
4. Paste this script:

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
  TITLE=$(echo "$BODY" | python3 -c \
    "import sys,json; print(json.load(sys.stdin).get('title','$FILENAME'))" 2>/dev/null \
    || echo "$FILENAME")
  osascript -e "display notification \"$TITLE\" with title \"Added to PKM5\""
else
  osascript -e "display notification \"Failed: HTTP $HTTP_CODE\" with title \"PKM5 Error\""
fi
```

5. Save as **"Add to PKM5"** (saved automatically to `~/Library/Services/`).

### Usage

Right-click any supported file in Finder → **Services** → **Add to PKM5**

If "Services" isn't visible: **System Settings → Keyboard → Keyboard Shortcuts → Services** and enable it.

---

## API Reference

### `POST /api/nodes` — Quick capture

```json
{
  "title": "string (required)",
  "dimensions": ["task", "pending", "admin"],
  "metadata": { "due": "2026-03-01" },
  "notes": "optional longer content"
}
```

Returns `{ success, data: { id, title, dimensions, ... } }`.

### `POST /api/ingest/email`

```json
{
  "subject": "string (required)",
  "body": "string (required)",
  "from": "string (required)",
  "date": "ISO 8601 string (required)",
  "to": "string (optional)"
}
```

Returns `{ success, nodeId, title }`.

### `POST /api/extract/file/upload`

Multipart form upload with field `file`.

Supported MIME types: `application/pdf`, `text/plain`, `text/markdown`, `.docx`

Returns `{ success, nodeId, title, fileType, textLength }`.

---

## Verification

```bash
# Quick task capture
curl -X POST http://localhost:3000/api/nodes \
  -H "Content-Type: application/json" \
  -d '{"title":"Test task from shortcut","dimensions":["task","pending","admin"],"metadata":{"due":"2026-03-01"}}'

# Email ingest
curl -X POST http://localhost:3000/api/ingest/email \
  -H "Content-Type: application/json" \
  -d '{"subject":"Test","body":"Hello","from":"test@example.com","date":"2026-02-22T10:00:00Z"}'

# File upload
echo "My notes" > /tmp/test.txt
curl -F "file=@/tmp/test.txt" http://localhost:3000/api/extract/file/upload
```

---

## Tailscale setup (iOS → MacBook)

1. Install Tailscale on both iPhone and MacBook
2. Sign in with the same account
3. Find your MacBook's Tailscale IP: `tailscale ip -4`
4. In all shortcuts, replace `localhost` with that IP (e.g. `100.x.x.x`)
5. PKM5 must be running on the MacBook (`npm run dev` or production build)
