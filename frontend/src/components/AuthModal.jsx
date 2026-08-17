import { useState, useRef, useEffect } from "react";
import { X, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "../utils/toast";

// Login / cadastro sobre <dialog> nativo (backdrop, focus-trap e Escape do browser).
// Consome useAuth(); alterna entre entrar e criar conta no mesmo formulário.
export default function AuthModal({ onClose }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const cb = useRef(onClose);
  useEffect(() => { cb.current = onClose; }, [onClose]);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const onCancel = (e) => { e.preventDefault(); cb.current(); };
    d?.addEventListener("cancel", onCancel);
    return () => d?.removeEventListener("cancel", onCancel);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(null); setBusy(true);
    try {
      if (mode === "register") await register(email.trim(), password);
      else await login(email.trim(), password);
      toast(mode === "register" ? "Conta criada!" : "Bem-vindo de volta!");
      onClose();
    } catch (err) {
      setError(err?.message || "Não foi possível conectar ao servidor.");
    } finally {
      setBusy(false);
    }
  };

  const onClick = (e) => {
    const d = ref.current;
    if (!d) return;
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
  };

  return (
    <dialog ref={ref} onClick={onClick} aria-label={mode === "login" ? "Entrar" : "Criar conta"} className="share-dialog pop">
      <form className="p-4" onSubmit={submit}>
        <div className="flex items-center justify-between mb-3">
          <p className="ff-d text-base font-bold">{mode === "login" ? "Entrar" : "Criar conta"}</p>
          <button type="button" onClick={onClose} aria-label="fechar" className="hover:opacity-70">
            <X size={18} className="text-ink-soft" />
          </button>
        </div>

        <label className="ff-b text-xs font-medium text-ink-soft">E-mail</label>
        <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
          placeholder="voce@email.com"
          className="ff-b w-full text-sm rounded-xl border p-2.5 mt-1 mb-3 outline-none border-line bg-canvas text-ink" />

        <label className="ff-b text-xs font-medium text-ink-soft">Senha</label>
        <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="mínimo 8 caracteres"
          className="ff-b w-full text-sm rounded-xl border p-2.5 mt-1 outline-none border-line bg-canvas text-ink" />

        {error && <p className="ff-b text-xs mt-2 text-danger">{error}</p>}

        <button type="submit" disabled={busy}
          className="ff-b mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 bg-primary">
          {mode === "login" ? <LogIn size={16} /> : <UserPlus size={16} />}
          {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
        </button>
        <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
          className="ff-b mt-2 w-full text-center text-xs font-medium transition-all hover:opacity-70 text-primary">
          {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </button>
      </form>
    </dialog>
  );
}
