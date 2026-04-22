import React, { useState, useCallback, useRef, useEffect } from "react";

const TOAST_DURATION = 5000;

let addToastGlobal = null;

export function toast(message, type = "error") {
  if (addToastGlobal) addToastGlobal({ message, type });
}

const typeStyles = {
  error: "bg-red-600 text-white",
  success: "bg-green-600 text-white",
  info: "bg-blue-600 text-white",
  warning: "bg-yellow-500 text-white",
};

function ToastItem({ item, onRemove }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(item.id), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [item.id, onRemove]);

  return (
    <div
      className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm animate-slide-in ${
        typeStyles[item.type] || typeStyles.error
      }`}
      role="alert"
    >
      {item.message}
    </div>
  );
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const addToast = useCallback(({ message, type }) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    addToastGlobal = addToast;
    return () => { addToastGlobal = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} item={t} onRemove={removeToast} />
      ))}
    </div>
  );
}
