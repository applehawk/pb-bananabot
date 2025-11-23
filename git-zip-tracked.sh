#!/usr/bin/env bash
set -euo pipefail

OUT="${1:-repo-tracked.zip}"

tmpfile="$(mktemp)"
trap 'rm -f "$tmpfile"' EXIT

# главные tracked файлы (null-separated)
git ls-files -z > "$tmpfile"

# добавляем tracked файлы из сабмодулей, префиксуя их путём сабмодуля
git submodule --quiet foreach --recursive 'printf "%s\0" "$path"' |
while IFS= read -r -d '' subpath; do
  if [ ! -d "$subpath" ]; then
    printf "warning: submodule path %s missing, skipping\n" "$subpath" >&2
    continue
  fi
  # файлы внутри сабмодуля (без префикса) -> добавляем префикс
  git -C "$subpath" ls-files -z | while IFS= read -r -d '' f; do
    printf "%s\0" "$subpath/$f" >> "$tmpfile"
  done
done

# запускаем встроенный python3 для упаковки в zip
# передаём tmpfile и имя выходного архива как аргументы
python3 - "$tmpfile" "$OUT" <<'PY'
import sys, zipfile, os

infile = sys.argv[1]
outfile = sys.argv[2]

with open(infile, 'rb') as f:
    data = f.read()

paths = [p.decode('utf-8') for p in data.split(b'\0') if p]
if not paths:
    print("No files to archive.", file=sys.stderr)
    sys.exit(1)

# убираем дубликаты, сохраняя порядок
seen = set()
uniq_paths = []
for p in paths:
    if p not in seen:
        seen.add(p)
        uniq_paths.append(p)

with zipfile.ZipFile(outfile, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
    added = 0
    for p in uniq_paths:
        try:
            if os.path.islink(p):
                target = os.readlink(p)
                real = target if os.path.isabs(target) else os.path.normpath(os.path.join(os.path.dirname(p), target))
                if os.path.isfile(real):
                    zf.write(real, arcname=p)
                    added += 1
                else:
                    print(f"Skipping symlink (target not a regular file): {p}", file=sys.stderr)
            elif os.path.isfile(p):
                zf.write(p, arcname=p)
                added += 1
            else:
                print(f"Skipping non-file: {p}", file=sys.stderr)
        except Exception as e:
            print(f"Error adding {p}: {e}", file=sys.stderr)
print(f"Wrote {outfile} ({added} files).")
PY

echo "Archive created: $OUT"
