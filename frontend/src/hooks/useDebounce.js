import { useRef, useCallback } from "react";

export function useDebounce(fn, delay = 400) {
  const timer = useRef(null);

  return useCallback(
    (...args) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => fn(...args), delay);
    },
    [fn, delay]
  );
}
