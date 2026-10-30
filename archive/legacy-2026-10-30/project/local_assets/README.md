# Local source assets (not uploaded)

This directory is the local-only input layer. Everything except this README is
ignored by Git and excluded from deployment.

Expected layout:

```text
local_assets/
├── mixamo/
│   ├── characters/   # With Skin character FBX files
│   ├── idle/         # Without Skin animation FBX files
│   ├── perform/
│   ├── sit/
│   └── output/       # full GLB, manifest and Blender masters
├── source-packs/     # original Kenney ZIP archives
└── voice/            # original WAV recordings
```

Only optimized derivatives are allowed under `public/`.
