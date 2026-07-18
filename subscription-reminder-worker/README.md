# Subscription Reminder Worker

This Worker runs a daily cron trigger and calls the Pages internal reminder endpoint:

- `POST /api/internal/run-subscription-reminders`

Required secrets:

- `REMINDER_ENDPOINT`
- `REMINDER_RUNNER_TOKEN`
- `CRON_ADMIN_TOKEN`

Default cron:

- `30 3 * * *`

This runs daily at 03:30 UTC, which is 09:00 AM IST.
