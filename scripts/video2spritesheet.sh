#!/usr/bin/env bash
set -euo pipefail

# video2spritesheet.sh - Convert video animations to transparent PNG spritesheets
# Supports videos with native alpha channel (WebM/MOV) or green/blue screen (chroma key)
# Requires: ffmpeg, ffprobe, ImageMagick (convert, montage, mogrify)

VERSION="1.0.0"

# Defaults
FPS=12
COLS=0
SCALE=""
CHROMA=""
KEY_MODE="colorkey"  # colorkey (RGB, precise) or chromakey (YUV, aggressive)
SIMILARITY=0.12
BLEND=0.05
TRIM=false
JSON=false
PADDING=0
OUTPUT=""
INPUT=""

TMPDIR=""

cleanup() {
    if [[ -n "$TMPDIR" && -d "$TMPDIR" ]]; then
        rm -rf "$TMPDIR"
    fi
}
trap cleanup EXIT

usage() {
    cat <<EOF
video2spritesheet v${VERSION} - Convert video to transparent PNG spritesheet

Usage: $(basename "$0") <video> [options]

Arguments:
  <video>                  Input video file (WebM, MOV, MP4, AVI, etc.)

Options:
  -o, --output <path>      Output spritesheet path (default: <video>_spritesheet.png)
  --fps <n>                Frames per second to extract (default: 12)
  --cols <n>               Columns in the grid, 0 = single row (default: 0)
  --scale <value>          Resize frames (e.g. 200x200, 50%)
  --chroma <color>         Background color to remove, e.g. 0x00FF00 (auto-detects alpha if absent)
  --chromakey              Use chromakey filter (YUV space, aggressive) instead of colorkey
  --similarity <0.0-1.0>   Color key tolerance (default: 0.12)
  --blend <0.0-1.0>        Color key edge blending (default: 0.05)
  --trim                   Auto-crop frames to remove excess transparency
  --json                   Generate JSON metadata alongside the PNG
  --padding <n>            Pixels of padding between frames (default: 0)
  -h, --help               Show this help
  -v, --version            Show version

Examples:
  $(basename "$0") anim.webm
  $(basename "$0") greenscreen.mp4 --fps 8 --cols 8 --scale 128x128
  $(basename "$0") anim.mov --trim --json -o assets/walk_cycle.png
  $(basename "$0") bluescreen.avi --chroma 0x0000FF --similarity 0.4
EOF
    exit 0
}

die() { echo "Error: $*" >&2; exit 1; }
info() { echo "[info] $*"; }

# --- Parse arguments ---

[[ $# -eq 0 ]] && usage

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help) usage ;;
        -v|--version) echo "video2spritesheet v${VERSION}"; exit 0 ;;
        -o|--output) OUTPUT="$2"; shift 2 ;;
        --fps) FPS="$2"; shift 2 ;;
        --cols) COLS="$2"; shift 2 ;;
        --scale) SCALE="$2"; shift 2 ;;
        --chroma) CHROMA="$2"; shift 2 ;;
        --chromakey) KEY_MODE="chromakey"; shift ;;
        --similarity) SIMILARITY="$2"; shift 2 ;;
        --blend) BLEND="$2"; shift 2 ;;
        --trim) TRIM=true; shift ;;
        --json) JSON=true; shift ;;
        --padding) PADDING="$2"; shift 2 ;;
        -*) die "Unknown option: $1" ;;
        *)
            [[ -n "$INPUT" ]] && die "Multiple input files not supported"
            INPUT="$1"; shift ;;
    esac
done

[[ -z "$INPUT" ]] && die "No input video specified"
[[ -f "$INPUT" ]] || die "File not found: $INPUT"

# Default output name
if [[ -z "$OUTPUT" ]]; then
    basename_no_ext="${INPUT%.*}"
    OUTPUT="${basename_no_ext}_spritesheet.png"
fi

# --- Check dependencies ---

for cmd in ffmpeg ffprobe convert montage; do
    command -v "$cmd" >/dev/null 2>&1 || die "'$cmd' is required but not installed"
done

# --- Create temp directory ---

TMPDIR=$(mktemp -d "${TMPDIR:-/tmp}/v2ss.XXXXXX")

# --- Step 1: Detect alpha channel ---

has_alpha=false
if [[ -z "$CHROMA" ]]; then
    pix_fmt=$(ffprobe -v error -select_streams v:0 \
        -show_entries stream=pix_fmt -of csv=p=0 "$INPUT" 2>/dev/null || true)
    if [[ "$pix_fmt" == *"a"* || "$pix_fmt" == "rgba"* || "$pix_fmt" == "yuva"* || "$pix_fmt" == "bgra"* || "$pix_fmt" == "argb"* || "$pix_fmt" == "abgr"* || "$pix_fmt" == "gbrap"* || "$pix_fmt" == "ya"* || "$pix_fmt" == "pala"* ]]; then
        has_alpha=true
        info "Detected alpha channel (pix_fmt: $pix_fmt)"
    else
        info "No alpha channel detected (pix_fmt: $pix_fmt), using chroma key"
        CHROMA="0x00FF00"
    fi
fi

# --- Step 2: Extract frames ---

info "Extracting frames at ${FPS} fps..."

if [[ "$has_alpha" == true ]]; then
    ffmpeg -v warning -i "$INPUT" \
        -vf "fps=$FPS" \
        -c:v png -pix_fmt rgba \
        "$TMPDIR/frame_%04d.png"
else
    info "Using $KEY_MODE filter (color: $CHROMA, similarity: $SIMILARITY, blend: $BLEND)"
    ffmpeg -v warning -i "$INPUT" \
        -vf "fps=$FPS,${KEY_MODE}=${CHROMA}:${SIMILARITY}:${BLEND}" \
        -c:v png -pix_fmt rgba \
        "$TMPDIR/frame_%04d.png"
fi

frame_count=$(find "$TMPDIR" -name 'frame_*.png' | wc -l)
[[ "$frame_count" -eq 0 ]] && die "No frames extracted from video"
info "Extracted $frame_count frames"

# --- Step 3: Trim (optional) ---

if [[ "$TRIM" == true ]]; then
    info "Trimming frames..."
    max_w=0
    max_h=0

    for f in "$TMPDIR"/frame_*.png; do
        convert "$f" -trim +repage "$f"
        dims=$(identify -format "%wx%h" "$f")
        w=${dims%x*}
        h=${dims#*x}
        (( w > max_w )) && max_w=$w
        (( h > max_h )) && max_h=$h
    done

    info "Normalizing trimmed frames to ${max_w}x${max_h}"
    for f in "$TMPDIR"/frame_*.png; do
        convert "$f" -gravity center -background none -extent "${max_w}x${max_h}" "$f"
    done
fi

# --- Step 4: Scale (optional) ---

if [[ -n "$SCALE" ]]; then
    info "Scaling frames to $SCALE..."
    mogrify -resize "$SCALE" "$TMPDIR"/frame_*.png
fi

# --- Step 5: Assemble spritesheet ---

# Get frame dimensions from first frame
first_frame=$(ls "$TMPDIR"/frame_*.png | head -1)
frame_dims=$(identify -format "%wx%h" "$first_frame")
frame_w=${frame_dims%x*}
frame_h=${frame_dims#*x}

if [[ "$COLS" -eq 0 ]]; then
    cols=$frame_count
else
    cols=$COLS
fi
rows=$(( (frame_count + cols - 1) / cols ))

info "Assembling spritesheet: ${cols}x${rows} grid, frame size ${frame_w}x${frame_h}, padding ${PADDING}px"

montage "$TMPDIR"/frame_*.png \
    -tile "${cols}x" \
    -geometry "${frame_w}x${frame_h}+${PADDING}+${PADDING}" \
    -background none \
    "$OUTPUT"

info "Spritesheet saved to: $OUTPUT"

# --- Step 6: JSON metadata (optional) ---

if [[ "$JSON" == true ]]; then
    json_path="${OUTPUT%.png}.json"
    output_basename=$(basename "$OUTPUT")
    cat > "$json_path" <<EOJSON
{
  "image": "$output_basename",
  "frameWidth": $frame_w,
  "frameHeight": $frame_h,
  "frameCount": $frame_count,
  "cols": $cols,
  "rows": $rows,
  "fps": $FPS,
  "padding": $PADDING
}
EOJSON
    info "Metadata saved to: $json_path"
fi

info "Done!"
