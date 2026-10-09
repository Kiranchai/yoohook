import Editor, { type Monaco } from "@monaco-editor/react";
import { InlineSpinner } from "@/components/icons";

const FONT = "'IBM Plex Mono', ui-monospace, Menlo, monospace";

function defineTheme(monaco: Monaco) {
  monaco.editor.defineTheme("carbon-g100", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "f4f4f4", background: "161616" },
      { token: "string.key.json", foreground: "78a9ff" },
      { token: "string.value.json", foreground: "6fdc8c" },
      { token: "string", foreground: "6fdc8c" },
      { token: "number", foreground: "ffb784" },
      { token: "keyword", foreground: "be95ff" },
      { token: "delimiter", foreground: "8d8d8d" },
      { token: "comment", foreground: "8d8d8d", fontStyle: "italic" },
      { token: "tag", foreground: "78a9ff" },
      { token: "attribute.name", foreground: "be95ff" },
      { token: "attribute.value", foreground: "6fdc8c" },
    ],
    colors: {
      "editor.background": "#161616",
      "editor.foreground": "#f4f4f4",
      "editor.lineHighlightBackground": "#262626",
      "editor.selectionBackground": "#393939",
      "editor.inactiveSelectionBackground": "#2a2a2a",
      "editorCursor.foreground": "#f4f4f4",
      "editorLineNumber.foreground": "#6f6f6f",
      "editorLineNumber.activeForeground": "#c6c6c6",
      "editorIndentGuide.background1": "#393939",
      "scrollbarSlider.background": "#52525280",
      "scrollbarSlider.hoverBackground": "#6f6f6f80",
      "editorBracketMatch.border": "#8d8d8d",
      "editorBracketMatch.background": "#00000000",
    },
  });
}

export default function CodeEditor({
  value,
  onChange,
  onBlur,
  language,
  height,
  lineNumbers = true,
  invalid = false,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  language: string;
  height: number;
  lineNumbers?: boolean;
  invalid?: boolean;
  label: string;
}) {
  return (
    <div
      aria-label={label}
      className="border-b border-solid"
      style={{ borderColor: invalid ? "#fa4d56" : "#8d8d8d", outline: invalid ? "2px solid #fa4d56" : undefined, outlineOffset: -2 }}
    >
      <Editor
        height={height}
        language={language}
        value={value}
        theme="carbon-g100"
        beforeMount={defineTheme}
        onChange={(v) => onChange(v ?? "")}
        onMount={(editor, monaco) => {
          if (onBlur) editor.onDidBlurEditorText(onBlur);
          editor.addAction({
            id: "format",
            label: "Format",
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
            run: () => editor.getAction("editor.action.formatDocument")?.run(),
          });
        }}
        loading={
          <div className="flex h-full w-full items-center justify-center gap-2 bg-background text-text-secondary">
            <InlineSpinner /> Loading editor…
          </div>
        }
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          lineHeight: 20,
          fontFamily: FONT,
          lineNumbers: lineNumbers ? "on" : "off",
          folding: lineNumbers,
          wordWrap: "on",
          automaticLayout: true,
          padding: { top: 12, bottom: 12 },
          quickSuggestions: false,
          suggestOnTriggerCharacters: false,
          formatOnPaste: true,
          tabSize: 2,
          insertSpaces: true,
          detectIndentation: false,
          renderValidationDecorations: "off",
          renderLineHighlight: lineNumbers ? "gutter" : "none",
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        }}
      />
    </div>
  );
}
