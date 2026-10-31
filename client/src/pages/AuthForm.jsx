import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/** Text input with a leading icon. Password fields get a show/hide eye button. */
export function IconField({ id, label, icon: Icon, type = 'text', hint, ...props }) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <Icon size={18} aria-hidden="true" />
        <input id={id} className="input" type={isPassword && show ? 'text' : type} {...props} />
        {isPassword && (
          <button
            type="button"
            className="input-action"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {hint && <small className="muted">{hint}</small>}
    </div>
  );
}
