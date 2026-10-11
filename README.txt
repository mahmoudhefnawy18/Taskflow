Upload index.html, app.js, manifest.json, sw.js and icon.png to the GitHub repository root. Do not run SQL.
Home Screen uses a separate authentication session from Safari. Sign in within the Home Screen app. To use numeric email OTP codes, configure the Supabase Auth email template to include {{ .Token }}. Otherwise email links may open Safari rather than the installed app.
