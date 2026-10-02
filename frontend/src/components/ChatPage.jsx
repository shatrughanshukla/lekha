import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api.js'
import {
  ErrorNote, IconSend, IconSparkle, IconPlus, IconTrash, IconClose, IconClock,
} from './Shared.jsx'
import DropdownMenu from './DropdownMenu.jsx'
import EmptyState from './EmptyState.jsx'
import { useT } from '../i18n.jsx'
import PageLayout from './PageLayout.jsx'
import {
  useMotionVariants, useMediaQuery, MOBILE_QUERY,
  drawerVariants, backdropVariants, listVariants, listItemVariants,
  duration, easing,
} from '../motion/index.js'

/**
 * Minimal, dependency-free rendering for the assistant's reply text:
 * blank-line-separated paragraphs, and consecutive "- "/"* " lines as a
 * bullet list. Not full markdown — the model's system prompt (see
 * backend/handlers/chat_handler.go) only asks for a plain-text "reply"
 * string today, so real table/code-block support would have nothing to
 * render; this covers what the assistant actually produces without
 * pulling in a markdown dependency for it.
 */
function AssistantText({ content }) {
  const blocks = useMemo(() => {
    const paras = content.split(/\n{2,}/)
    return paras.map((para) => {
      const lines = para.split('\n').filter((l) => l.trim() !== '')
      const isList = lines.length > 0 && lines.every((l) => /^[-*]\s+/.test(l.trim()))
      if (isList) return { type: 'list', items: lines.map((l) => l.trim().replace(/^[-*]\s+/, '')) }
      return { type: 'p', text: para }
    })
  }, [content])

  return (
    <>
      {blocks.map((b, i) =>
        b.type === 'list' ? (
          <ul key={i} className="msg-list">
            {b.items.map((item, j) => <li key={j}>{item}</li>)}
          </ul>
        ) : (
          <p key={i}>{b.text}</p>
        )
      )}
    </>
  )
}

function groupByRecency(conversations, t) {
  const now = new Date()
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const today = startOfDay(now)
  const yesterday = today - 86400000

  const groups = { today: [], yesterday: [], older: [] }
  for (const c of conversations) {
    const day = startOfDay(new Date(c.updated_at))
    if (day === today) groups.today.push(c)
    else if (day === yesterday) groups.yesterday.push(c)
    else groups.older.push(c)
  }
  return [
    { label: t('assistant_today'), items: groups.today },
    { label: t('assistant_yesterday'), items: groups.yesterday },
    { label: t('assistant_older'), items: groups.older },
  ].filter((g) => g.items.length > 0)
}

export default function ChatPage({ token, user }) {
  const { t } = useT()
  const isMobile = useMediaQuery(MOBILE_QUERY)

  const [conversations, setConversations] = useState([])
  const [conversationsLoaded, setConversationsLoaded] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([]) // {role, content, fresh?, action?, actionPending?, actionDone?, actionError?, actionDismissed?}
  const [loadingThread, setLoadingThread] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const skipNextScrollAnim = useRef(false)

  const drawer = useMotionVariants(drawerVariants)
  const backdrop = useMotionVariants(backdropVariants)
  const listVars = useMotionVariants(listVariants)
  const itemVars = useMotionVariants(listItemVariants)

  const suggestedPrompts = [t('chat_suggestion_1'), t('chat_suggestion_2'), t('chat_suggestion_3'), t('chat_suggestion_4')]

  useEffect(() => {
    api.listConversations(token)
      .then((data) => setConversations(data))
      .catch((err) => setError(err.message))
      .finally(() => setConversationsLoaded(true))
  }, [token])

  useEffect(() => {
    if (skipNextScrollAnim.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' })
      skipNextScrollAnim.current = false
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, sending])

  const grouped = useMemo(() => groupByRecency(conversations, t), [conversations, t])

  function startNewChat() {
    setActiveId(null)
    setMessages([])
    setError('')
    setHistoryOpen(false)
    inputRef.current?.focus()
  }

  const openConversation = useCallback(async (id) => {
    if (id === activeId) { setHistoryOpen(false); return }
    setLoadingThread(true)
    setError('')
    try {
      const data = await api.getConversation(token, id)
      skipNextScrollAnim.current = true
      setActiveId(id)
      // Persisted messages never carry an action (see backend comment in
      // conversation_handler.go — actions are re-validated live, not
      // stored) and are already-seen, so they render without the
      // arrival reveal.
      setMessages(data.messages.map((m) => ({ role: m.role, content: m.content, fresh: false })))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingThread(false)
      setHistoryOpen(false)
    }
  }, [activeId, token])

  async function deleteConversation(id) {
    try {
      await api.deleteConversation(token, id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (id === activeId) startNewChat()
    } catch (err) {
      setError(err.message)
    }
  }

  async function send(overrideText) {
    const text = (overrideText ?? input).trim()
    if (!text || sending) return
    setInput('')
    setError('')
    setMessages((prev) => [...prev, { role: 'user', content: text, fresh: true }])
    setSending(true)
    try {
      const res = await api.sendConversationMessage(token, activeId, text)
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply, action: res.action, fresh: true }])

      if (res.conversation_id !== activeId) {
        // First message of a brand-new conversation — it now exists in
        // the database (lazy creation), so add it to the sidebar list.
        setActiveId(res.conversation_id)
        setConversations((prev) => [
          { id: res.conversation_id, title: res.title, updated_at: new Date().toISOString() },
          ...prev,
        ])
      } else {
        // Bump the existing conversation to the top of the list, same as
        // its real updated_at ordering from the backend would.
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === res.conversation_id)
          if (idx <= 0) return prev
          const next = [...prev]
          const [moved] = next.splice(idx, 1)
          return [{ ...moved, updated_at: new Date().toISOString() }, ...next]
        })
      }
    } catch (err) {
      setError(err.message)
      setMessages((prev) => prev.slice(0, -1)) // drop the optimistic user bubble on failure
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

  const historyList = (
    <div className="assistant-history">
      <div className="assistant-history-head">
        <span>{t('assistant_history_title')}</span>
        {isMobile && (
          <button className="icon-menu-btn" onClick={() => setHistoryOpen(false)} aria-label={t('dismiss')}>
            <IconClose />
          </button>
        )}
      </div>

      <button className="assistant-new-chat-btn" onClick={startNewChat}>
        <IconPlus /> {t('assistant_new_chat')}
      </button>

      <div className="assistant-history-list">
        {!conversationsLoaded ? null : conversations.length === 0 ? (
          <p className="assistant-history-empty">{t('assistant_no_conversations')}</p>
        ) : (
          <motion.div variants={listVars} initial="initial" animate="animate">
            {grouped.map((group) => (
              <div className="assistant-history-group" key={group.label}>
                <div className="assistant-history-group-label">{group.label}</div>
                {group.items.map((c) => (
                  <motion.div key={c.id} variants={itemVars} className={`assistant-history-item${c.id === activeId ? ' active' : ''}`}>
                    <button className="assistant-history-item-btn" onClick={() => openConversation(c.id)}>
                      {c.title}
                    </button>
                    <DropdownMenu
                      trigger={<button className="icon-menu-btn assistant-history-item-menu" aria-label={t('company_menu_label')}>⋯</button>}
                      items={[{ label: t('assistant_delete_conversation'), icon: <IconTrash />, danger: true, onSelect: () => deleteConversation(c.id) }]}
                    />
                  </motion.div>
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )

  return (
    <PageLayout padding="flush" restoreScroll={false} className="assistant-page">
      <div className="assistant-workspace">
        {/* Desktop: a permanent rail. Mobile: a drawer, per Phase 4.14. */}
        {!isMobile && historyList}

        {isMobile && (
          <AnimatePresence>
            {historyOpen && (
              <>
                <motion.div className="sidebar-backdrop" variants={backdrop} initial="closed" animate="open" exit="closed" onClick={() => setHistoryOpen(false)} />
                <motion.div className="assistant-history-drawer" variants={drawer} initial="closed" animate="open" exit="closed">
                  {historyList}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        )}

        <div className="assistant-conversation">
          <div className="assistant-conversation-head">
            {isMobile && (
              <button className="icon-menu-btn" onClick={() => setHistoryOpen(true)} aria-label={t('assistant_history_title')}>
                <IconClock />
              </button>
            )}
            <span className="assistant-conversation-title">
              {activeId ? conversations.find((c) => c.id === activeId)?.title || t('chat_nav') : t('chat_nav')}
            </span>
          </div>

          <div className="assistant-messages">
            {loadingThread ? (
              <div className="assistant-thread-loading">{t('assistant_loading_conversation')}</div>
            ) : messages.length === 0 ? (
              <EmptyState
                icon={IconSparkle}
                title={t('chat_empty_title')}
                hint={t('chat_intro')}
                action={
                  <div className="chat-suggestions">
                    {suggestedPrompts.map((p) => (
                      <button key={p} className="chat-suggestion-chip" onClick={() => send(p)}>{p}</button>
                    ))}
                  </div>
                }
              />
            ) : (
              <div className="assistant-message-list">
                {messages.map((m, i) => {
                  const bubble = m.role === 'user' ? (
                    <div className="msg-row msg-row-user"><div className="msg-user">{m.content}</div></div>
                  ) : (
                    <div className="msg-row msg-row-assistant">
                      <div className="msg-assistant-label"><IconSparkle width={12} height={12} /> {t('assistant_label')}</div>
                      <div className="msg-assistant">
                        <AssistantText content={m.content} />
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
                        {m.actionDone && <p className="chat-action-done">{t('chat_action_done')}</p>}
                      </div>
                    </div>
                  )
                  return m.fresh ? (
                    <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.base, ease: easing.out }}>
                      {bubble}
                    </motion.div>
                  ) : <div key={i}>{bubble}</div>
                })}
                {sending && (
                  <div className="msg-row msg-row-assistant">
                    <div className="msg-assistant-label"><IconSparkle width={12} height={12} /> {t('assistant_label')}</div>
                    <div className="msg-assistant chat-typing">
                      <span className="chat-typing-dot" /><span className="chat-typing-dot" /><span className="chat-typing-dot" />
                    </div>
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
        </div>
      </div>
    </PageLayout>
  )
}
