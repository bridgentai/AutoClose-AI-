import { useRef, useEffect, useState } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Type,
  Heading1,
  Heading2,
  Heading3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface DocumentEditorProps {
  content: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
  className?: string;
}

export function DocumentEditor({ content, onChange, readOnly = false, className = '' }: DocumentEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (editorRef.current && !readOnly) {
      // Solo actualizar si el contenido es diferente para evitar perder el foco
      if (editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content || '';
      }
    }
  }, [content, readOnly]);

  const executeCommand = (command: string, value?: string) => {
    if (!editorRef.current) return;
    
    // Guardar la posición del cursor
    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    const savedRange = range?.cloneRange();
    
    document.execCommand(command, false, value);
    
    // Restaurar foco
    editorRef.current.focus();
    
    // Restaurar selección si existe
    if (savedRange && selection) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
    }
    
    // Actualizar contenido
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+B para negrita
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault();
      executeCommand('bold');
    }
    // Ctrl+I para cursiva
    if (e.ctrlKey && e.key === 'i') {
      e.preventDefault();
      executeCommand('italic');
    }
    // Ctrl+U para subrayado
    if (e.ctrlKey && e.key === 'u') {
      e.preventDefault();
      executeCommand('underline');
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  if (readOnly) {
    return (
      <div className={cn("document-viewer-container", className)}>
        <div 
          className="document-viewer bg-gradient-to-br from-[#0a0a0c] via-[#1a001c] to-[#3d0045] border border-white/10 rounded-lg overflow-hidden"
          style={{
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {/* Simulación de página Word con márgenes */}
          <div className="p-8 overflow-y-auto max-h-[600px]">
            <div 
              className="document-content mx-auto"
              style={{
                maxWidth: '8.5in',
                minHeight: '11in',
                padding: '1in',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                boxShadow: '0 0 30px rgba(159, 37, 184, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
                borderRadius: '2px',
              }}
            >
              <div
                style={{
                  fontFamily: 'Inter, sans-serif',
                  lineHeight: '1.8',
                  fontSize: '16px',
                  color: '#ffffff',
                }}
                dangerouslySetInnerHTML={{ 
                  __html: content || '<p style="color: rgba(255, 255, 255, 0.6); text-align: center; margin-top: 2rem;">No hay contenido disponible.</p>' 
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col document-editor-container", className)}>
      {/* Toolbar estilo Word */}
      <div className="bg-gradient-to-r from-[#1a001c] to-[#3d0045] border border-white/10 rounded-t-lg p-2 flex items-center gap-1 flex-wrap shadow-lg">
        {/* Formato de texto */}
        <div className="flex items-center gap-1 border-r border-white/20 pr-2 mr-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => executeCommand('formatBlock', 'h1')}
            className="h-8 w-8 p-0 text-white hover:bg-[#9f25b8]/20 hover:text-[#c66bff] transition-colors"
            title="Título 1"
          >
            <Heading1 className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => executeCommand('formatBlock', 'h2')}
            className="h-8 w-8 p-0 text-white hover:bg-[#9f25b8]/20 hover:text-[#c66bff] transition-colors"
            title="Título 2"
          >
            <Heading2 className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => executeCommand('formatBlock', 'h3')}
            className="h-8 w-8 p-0 text-white hover:bg-[#9f25b8]/20 hover:text-[#c66bff] transition-colors"
            title="Título 3"
          >
            <Heading3 className="w-4 h-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6 bg-white/20 mx-1" />
        
        {/* Estilos de texto */}
        <div className="flex items-center gap-1 border-r border-white/20 pr-2 mr-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => executeCommand('bold')}
            className="h-8 w-8 p-0 text-white hover:bg-[#9f25b8]/20 hover:text-[#c66bff] transition-colors"
            title="Negrita (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => executeCommand('italic')}
            className="h-8 w-8 p-0 text-white hover:bg-[#9f25b8]/20 hover:text-[#c66bff] transition-colors"
            title="Cursiva (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => executeCommand('underline')}
            className="h-8 w-8 p-0 text-white hover:bg-[#9f25b8]/20 hover:text-[#c66bff] transition-colors"
            title="Subrayado (Ctrl+U)"
          >
            <Underline className="w-4 h-4" />
          </Button>
        </div>
        
        <Separator orientation="vertical" className="h-6 bg-white/20 mx-1" />
        
        {/* Listas */}
        <div className="flex items-center gap-1 border-r border-white/20 pr-2 mr-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => executeCommand('insertUnorderedList')}
            className="h-8 w-8 p-0 text-white hover:bg-[#9f25b8]/20 hover:text-[#c66bff] transition-colors"
            title="Lista con viñetas"
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => executeCommand('insertOrderedList')}
            className="h-8 w-8 p-0 text-white hover:bg-[#9f25b8]/20 hover:text-[#c66bff] transition-colors"
            title="Lista numerada"
          >
            <ListOrdered className="w-4 h-4" />
          </Button>
        </div>
        
        <Separator orientation="vertical" className="h-6 bg-white/20 mx-1" />
        
        {/* Alineación */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => executeCommand('justifyLeft')}
            className="h-8 w-8 p-0 text-white hover:bg-[#9f25b8]/20 hover:text-[#c66bff] transition-colors"
            title="Alinear izquierda"
          >
            <AlignLeft className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => executeCommand('justifyCenter')}
            className="h-8 w-8 p-0 text-white hover:bg-[#9f25b8]/20 hover:text-[#c66bff] transition-colors"
            title="Centrar"
          >
            <AlignCenter className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => executeCommand('justifyRight')}
            className="h-8 w-8 p-0 text-white hover:bg-[#9f25b8]/20 hover:text-[#c66bff] transition-colors"
            title="Alinear derecha"
          >
            <AlignRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Editor con diseño tipo Word */}
      <div 
        className={cn(
          "bg-gradient-to-br from-[#0a0a0c] via-[#1a001c] to-[#3d0045] border-x border-b border-white/10 rounded-b-lg overflow-y-auto transition-all",
          isFocused && "ring-2 ring-[#9f25b8]/50"
        )}
        style={{ minHeight: '500px', maxHeight: '70vh' }}
      >
        <div className="p-8">
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="document-editor focus:outline-none"
            style={{
              fontFamily: 'Inter, sans-serif',
              lineHeight: '1.8',
              fontSize: '16px',
              color: '#ffffff',
              maxWidth: '8.5in',
              margin: '0 auto',
              padding: '1in',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              minHeight: '11in',
              boxShadow: '0 0 30px rgba(159, 37, 184, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
              borderRadius: '2px',
            }}
            data-placeholder="Comienza a escribir tu documento aquí..."
            suppressContentEditableWarning
          />
        </div>
      </div>
    </div>
  );
}
