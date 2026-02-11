#!/usr/bin/env python3
"""Generate pixel-art app icons for Agent Monitor."""

from PIL import Image, ImageDraw

# Color palette (matches app theme)
BG = (15, 23, 42)           # pixel-bg: #0f172a
SURFACE = (30, 41, 59)      # pixel-surface: #1e293b
BORDER = (51, 65, 85)       # pixel-border: #334155
CYAN = (34, 211, 238)       # pixel-accent: #22d3ee
GREEN = (52, 211, 153)      # pixel-success: #34d399
YELLOW = (251, 191, 36)     # pixel-warning: #fbbf24
RED = (251, 113, 133)       # pixel-error: #fb7185
TEXT = (230, 241, 255)      # pixel-text: #e6f1ff
MUTED = (148, 163, 184)     # pixel-muted: #94a3b8
TRANSPARENT = (0, 0, 0, 0)

# Agent character colors
AGENT_BODY_1 = CYAN
AGENT_BODY_2 = GREEN
AGENT_BODY_3 = YELLOW

def draw_pixel(draw, x, y, color, scale):
    """Draw a single pixel at scale."""
    draw.rectangle([x*scale, y*scale, (x+1)*scale-1, (y+1)*scale-1], fill=color)

def create_icon(size):
    """Create the icon at given size. Design is on a 32x32 pixel grid."""
    scale = size // 32
    img = Image.new('RGBA', (size, size), TRANSPARENT)
    draw = ImageDraw.Draw(img)

    p = lambda x, y, c: draw_pixel(draw, x, y, c, scale)

    # -- Background: rounded rectangle --
    for y in range(32):
        for x in range(32):
            # Rounded corners (radius ~3px)
            corner = False
            if (x < 3 and y < 3):
                dist = (2-x)**2 + (2-y)**2
                if dist > 7: corner = True
            if (x > 28 and y < 3):
                dist = (x-29)**2 + (2-y)**2
                if dist > 7: corner = True
            if (x < 3 and y > 28):
                dist = (2-x)**2 + (y-29)**2
                if dist > 7: corner = True
            if (x > 28 and y > 28):
                dist = (x-29)**2 + (y-29)**2
                if dist > 7: corner = True

            if not corner:
                p(x, y, BG)

    # -- Monitor frame (center of icon) --
    # Monitor outer frame
    for x in range(4, 28):
        p(x, 3, BORDER)
        p(x, 21, BORDER)
    for y in range(3, 22):
        p(4, y, BORDER)
        p(27, y, BORDER)

    # Monitor inner area (screen)
    for y in range(4, 21):
        for x in range(5, 27):
            p(x, y, SURFACE)

    # Monitor stand
    for x in range(14, 18):
        p(x, 22, BORDER)
        p(x, 23, BORDER)
    # Stand base
    for x in range(11, 21):
        p(x, 24, BORDER)

    # -- Screen content: pixel art office scene --

    # Floor line
    for x in range(6, 26):
        p(x, 18, (51, 65, 85))

    # Agent 1 (cyan) - standing left, working
    # Head
    p(9, 11, CYAN)
    p(10, 11, CYAN)
    # Body
    p(9, 12, CYAN)
    p(10, 12, CYAN)
    p(9, 13, CYAN)
    p(10, 13, CYAN)
    # Legs
    p(9, 14, CYAN)
    p(10, 14, CYAN)
    # Eyes
    p(9, 11, (200, 240, 255))

    # Desk for agent 1
    for x in range(7, 13):
        p(x, 15, MUTED)
    # Monitor on desk
    p(8, 13, TEXT)
    p(8, 14, TEXT)
    p(7, 15, MUTED)

    # Agent 2 (green) - center, working
    # Head
    p(15, 10, GREEN)
    p(16, 10, GREEN)
    # Body
    p(15, 11, GREEN)
    p(16, 11, GREEN)
    p(15, 12, GREEN)
    p(16, 12, GREEN)
    # Legs
    p(15, 13, GREEN)
    p(16, 13, GREEN)
    # Eyes
    p(15, 10, (200, 255, 220))

    # Desk for agent 2
    for x in range(13, 19):
        p(x, 14, MUTED)
    # Monitor on desk
    p(14, 12, TEXT)
    p(14, 13, TEXT)

    # Agent 3 (yellow) - right, idle in lounge
    # Head
    p(22, 12, YELLOW)
    p(23, 12, YELLOW)
    # Body
    p(22, 13, YELLOW)
    p(23, 13, YELLOW)
    p(22, 14, YELLOW)
    p(23, 14, YELLOW)
    # Legs
    p(22, 15, YELLOW)
    p(23, 15, YELLOW)

    # Status dots above agents (glow effect)
    # Agent 1 - working (green dot)
    p(9, 9, GREEN)
    p(10, 9, GREEN)
    # Agent 2 - working (green dot)
    p(15, 8, GREEN)
    p(16, 8, GREEN)
    # Agent 3 - idle (yellow dot)
    p(22, 10, YELLOW)
    p(23, 10, YELLOW)

    # -- Title bar dots (top of monitor) --
    p(6, 4, RED)
    p(8, 4, YELLOW)
    p(10, 4, GREEN)

    # Separator line below title bar
    for x in range(5, 27):
        p(x, 5, BORDER)

    # -- Bottom text area: "AM" logo --
    # A
    p(11, 27, CYAN)
    p(12, 26, CYAN)
    p(13, 27, CYAN)
    p(11, 28, CYAN)
    p(12, 28, CYAN)
    p(13, 28, CYAN)
    p(11, 29, CYAN)
    p(13, 29, CYAN)

    # M
    p(15, 26, CYAN)
    p(16, 27, CYAN)
    p(17, 26, CYAN)
    p(18, 27, CYAN)
    p(19, 26, CYAN)
    p(15, 27, CYAN)
    p(15, 28, CYAN)
    p(15, 29, CYAN)
    p(19, 27, CYAN)
    p(19, 28, CYAN)
    p(19, 29, CYAN)

    # -- Subtle glow effect around monitor --
    # Cyan glow on edges (semi-transparent)
    glow_color = (34, 211, 238, 40)
    for x in range(3, 29):
        draw_pixel(draw, x, 2, glow_color, scale)
    for x in range(3, 29):
        draw_pixel(draw, x, 22, glow_color, scale)
    for y in range(3, 22):
        draw_pixel(draw, 3, y, glow_color, scale)
        draw_pixel(draw, 28, y, glow_color, scale)

    return img


def main():
    icon_dir = "/Users/seokjunehong/Desktop/Claude/agent-monitor/src-tauri/icons"

    # Generate all required sizes
    sizes = {
        "32x32.png": 32,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "icon.png": 512,
    }

    for filename, size in sizes.items():
        img = create_icon(size)
        path = f"{icon_dir}/{filename}"
        img.save(path, "PNG")
        print(f"Created {filename} ({size}x{size})")

    # Create icon.ico (Windows, with multiple sizes embedded)
    ico_sizes = [16, 32, 48, 256]
    ico_images = []
    for s in ico_sizes:
        # For sizes not divisible by 32, scale from 32x32
        if s < 32:
            base = create_icon(32)
            ico_images.append(base.resize((s, s), Image.NEAREST))
        elif s == 48:
            base = create_icon(32)
            ico_images.append(base.resize((s, s), Image.NEAREST))
        else:
            ico_images.append(create_icon(s))

    ico_path = f"{icon_dir}/icon.ico"
    ico_images[0].save(ico_path, format='ICO', sizes=[(s, s) for s in ico_sizes],
                       append_images=ico_images[1:])
    print(f"Created icon.ico (multi-size)")

    # Create .icns for macOS (using iconutil if available)
    import subprocess, tempfile, os

    iconset_dir = tempfile.mkdtemp(suffix=".iconset")
    icns_sizes = {
        "icon_16x16.png": 16,
        "icon_16x16@2x.png": 32,
        "icon_32x32.png": 32,
        "icon_32x32@2x.png": 64,
        "icon_128x128.png": 128,
        "icon_128x128@2x.png": 256,
        "icon_256x256.png": 256,
        "icon_256x256@2x.png": 512,
        "icon_512x512.png": 512,
    }

    for fname, s in icns_sizes.items():
        if s <= 32:
            base = create_icon(32)
            if s < 32:
                img = base.resize((s, s), Image.NEAREST)
            else:
                img = base
        else:
            # For sizes > 32, create at nearest valid size
            valid = s if s % 32 == 0 else 32
            img = create_icon(valid)
            if valid != s:
                img = img.resize((s, s), Image.NEAREST)
        img.save(os.path.join(iconset_dir, fname), "PNG")

    icns_path = f"{icon_dir}/icon.icns"
    result = subprocess.run(["iconutil", "-c", "icns", iconset_dir, "-o", icns_path],
                           capture_output=True, text=True)
    if result.returncode == 0:
        print(f"Created icon.icns (macOS)")
    else:
        print(f"Warning: iconutil failed: {result.stderr}")

    # Cleanup
    import shutil
    shutil.rmtree(iconset_dir, ignore_errors=True)

    print("\nAll icons generated!")


if __name__ == "__main__":
    main()
