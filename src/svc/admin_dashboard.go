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
    .card { background: #1a1f2e; border: 1px solid #252d3d; border-radius: 10px; padding: 1.5rem; margin-bottom: 1.25rem; max-width: 700px; }
    label { display: block; font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.35rem; }
    input { width: 100%; background: #0f1117; border: 1px solid #252d3d; border-radius: 6px; color: #e2e8f0; padding: 0.55rem 0.75rem; font-size: 0.875rem; margin-bottom: 1rem; font-family: inherit; transition: border-color 0.15s; }
    input:focus { outline: none; border-color: #3b82f6; }
    .notif-textarea { width: 100%; background: #0f1117; border: 1px solid #252d3d; border-radius: 6px; color: #e2e8f0; padding: 0.55rem 0.75rem; font-size: 0.875rem; margin-bottom: 1rem; font-family: inherit; transition: border-color 0.15s; resize: vertical; min-height: 72px; }
    .notif-textarea:focus { outline: none; border-color: #3b82f6; }
    .row { display: flex; gap: 0.6rem; }
    .row input { margin-bottom: 0; }
    button { padding: 0.5rem 1.1rem; border-radius: 6px; border: none; font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: background 0.15s; }
    .btn-save  { background: #1e3a5f; color: #93c5fd; }
    .btn-save:hover  { background: #1e40af; color: #fff; }
    .btn-set   { background: #3b82f6; color: #fff; }
    .btn-set:hover   { background: #2563eb; }
    .btn-del   { background: #2d1f1f; color: #fca5a5; border: 1px solid #3d2020; }
    .btn-del:hover   { background: #7f1d1d; color: #fff; }
    .toast { position: fixed; bottom: 1.5rem; right: 1.5rem; padding: 0.65rem 1.1rem; border-radius: 8px; font-size: 0.8rem; font-weight: 500; opacity: 0; transition: opacity 0.2s; pointer-events: none; z-index: 99; }
    .toast.show { opacity: 1; }
    .toast.ok  { background: #14532d; color: #86efac; border: 1px solid #16a34a; }
    .toast.err { background: #7f1d1d; color: #fecaca; border: 1px solid #991b1b; }
    /* Feedback */
    .threads { display: flex; flex-direction: column; gap: 1rem; }
    .thread-card { border: 1px solid #252d3d; border-radius: 8px; overflow: hidden; }
    .thread-card.has-open { border-color: #1e40af; }
    .thread-header { background: #111827; padding: 0.65rem 1rem; display: flex; align-items: center; gap: 0.7rem; cursor: pointer; user-select: none; }
    .thread-header:hover { background: #141c2e; }
    .avatar { width: 30px; height: 30px; border-radius: 50%; background: #1e3a5f; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; color: #93c5fd; flex-shrink: 0; }
    .user-info { flex: 1; min-width: 0; }
    .user-name { font-size: 0.82rem; font-weight: 600; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-meta { font-size: 0.68rem; color: #475569; margin-top: 0.05rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .badge { font-size: 0.62rem; padding: 0.12rem 0.4rem; border-radius: 999px; font-weight: 600; flex-shrink: 0; }
    .badge-open { background: #451a03; color: #fbbf24; }
    .badge-replied { background: #052e16; color: #4ade80; }
    .chevron { font-size: 0.7rem; color: #475569; flex-shrink: 0; transition: transform 0.15s; }
    .thread-body { display: none; flex-direction: column; }
    .thread-body.expanded { display: flex; }
    .chat-log { padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; max-height: 320px; overflow-y: auto; }
    .bubble-wrap-user { display: flex; justify-content: flex-end; }
    .bubble-wrap-admin { display: flex; justify-content: flex-start; flex-direction: column; }
    .admin-label { font-size: 0.62rem; color: #475569; margin-bottom: 0.15rem; margin-left: 2px; }
    .bubble { max-width: 80%; padding: 0.45rem 0.75rem; border-radius: 14px; font-size: 0.82rem; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
    .bubble-user { background: #1e40af; color: #e0eaff; border-bottom-right-radius: 3px; }
    .bubble-admin { background: #1e2535; color: #cbd5e1; border-bottom-left-radius: 3px; }
    .bubble-time { font-size: 0.6rem; color: #475569; margin-top: 0.15rem; text-align: right; }
    .bubble-time-admin { text-align: left; margin-left: 2px; }
    .reply-area { border-top: 1px solid #1e2535; padding: 0.65rem 0.75rem; display: flex; gap: 0.5rem; align-items: flex-end; }
    .reply-input { flex: 1; background: #0f1117; border: 1px solid #252d3d; border-radius: 8px; color: #e2e8f0; padding: 0.45rem 0.65rem; font-size: 0.82rem; font-family: inherit; resize: none; min-height: 38px; max-height: 100px; transition: border-color 0.15s; }
    .reply-input:focus { outline: none; border-color: #3b82f6; }
    .btn-send { background: #1e40af; color: #fff; padding: 0.4rem 0.85rem; font-size: 0.8rem; border-radius: 7px; white-space: nowrap; align-self: flex-end; }
    .btn-send:hover { background: #2563eb; }
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
    <textarea class="notif-textarea" id="globalMsg" placeholder="e.g. Scheduled maintenance on March 10th."></textarea>
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
    <textarea class="notif-textarea" id="userMsg" placeholder="e.g. Your account has been flagged for review."></textarea>
    <div class="row">
      <button class="btn-set" onclick="setNotif('user')">Set</button>
      <button class="btn-del" onclick="delNotif('user')">Delete</button>
    </div>
  </div>

  <div class="card" style="max-width:700px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
      <h2 style="margin-bottom:0">Feedback &amp; Support</h2>
      <button class="btn-save" style="font-size:0.75rem;padding:0.3rem 0.75rem" onclick="loadFeedback()">Refresh</button>
    </div>
    <div id="feedbackList"><p style="color:#475569;font-size:0.8rem">Enter admin key above to load feedback.</p></div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    var expanded = {}

    window.addEventListener('load', function() {
      var saved = sessionStorage.getItem('adminKey')
      if (saved) { document.getElementById('adminKey').value = saved; loadFeedback() }
      setInterval(loadFeedback, 30000)
    })

    function saveKey() {
      var k = document.getElementById('adminKey').value.trim()
      sessionStorage.setItem('adminKey', k)
      toast('Key saved', 'ok')
      loadFeedback()
    }

    function key() { return sessionStorage.getItem('adminKey') || document.getElementById('adminKey').value.trim() }

    function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML }

    function fmtTime(iso) {
      if (!iso) return ''
      try { return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
      catch(e) { return iso }
    }

    function initials(name, email) {
      if (name) { var p = name.trim().split(' '); return p.length >= 2 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : name.trim()[0].toUpperCase() }
      return email ? email[0].toUpperCase() : '?'
    }

    function toggleThread(uid) {
      expanded[uid] = !expanded[uid]
      var body = document.getElementById('body-' + uid)
      var chev = document.getElementById('chev-' + uid)
      if (!body) return
      if (expanded[uid]) {
        body.classList.add('expanded')
        chev.textContent = '\u25BE'
        var log = document.getElementById('log-' + uid)
        if (log) log.scrollTop = log.scrollHeight
      } else {
        body.classList.remove('expanded')
        chev.textContent = '\u25B8'
      }
    }

    async function loadFeedback() {
      var k = key()
      if (!k) return
      var el = document.getElementById('feedbackList')
      try {
        var res = await fetch('/api/v1/admin/feedback', { headers: { 'X-Admin-Key': k } })
        if (!res.ok) {
          var err = await res.json().catch(function() { return {} })
          el.innerHTML = '<p style="color:#f87171;font-size:0.8rem">Error ' + res.status + ': ' + esc(err.error || 'Failed to load') + '</p>'
          return
        }
        var data = await res.json()
        var threads = data.data && data.data.threads ? data.data.threads : []
        if (!threads.length) { el.innerHTML = '<p style="color:#475569;font-size:0.8rem">No feedback yet.</p>'; return }

        var html = '<div class="threads">'
        threads.forEach(function(t) {
          var uid = t.UserDocID || t.id
          var name = t.UserName || ''
          var email = t.UserEmail || ''
          var isOpen = t.Status === 'open'
          var isExp = expanded[uid]
          var entries = t.Entries || []

          html += '<div class="thread-card' + (isOpen ? ' has-open' : '') + '">'
          html += '<div class="thread-header" onclick="toggleThread(\'' + esc(uid) + '\')">'
          html += '<div class="avatar">' + esc(initials(name, email)) + '</div>'
          html += '<div class="user-info">'
          html += '<div class="user-name">' + esc(name || email || uid) + '</div>'
          html += '<div class="user-meta">' + (email ? esc(email) + ' &nbsp;&bull;&nbsp; ' : '') + 'ID: ' + esc(uid) + '</div>'
          html += '</div>'
          html += '<span class="badge ' + (isOpen ? 'badge-open' : 'badge-replied') + '">' + (isOpen ? 'open' : 'replied') + '</span>'
          html += '<span class="chevron" id="chev-' + esc(uid) + '">' + (isExp ? '\u25BE' : '\u25B8') + '</span>'
          html += '</div>'

          html += '<div class="thread-body' + (isExp ? ' expanded' : '') + '" id="body-' + esc(uid) + '">'
          html += '<div class="chat-log" id="log-' + esc(uid) + '">'
          entries.forEach(function(e) {
            if (e.Role === 'user') {
              html += '<div class="bubble-wrap-user">'
              html += '<div>'
              html += '<div class="bubble bubble-user">' + esc(e.Content) + '</div>'
              html += '<div class="bubble-time">' + esc(fmtTime(e.CreatedAt)) + '</div>'
              html += '</div></div>'
            } else {
              html += '<div class="bubble-wrap-admin">'
              html += '<div class="admin-label">Support</div>'
              html += '<div class="bubble bubble-admin">' + esc(e.Content) + '</div>'
              html += '<div class="bubble-time bubble-time-admin">' + esc(fmtTime(e.CreatedAt)) + '</div>'
              html += '</div>'
            }
          })
          html += '</div>'
          html += '<div class="reply-area">'
          html += '<textarea class="reply-input" id="reply-' + esc(uid) + '" placeholder="Reply..." rows="1" onkeydown="replyKey(event,\'' + esc(uid) + '\')"></textarea>'
          html += '<button class="btn-send" onclick="sendReply(\'' + esc(uid) + '\')">Send</button>'
          html += '</div></div></div>'
        })
        html += '</div>'
        el.innerHTML = html

        // Scroll open chat logs to bottom
        threads.forEach(function(t) {
          var uid = t.UserDocID || t.id
          if (expanded[uid]) {
            var log = document.getElementById('log-' + uid)
            if (log) log.scrollTop = log.scrollHeight
          }
        })
      } catch(e) {
        el.innerHTML = '<p style="color:#f87171;font-size:0.8rem">Error: ' + esc(e.message) + '</p>'
      }
    }

    function replyKey(event, uid) {
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendReply(uid) }
    }

    async function sendReply(uid) {
      var textarea = document.getElementById('reply-' + uid)
      if (!textarea || !textarea.value.trim()) return toast('Reply cannot be empty', 'err')
      var replyText = textarea.value.trim()
      textarea.value = ''
      try {
        var res = await fetch('/api/v1/admin/feedback/' + encodeURIComponent(uid) + '/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key() },
          body: JSON.stringify({ reply: replyText })
        })
        if (res.ok) { toast('Sent', 'ok'); expanded[uid] = true; loadFeedback() }
        else {
          var d = await res.json().catch(function() { return {} })
          toast((d.error || 'Error') + ' (' + res.status + ')', 'err')
          textarea.value = replyText
        }
      } catch(e) { toast('Request failed: ' + e.message, 'err'); textarea.value = replyText }
    }

    async function setNotif(type) {
      var k = key(); if (!k) return toast('Enter admin key first', 'err')
      var body = { type: type }
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
      var k = key(); if (!k) return toast('Enter admin key first', 'err')
      var body = { type: type }
      if (type === 'user') { body.userID = document.getElementById('userID').value.trim(); if (!body.userID) return toast('User ID required', 'err') }
      await call('DELETE', body)
    }

    async function call(method, body) {
      try {
        var res = await fetch('/api/v1/admin/notification', { method: method, headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key() }, body: JSON.stringify(body) })
        if (res.ok) { toast(method === 'DELETE' ? 'Deleted' : 'Notification set', 'ok') }
        else { var data = await res.json().catch(function() { return {} }); toast((data.error || data.status || 'Error') + ' (' + res.status + ')', 'err') }
      } catch(e) { toast('Request failed: ' + e.message, 'err') }
    }

    var toastTimer
    function toast(msg, type) {
      var el = document.getElementById('toast')
      el.textContent = msg
      el.className = 'toast show ' + type
      clearTimeout(toastTimer)
      toastTimer = setTimeout(function() { el.className = 'toast' }, 2800)
    }
  </script>
</body>
</html>`

func (s *Service) AdminDashboardHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(adminDashboardHTML))
}
