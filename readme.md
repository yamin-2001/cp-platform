# CPLab — Competitive Programming Training Platform

A platform that syncs with your Codeforces account and suggests problems you've never attempted, based on your rating.

## Tech Stack
- **Backend** — Node.js, Express, MongoDB, Mongoose, JWT
- **Frontend** — React, Vite, Tailwind CSS, DaisyUI
- **API** — Codeforces REST API

## Features
- Syncs your CF submission history
- Suggests unsolved problems based on your rating
- Smart / Upsolve / Stretch / Random strategies
- Practice sets with progress tracking
- HttpOnly cookie authentication

## Setup
1. Clone the repo
2. `npm install` in both backend and frontend
3. Add your MongoDB URI and JWT secret to `backend/.env`
4. Run `npm run server` (backend) and `npm run dev` (frontend)
