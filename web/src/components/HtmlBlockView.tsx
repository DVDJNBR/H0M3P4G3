import React, { useEffect, useRef, useState } from 'react';

interface HtmlBlockViewProps {
  content: string;
}

const HEIGHT_MESSAGE_TYPE = 'h0m3p4g3-html-block-height';

// The iframe's own script measures its content after `load` and on every
// resize, then posts the height back -- this is the only way to size the
// iframe to fit content of unknown/variable height without ever polling.
function buildSrcDoc(content: string) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>html, body { margin: 0; padding: 0; }</style>
</head>
<body>
${content}
<script>
  (function () {
    function reportHeight() {
      parent.postMessage(
        { type: '${HEIGHT_MESSAGE_TYPE}', height: document.documentElement.scrollHeight },
        '*',
      );
    }
    window.addEventListener('load', reportHeight);
    new ResizeObserver(reportHeight).observe(document.body);
  })();
</script>
</body>
</html>`;
}

export const HtmlBlockView: React.FC<HtmlBlockViewProps> = ({ content }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(40);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type !== HEIGHT_MESSAGE_TYPE) return;
      setHeight(Math.max(20, event.data.height));
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={buildSrcDoc(content)}
      sandbox="allow-scripts allow-same-origin"
      title="Bloc HTML personnalisé"
      style={{ width: '100%', height, border: 'none', display: 'block' }}
      className="rounded-lg"
    />
  );
};
