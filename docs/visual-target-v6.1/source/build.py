"""Build the downloadable, offline V6.1 preview with Python's standard library."""
import argparse
import base64
import json
from pathlib import Path

SOURCE = Path(__file__).resolve().parent
PAGE = SOURCE.parents[2] / "public/previews/roundtable-v6.1/index.html"


def read(name):
    return (SOURCE / name).read_text(encoding="utf-8-sig")


def fill(template, marker, value):
    if template.count(marker) != 1:
        raise ValueError(f"Expected exactly one {marker} in its template")
    return template.replace(marker, value, 1)


def render():
    assets = {}
    for entry in json.loads(read("assets-index.json")):
        key = entry["id"]
        if key in assets:
            raise ValueError(f"Duplicate asset id: {key}")
        data = (SOURCE / entry["file"]).read_bytes()
        assets[key] = "data:image/webp;base64," + base64.b64encode(data).decode("ascii")

    script = fill(read("controller.js"), "__CANVAS__", read("canvas.js"))
    html = read("template.html")
    for marker, value in (
        ("__CSS__", read("style.css")),
        ("__ASSETS__", json.dumps(assets, separators=(",", ":"))),
        ("__GEO__", read("geometry.json")),
        ("__SCRIPT__", script),
    ):
        html = fill(html, marker, value)
    # Preserve the approved offline file byte-for-byte, including its line endings.
    return html.replace("\n", "\r\n").encode("utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify the published file without changing it")
    parser.add_argument("--output", type=Path, default=PAGE, help="optional standalone HTML path")
    args = parser.parse_args()
    data = render()
    if args.check:
        if not args.output.is_file() or args.output.read_bytes() != data:
            parser.exit(1, "Offline preview is missing or out of date. Run build.py to rebuild.\n")
        print("OK: offline preview matches the editable source byte-for-byte.")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_bytes(data)
        print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
