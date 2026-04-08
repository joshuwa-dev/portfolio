Set admin custom claim

Usage:

- Ensure `FIREBASE_SERVICE_ACCOUNT_B64` (base64-encoded service account JSON) or `FIREBASE_SERVICE_ACCOUNT` (raw JSON) is available in your environment.
- Run:

```
node scripts/set-admin.mjs <USER_UID>
```

This will set the `admin: true` custom claim for the specified UID. Use this for granting dashboard admin privileges.

Note: In production prefer using a restricted service account and Secret Manager for credentials.
