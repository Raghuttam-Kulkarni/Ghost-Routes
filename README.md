# 👻 Ghost Routes

> **AI-powered informal public transport route discovery platform.**

---

## 📌 Overview

Ever tried taking a shared auto, local minibus, or informal transport route only to realize it isn't listed on standard navigation apps? **Ghost Routes** bridges this gap by bringing undocumented, community-driven transit networks into the digital age.

---

## 🎯 The Problem

Shared autos, minibuses, and local transit options form the backbone of daily commutes in many regions. However, these routes are often **undocumented, hyper-local, and completely missing** from existing navigation platforms, leaving commuters reliant purely on word-of-mouth.

---

## 🚀 The Solution

**Ghost Routes** enables local communities to submit, discover, and visualize informal transit paths. By leveraging crowdsourced data alongside **AI-powered route normalization**, we transform chaotic, informal travel paths into clear, reliable, interactive routes.

---

## ✨ Key Features

- 📌 **Route Submission:** Empowers users to report and map informal transit pathways effortlessly.
- 🔍 **Smart Route Search:** Find local travel options ignored by mainstream map tools.
- 🗺️ **Interactive Map View:** Rich visual mapping for real-time clarity.
- 🤖 **AI Route Standardization:** Automatically cleans up, connects, and structures crowdsourced GPS inputs.
- 🎯 **Confidence Scoring:** Validates route reliability based on community feedback and data points.

---

## 🛠️ Tech Stack

- **Frontend:** Next.js / React, Tailwind CSS
- **Backend & Database:** Supabase
- **AI & ML:** Gemini API
- **Mapping:** Leaflet / OpenStreetMap

---

## 👥 The Team

| Name | Role |
| :--- | :--- |
| **Member 1** | Frontend Lead |
| **Member 2** | Backend & Database Lead |
| **Member 3** | AI Integration & Mapping Lead |

---

## ⚡ Quick Start

```bash
# Clone the repository
git clone https://github.com/Raghuttam-Kulkarni/Ghost-Routes.git

# Navigate to the project directory
cd Ghost-Routes

# Install dependencies
npm install

# Run the development server
npm run dev

## Community route submissions

The curated transit network remains the source for search, detailed route information, and seat requests. Community submissions are stored in Supabase and shown as dashed connections on the same map. Copy `.env.example` to `.env.local`, set `SUPABASE_URL` and `SUPABASE_ANON_KEY`, then run `supabase/schema.sql` in the Supabase SQL editor. The route API geocodes place names with OpenStreetMap Nominatim. A submission that cannot be located is still saved but is not drawn on the map.
