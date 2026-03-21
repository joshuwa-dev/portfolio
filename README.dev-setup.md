# Development setup

Move your Firebase service account JSON to `~/.config/vcdn` and set the env var locally:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.config/vcdn/cobary-ed770-firebase-adminsdk-fbsvc-14428ea066.json"
npm run dev
```

Rotate/revoke exposed keys in the GCP Console immediately after moving.
