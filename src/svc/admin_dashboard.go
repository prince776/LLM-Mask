package svc

import "net/http"

const adminDashboardHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LLMMask Admin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f1117; color: #e2e8f0; min-height: 100vh; padding: 2rem; }
    h1 { font-size: 1.4rem; font-weight: 700; margin-bottom: 2rem; color: #fff; letter-spacing: -0.01em; }
    h2 { font-size: 0.7rem; font-weight: 600; margin-bottom: 1rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
    .card { background: #1a1f2e; border: 1px solid #252d3d; border-radius: 10px; padding: 1.5rem; margin-bottom: 1.25rem; max-width: 560px; }
    label { display: block; font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.35rem; }
    input, textarea {
      width: 100%; background: #0f1117; border: 1px solid #252d3d; border-radius: 6px;
      color: #e2e8f0; padding: 0.55rem 0.75rem; font-size: 0.875rem; margin-bottom: 1rem;
      font-family: inherit; transition: border-color 0.15s;
    }
    input:focus, textarea:focus { outline: none; border-color: #3b82f6; }
    textarea { resize: vertical; min-height: 72px; }
    .row { display: flex; gap: 0.6rem; }
    .row input { margin-bottom: 0; }
    button {
      padding: 0.5rem 1.1rem; border-radius: 6px; border: none;
      font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: background 0.15s;
    }
    .btn-save  { background: #1e3a5f; color: #93c5fd; }
    .btn-save:hover  { background: #1e40af; color: #fff; }
    .btn-set   { background: #3b82f6; color: #fff; }
    .btn-set:hover   { background: #2563eb; }
    .btn-del   { background: #2d1f1f; color: #fca5a5; border: 1px solid #3d2020; }
    .btn-del:hover   { background: #7f1d1d; color: #fff; }
    .toast {
      position: fixed; bottom: 1.5rem; right: 1.5rem; padding: 0.65rem 1.1rem;
      border-radius: 8px; font-size: 0.8rem; font-weight: 500; opacity: 0;
      transition: opacity 0.2s; pointer-events: none; z-index: 99;
    }
    .toast.show { opacity: 1; }
    .toast.ok  { background: #14532d; color: #86efac; border: 1px solid #16a34a; }
    .toast.err { background: #7f1d1d; color: #fecaca; border: 1px solid #991b1b; }
  </style>
</head>
<body>
  <h1>LLMMask Admin</h1>

  <div class="card">
    <h2>Admin Key</h2>
    <div class="row">
      <input type="password" id="adminKey" placeholder="X-Admin-Key" />
      <button class="btn-save" onclick="saveKey()">Save</button>
    </div>
  </div>

  <div class="card">
    <h2>Global Notification</h2>
    <label>Message</label>
    <textarea id="globalMsg" placeholder="e.g. Scheduled maintenance on March 10th."></textarea>
    <div class="row">
      <button class="btn-set" onclick="setNotif('global')">Set</button>
      <button class="btn-del" onclick="delNotif('global')">Delete</button>
    </div>
  </div>

  <div class="card">
    <h2>User Notification</h2>
    <label>User ID (Cosmos DocID)</label>
    <input type="text" id="userID" placeholder="e.g. 1234567890" />
    <label>Message</label>
    <textarea id="userMsg" placeholder="e.g. Your account has been flagged for review."></textarea>
    <div class="row">
      <button class="btn-set" onclick="setNotif('user')">Set</button>
      <button class="btn-del" onclick="delNotif('user')">Delete</button>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    window.addEventListener('load', () => {
      const saved = sessionStorage.getItem('adminKey')
      if (saved) document.getElementById('adminKey').value = saved
    })

    function saveKey() {
      const k = document.getElementById('adminKey').value.trim()
      sessionStorage.setItem('adminKey', k)
      toast('Key saved', 'ok')
    }

    function key() {
      return sessionStorage.getItem('adminKey') || document.getElementById('adminKey').value.trim()
    }

    async function setNotif(type) {
      const k = key()
      if (!k) return toast('Enter admin key first', 'err')
      const body = { type }
      if (type === 'global') {
        body.message = document.getElementById('globalMsg').value.trim()
        if (!body.message) return toast('Message required', 'err')
      } else {
        body.userID = document.getElementById('userID').value.trim()
        body.message = document.getElementById('userMsg').value.trim()
        if (!body.userID) return toast('User ID required', 'err')
        if (!body.message) return toast('Message required', 'err')
      }
      await call('POST', body)
    }

    async function delNotif(type) {
      const k = key()
      if (!k) return toast('Enter admin key first', 'err')
      const body = { type }
      if (type === 'user') {
        body.userID = document.getElementById('userID').value.trim()
        if (!body.userID) return toast('User ID required', 'err')
      }
      await call('DELETE', body)
    }

    async function call(method, body) {
      try {
        const res = await fetch('/api/v1/admin/notification', {
          method,
          headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key() },
          body: JSON.stringify(body)
        })
        if (res.ok) {
          toast(method === 'DELETE' ? 'Deleted' : 'Notification set', 'ok')
        } else {
          const data = await res.json().catch(() => ({}))
          toast((data.error || data.status || 'Error') + ' (' + res.status + ')', 'err')
        }
      } catch (e) {
        toast('Request failed: ' + e.message, 'err')
      }
    }

    let timer
    function toast(msg, type) {
      const el = document.getElementById('toast')
      el.textContent = msg
      el.className = 'toast show ' + type
      clearTimeout(timer)
      timer = setTimeout(() => { el.className = 'toast' }, 2800)
    }
  </script>
</body>
</html>`

func (s *Service) AdminDashboardHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(adminDashboardHTML))
}
