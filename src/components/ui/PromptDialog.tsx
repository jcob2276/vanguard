import { useEffect, useState } from 'react';
import { resolvePrompt, subscribePrompt } from '../../lib/notify';
import Button from './Button';
import { ControlInput } from './ControlPrimitives';
import Modal from './Modal';

export default function PromptDialog() {
  const [prompt, setPrompt] = useState({ open: false, message: '', initialValue: '' });
  const [value, setValue] = useState('');

  useEffect(() => subscribePrompt((open, message, initialValue) => {
    setPrompt({ open, message, initialValue });
    setValue(initialValue);
  }), []);

  return (
    <Modal isOpen={prompt.open} onClose={() => resolvePrompt(null)} showCloseButton={false} size="sm" padding="p-5">
      <label className="text-sm font-semibold text-text-primary">
        {prompt.message}
        <ControlInput
          autoFocus
          value={value}
          onChange={event => setValue(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') resolvePrompt(value);
            if (event.key === 'Escape') resolvePrompt(null);
          }}
          className="mt-3 w-full"
        />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => resolvePrompt(null)}>Anuluj</Button>
        <Button variant="primary" size="sm" onClick={() => resolvePrompt(value)}>OK</Button>
      </div>
    </Modal>
  );
}
