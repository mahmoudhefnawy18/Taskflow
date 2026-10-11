TaskFlow live update release
1. Replace GitHub Pages files: index.html, app.js, sw.js, manifest.json, icon.png.
2. Run supabase.sql in Supabase SQL Editor to enable Realtime (if the table already exists, existing tasks are retained).
3. Refresh the installed iPhone app once after deployment to load the new version.
4. Thereafter tasks appear immediately on the device where edited; Supabase Realtime sends updates to other open devices. Backgrounded devices catch up when reopened.
5. Signed-in account panel, cloud-sync heading and status are hidden.
