import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import FormatStrikethroughIcon from '@mui/icons-material/FormatStrikethrough';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import FormatSizeIcon from '@mui/icons-material/FormatSize';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import HighlightIcon from '@mui/icons-material/Highlight';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

const EditorContainer = styled.div`
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  background: var(--card-background);
  overflow: hidden;
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--gray-50);
  flex-wrap: wrap;
`;

const ToolbarButton = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: ${props => props.$active ? 'var(--primary-color)' : 'transparent'};
  color: ${props => props.$active ? 'var(--text-color-on-primary)' : 'var(--text-color)'};
  cursor: pointer;
  transition: all var(--transition-fast);
  
  &:hover {
    background: ${props => props.$active ? 'var(--primary-dark)' : 'var(--hover-overlay)'};
  }
  
  &:disabled {
    opacity: var(--disabled-opacity);
    cursor: not-allowed;
  }
`;

const ColorPicker = styled.input`
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  background: transparent;
  
  &::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  
  &::-webkit-color-swatch {
    border: none;
    border-radius: var(--radius-sm);
  }
`;

const SizeSelect = styled.select`
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--card-background);
  color: var(--text-color);
  font-size: 12px;
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
  }
`;

const EditorContent = styled.div`
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
  padding: 16px;
  line-height: 1.6;
  color: var(--text-color);
  
  &:focus {
    outline: none;
  }
  
  &:empty:before {
    content: attr(data-placeholder);
    color: var(--text-secondary);
    pointer-events: none;
  }
  
  /* Стили для отформатированного текста */
  .bold {
    font-weight: bold;
  }
  
  .italic {
    font-style: italic;
  }
  
  .underline {
    text-decoration: underline;
  }
  
  .strikethrough {
    text-decoration: line-through;
  }
  
  .highlight {
    background: var(--warning-background);
    padding: 2px 4px;
    border-radius: 4px;
  }
  
  .accent {
    color: var(--primary-color);
    font-weight: 600;
  }
  
  .success {
    color: var(--success-color);
    font-weight: 600;
  }
  
  .warning {
    color: var(--warning-color);
    font-weight: 600;
  }
  
  .error {
    color: var(--error-color);
    font-weight: 600;
  }
  
  .large {
    font-size: 1.2em;
  }
  
  .small {
    font-size: 0.9em;
  }
  
  .emoji {
    font-size: 1.2em;
  }
`;

const EmojiPanel = styled.div<{ $visible: boolean }>`
  position: absolute;
  top: 100%;
  left: 0;
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 8px;
  display: ${props => props.$visible ? 'grid' : 'none'};
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  z-index: 1000;
  box-shadow: var(--shadow-md);
`;

const EmojiButton = styled.button`
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: var(--hover-overlay);
  }
`;

const RichTextEditor: React.FC<RichTextEditorProps> = ({ 
  value, 
  onChange, 
  placeholder = "Введите описание конкурса...",
  readOnly = false 
}) => {
  const [isEmojiPanelVisible, setIsEmojiPanelVisible] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#FF5F1F');
  const [selectedSize, setSelectedSize] = useState('normal');
  const editorRef = useRef<HTMLDivElement>(null);
  const emojiPanelRef = useRef<HTMLDivElement>(null);

  const emojis = [
    '🎉', '🏆', '💰', '🔥', '⭐', '💪', '🚀', '✨',
    '🎯', '🎊', '💎', '🌟', '💯', '🎪', '🎨', '🎭',
    '🎪', '🎯', '🎲', '🎮', '🎸', '🎹', '🎺', '🎻',
    '🎤', '🎧', '🎵', '🎶', '🎼', '🎹', '🎺', '🎻'
  ];

  useEffect(() => {
    if (editorRef.current) {
      // Обрабатываем переносы строк для отображения
      const processedValue = value.replace(/\n/g, '<br>');
      editorRef.current.innerHTML = processedValue;
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPanelRef.current && !emojiPanelRef.current.contains(event.target as Node)) {
        setIsEmojiPanelVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const execCommand = (command: string, value?: string) => {
    if (readOnly) return;
    
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    updateValue();
  };

  const updateValue = () => {
    if (editorRef.current) {
      // Конвертируем <br> обратно в \n для сохранения
      const htmlContent = editorRef.current.innerHTML;
      const processedContent = htmlContent.replace(/<br\s*\/?>/gi, '\n');
      onChange(processedContent);
    }
  };

  const insertEmoji = (emoji: string) => {
    if (readOnly) return;
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      span.className = 'emoji';
      span.textContent = emoji;
      range.deleteContents();
      range.insertNode(span);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      updateValue();
    }
    setIsEmojiPanelVisible(false);
  };

  const applyStyle = (style: string) => {
    if (readOnly) return;
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (!range.collapsed) {
        const span = document.createElement('span');
        span.className = style;
        range.surroundContents(span);
        updateValue();
      }
    }
  };

  const applyColor = () => {
    if (readOnly) return;
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (!range.collapsed) {
        const span = document.createElement('span');
        span.style.color = selectedColor;
        range.surroundContents(span);
        updateValue();
      }
    }
  };

  const applySize = () => {
    if (readOnly) return;
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (!range.collapsed) {
        const span = document.createElement('span');
        span.className = selectedSize;
        range.surroundContents(span);
        updateValue();
      }
    }
  };

  return (
    <EditorContainer>
      {!readOnly && (
        <Toolbar>
          <ToolbarButton onClick={() => execCommand('bold')} title="Жирный">
            <FormatBoldIcon fontSize="small" />
          </ToolbarButton>
          
          <ToolbarButton onClick={() => execCommand('italic')} title="Курсив">
            <FormatItalicIcon fontSize="small" />
          </ToolbarButton>
          
          <ToolbarButton onClick={() => execCommand('underline')} title="Подчеркнутый">
            <FormatUnderlinedIcon fontSize="small" />
          </ToolbarButton>
          
          <ToolbarButton onClick={() => execCommand('strikeThrough')} title="Зачеркнутый">
            <FormatStrikethroughIcon fontSize="small" />
          </ToolbarButton>
          
          <ToolbarButton onClick={() => applyStyle('highlight')} title="Выделить">
            <HighlightIcon fontSize="small" />
          </ToolbarButton>
          
          <ToolbarButton onClick={() => applyStyle('accent')} title="Акцент">
            <FormatColorFillIcon fontSize="small" />
          </ToolbarButton>
          
          <ToolbarButton onClick={() => applyStyle('success')} title="Успех">
            <span style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>✓</span>
          </ToolbarButton>
          
          <ToolbarButton onClick={() => applyStyle('warning')} title="Предупреждение">
            <span style={{ color: 'var(--warning-color)', fontWeight: 'bold' }}>⚠</span>
          </ToolbarButton>
          
          <ToolbarButton onClick={() => applyStyle('error')} title="Ошибка">
            <span style={{ color: 'var(--error-color)', fontWeight: 'bold' }}>✗</span>
          </ToolbarButton>
          
          <ColorPicker
            type="color"
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
            onClick={applyColor}
            title="Цвет текста"
          />
          
          <SizeSelect value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)} onClick={applySize}>
            <option value="normal">Обычный</option>
            <option value="large">Большой</option>
            <option value="small">Маленький</option>
          </SizeSelect>
          
          <div style={{ position: 'relative' }} ref={emojiPanelRef}>
            <ToolbarButton 
              onClick={() => setIsEmojiPanelVisible(!isEmojiPanelVisible)}
              title="Эмодзи"
            >
              <EmojiEmotionsIcon fontSize="small" />
            </ToolbarButton>
            
            <EmojiPanel $visible={isEmojiPanelVisible}>
              {emojis.map((emoji, index) => (
                <EmojiButton
                  key={index}
                  onClick={() => insertEmoji(emoji)}
                  title={emoji}
                >
                  {emoji}
                </EmojiButton>
              ))}
            </EmojiPanel>
          </div>
        </Toolbar>
      )}
      
      <EditorContent
        ref={editorRef}
        contentEditable={!readOnly}
        onInput={updateValue}
        onBlur={updateValue}
        data-placeholder={readOnly ? undefined : placeholder}
        suppressContentEditableWarning={true}
      />
    </EditorContainer>
  );
};

export default RichTextEditor; 