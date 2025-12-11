# Performance Optimizations

## Changes Made

### 1. Switched to GPT-3.5-Turbo (backend/main.py)
- Changed from `gpt-4-turbo-preview` to `gpt-3.5-turbo`
- **Impact:** ~3x faster response times, lower cost
- **Trade-off:** Slightly less accurate for complex text, but sufficient for event extraction

### 2. Enabled Client-Side Caching (extension/background.js)
- Removed aggressive cache clearing on every request
- Cache now persists for 1 hour
- **Impact:** Instant response for repeated text selections

### 3. Streamlined Request Flow
- Removed unnecessary storage clearing before API calls
- **Impact:** ~100-200ms faster startup

---

## Keep Backend Warm (Prevent Cold Starts)

Render.com free tier spins down after 15 minutes of inactivity. To prevent cold starts:

### Option A: Use UptimeRobot (Free)
1. Go to [UptimeRobot](https://uptimerobot.com/)
2. Create a free account
3. Add a new monitor:
   - **Monitor Type:** HTTP(s)
   - **URL:** `https://ai-calendar-app.onrender.com/health`
   - **Monitoring Interval:** 5 minutes

### Option B: Use cron-job.org (Free)
1. Go to [cron-job.org](https://cron-job.org/)
2. Create a free account
3. Create a new cron job:
   - **URL:** `https://ai-calendar-app.onrender.com/health`
   - **Schedule:** Every 5 minutes

### Option C: GitHub Actions (Free)
Add `.github/workflows/keep-alive.yml`:

```yaml
name: Keep Backend Alive

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping backend
        run: curl -s https://ai-calendar-app.onrender.com/health
```

---

## Expected Performance

| Scenario | Before | After |
|----------|--------|-------|
| Cold start + GPT-4 | 5-10s | N/A |
| Warm + GPT-4 | 2-4s | N/A |
| Cold start + GPT-3.5 | 3-6s | 3-6s (with keep-alive: N/A) |
| Warm + GPT-3.5 | 0.5-1.5s | 0.5-1.5s |
| Cached response | N/A | <100ms |

---

## Future Optimizations

1. **Reduce system prompt size** - Current prompt is ~2KB, could be trimmed
2. **Use streaming** - Show partial results as they arrive
3. **Edge deployment** - Deploy backend closer to users (Vercel Edge, Cloudflare Workers)
4. **Upgrade Render plan** - Paid plans don't have cold starts
