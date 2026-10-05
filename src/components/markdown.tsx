import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

/** Claude's answers are Markdown. Raw HTML in them is shown as text, never run. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed [&_li>p]:inline">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => (
            <h3 className="font-heading text-base font-semibold" {...props} />
          ),
          h2: (props) => (
            <h3 className="font-heading text-base font-semibold" {...props} />
          ),
          h3: (props) => <h4 className="font-medium" {...props} />,
          ul: (props) => (
            <ul className="flex list-disc flex-col gap-1 pl-5" {...props} />
          ),
          ol: (props) => (
            <ol className="flex list-decimal flex-col gap-1 pl-5" {...props} />
          ),
          a: (props) => (
            <a
              className="underline underline-offset-4"
              target="_blank"
              rel="noreferrer"
              {...props}
            />
          ),
          pre: (props) => (
            <pre
              className="overflow-x-auto rounded-xl bg-muted p-3 font-mono text-xs leading-relaxed [&>code]:bg-transparent [&>code]:p-0"
              {...props}
            />
          ),
          code: (props) => (
            <code
              className="rounded-md bg-muted px-1 py-0.5 font-mono text-[0.85em]"
              {...props}
            />
          ),
          table: (props) => (
            <div className="overflow-x-auto">
              <table
                className="w-full text-left text-sm [&_td]:border-t [&_td]:py-1.5 [&_td]:pr-3 [&_th]:py-1.5 [&_th]:pr-3 [&_th]:font-medium"
                {...props}
              />
            </div>
          ),
          hr: () => <hr className="border-border" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
