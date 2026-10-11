TaskFlow Connected

1. Upload index.html, app.js, manifest.json, sw.js, icon.png to the ROOT of GitHub repository TaskFlow.
2. Run supabase.sql once in Supabase SQL Editor (if not already run).
3. Supabase > Authentication > Providers > Email: enable email OTP / magic link.
4. Supabase > Authentication > URL Configuration: add your GitHub Pages URL as a Redirect URL: https://mahmoudhefnawy18.github.io/TaskFlow/
5. Open the website, enter email, click sign-in link from email. Repeat on other devices with same email.
6. Existing locally stored tasks remain in local device mode; account sync uses a separate per-user store. Export backups before changing devices.
Note: Supabase requires an authenticated session; do not use secret/service_role keys in frontend.
