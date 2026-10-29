import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html',
        about: './about.html',
        'nexus-now': './nexus-now.html',
        robots: './robots.html',
        team: './team.html',
        sponsors: './sponsors.html',
        contact: './contact.html',
        mechanical: './mechanical.html',
        electronics: './electronics.html',
        programming: './programming.html',
        automation: './automation.html',
        // legacy URL — meta-refresh stub forwarding to automation.html
        'image-processing-redirect': './image-processing.html',
        management: './management.html',
        // NEXUS NOW stories — permanent retrospective pages
        'nexus-now/kynex-26': './nexus-now/kynex-26.html',
        'nexus-now/la-casa-de-bots': './nexus-now/la-casa-de-bots.html',
        // Internal Portal Pages
        'portal/login': './portal/login.html',
        'portal/scan': './portal/scan.html',
        'portal/member': './portal/member.html',
        'portal/admin': './portal/admin.html',
        // Team roster admin console (Supabase Auth + RLS)
        'portal/team-admin': './portal/team-admin.html',
      },
    },
  },
  server: {
    host: '127.0.0.1',   // bind IPv4 explicitly — avoids Windows iphlpsvc
                         // stealing 0.0.0.0:3000, which wedges the browser
                         // in a reconnect loop (glitchy navbar/HMR).
    port: 5173,          // free port, no conflict with system services
    strictPort: true,    // fail loudly instead of silently grabbing another
    open: true,
  },
});
