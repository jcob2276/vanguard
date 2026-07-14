import Button from '../ui/Button';
import { ControlInput } from '../ui/ControlPrimitives';
import { Camera, Send, X } from 'lucide-react';
import type { RefObject } from 'react';

interface OracleInputPanelProps {
  input: string;
  setInput: (val: string) => void;
  loading: boolean;
  setFocused: (val: boolean) => void;
  storageScope: 'default' | 'medical';
  pendingImages: File[];
  setPendingImages: React.Dispatch<React.SetStateAction<File[]>>;
  previewUrls: string[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  onAttachImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
}

export function OracleInputPanel({
  input,
  setInput,
  loading,
  setFocused,
  storageScope,
  pendingImages,
  setPendingImages,
  previewUrls,
  fileInputRef,
  inputRef,
  onAttachImage,
  onSubmit,
}: OracleInputPanelProps) {
  return (
    <>
      {/* Pending Images Preview */}
      {pendingImages.length > 0 && (
        <div className="flex gap-2 px-4 py-2 border-t border-border-custom bg-surface-solid/20">
          {pendingImages.map((file, idx) => (
            <div key={`${file.name}-${idx}`} className="relative h-10 w-10 rounded-lg overflow-hidden border border-border-custom group">
              <img src={previewUrls[idx]} alt="" className="h-full w-full object-cover" />
              <Button
                variant="ghost"
                onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== idx))}
                icon={<X size={10} />}
                className="absolute inset-0 rounded-none p-0 min-w-0 bg-scrim/40 opacity-[var(--opacity-100)] sm:opacity-[var(--opacity-0)] sm:group-hover:opacity-[var(--opacity-100)] text-on-accent hover:bg-scrim/40 hover:text-on-accent"
              />
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-border-custom px-4 py-3">
        <label className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-solid border border-border-custom text-text-secondary hover:text-text-primary active:scale-95 transition-all cursor-pointer">
          <Camera size={13} />
          <ControlInput
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onAttachImage}
          />
        </label>
        <ControlInput
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={
            storageScope === 'medical'
              ? 'Co warto badać / odświeżyć u mnie teraz?'
              : 'Jak wygląda mój sen w tym tygodniu?'
          }
          disabled={loading}
          className="flex-1 bg-transparent text-lg font-medium text-text-primary placeholder:text-text-muted/40 outline-none"
        />
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={(!input.trim() && pendingImages.length === 0) || loading}
          icon={<Send size={13} />}
          className="h-8 w-8 shrink-0 rounded-full p-0 min-w-0 shadow-none hover:translate-y-0 disabled:opacity-[var(--opacity-30)]"
        />
      </div>
    </>
  );
}
