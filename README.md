# 24 Mason Street Sale Tracker

Standalone dashboard for monitoring the sale of Flat 2, 24 Mason Street, London SE17 1HF.

## Deployment

Create a Vercel project from this repository and add:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The app reads live data from the dedicated Supabase project for this sale.


Deployment trigger: Vercel project configured for Next.js with dedicated Supabase environment variables.
