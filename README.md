# JobStacking — Application Dashboard

A lightweight, static dashboard for tracking job applications.

## Run

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Features

- Sidebar navigation (Dashboard, Applications, Companies, Calendar, Analytics, Documents, Settings)
- Stats overview cards (Total / In Progress / Interviews / Offers / Rejected)
- Filter tabs by status (All / Applied / Interview / Offer / Rejected / Saved)
- Search by company, role, or location
- Sort by date, company, or role
- Add new applications via modal
- Per-row View / Delete actions
- Data persists to `localStorage`

## Files

- `index.html` — markup
- `styles.css` — design system + layout
- `app.js` — state, rendering, interactions
