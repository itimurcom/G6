#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
FILE="$ROOT/public/index.php"
TMP="$FILE.__tmp__"
OUT="$FILE.__out__"

if [[ ! -f "$FILE" ]]; then
  echo "Error: public/index.php not found. Run this from the project root." >&2
  exit 1
fi

# 1) One-time backup
cp -n "$FILE" "$FILE.bak" 2>/dev/null || true

# 2) Remove any existing /api/users/name lines (broken inserts)
grep -v "/api/users/name" "$FILE" > "$TMP" || true

# 3) Insert correct line after the *end* of /api/users/get call
#    We'll parse and track parentheses () and brackets [] balance; ignore inside strings.
INSERT="\$router->get('/api/users/name',         [\\App\\Controllers\\ApiUserNameController::class, 'name']);"

python3 - << 'PY' "$TMP" "$OUT" "$INSERT"
import sys, re

inp, outp, INSERT = sys.argv[1], sys.argv[2], sys.argv[3]

with open(inp, 'r', encoding='utf-8', errors='ignore') as f:
    src = f.read()

# Find the start of /api/users/get
start = src.find("$router->get('/api/users/get'")
if start == -1:
    # fallback: append before closing PHP tag if present, else at end
    s = src.rstrip()
    if s.endswith("?>"):
        s = s[:-2].rstrip() + "\n" + INSERT + "\n?>\n"
    else:
        s = s + ("\n" if not s.endswith("\n") else "") + INSERT + "\n"
    src = s
else:
    # Walk forward from 'start' to find end of the *call* by tracking (), []
    i = src.find('(', start)
    if i == -1:
        # malformed; insert after the line
        nl = src.find('\n', start)
        if nl == -1: nl = len(src)
        src = src[:nl] + "\n" + INSERT + src[nl:]
    else:
        paren = 0
        bracket = 0
        in_s = False
        in_d = False
        esc = False
        n = len(src)
        while i < n:
            ch = src[i]
            if in_s:
                if ch == "\\" and not esc:
                    esc = True
                elif ch == "'" and not esc:
                    in_s = False
                else:
                    esc = False
            elif in_d:
                if ch == "\\" and not esc:
                    esc = True
                elif ch == '"' and not esc:
                    in_d = False
                else:
                    esc = False
            else:
                if ch == "'":
                    in_s = True
                elif ch == '"':
                    in_d = True
                elif ch == '(':
                    paren += 1
                elif ch == ')':
                    paren -= 1
                elif ch == '[':
                    bracket += 1
                elif ch == ']':
                    bracket -= 1
                elif ch == ';' and paren == 0 and bracket == 0:
                    i += 1
                    break
            i += 1
        end = i
        src = src[:end] + "\n" + INSERT + "\n" + src[end:]

with open(outp, 'w', encoding='utf-8') as f:
    f.write(src)
PY

mv "$OUT" "$FILE"
rm -f "$TMP"

echo "Route fixed: inserted correct /api/users/name registration."
