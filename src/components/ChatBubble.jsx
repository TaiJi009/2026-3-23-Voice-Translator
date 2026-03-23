import { useEffect, useState } from 'react';

export function ChatBubble({
  msg,
  editing,
  onStartEdit,
  onRetranslate,
  onSpeak,
  onCopy,
  onFullscreen,
  onTranslatedClick,
  retranslating,
}) {
  const [draft, setDraft] = useState(msg.original);
  useEffect(() => {
    if (!editing) setDraft(msg.original);
  }, [msg.original, editing]);

  return (
    <div className={`msg-row ${msg.role === 'me' ? 'msg-row--me' : 'msg-row--them'}`}>
      <div className={`bubble ${editing ? 'bubble--editing' : ''}`}>
        <div className="bubble__original">{msg.original}</div>
        <textarea
          className="bubble__edit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="编辑原文"
        />
        <div className="bubble__divider" />
        <div
          className="bubble__translated"
          onClick={onTranslatedClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onTranslatedClick();
            }
          }}
          role="button"
          tabIndex={0}
          title="点击全屏显示译文"
        >
          {msg.translated}
        </div>
        <div className="bubble__actions">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSpeak();
            }}
            aria-label="朗读译文"
          >
            🔊
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
            aria-label="复制译文"
          >
            📋
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFullscreen();
            }}
            aria-label="全屏显示译文"
          >
            ⛶
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStartEdit();
            }}
            aria-label="编辑原文并重译"
          >
            ✏️
          </button>
        </div>
        <button
          type="button"
          className="bubble__retranslate"
          disabled={retranslating}
          onClick={(e) => {
            e.stopPropagation();
            onRetranslate(draft);
          }}
        >
          重新翻译
        </button>
      </div>
    </div>
  );
}
