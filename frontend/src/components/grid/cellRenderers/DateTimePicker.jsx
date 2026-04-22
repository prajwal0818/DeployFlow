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
  // Convert ISO UTC string to "YYYY-MM-DDTHH:mm" format in UTC
  // so the user edits in UTC and no timezone shift occurs on save.
  const toUtcInput = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  };

  const [value, setValue] = useState(toUtcInput(props.value));
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.showPicker?.();
  }, []);

  useImperativeHandle(ref, () => ({
    getValue() {
      // The input value is in UTC — append "Z" to ensure correct parsing
      return value ? new Date(value + "Z").toISOString() : null;
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
