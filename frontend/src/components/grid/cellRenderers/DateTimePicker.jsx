import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";

/**
 * AG Grid custom cell editor for datetime fields.
 * Uses HTML5 <input type="datetime-local">.
 *
 * Input:  ISO string ("2026-04-16T11:00:00.000Z") or null
 * Output: ISO string or null
 */
const DateTimeEditor = forwardRef((props, ref) => {
  const toLocalInput = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [value, setValue] = useState(toLocalInput(props.value));
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.showPicker?.();
  }, []);

  useImperativeHandle(ref, () => ({
    getValue() {
      return value ? new Date(value).toISOString() : null;
    },
    isPopup() {
      return false;
    },
  }));

  return (
    <input
      ref={inputRef}
      type="datetime-local"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        outline: "none",
        padding: "0 4px",
        fontSize: "13px",
        fontFamily: "inherit",
        boxSizing: "border-box",
      }}
    />
  );
});

DateTimeEditor.displayName = "DateTimeEditor";

export default DateTimeEditor;
