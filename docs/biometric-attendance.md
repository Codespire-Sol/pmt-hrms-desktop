# Biometric Attendance Setup

This platform integrates with **biometric punch devices** (fingerprint / face
attendance machines) to record employee attendance automatically. Each "punch"
becomes a check-in / check-out in HRMS.

> **Note on terminology:** "biometric" here means *attendance capture from a
> biometric device*, not biometric login. Users still log in with their email and
> password. The biometric device only feeds attendance punches.

---

## For the admin (in plain terms)

You only need to do two things to make a biometric device feed attendance:

1. **Map each employee** to their device ID on the HRMS **Biometric Mappings**
   page (sidebar → *Biometric Mappings*).
2. **Give your device vendor the push URL** so the machine sends each punch to the
   app: `http://<host-PC-LAN-IP>:4000/api/v1/biometric/realtime-push`
   (e.g. `http://192.168.1.50:4000/...`). If you set a `BIOMETRIC_PUSH_TOKEN` in
   `.env`, the device must send it as the `x-device-token` header.

That's it — punches then show up as check-in/check-out automatically. The rest of
this document is the technical detail for whoever configures the device.

---

## 1. How it works

```
 ┌──────────────────┐   punch (HTTP POST)    ┌──────────────┐      ┌────────────┐
 │ Biometric device │ ─────────────────────► │  api         │ ───► │ attendance │
 │ (RealTime cloud) │  /biometric/realtime-  │  biometric   │      │ + logs     │
 │  employee_code   │        push            │  module      │      └────────────┘
 └──────────────────┘                        └──────────────┘
```

- The device (or its cloud service) sends each punch to the API.
- The API maps the device's `employee_code` to an employee via the
  `biometric_device_id` field, then records it.
- **First punch of the day** → `check_in_time` (status `checked_in`).
- **A later punch** → updates `check_out_time`, computes `work_hours`, and sets
  status to `present` / `half_day` based on hours worked.
- Duplicate punches are de-duplicated (in-memory cache + DB constraint).
- All times are handled in **IST (Asia/Kolkata)**.

---

## 2. Endpoints

Base path: `/api/v1/biometric`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/realtime-push` | **none** | Receives punches from the device cloud (see payload below). |
| `GET` | `/push-logs` | app | Daily first-punch / last-punch summary per employee. |
| `GET` | `/punch-logs` | app | Every individual punch (raw log). |
| `POST` | `/simulate` | app | Inject a test punch (for verifying the setup). |
| `POST` | `/import` | app | Bulk-import punches from exported text (offline devices). |
| `GET` | `/mappings` | app | List employees and their mapped device IDs. |
| `POST` | `/mappings` | app | Map an employee to a device ID. |
| `DELETE` | `/mappings/:employeeId` | app | Remove a mapping. |

### `/realtime-push` payload

The device cloud (e.g. RealTime "Parallel Data Export") posts JSON:

```json
{
  "employee_code": "00000002",
  "log_datetime": "2026-03-13 09:04:00",
  "log_time": "09:04:00",
  "device_sn": "RSS202506119224",
  "downloaded_at": "2026-03-13 09:04:05"
}
```

- `employee_code` — the user ID enrolled on the device. Matched to an employee's
  `biometric_device_id` (leading zeros are ignored, so `00000002` == `2`).
- `log_datetime` — punch time, interpreted as **IST**.
- `device_sn` — device serial (logged for traceability).

Response is `200` with `{ "success": true }`. Unmapped codes return `404` and are
logged so you can fix the mapping.

---

## 3. Setup steps

### Step 1 — Map each employee to their device ID

Every employee who uses the device needs their device enrolment number stored in
`biometric_device_id`. Do this on the **Biometric Mappings** page (HRMS sidebar →
*Biometric Mappings*), or via the API:

```bash
curl -X POST http://localhost:4000/api/v1/biometric/mappings \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "employeeId": "<employee-uuid>", "deviceId": "2" }'
```

Verify mappings:

```bash
curl http://localhost:4000/api/v1/biometric/mappings -H "Authorization: Bearer <token>"
```

### Step 2 — Point the device cloud at your API

In your biometric device's cloud portal (the "third-party push" / "parallel data
export" settings), set the push/webhook URL to:

```
http://<your-server>:4000/api/v1/biometric/realtime-push
```

Use your server's public address in production (behind HTTPS — see Security
below). The device will then POST each punch as it happens.

### Step 3 — Verify with a simulated punch

Before relying on the hardware, confirm the pipeline works:

```bash
curl -X POST http://localhost:4000/api/v1/biometric/simulate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "deviceUserId": "2" }'
```

Then check it landed:

```bash
curl "http://localhost:4000/api/v1/biometric/punch-logs?date=$(date +%F)" \
  -H "Authorization: Bearer <token>"
```

You should see the punch, and the employee's attendance for today should show a
check-in.

---

## 4. Offline devices — bulk import

For devices that don't push to the cloud, export the punch log from the vendor's
desktop software and import the text (tab- or multi-space-separated, one punch per
line: `<sno> <deviceUserId> <date YYYY-MM-DD> <time HH:mm:ss>`):

```bash
curl -X POST http://localhost:4000/api/v1/biometric/import \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "data": "1\t2\t2026-03-13\t09:04:00\n2\t2\t2026-03-13\t18:20:00" }'
```

The response reports `imported`, `skipped`, and any `unmappedDeviceIds`.

---

## 5. Configuration

| Variable | Default | Meaning |
|----------|---------|---------|
| `FULL_DAY_HOURS` | `9` | Hours worked at/above which a day is `present`. |
| `HALF_DAY_HOURS` | `4` | Hours worked at/above which a day is `half_day` (below full day). |

Add these to the `api` service environment (or `.env`) if your policy differs.

---

## 6. Security

⚠️ **`/realtime-push` is intentionally unauthenticated** — biometric device clouds
cannot present an app login. Protect it at the network layer:

- Expose **only** `/api/v1/biometric/realtime-push` to the device cloud, ideally
  from a **fixed source IP** (allowlist the device cloud's IP at your reverse
  proxy / firewall).
- Terminate **HTTPS** at a reverse proxy in front of the API.
- Consider a hard-to-guess path prefix or a shared secret header enforced by your
  reverse proxy if your device cloud supports custom headers.
- Do **not** expose the whole API publicly just to receive punches — proxy only
  the one route.

---

## 7. Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `404 No employee mapped to code "X"` | The device's `employee_code` isn't set as any employee's `biometric_device_id`. Add the mapping (Step 1). |
| Punch accepted but no attendance change | Punch is a duplicate (same employee + time), or it's a second punch < 2s after check-in. |
| Wrong day on attendance | Time zone — punches are parsed as IST. Confirm the device sends IST `log_datetime`. |
| Check-out not recorded | Only punches ≥ 2 seconds after the first are treated as check-out; verify the device sends both punches. |
