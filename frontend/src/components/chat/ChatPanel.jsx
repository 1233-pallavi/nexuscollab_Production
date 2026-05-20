import { useState, useRef, useEffect, useCallback } from 'react';
import useRoomStore from '../../store/roomStore';
import useAuthStore from '../../store/authStore';
import styles from './ChatPanel.module.css';

const formatTime = (ts) => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ChatPanel = ({ onSend, onTyping }) => {
  const [input, setInput] = useState('');
  const { messages, typingUsers } = useRoomStore();
  const { user } = useAuthStore();
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleTyping = (e) => {
    setInput(e.target.value);
    onTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => onTyping(false), 1500);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
    onTyping(false);
    clearTimeout(typingTimeout.current);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>No messages yet. Say hello! 👋</div>
        )}
        {messages.map((msg, i) => {
          const isOwn = msg.sender?._id === user?._id || msg.sender === user?._id;
          const isSystem = msg.type === 'system';

          if (isSystem) {
            return (
              <div key={i} className={styles.systemMsg}>
                {msg.content}
              </div>
            );
          }

          return (
            <div key={i} className={`${styles.message} ${isOwn ? styles.own : ''}`}>
              {!isOwn && (
                <div className={styles.avatar}>
                  {(msg.senderName || msg.sender?.username || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className={styles.bubble}>
                {!isOwn && (
                  <span className={styles.senderName}>
                    {msg.senderName || msg.sender?.username}
                  </span>
                )}
                <p className={styles.text}>{msg.content}</p>
                <span className={styles.time}>{formatTime(msg.timestamp)}</span>
              </div>
            </div>
          );
        })}

        {typingUsers.length > 0 && (
          <div className={styles.typing}>
            <span>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing</span>
            <span className={styles.dots}>
              <span></span><span></span><span></span>
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputArea}>
        <textarea
          className={styles.input}
          value={input}
          onChange={handleTyping}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send)"
          rows={1}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!input.trim()}
        >
          ➤
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;
