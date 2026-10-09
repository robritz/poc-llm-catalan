import Markdown, { type ExtraProps } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

// A model often breaks lines without leaving a blank line between them.
const REMARK_PLUGINS = [remarkGfm, remarkBreaks];

// Links in a reply open in a new tab so the conversation isn't lost.
function ReplyLink({ node, ...props }: React.ComponentProps<"a"> & ExtraProps) {
  void node; // react-markdown's syntax node, not an attribute
  const external = !props.href?.startsWith("#");
  return <a {...props} {...(external && { target: "_blank", rel: "noopener noreferrer" })} />;
}

// The text of a reply, formatted. It is shown the same way in the
// conversation and among the saved exchanges.
export default function Reply({ text }: { text: string }) {
  return (
    // Images are dropped: a reply must not make the browser fetch a URL.
    <Markdown remarkPlugins={REMARK_PLUGINS} components={{ a: ReplyLink }} disallowedElements={["img"]}>
      {text}
    </Markdown>
  );
}
