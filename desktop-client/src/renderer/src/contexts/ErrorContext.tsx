import  { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface ErrorContextType {
  showError: (message: string, consoleMsg?: any) => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) throw new Error("useError must be used within an ErrorProvider");
  return context;
};

export const ErrorProvider = ({ children }: { children: ReactNode }) => {
  const [error, setError] = useState<string | null>(null);

  const showError = useCallback((message: string, consoleMsg?: any) => {
    setError(message);
    console.log(message, "extra:" , consoleMsg);
    setTimeout(() => setError(null), 4000);
  }, []);

  return (
    <ErrorContext.Provider value={{ showError }}>
      {children}
      {error && <ErrorCard message={error} />}
    </ErrorContext.Provider>
  );
};

const ErrorCard = ({ message }: { message: string }) => {
  const [visible, setVisible] = useState(true);
  const [hover, setHover] = useState(false);
  if (!visible) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        background: "#f87171",
        color: "white",
        padding: "16px 24px",
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        zIndex: 9999,
        minWidth: 280,
        fontWeight: 500,
        fontSize: 16,
        transition: "opacity 0.3s",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={() => setVisible(false)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          background: hover ? "rgba(255,255,255,0.15)" : "transparent",
          border: "none",
          color: hover ? "#fee2e2" : "white",
          fontSize: 20,
          cursor: "pointer",
          marginLeft: 8,
          borderRadius: 4,
          padding: "2px 8px",
          transition: "background 0.2s, color 0.2s"
        }}
        aria-label="Close error dialog"
      >
        ×
      </button>
    </div>
  );
};
