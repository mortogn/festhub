import MarkdownIT from "markdown-it";

const md = new MarkdownIT({
  html: false,
  linkify: true,
  breaks: true,
});

//* Use dangerously set html to attach the markdown to a container */
const renderMarkdown = (text: string) => {
  return md.render(text);
};

export { md, renderMarkdown };
