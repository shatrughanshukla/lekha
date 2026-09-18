import { useState, useRef, useEffect } from 'react'
import { api } from '../api.js'
import { ErrorNote, IconSend, IconSparkle } from './Shared.jsx'
import { useT } from '../i18n.jsx'
import PageLayout from './PageLayout.jsx'

// The assistant never moves money itself — every action it proposes is
// just a suggestion shown as a confirmation card. Only when the user taps
// Confirm does this component call the real transfer endpoints, using
// exactly the same createTransfer/respondToTransfer calls the rest of the
// app uses — so the same authorization and validation always applies.
export default function ChatPage({ token, user }) {
  const { t } = useT()
  const [messages, setMessages] = useState([]) // {role, content, action?, actionPending?, actionDone?, actionError?, actionDismissed?}
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const suggestedPrompts = [
    t('chat_suggestion_1'),
    t('chat_suggestion_2'),
    t('chat_suggestion_3'),
  ]

  async function send(overrideText) {
    const text = (overrideText ?? input).trim()
    if (!text || sending) return
    setInput('')
    setError('')
    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setSending(true)
    try {
      const res = await api.chat(token, text, history)
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply, action: res.action }])
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  async function confirmAction(msgIndex, action) {
    setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, actionPending: true, actionError: null } : m)))
    try {
      if (action.type === 'create_transfer') {
        await api.createTransfer(token, {
          fromAccountId: action.from_account_id,
          toAccountId: action.to_account_id,
          amount: action.amount,
          notes: action.notes,
          userId: user.id,
        })
      } else {
        await api.respondToTransfer(token, action.transfer_id, action.type === 'approve_transfer', user.id)
      }
      setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, actionDone: true, actionPending: false } : m)))
    } catch (err) {
      setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, actionError: err.message, actionPending: false } : m)))
    }
  }

  function dismissAction(msgIndex) {
    setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, actionDismissed: true } : m)))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <PageLayout
      title={t('chat_nav')}
      titleId="page-title"
      subtitle={t('chat_page_hint')}
      className="chat-page"
    >

      <div className="chat-window">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon"><IconSparkle width={22} height={22} /></div>
            <h3>{t('chat_empty_title')}</h3>
            <p>{t('chat_intro')}</p>
            <div className="chat-suggestions">
              {suggestedPrompts.map((p) => (
                <button key={p} className="chat-suggestion-chip" onClick={() => send(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble chat-${m.role}`}>
                <p>{m.content}</p>
                {m.action && !m.actionDismissed && !m.actionDone && (
                  <div className="chat-action-card">
                    <p className="chat-action-label">{m.action.confirm_label}</p>
                    <div className="chat-action-buttons">
                      <button className="btn-primary small" disabled={m.actionPending} onClick={() => confirmAction(i, m.action)}>
                        {m.actionPending ? t('chat_thinking') : t('chat_confirm')}
                      </button>
                      <button className="btn-ghost small" disabled={m.actionPending} onClick={() => dismissAction(i)}>
                        {t('chat_cancel')}
                      </button>
                    </div>
                    {m.actionError && <ErrorNote message={t('chat_action_failed') + m.actionError} />}
                  </div>
                )}
                {m.actionDone && <p className="chat-action-done">✓ {t('chat_action_done')}</p>}
              </div>
            ))}
            {sending && (
              <div className="chat-bubble chat-assistant chat-typing">
                <span className="chat-typing-dot" /><span className="chat-typing-dot" /><span className="chat-typing-dot" />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <ErrorNote message={error} />

      <div className="chat-input-row">
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('chat_placeholder')}
          rows={1}
        />
        <button className="chat-send-btn" onClick={() => send()} disabled={sending || !input.trim()} title={t('chat_send')}>
          <IconSend width={17} height={17} />
        </button>
      </div>
    </PageLayout>
  )
}
