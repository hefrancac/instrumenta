import { Component } from "react";

// Evita a "tela branca": se algum render quebrar, mostra uma tela amigável.
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("Instrumenta crash:", error, info); }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, fontFamily: "Inter, system-ui, sans-serif", background: "#F1F5F4", color: "#0C2B29" }}>
        <div style={{ maxWidth: 360, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🦷</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Algo deu errado</h1>
          <p style={{ fontSize: 14, color: "#516360", marginBottom: 16 }}>
            Tivemos um problema ao mostrar esta tela. Recarregue para tentar de novo.
          </p>
          <button
            onClick={() => { try { localStorage.removeItem("instrumenta:list"); } catch { /* ignore */ } window.location.href = window.location.pathname; }}
            style={{ background: "#0B6E5F", color: "#fff", border: "none", padding: "10px 20px",
              borderRadius: 12, fontWeight: 600, cursor: "pointer" }}>
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
