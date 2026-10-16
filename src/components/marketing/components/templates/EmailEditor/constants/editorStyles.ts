
export const SHARED_EMAIL_CSS = `
  body { margin: 0; padding: 0; min-width: 100%; width: 100% !important; height: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { border-spacing: 0; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; display: block; }
  p { display: block; margin: 0; padding: 0; }
  .ExternalClass { width: 100%; }
  .ExternalClass, .ExternalClass p, .ExternalClass span, .ExternalClass font, .ExternalClass td, .ExternalClass div { line-height: 100%; }
  .ReadMsgBody { width: 100%; background-color: #ffffff; }
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: inherit !important; }
  #MessageViewBody a { color: inherit; text-decoration: none; font-size: inherit; font-family: inherit; font-weight: inherit; line-height: inherit; }

  /* Reset for Editor integration */
  .email-canvas-container p { margin: 0; padding: 0; }
  .email-canvas-container table { border-collapse: collapse; }
  .email-canvas-container a { text-decoration: none; }
`;

export const EDITOR_SPECIFIC_CSS = `
  .email-block-hover {
    outline: 2px solid #2563eb;
    outline-offset: -2px;
  }
  .email-block-selected {
    outline: 2px solid #2563eb;
    outline-offset: -2px;
    z-index: 10;
  }
  .rich-text-editor {
    outline: none;
    min-height: 1em;
  }
  .rich-text-editor:focus {
    background-color: rgba(104, 61, 242, 0.05);
  }
  .rich-text-editor * {
    text-align: inherit;
  }
`;
